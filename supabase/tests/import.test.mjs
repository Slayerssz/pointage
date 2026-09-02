// Rejoue l'import sur une base neuve : le schéma réel, quelques employés
// déjà en place, puis les trois scripts dans l'ordre.
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'

const RACINE = '/Users/adambenslama/1 WORK/pointage-claude-groupe-triple-a-pointage-cu7q2i/supabase'
const db = new PGlite()
let P = 0, F = 0
const ok = (n, c, d = '') => { c ? (P++, console.log('  ✓ ' + n)) : (F++, console.log('  ✗ ' + n + (d ? '  → ' + d : ''))) }
const q1 = async (s, p = []) => (await db.query(s, p)).rows[0]

/**
 * Découpe un script en instructions, en respectant les blocs $bloc$…$bloc$.
 * L'éditeur SQL de Supabase exécute les instructions une par une : les
 * scripts d'import doivent tenir sous ce régime, pas seulement en bloc.
 */
function instructions(sql) {
  const out = []
  let cur = '', i = 0, tag = null
  while (i < sql.length) {
    if (!tag) {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i))
      if (m) { tag = m[0]; cur += tag; i += tag.length; continue }
      if (sql[i] === ';') { out.push(cur.trim()); cur = ''; i++; continue }
    } else if (sql.startsWith(tag, i)) {
      cur += tag; i += tag.length; tag = null; continue
    }
    cur += sql[i++]
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter((x) => x && !/^(--|\s)*$/.test(x))
}

/** Rejoue un script comme le ferait l'éditeur Supabase : une par une. */
async function jouerScript(fichier) {
  const sql = fs.readFileSync(path.join(RACINE, 'mise_a_jour', fichier), 'utf8')
  for (const st of instructions(sql)) {
    try { await db.query(st) }
    catch (e) { throw new Error(`${fichier} — ${e.message}\n   sur : ${st.slice(0, 120)}`) }
  }
}
const rows = async (s, p = []) => (await db.query(s, p)).rows

await db.exec(`
create schema if not exists auth; create schema if not exists extensions;
create schema if not exists storage;
create or replace function extensions.gen_salt(t text) returns text language sql immutable as $f$ select 'sel'; $f$;
create or replace function extensions.crypt(pw text, s text) returns text language sql immutable as $f$ select md5(pw); $f$;
create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text,
  email_change_token_new text, email_change text, banned_until timestamptz);
create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('test.uid', true), '')::uuid; $f$;
create role authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;`)

const BASE = ['001_schema.sql','002_rls.sql','007_ameliorations.sql','008_details_paie.sql',
              '012_role_admin.sql','013_admin_fonctions.sql','014_types_garde.sql']
for (const f of BASE) {
  let sql = fs.readFileSync(path.join(RACINE, 'migrations', f), 'utf8')
  if (f === '007_ameliorations.sql') { const c = sql.indexOf('do $$'); if (c > 0) sql = sql.slice(0, c) }
  await db.exec(sql)
}
for (const b of ['BLOC_1_paie_contrats.sql','BLOC_2_role_paie.sql','BLOC_3_droits_verrouillage.sql',
  'BLOC_4_SECURITE_URGENT.sql','BLOC_5_gestion_comptes.sql','BLOC_6_supprimer_employe.sql',
  'BLOC_7_sites_principaux.sql','BLOC_8_dossier_employe.sql','BLOC_9_dette_simple.sql',
  'BLOC_10_role_personnel.sql','BLOC_11_personnel_departement.sql','BLOC_12_matricule.sql',
  'BLOC_13_verrou_analytics.sql','BLOC_14_analytics_paie.sql','BLOC_15_bulletin_paie.sql'])
  await db.exec(fs.readFileSync(path.join(RACINE, 'mise_a_jour', b), 'utf8'))

for (const t of ['companies','sites','employees','profiles','pointages','sites_principaux'])
  await db.exec(`alter table public.${t} disable row level security;`)

// ── L'état de départ : les dix sociétés, et quelques employés déjà saisis
console.log('\n  ── Base de départ ──────────────────────────────────────')
const SOC = ['EDEN VERT SERVICE','AL SAFAE EL MAGHREB','GROUPE TRIPLE A','BO','TRIMAX',
             'VIGILMA GARD MAROC','DUO MULTI SERVICE','NORD PLANET','SERCLEAN NEGOCE','MEGANTER SERVICE MAROC']
for (const s of SOC) await db.query(`insert into public.companies(name) values ($1)`, [s])
const idCo = async (n) => (await q1(`select id from public.companies where name=$1`, [n])).id

const coBO = await idCo('BO'), coDuo = await idCo('DUO MULTI SERVICE')
const sBO = (await q1(`insert into public.sites(company_id,name) values ($1,'ANCIEN SITE') returning id`, [coBO])).id
const sDuo = (await q1(`insert into public.sites(company_id,name) values ($1,'SITE DUO') returning id`, [coDuo])).id

// a) quelqu'un qui est sur l'état, avec le bon C.I.N. mais au mauvais site
const dejaLa = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom,cin,salaire,jours_travailles,ville,adresse)
   values ($1,$2,'TRIBAK RAHMA','K188284',4200,17,'TANGER','ANCIENNE ADRESSE COMPLETE') returning id`,
  [coBO, sBO])).id
// b) quelqu'un déjà sorti qui reparaît sur l'état
const revenu = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom,cin,date_sortie)
   values ($1,$2,'TAHIRI ZOHAIR','GB196891','2026-01-31') returning id`, [coBO, sBO])).id
// c) quelqu'un qui n'est sur aucun état
const absent = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom,cin)
   values ($1,$2,'FANTOME INCONNU','ZZ999999') returning id`, [coBO, sBO])).id
// d) un absent qui figure DÉJÀ dans une paie : à sortir, jamais à supprimer
const absentAvecPaie = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom,cin)
   values ($1,$2,'ANCIEN PAYE','ZZ111111') returning id`, [coBO, sBO])).id

// e) un employé d'une société sans état : il ne doit surtout pas bouger
const horsLot = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom,cin)
   values ($1,$2,'DUO PERSONNE','YY888888') returning id`, [coDuo, sDuo])).id

// on lui fabrique une période de paie et une ligne, comme en production
const per = (await q1(
  `insert into public.periodes_paie(company_id,annee,mois,statut,jours_base)
   values ($1,2025,12,'paie_validee',26) returning id`, [coBO])).id
await db.query(
  `insert into public.lignes_paie(periode_id,employee_id,nom_prenom,salaire_base,net_a_payer)
   values ($1,$2,'ANCIEN PAYE',4000,4000)`, [per, absentAvecPaie])

const avant = Number((await q1(`select count(*) as c from public.employees`)).c)
ok(`base de départ : ${avant} employés, ${SOC.length} sociétés`, avant === 5)

// ── 1. L'aperçu ne doit rien changer
console.log('\n  ── 1. Aperçu ───────────────────────────────────────────')
await jouerScript('IMPORT_1_apercu.sql')
ok('l’aperçu ne modifie aucun employé',
   Number((await q1(`select count(*) as c from public.employees`)).c) === avant)
ok('l’aperçu ne crée aucun site',
   Number((await q1(`select count(*) as c from public.sites`)).c) === 2)

// ── 2. L'application
console.log('\n  ── 2. Application ──────────────────────────────────────')
await jouerScript('IMPORT_2_appliquer.sql')

const apres = Number((await q1(`select count(*) as c from public.employees`)).c)
// 544 sur les états ; 3 étaient déjà en base et sont rapprochés (a, b et
// un troisième non — a et b seulement), + les 2 non rapprochés conservés.
ok(`544 employés importés (${apres} en base au total)`, apres === 544 + 3, String(apres))

const t = await q1(`select e.*, s.name as site, co.name as societe
                      from public.employees e
                      join public.sites s on s.id=e.site_id
                      join public.companies co on co.id=e.company_id
                     where e.id=$1`, [dejaLa])
ok('l’employé déjà présent a changé de site', t.site === 'ECONOMAT', t.site)
ok('… il est resté chez BO', t.societe === 'BO', t.societe)
ok('… son C.N.S.S. a été renseigné', t.cnss === null || t.cnss !== '', String(t.cnss))
ok('… son département vient de l’état', t.departement === 'NETTOYAGE', String(t.departement))
ok('… son salaire n’a PAS été touché', Number(t.salaire) === 4200, String(t.salaire))
ok('… ses gardes travaillées n’ont PAS été touchées', Number(t.jours_travailles) === 17)
ok('… son adresse complète n’a pas été écrasée par la version tronquée',
   t.adresse === 'ANCIENNE ADRESSE COMPLETE', String(t.adresse))

const r = await q1(`select * from public.employees where id=$1`, [revenu])
ok('l’employé sorti qui reparaît est remis en poste', r.actif === true && r.date_sortie === null,
   `actif=${r.actif} sortie=${r.date_sortie}`)

const f = await q1(`select * from public.employees where id=$1`, [absent])
ok('l’employé absent des états n’est pas touché', f.actif === true && f.nom_prenom === 'FANTOME INCONNU')

const h = await q1(`select e.*, co.name as societe from public.employees e
                    join public.companies co on co.id=e.company_id where e.id=$1`, [horsLot])
ok('un employé d’une société sans état ne bouge pas',
   h.societe === 'DUO MULTI SERVICE' && h.actif === true)

// Les effectifs par société doivent coller aux totaux des PDF
const attendu = { 'BO': 66, 'AL SAFAE EL MAGHREB': 51, 'EDEN VERT SERVICE': 161,
  'GROUPE TRIPLE A': 104, 'NORD PLANET': 7, 'SERCLEAN NEGOCE': 5, 'TRIMAX': 67,
  'VIGILMA GARD MAROC': 83 }
const parCo = await rows(`select co.name, count(*)::int as n from public.employees e
                          join public.companies co on co.id=e.company_id
                          group by co.name`)
let effOk = true
for (const [nom, n] of Object.entries(attendu)) {
  const trouve = parCo.find((x) => x.name === nom)?.n ?? 0
  // BO porte en plus les deux fiches d'essai restées en base :
  // le « fantôme » et l'ancien salarié déjà passé en paie
  const cible = nom === 'BO' ? n + 2 : n
  if (trouve !== cible) { effOk = false; console.log(`      ${nom}: ${trouve} au lieu de ${cible}`) }
}
ok('les effectifs par société correspondent aux totaux des PDF', effOk)

ok('aucun doublon de matricule dans une société',
   (await rows(`select company_id, matricule from public.employees
                 where matricule is not null
                 group by company_id, matricule having count(*)>1`)).length === 0)
ok('tout le monde a un matricule',
   Number((await q1(`select count(*) as c from public.employees where matricule is null`)).c) === 0)
ok('le compteur de matricules est au-dessus du plus grand attribué',
   Number((await q1(`select dernier from public.matricule_compteur`)).dernier) >=
   Number((await q1(`select max(matricule) as m from public.employees`)).m))
ok('les virements sont majoritaires (408 sur les états)',
   Number((await q1(`select count(*) as c from public.employees where mode_reglement='Virement'`)).c) >= 408)
ok('les sites ont été créés',
   Number((await q1(`select count(*) as c from public.sites`)).c) > 90,
   String((await q1(`select count(*) as c from public.sites`)).c))

// ── 3. Relancer l'import ne doit rien dupliquer
console.log('\n  ── 3. Idempotence ──────────────────────────────────────')
await jouerScript('IMPORT_2_appliquer.sql')
ok('relancer l’import ne crée aucun doublon',
   Number((await q1(`select count(*) as c from public.employees`)).c) === apres,
   String((await q1(`select count(*) as c from public.employees`)).c))
ok('… ni aucun site en double',
   (await rows(`select company_id, upper(trim(name)) n from public.sites
                 group by 1,2 having count(*)>1`)).length === 0)

// ── 4. La suppression des absents
console.log('\n  ── 4. Suppression des absents ──────────────────────────')
await jouerScript('IMPORT_3_supprimer_absents.sql')

ok('l’absent sans historique est supprimé',
   (await rows(`select 1 from public.employees where id=$1`, [absent])).length === 0)

// Même celui qui figurait dans une paie : la base ne porte que du jeu d'essai,
// la suppression est demandée sans exception.
ok('l’absent qui figurait dans une paie est supprimé lui aussi',
   (await rows(`select 1 from public.employees where id=$1`, [absentAvecPaie])).length === 0)
ok('… sa ligne de paie est partie en cascade',
   Number((await q1(`select count(*) as c from public.lignes_paie where employee_id=$1`,
                    [absentAvecPaie])).c) === 0)

ok('l’employé de DUO (société sans état) n’est ni supprimé ni sorti',
   (await q1(`select actif from public.employees where id=$1`, [horsLot]))?.actif === true)

ok('il ne reste QUE les 544 des états (plus l’employé de Duo)',
   Number((await q1(`select count(*) as c from public.employees`)).c) === 544 + 1,
   String((await q1(`select count(*) as c from public.employees`)).c))

// Le registre des huit sociétés fournies = exactement les états reçus
const effectifs = await rows(
  `select co.name, count(*) filter (where e.actif)::int as n
     from public.employees e join public.companies co on co.id=e.company_id
    where co.name in ('BO','AL SAFAE EL MAGHREB','EDEN VERT SERVICE','GROUPE TRIPLE A',
                      'NORD PLANET','SERCLEAN NEGOCE','TRIMAX','VIGILMA GARD MAROC')
    group by co.name`)
let exact = true
for (const [nom, n] of Object.entries(attendu)) {
  const trouve = effectifs.find((x) => x.name === nom)?.n ?? 0
  if (trouve !== n) { exact = false; console.log(`      ${nom}: ${trouve} en poste au lieu de ${n}`) }
}
ok('après suppression, chaque société a EXACTEMENT l’effectif de son état', exact)

ok('les pointages de l’employé supprimé sont partis avec lui',
   Number((await q1(`select count(*) as c from public.pointages where employee_id=$1`, [absent])).c) === 0)

ok('la table de travail est protégée par RLS',
   (await q1(`select relrowsecurity as r from pg_class where relname='import_etat'`))?.r === true)
await db.exec(`drop view if exists public.import_rapprochement; drop table if exists public.import_etat;`)
ok('le ménage supprime bien la table de travail',
   (await rows(`select 1 from pg_class where relname='import_etat'`)).length === 0)

console.log('\n' + '═'.repeat(66))
console.log(F === 0 ? `  ✅  ${P} vérifications, toutes réussies` : `  ❌  ${F} échec(s) sur ${P + F}`)
console.log('═'.repeat(66))
process.exit(F ? 1 : 0)
