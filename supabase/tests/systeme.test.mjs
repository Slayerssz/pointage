/**
 * TEST COMPLET DU SYSTÈME
 *
 * Rejoue, dans un PostgreSQL embarqué (PGlite), exactement ce que vous
 * exécutez dans Supabase : les migrations d'origine, puis les BLOCS 1 à 11
 * du dossier `supabase/mise_a_jour`. Puis déroule le système de bout en
 * bout : rôles, sécurité, pointage, contrats, congés, paie, comptes.
 *
 *   npm run test:db
 *
 * Aucune base réelle n'est touchée.
 */
process.on('uncaughtException', (e) => {
  console.log('\n💥 ERREUR NON RATTRAPÉE : ' + e.message)
  process.exit(1)
})

import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS = path.join(ICI, '..', 'migrations')
const BLOCS = path.join(ICI, '..', 'mise_a_jour')

const db = new PGlite()
let P = 0, F = 0
const echecs = []

function ok(nom, condition, detail = '') {
  if (condition) { P++; console.log('    ✓ ' + nom) }
  else { F++; echecs.push(nom); console.log('    ✗ ' + nom + (detail ? '  → ' + detail : '')) }
}
function section(titre) { console.log('\n  ── ' + titre + ' ' + '─'.repeat(Math.max(0, 58 - titre.length))) }

const q1 = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const rows = async (sql, p = []) => (await db.query(sql, p)).rows
const connecte = (uid) => db.exec(`select set_config('test.uid', '${uid ?? ''}', false);`)

/** Les formulations possibles d'un refus lié au rôle. */
const REFUS = /réservé|Action réservée|autoris|administrateur|Seul l/i

/** Attend que l'appel échoue avec un message contenant `motif`. */
async function refuse(nom, sql, params, motif) {
  try {
    await db.query(sql, params)
    ok(nom, false, 'aucune erreur levée')
  } catch (e) {
    ok(nom, motif.test(e.message), e.message.split('\n')[0].slice(0, 70))
  }
}

// ═══════════════════════════════════════════════════ 1. INSTALLATION ═══

console.log('\n🏗  INSTALLATION')

// Ce que Supabase fournit et que PGlite n'a pas
await db.exec(`
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;
-- Imitation fidèle de bcrypt : le sel est embarqué dans le haché, si bien
-- que crypt(motdepasse, haché) redonne le haché quand le mot de passe est bon.
create or replace function extensions.gen_salt(t text) returns text
  language sql immutable as $f$ select 'sel'; $f$;
create or replace function extensions.crypt(pw text, s text) returns text
  language sql immutable as $f$
    select (case when position('$' in s) > 0 then split_part(s, '$', 1) else s end)
           || '$' ||
           md5(pw || (case when position('$' in s) > 0 then split_part(s, '$', 1) else s end));
  $f$;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb,
  raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text,
  email_change text, banned_until timestamptz);
create table auth.identities (
  id uuid primary key, user_id uuid, provider_id text, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('test.uid', true), '')::uuid; $f$;
create role authenticated;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
`)

// La base telle qu'elle existait avant la mise à jour (sans les gros seeds)
const BASE = ['001_schema.sql', '002_rls.sql', '007_ameliorations.sql', '008_details_paie.sql',
              '012_role_admin.sql', '013_admin_fonctions.sql', '014_types_garde.sql']
for (const f of BASE) {
  let sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')
  if (f === '007_ameliorations.sql') {           // bloc de corrections propre au registre réel
    const c = sql.indexOf('do $$'); if (c > 0) sql = sql.slice(0, c)
  }
  await db.exec(sql)
}
console.log('  base d’origine (001 → 014) : OK')

// Les blocs que vous collez dans Supabase, dans l'ordre
const ORDRE = [
  'BLOC_1_paie_contrats.sql', 'BLOC_2_role_paie.sql', 'BLOC_3_droits_verrouillage.sql',
  'BLOC_4_SECURITE_URGENT.sql', 'BLOC_5_gestion_comptes.sql', 'BLOC_6_supprimer_employe.sql',
  'BLOC_7_sites_principaux.sql', 'BLOC_8_dossier_employe.sql', 'BLOC_9_dette_simple.sql',
  'BLOC_10_role_personnel.sql', 'BLOC_11_personnel_departement.sql',
  'BLOC_12_matricule.sql', 'BLOC_13_verrou_analytics.sql',
  'BLOC_14_analytics_paie.sql', 'BLOC_15_bulletin_paie.sql',
]
for (const b of ORDRE) {
  try {
    await db.exec(fs.readFileSync(path.join(BLOCS, b), 'utf8'))
    console.log('  ' + b.padEnd(34) + ' OK')
  } catch (e) {
    console.log('  ' + b.padEnd(34) + ' ÉCHEC : ' + e.message)
    process.exit(1)
  }
}

// On relève l'état de la sécurité au niveau ligne AVANT de la désactiver :
// c'est l'état réel de votre base qui nous intéresse, pas celui du test.
const sansRlsInstall = (await db.query(`
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname <> 'matricule_compteur'
    and not c.relrowsecurity`)).rows.map((r) => r.relname)

// RLS désactivée pour le test : ce sont les contrôles DANS les fonctions
// qu'on vérifie (PGlite n'a pas les rôles PostgREST).
for (const t of ['companies', 'sites', 'sites_principaux', 'employees', 'profiles',
                 'pointages', 'contrats', 'conges', 'documents', 'periodes_paie',
                 'lignes_paie', 'parametres_paie']) {
  await db.exec(`alter table public.${t} disable row level security;`)
}

// ═════════════════════════════════════════════════════ 2. SÉCURITÉ ═════

section('Sécurité : un visiteur non connecté')
await connecte(null)

const SENSIBLES = [
  ['admin_creer_utilisateur',   `select public.admin_creer_utilisateur('pirate','motdepasse','X','admin')`],
  ['admin_creer_entreprise',    `select public.admin_creer_entreprise('Pirate SARL')`],
  ['admin_supprimer_utilisateur', `select public.admin_supprimer_utilisateur(gen_random_uuid())`],
  ['admin_activer_utilisateur', `select public.admin_activer_utilisateur(gen_random_uuid(),false)`],
  ['admin_reinitialiser_mot_de_passe', `select public.admin_reinitialiser_mot_de_passe(gen_random_uuid(),'abcdef')`],
  ['creer_site',                `select public.creer_site(gen_random_uuid(),'Site pirate')`],
  ['supprimer_site',            `select public.supprimer_site(gen_random_uuid())`],
  ['creer_site_principal',      `select public.creer_site_principal(gen_random_uuid(),'X')`],
  ['lier_annexes',              `select public.lier_annexes(array[gen_random_uuid()],null)`],
  ['marquer_present',           `select public.marquer_present(gen_random_uuid(),current_date,'X')`],
  ['supprimer_pointage',        `select public.supprimer_pointage(gen_random_uuid())`],
  ['creer_conge',               `select public.creer_conge(gen_random_uuid(),current_date,current_date,'C',null)`],
  ['validate_pointage',         `select public.validate_pointage(gen_random_uuid(),'validated','X')`],
  ['valider_pointage_mois',     `select public.valider_pointage_mois(gen_random_uuid(),2026,1)`],
  ['maj_ligne_paie',            `select public.maj_ligne_paie(gen_random_uuid(),0,0,0,null)`],
  ['valider_paie',              `select public.valider_paie(gen_random_uuid())`],
  ['repondre_reouverture',      `select public.repondre_reouverture(gen_random_uuid(),true)`],
  ['supprimer_employe',         `select public.supprimer_employe(gen_random_uuid())`],
  ['apercu_suppression_employe',`select public.apercu_suppression_employe(gen_random_uuid())`],
  ['maj_parametres_paie',       `select public.maj_parametres_paie(gen_random_uuid(),26,true,true,8)`],
  ['analytics_paie',            `select public.analytics_paie(null,2026)`],
  ['bulletin_paie',             `select public.bulletin_paie(gen_random_uuid())`],
  ['maj_bareme_igr',            `select public.maj_bareme_igr('[]'::jsonb)`],
]
let ouvertes = 0
for (const [nom, sql] of SENSIBLES) {
  try { await db.query(sql); ouvertes++; console.log(`    ✗ ${nom} accessible !`) }
  catch (e) {
    if (!REFUS.test(e.message)) {
      ouvertes++; console.log(`    ✗ ${nom} franchie → ${e.message.slice(0, 50)}`)
    }
  }
}
ok(`les ${SENSIBLES.length} fonctions sensibles refusent un visiteur anonyme`, ouvertes === 0,
   `${ouvertes} accessible(s)`)

// ══════════════════════════════════════════════════════ 3. COMPTES ═════

section('Comptes et rôles')
const creerCompte = async (nom, role) => {
  const id = (await q1(`select gen_random_uuid() as id`)).id
  await db.query(`insert into auth.users(id,email) values($1,$2)`, [id, nom + '@local'])
  await db.query(`insert into public.profiles(user_id,username,role) values($1,$2,$3)`, [id, nom, role])
  return id
}
const admin = await creerCompte('admin1', 'admin')
const bureau = await creerCompte('bureau1', 'validator')
const paie = await creerCompte('paie1', 'paie')
const agent = await creerCompte('agent1', 'agent')
ok('quatre rôles créés (agent, bureau, paie, admin)', true)

await connecte(agent)
await refuse('un agent ne peut pas créer d’entreprise',
  `select public.admin_creer_entreprise('X')`, [], REFUS)
await connecte(bureau)
await refuse('un validateur ne peut pas créer d’entreprise',
  `select public.admin_creer_entreprise('X')`, [], REFUS)
await connecte(paie)
await refuse('la paie ne peut pas créer de site',
  `select public.creer_site(gen_random_uuid(),'X')`, [], REFUS)

// ═══════════════════════════════════════════ 4. ENTREPRISE & SITES ═════

section('Entreprise, sites principaux et annexes')
await connecte(admin)
const co = (await q1(`select public.admin_creer_entreprise('Groupe Triple A') as id`)).id
ok('l’admin crée l’entreprise', !!co)
ok('paramètres de paie créés automatiquement (base 26 j, malade et congé payés)',
  await (async () => {
    const p = await q1(`select * from public.parametres_paie where company_id=$1`, [co])
    return Number(p.jours_base) === 26 && p.maladie_payee === true && p.conge_paye === true
  })())

await connecte(bureau)
const commune = (await q1(`select public.creer_site_principal($1,'LA COMMUNE') as id`, [co])).id
const aRiad = (await q1(`select public.creer_site($1,'COMMUNE HAY RIAD') as id`, [co])).id
const aAgdal = (await q1(`select public.creer_site($1,'COMMUNE AGDAL') as id`, [co])).id
const aPort = (await q1(`select public.creer_site($1,'PORT') as id`, [co])).id
ok('le bureau crée un site principal et trois annexes', !!commune && !!aRiad && !!aAgdal && !!aPort)

const nLies = (await q1(`select public.lier_annexes($1::uuid[],$2) as n`, [[aRiad, aAgdal], commune])).n
ok('rattachement groupé de deux annexes', Number(nLies) === 2)
ok('une annexe non rattachée reste indépendante',
  (await q1(`select site_principal_id from public.sites where id=$1`, [aPort])).site_principal_id === null)

// ════════════════════════════════════════════════════ 5. EMPLOYÉS ═════

section('Employés')
const creerEmploye = async (nom, siteId, opts = {}) => (await q1(
  `insert into public.employees
     (company_id, site_id, nom_prenom, salaire, heures_par_jour, mode_reglement,
      banque, jour_de_repos, situation_familiale, nombre_enfants, dette, cin)
   values ($1,$2,$3,$4,8,$5,$6,7,$7,$8,$9,$10) returning id`,
  // Attention : `??` laisserait passer null. On distingue « non fourni » de « null ».
  [co, siteId, nom, 'salaire' in opts ? opts.salaire : 5200,
   opts.mode ?? 'Virement', opts.banque ?? 'CIH',
   opts.situation ?? 'Célibataire', opts.enfants ?? 0, opts.dette ?? 0, opts.cin ?? null])).id

const ePlein = await creerEmploye('PLEIN MOIS', aRiad, { cin: 'AA1' })
const ePartiel = await creerEmploye('VINGT JOURS', aAgdal, { mode: 'Espece', banque: null, cin: 'AA2' })
const eMixte = await creerEmploye('CONGE MALADE', aAgdal, { banque: 'BMCE', cin: 'AA3' })
const eDette = await creerEmploye('AVEC DETTE', aPort, { mode: 'Versement', banque: null, dette: 1500, cin: 'AA4' })

ok('matricules attribués automatiquement et à la suite',
  await (async () => {
    const m = (await rows(`select matricule from public.employees where company_id=$1 order by matricule`, [co]))
      .map((r) => Number(r.matricule))
    return m.length === 4 && m.every((v, i) => i === 0 || v === m[i - 1] + 1)
  })())

await db.query(`update public.employees set situation_familiale='Marié(e)', nombre_enfants=3 where id=$1`, [ePlein])
ok('situation familiale et nombre d’enfants enregistrés',
  Number((await q1(`select nombre_enfants from public.employees where id=$1`, [ePlein])).nombre_enfants) === 3)
await refuse('situation familiale hors liste refusée',
  `update public.employees set situation_familiale='Pacsé' where id=$1`, [ePlein], /check|contrainte|violates/i)

// Le matricule ne recule pas et ne se réutilise pas
const hautNum = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom,matricule)
   values($1,$2,'NUMERO ELEVE',1200) returning matricule`, [co, aPort])).matricule
ok('un matricule imposé est accepté', Number(hautNum) === 1200)
const apres = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom)
   values($1,$2,'SUIVANT') returning matricule`, [co, aPort])).matricule
ok('le suivant repart du plus haut, pas du premier trou (1201)',
   Number(apres) === 1201, `obtenu ${apres}`)
await db.query(`delete from public.employees where matricule=$1 and company_id=$2`, [apres, co])
const apres2 = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom)
   values($1,$2,'ENCORE APRES') returning matricule`, [co, aPort])).matricule
ok('un numéro libéré n’est pas réattribué (1202)', Number(apres2) === 1202, `obtenu ${apres2}`)
await db.query(`delete from public.employees where matricule in ($1,$2) and company_id=$3`,
               [1200, apres2, co])

ok('tout le personnel d’un site principal se lit d’un coup',
  Number((await q1(`select count(*) as c from public.employees e
                    join public.sites s on s.id=e.site_id
                    where s.site_principal_id=$1`, [commune])).c) === 3)

// ═════════════════════════════════════════════════════ 6. CONTRATS ═════

section('Contrats')
const contratDe = async (emp, debut, fin) => (await q1(
  `insert into public.contrats(company_id,employee_id,type_contrat,date_debut,date_fin,created_by)
   values($1,$2,'CDD',$3,$4,$5) returning id, numero`, [co, emp, debut, fin, bureau]))

const ct1 = await contratDe(ePlein, '2026-01-01', '2026-12-31')
ok('numéro de contrat automatique au format CT-AAAA-NNNN', /^CT-\d{4}-\d{4}$/.test(ct1.numero))

const statutDe = async (emp) => (await q1(
  `select statut, jours_restants from public.contrats_courants where employee_id=$1`, [emp]))
await db.query(`update public.contrats set date_fin = current_date + 5 where id=$1`, [ct1.id])
ok('fin dans 5 jours → « bientôt » (ligne bleue)', (await statutDe(ePlein)).statut === 'bientot')
await db.query(`update public.contrats set date_fin = current_date - 1 where id=$1`, [ct1.id])
ok('date de fin dépassée → « terminé » (ligne jaune)', (await statutDe(ePlein)).statut === 'termine')
await db.query(`update public.contrats set date_fin = current_date + 40 where id=$1`, [ct1.id])
ok('fin lointaine → « en cours », aucune alerte', (await statutDe(ePlein)).statut === 'actif')
await db.query(`update public.contrats set date_fin = null where id=$1`, [ct1.id])
ok('CDI sans date de fin → jamais d’alerte', (await statutDe(ePlein)).statut === 'actif')

// Renouvellement : nouveau contrat, ancien archivé
await db.query(`update public.contrats set date_fin='2026-06-30' where id=$1`, [ct1.id])
const ct2 = await contratDe(ePlein, '2026-07-01', '2027-06-30')
await db.query(`update public.contrats set archive=true where id=$1`, [ct1.id])
ok('après renouvellement, seul le nouveau contrat fait foi',
  (await q1(`select id from public.contrats_courants where employee_id=$1`, [ePlein])).id === ct2.id)

// ══════════════════════════════════════════════════════ 7. CONGÉS ═════

section('Congés et absences')
const c1 = (await q1(`select public.creer_conge($1,'2026-03-02'::date,'2026-03-06'::date,'C','Congé annuel') as id`, [eMixte])).id
const c2 = (await q1(`select public.creer_conge($1,'2026-04-01'::date,'2026-04-03'::date,'C','Deuxième') as id`, [eMixte])).id
ok('un employé cumule plusieurs congés', !!c1 && !!c2)
await refuse('deux congés qui se chevauchent sont refusés',
  `select public.creer_conge($1,'2026-03-04'::date,'2026-03-09'::date,'C',null)`, [eMixte], /existe déjà/i)
const c3 = (await q1(`select public.creer_conge($1,'2026-03-07'::date,'2026-03-09'::date,'C','Enchaîné') as id`, [eMixte])).id
ok('un congé qui enchaîne juste après est accepté', !!c3)
ok('les jours du congé sont écrits dans le pointage',
  Number((await q1(`select count(*) as c from public.pointages where conge_id=$1`, [c1])).c) > 0)
ok('le jour de repos hebdomadaire n’est pas consommé',
  Number((await q1(`select count(*) as c from public.pointages
                    where conge_id=$1 and extract(isodow from pointed_on)=7`, [c1])).c) === 0)

// Documents rattachés
await db.query(`insert into public.documents(company_id,employee_id,type,conge_id,chemin,nom_fichier,mime)
                values($1,$2,'engagement',$3,'a/b/eng.pdf','engagement-signe.pdf','application/pdf')`, [co, eMixte, c1])
await db.query(`insert into public.documents(company_id,employee_id,type,contrat_id,chemin,nom_fichier,mime)
                values($1,$2,'contrat',$3,'a/b/ct.pdf','contrat-legalise.pdf','application/pdf')`, [co, ePlein, ct2.id])
ok('scans rattachés au congé et au contrat',
  Number((await q1(`select count(*) as c from public.documents where company_id=$1`, [co])).c) === 2)
await q1(`select public.supprimer_conge($1)`, [c3])
ok('supprimer un congé retire aussi ses jours de pointage',
  Number((await q1(`select count(*) as c from public.pointages where conge_id=$1`, [c3])).c) === 0)

// ════════════════════════════════════════════════════ 8. POINTAGE ═════

section('Pointage')
const jour = (n) => `2026-03-${String(n).padStart(2, '0')}`
const ouvrables = []
for (let j = 1; j <= 31; j++) if (new Date(2026, 2, j).getDay() !== 0) ouvrables.push(j)

let n = 0
for (const j of ouvrables) { if (n >= 26) break; await q1(`select public.marquer_present($1,$2::date,'X')`, [ePlein, jour(j)]); n++ }
ok('26 gardes pointées pour l’employé à mois plein', n === 26)

n = 0
for (const j of ouvrables) { if (n >= 20) break; await q1(`select public.marquer_present($1,$2::date,'X')`, [ePartiel, jour(j)]); n++ }
ok('20 gardes pointées pour l’employé à mois partiel', n === 20)

// eMixte a déjà 5 jours de congé en mars : on complète
const libres = ouvrables.filter((j) => ![2, 3, 4, 5, 6].includes(j))
for (let i = 0; i < 10; i++) await q1(`select public.marquer_present($1,$2::date,'X')`, [eMixte, jour(libres[i])])
await q1(`select public.marquer_present($1,$2::date,'X05')`, [eMixte, jour(libres[10])])
await q1(`select public.marquer_present($1,$2::date,'XX')`, [eMixte, jour(libres[11])])
await q1(`select public.marquer_present($1,$2::date,'M')`, [eMixte, jour(libres[12])])
await q1(`select public.marquer_present($1,$2::date,'M')`, [eMixte, jour(libres[13])])
ok('demi-garde = 0,5 · garde et demi = 1,5 · double = 2',
  await (async () => {
    const v = await q1(`select public.garde_valeur('X05') a, public.garde_valeur('X15') b,
                               public.garde_valeur('XX') c, public.garde_valeur('M') d`)
    return Number(v.a) === 0.5 && Number(v.b) === 1.5 && Number(v.c) === 2 && Number(v.d) === 1
  })())

n = 0
for (const j of ouvrables) { if (n >= 26) break; await q1(`select public.marquer_present($1,$2::date,'X')`, [eDette, jour(j)]); n++ }

await refuse('impossible de pointer dans le futur',
  `select public.marquer_present($1,(current_date + 5)::date,'X')`, [ePlein], /futur/i)

// ═════════════════════════════════════════════════════════ 9. PAIE ═════

section('Clôture du mois et calcul de la paie')
await connecte(bureau)
const periode = (await q1(`select public.valider_pointage_mois($1,2026,3) as id`, [co])).id
ok('le mois bascule en paie', !!periode)
ok('statut « pointage validé »',
  (await q1(`select statut from public.periodes_paie where id=$1`, [periode])).statut === 'pointage_valide')
await refuse('le pointage du mois clôturé est verrouillé',
  `select public.marquer_present($1,'2026-03-30'::date,'X')`, [ePlein], /clôturé/i)

// L'agent non plus ne peut plus rien y ajouter (son insertion est directe)
await connecte(agent)
const moisCourant = await q1(`select date_part('year',(now() at time zone 'Africa/Casablanca'))::int a,
                                     date_part('month',(now() at time zone 'Africa/Casablanca'))::int m`)
await connecte(bureau)
const pCourant = (await q1(`select public.valider_pointage_mois($1,$2,$3) as id`, [co, moisCourant.a, moisCourant.m])).id
await connecte(agent)
await refuse('un agent ne peut pas pointer sur un mois clôturé',
  `insert into public.pointages(company_id,site_id,employee_id,agent_id,photo_path)
   values($1,$2,$3,$4,'p.jpg')`, [co, aRiad, ePlein, agent], /clôturé/i)
await connecte(admin)
await db.query(`delete from public.periodes_paie where id=$1`, [pCourant])

const ligne = async (emp) => q1(`select * from public.lignes_paie where periode_id=$1 and employee_id=$2`, [periode, emp])
const lPlein = await ligne(ePlein), lPartiel = await ligne(ePartiel), lMixte = await ligne(eMixte)

ok('26 jours travaillés = salaire complet (5 200,00 DH)', Number(lPlein.net_a_payer) === 5200,
   `net = ${lPlein.net_a_payer}`)
ok('26 jours × 8 h = 208 h', Number(lPlein.heures_effectuees) === 208)
ok('20 jours sur 26 = 4 000,00 DH', Number(lPartiel.net_a_payer) === 4000, `net = ${lPartiel.net_a_payer}`)
ok('20 jours × 8 h = 160 h', Number(lPartiel.heures_effectuees) === 160)

const attendu = 12.5 + 2 + Number(lMixte.jours_conge)
ok(`jours payés = ${attendu} (12,5 travaillés + 2 malade + ${lMixte.jours_conge} congé)`,
   Number(lMixte.jours_payes) === attendu, `obtenu ${lMixte.jours_payes}`)
ok('malade et congé sont bien payés (ils ne réduisent pas le salaire)',
   Number(lMixte.jours_conge) > 0 && Number(lMixte.jours_maladie) === 2)
ok('salaire proratisé au centime près',
   Number(lMixte.net_a_payer) === Math.round(5200 * attendu / 26 * 100) / 100,
   `${lMixte.net_a_payer} attendu ${Math.round(5200 * attendu / 26 * 100) / 100}`)
ok('mode de règlement, banque et site principal repris dans la paie',
   lPartiel.mode_reglement === 'Espece' && lPlein.banque === 'CIH' &&
   lPlein.site_principal_nom === 'LA COMMUNE')

section('Retenues, dette et validation de la paie')
await connecte(bureau)
await refuse('le bureau ne touche pas aux montants de la paie',
  `select public.maj_ligne_paie($1,0,100,0,null)`, [lPartiel.id], REFUS)

await connecte(paie)
const lDette = await ligne(eDette)
// 2 000 : au-dessus de la dette (1 500) mais sous le salaire, pour que ce
// soit bien le contrôle de dette qui se déclenche, et pas le net négatif.
await q1(`select public.maj_ligne_paie($1,0,2000,0,null)`, [lDette.id])
await refuse('retenue supérieure à la dette : refusée à la validation',
  `select public.valider_paie($1)`, [periode], /dette/i)

await q1(`select public.maj_ligne_paie($1,200,500,0,'Prime + retenue')`, [lDette.id])
const lDette2 = await ligne(eDette)
ok('prime 200 et retenue 500 → net = 5 200 + 200 − 500 = 4 900',
   Number(lDette2.net_a_payer) === 4900, `net = ${lDette2.net_a_payer}`)

const totaux = (await q1(`select public.totaux_periode($1) as t`, [periode])).t
// « Virement » part en banque ; « Espece » et « Versement » sont regroupés
// dans le hors-virement. Ce qui compte : la somme retombe sur le total.
ok('espèces + virements = total net (rien ne se perd)',
   Number(totaux.total_especes) + Number(totaux.total_virement) === Number(totaux.total_net),
   JSON.stringify({ esp: totaux.total_especes, vir: totaux.total_virement, net: totaux.total_net }))
ok('seuls les « Virement » comptent comme banque',
   Number(totaux.total_virement) === Number(lPlein.net_a_payer) + Number(lMixte.net_a_payer),
   `vir = ${totaux.total_virement}`)
ok('détail par banque disponible pour préparer les virements',
   Array.isArray(totaux.par_banque) && totaux.par_banque.length >= 2)

await q1(`select public.valider_paie($1)`, [periode])
ok('paie validée', (await q1(`select statut from public.periodes_paie where id=$1`, [periode])).statut === 'paie_validee')
ok('la dette passe de 1 500 à 1 000',
   Number((await q1(`select dette from public.employees where id=$1`, [eDette])).dette) === 1000)
await refuse('une paie validée est verrouillée',
  `select public.maj_ligne_paie($1,0,0,0,null)`, [lDette.id], /validée|réouverture/i)

// ═══════════════════════════════════ 9 bis. ANALYTICS DE LA PAIE ═════

section('Analytics : les montants versés')
const apCo = (await q1(`select public.analytics_paie($1,2026) as a`, [co])).a

ok('l’année est bien celle demandée', apCo.annee === 2026)

const mars = apCo.par_mois.find((m) => m.mois === 3)
ok('mars apparaît dans le détail mensuel', !!mars, JSON.stringify(apCo.par_mois))
ok('mars est marqué comme paie validée', mars?.statut === 'paie_validee', mars?.statut)

// Le net du mois doit retomber sur la somme des lignes, sans arrondi perdu.
const netLignes = Number((await q1(
  `select coalesce(sum(net_a_payer),0) as n from public.lignes_paie where periode_id=$1`,
  [periode])).n)
ok('le net du mois = la somme des lignes de paie',
   Number(mars.net) === netLignes, `${mars.net} vs ${netLignes}`)

ok('espèces + virements retombent sur le net du mois',
   Number(mars.virement) + Number(mars.especes) === Number(mars.net),
   JSON.stringify({ v: mars.virement, e: mars.especes, n: mars.net }))

ok('le brut du mois = la somme des salaires bruts',
   Number(mars.brut) === Number((await q1(
     `select coalesce(sum(salaire_brut),0) as n from public.lignes_paie where periode_id=$1`,
     [periode])).n), String(mars.brut))

ok('le nombre d’employés payés correspond aux lignes',
   Number(mars.employes) === Number((await q1(
     `select count(*) as c from public.lignes_paie where periode_id=$1`, [periode])).c),
   String(mars.employes))

// Le cumul de l'année ne retient QUE les mois validés.
ok('le cumul de l’année compte un mois validé', Number(apCo.annee_totaux.mois_validés) === 1,
   String(apCo.annee_totaux.mois_validés))
ok('le net cumulé de l’année = le net de mars',
   Number(apCo.annee_totaux.net) === Number(mars.net),
   `${apCo.annee_totaux.net} vs ${mars.net}`)
ok('espèces + virements retombent sur le net de l’année',
   Number(apCo.annee_totaux.virement) + Number(apCo.annee_totaux.especes)
     === Number(apCo.annee_totaux.net))

ok('la répartition par banque ne contient que des virements',
   apCo.par_banque.reduce((s2, b) => s2 + Number(b.montant), 0)
     === Number(apCo.annee_totaux.virement),
   JSON.stringify(apCo.par_banque))

ok('la répartition par site principal retombe sur le net',
   apCo.par_site_principal.reduce((s2, x) => s2 + Number(x.montant), 0)
     === Number(apCo.annee_totaux.net),
   JSON.stringify(apCo.par_site_principal))

ok('les dettes ouvertes sont remontées',
   Number(apCo.dettes.total) === Number((await q1(
     `select coalesce(sum(dette),0) as d from public.employees
       where dette > 0 and actif and company_id=$1`, [co])).d), String(apCo.dettes.total))

ok('la masse salariale théorique = la somme des salaires en poste',
   Number(apCo.masse_mensuelle_theorique) === Number((await q1(
     `select coalesce(sum(salaire),0) as s from public.employees where actif and company_id=$1`,
     [co])).s), String(apCo.masse_mensuelle_theorique))

// Une année sans paie ne doit pas casser : des zéros, pas une erreur.
const vide = (await q1(`select public.analytics_paie($1,2019) as a`, [co])).a
ok('une année sans paie renvoie des zéros, pas une erreur',
   vide.par_mois.length === 0 && Number(vide.annee_totaux.net) === 0,
   JSON.stringify(vide.annee_totaux))

// Filtrage par entreprise : une autre entreprise ne voit pas cette paie.
await connecte(admin)
const co2 = (await q1(`select public.admin_creer_entreprise('CLOISON SARL') as id`)).id
await connecte(paie)
const apAutre = (await q1(`select public.analytics_paie($1,2026) as a`, [co2])).a
ok('l’analytics d’une autre entreprise ne voit pas cette paie',
   apAutre.par_mois.length === 0 && Number(apAutre.annee_totaux.net) === 0)

// « Toutes les entreprises » doit au moins contenir celle-ci.
const apTout = (await q1(`select public.analytics_paie(null,2026) as a`)).a
ok('« toutes les entreprises » englobe le net de cette entreprise',
   Number(apTout.annee_totaux.net) >= Number(apCo.annee_totaux.net),
   `${apTout.annee_totaux.net} >= ${apCo.annee_totaux.net}`)

section('Demande de réouverture')
await connecte(paie)
await q1(`select public.demander_reouverture($1,'Erreur sur les gardes')`, [periode])
ok('demande enregistrée',
   (await q1(`select statut from public.periodes_paie where id=$1`, [periode])).statut === 'reouverture_demandee')
await refuse('la paie ne peut pas approuver sa propre demande',
  `select public.repondre_reouverture($1,true)`, [periode], REFUS)
await connecte(admin)
await q1(`select public.repondre_reouverture($1,true)`, [periode])
ok('seul l’admin rouvre le mois',
   (await q1(`select statut from public.periodes_paie where id=$1`, [periode])).statut === 'ouvert')
ok('la réouverture rend la dette retenue (1 000 → 1 500)',
   Number((await q1(`select dette from public.employees where id=$1`, [eDette])).dette) === 1500)
await connecte(bureau)
const libre = (await q1(
  `select d::date as j from generate_series(date '2026-03-01', date '2026-03-31', interval '1 day') d
    where not exists (select 1 from public.pointages p
                      where p.employee_id = $1 and p.pointed_on = d::date)
    limit 1`, [ePlein])).j
await q1(`select public.marquer_present($1,$2::date,'X')`, [ePlein, libre])
ok('le pointage redevient modifiable après réouverture', true)

// ══════════════════════════════════ 9 ter. BULLETIN DE PAIE ═════

section('Bulletin de paie (virements uniquement)')
await connecte(paie)

const bp = (await q1(`select public.bulletin_paie($1) as b`, [periode])).b
ok('le bulletin renvoie une liste', Array.isArray(bp), typeof bp)

// Seuls les employés payés par virement y figurent.
const virements = await rows(
  `select employee_id, nom_prenom, salaire_brut, cnss from public.lignes_paie
    where periode_id=$1 and lower(coalesce(mode_reglement,'')) like 'vir%'`, [periode])
const autres = await rows(
  `select employee_id from public.lignes_paie
    where periode_id=$1 and lower(coalesce(mode_reglement,'')) not like 'vir%'`, [periode])
ok('le bulletin ne contient que les employés payés par virement',
   bp.length === virements.length && bp.length > 0,
   `${bp.length} bulletins pour ${virements.length} virements`)
ok('aucun employé payé en espèces n’a de bulletin',
   autres.length > 0 && !bp.some((b) => autres.some((a) => a.employee_id === b.employe.id)),
   `${autres.length} non-virements ignorés`)

const b0 = bp[0]
const lig = (code) => b0.lignes.find((l) => l.code === code)
const brut = Number(lig('001').gain)

ok('la ligne SALAIRE BRUT porte le salaire de base et les jours payés',
   lig('001').libelle === 'SALAIRE BRUT' && Number(lig('001').base) > 0
     && Number(lig('001').taux) > 0, JSON.stringify(lig('001')))

const cnss = Number(lig('068').retenue)
ok('C.N.S.S. = brut × 4,48 %', cnss === Math.round(brut * 4.48) / 100,
   `${cnss} vs ${Math.round(brut * 4.48) / 100}`)
ok('la C.N.S.S. est une retenue, jamais un gain', lig('068').gain === null)

const amo = Number(lig('069').retenue)
ok('A.M.O. = brut × 2,26 %', amo === Math.round(brut * 2.26) / 100,
   `${amo} vs ${Math.round(brut * 2.26) / 100}`)

// Barème vide au départ : aucun taux n'est inventé, l'I.G.R. reste à zéro.
ok('sans barème saisi, l’I.G.R. vaut 0', Number(lig('070').retenue) === 0)
ok('… et le bulletin le signale quand le brut dépasse le seuil',
   b0.bareme_igr_absent === (brut >= 6000), `brut ${brut}, drapeau ${b0.bareme_igr_absent}`)

const net = Number(b0.lignes.find((l) => l.libelle === 'GAIN NET').gain)
ok('GAIN NET = brut − C.N.S.S. − A.M.O. − I.G.R.',
   net === Math.round((brut - cnss - amo) * 100) / 100, `${net}`)
ok('le pied reprend le même net à payer', Number(b0.pied.net_a_payer) === net)
ok('le pied porte 191 heures salariales', Number(b0.pied.heures_salariales) === 191)
ok('le pied porte les jours travaillés', Number(b0.pied.jours_travailles) > 0)
ok('le cumul C.N.S.S. du premier mois validé = la C.N.S.S. du mois',
   Number(b0.pied.cumul_cnss) === cnss, `${b0.pied.cumul_cnss} vs ${cnss}`)
ok('le cumul I.G.R. est à zéro sans barème', Number(b0.pied.cumul_igr) === 0)

// Ce que le bulletin ne doit PAS contenir (les lignes barrées de la photo)
const libelles = b0.lignes.map((l) => l.libelle).join(' | ')
ok('pas de seconde ligne SALAIRE BRUT en double',
   b0.lignes.filter((l) => l.libelle === 'SALAIRE BRUT').length === 1, libelles)
ok('ni Cumul B.Imp. ni C.I.M.R. ni Décompte Monétaire',
   !/B\.?Imp|C\.?I\.?M\.?R|Décompte/i.test(JSON.stringify(b0)))

// Un barème saisi : l'I.G.R. se met à calculer.
await connecte(admin)
const nTranches = Number(await q1(
  `select public.maj_bareme_igr($1::jsonb) as n`,
  [JSON.stringify([
    { salaire_min: 0,    salaire_max: 5999.99, taux: 0,  somme_a_deduire: 0 },
    { salaire_min: 6000, salaire_max: null,    taux: 10, somme_a_deduire: 100 },
  ])]).then((r) => r.n))
ok('l’administrateur enregistre un barème de 2 tranches', nTranches === 2, String(nTranches))
await connecte(paie)
await refuse('la paie ne modifie pas le barème I.G.R.',
  `select public.maj_bareme_igr('[]'::jsonb)`, [], REFUS)
const bp2 = (await q1(`select public.bulletin_paie($1) as b`, [periode])).b
const c0 = bp2.find((x) => x.ligne_id === b0.ligne_id)
const baseImp = Math.round((brut - cnss - amo) * 100) / 100
const igrAttendu = brut >= 6000 ? Math.max(0, Math.round((baseImp * 10 - 10000) ) / 100) : 0
ok('avec un barème, l’I.G.R. suit la tranche',
   Number(c0.lignes.find((l) => l.code === '070').retenue)
     === (brut >= 6000 ? Math.round((baseImp * 0.10 - 100) * 100) / 100 : 0),
   `brut ${brut}, base ${baseImp}, igr ${c0.lignes.find((l) => l.code === '070').retenue}`)
ok('le drapeau « barème absent » retombe une fois le barème saisi',
   c0.bareme_igr_absent === false)
void igrAttendu

// Filtrer sur un seul employé
const bpUn = (await q1(`select public.bulletin_paie($1,$2) as b`,
  [periode, b0.employe.id])).b
ok('on peut demander le bulletin d’un seul employé',
   bpUn.length === 1 && bpUn[0].employe.id === b0.employe.id, String(bpUn.length))

// Le bulletin distingue le net fiscal du net réellement versé
ok('le net réellement versé (primes/retenues internes) est exposé à part',
   c0.net_verse !== undefined && c0.prime !== undefined
     && c0.retenues_internes !== undefined)

// Une période inconnue échoue proprement
await refuse('une période inconnue est refusée clairement',
  `select public.bulletin_paie(gen_random_uuid())`, [], /introuvable/i)

// Le bureau n'a pas accès au bulletin de paie
await connecte(bureau)
await refuse('le bureau n’accède pas au bulletin de paie',
  `select public.bulletin_paie($1)`, [periode], REFUS)
await connecte(paie)

// On remet le barème à vide pour ne pas perturber les tests suivants.
await connecte(admin)
await q1(`select public.maj_bareme_igr('[]'::jsonb)`)
await connecte(paie)

// ═══════════════════════════════════════════════ 10. BULLETIN & RESET ═

section('Bulletin de présence et remise à zéro')
const bulletin = (await q1(`select public.bulletin_journalier($1,$2::date) as b`, [co, jour(ouvrables[0])])).b
ok('le bulletin journalier regroupe par site', Array.isArray(bulletin) && bulletin.length >= 1)
ok('le bulletin liste les employés présents ce jour-là',
   bulletin.reduce((s, x) => s + x.employes.length, 0) >= 3)

await connecte(bureau)
const per2 = (await q1(`select public.valider_pointage_mois($1,2026,3) as id`, [co])).id
await connecte(paie)
await q1(`select public.maj_ligne_paie($1,0,500,0,null)`, [(await ligne(eDette)).id])
await q1(`select public.valider_paie($1)`, [per2])
ok('mois revalidé, dette de nouveau à 1 000',
   Number((await q1(`select dette from public.employees where id=$1`, [eDette])).dette) === 1000)

const reset = fs.readFileSync(path.join(BLOCS, 'RESET_paie.sql'), 'utf8')
const blocA = reset.slice(reset.indexOf('do $$'), reset.indexOf('--  BLOC B'))
await db.exec(blocA.replace('v_annee int := 2026;', 'v_annee int := 2026;').replace('v_mois  int := 7;', 'v_mois  int := 3;'))
ok('la remise à zéro supprime la période',
   (await rows(`select 1 from public.periodes_paie where id=$1`, [per2])).length === 0)
ok('la remise à zéro rend la dette (1 000 → 1 500)',
   Number((await q1(`select dette from public.employees where id=$1`, [eDette])).dette) === 1500)
ok('la remise à zéro CONSERVE les pointages',
   Number((await q1(`select count(*) as c from public.pointages where employee_id=$1`, [ePlein])).c) >= 26)
ok('la remise à zéro conserve les employés',
   !!(await q1(`select 1 from public.employees where id=$1`, [ePlein])))

// ═════════════════════════════════════════ 11. GESTION DES COMPTES ═════

section('Gestion des comptes')
await connecte(admin)
await q1(`select public.admin_activer_utilisateur($1,false)`, [agent])
ok('compte désactivé', (await q1(`select actif from public.profiles where user_id=$1`, [agent])).actif === false)
await connecte(agent)
await refuse('un compte désactivé ne peut plus rien faire',
  `select public.creer_site($1,'X')`, [co], REFUS)
await connecte(admin)
await q1(`select public.admin_activer_utilisateur($1,true)`, [agent])
ok('compte réactivé', (await q1(`select actif from public.profiles where user_id=$1`, [agent])).actif === true)
await refuse('on ne peut pas désactiver son propre compte',
  `select public.admin_activer_utilisateur($1,false)`, [admin], /votre propre/i)
await refuse('on ne peut pas supprimer son propre compte',
  `select public.admin_supprimer_utilisateur($1)`, [admin], /votre propre/i)

const jetable = await creerCompte('jetable', 'agent')
await q1(`select public.admin_supprimer_utilisateur($1)`, [jetable])
ok('un compte sans pointage se supprime',
   (await rows(`select 1 from public.profiles where user_id=$1`, [jetable])).length === 0)

// On pointe EN TANT QUE l'agent : le trigger attribue le pointage à
// auth.uid(), c'est lui qui décide, pas la valeur qu'on passe.
await connecte(agent)
await db.query(`insert into public.pointages(company_id,site_id,employee_id,agent_id,photo_path)
                values($1,$2,$3,$4,'x.jpg')`, [co, aRiad, ePlein, agent])
ok('le pointage est bien attribué à l’agent qui l’envoie',
   (await q1(`select agent_id from public.pointages where photo_path='x.jpg'`)).agent_id === agent)
await connecte(admin)
await refuse('un compte qui a pointé ne se supprime pas (historique préservé)',
  `select public.admin_supprimer_utilisateur($1)`, [agent], /pointage/i)
await q1(`select public.admin_reinitialiser_mot_de_passe($1,'NouveauMdp1')`, [agent])
ok('mot de passe réinitialisé (jamais lisible, seulement remplacé)',
   !!(await q1(`select encrypted_password from auth.users where id=$1`, [agent])).encrypted_password)
const liste = await rows(`select * from public.admin_liste_utilisateurs()`)
ok('la liste des comptes indique actif et supprimable',
   liste.length > 0 && 'actif' in liste[0] && 'supprimable' in liste[0])

section('Rôle « personnel » (RH)')
const rh = await creerCompte('rh1', 'rh')
await connecte(rh)
const eRH = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom,salaire,departement)
   values($1,$2,'AJOUTE PAR RH',3000,'NETTOYAGE') returning id`, [co, aRiad])).id
ok('le personnel peut ajouter un employé', !!eRH)
await db.query(`update public.employees set ville='RABAT' where id=$1`, [eRH])
ok('le personnel peut modifier un employé',
   (await q1(`select ville from public.employees where id=$1`, [eRH])).ville === 'RABAT')
await refuse('le personnel ne peut pas supprimer un employé',
  `select public.supprimer_employe($1)`, [eRH], REFUS)
await refuse('le personnel ne touche pas au pointage',
  `select public.marquer_present($1,current_date,'X')`, [eRH], REFUS)
await refuse('le personnel ne touche pas à la paie',
  `select public.valider_paie(gen_random_uuid())`, [], REFUS)
await refuse('le personnel ne crée pas de site',
  `select public.creer_site($1,'X')`, [co], REFUS)
await refuse('le personnel ne gère pas les comptes',
  `select public.admin_liste_utilisateurs()`, [], REFUS)
// La reprise s'applique aux employés déjà en base au moment du BLOC 11.
// Ici la base est vierge à l'installation : on vérifie donc la règle elle-même.
ok('« AGENT DE NETTOYAGE » donne le département « NETTOYAGE »',
   (await q1(`select nullif(trim(regexp_replace(
                upper('AGENT DE NETTOYAGE'), '^AGENT( DE| D''''| )?', '', 'i')), '') as d`)).d
   === 'NETTOYAGE')
await db.query(`update public.employees set qualification='AGENT DE SECURITE', departement=null where id=$1`, [eRH])
await db.query(`update public.employees
                   set departement = nullif(trim(regexp_replace(
                         upper(qualification), '^AGENT( DE| D''''| )?', '', 'i')), '')
                 where departement is null and qualification is not null`)
ok('la reprise renseigne le département des fiches existantes',
   (await q1(`select departement from public.employees where id=$1`, [eRH])).departement === 'SECURITE')

section('Verrou par mot de passe')
// Le mot de passe est haché : on crée un compte via la fonction officielle
// pour disposer d'un vrai hachage, puis on vérifie les deux cas.
await connecte(admin)
await q1(`select public.admin_creer_utilisateur('verrou1','SecretBien1','Test','validator')`)
const idVerrou = (await q1(`select user_id from public.profiles where username='verrou1'`)).user_id
await connecte(idVerrou)
ok('le bon mot de passe déverrouille',
   (await q1(`select public.verifier_mon_mot_de_passe('SecretBien1') as v`)).v === true)
ok('un mauvais mot de passe est refusé',
   (await q1(`select public.verifier_mon_mot_de_passe('MauvaisMdp') as v`)).v === false)
ok('un mot de passe vide est refusé',
   (await q1(`select public.verifier_mon_mot_de_passe('') as v`)).v === false)
await connecte(null)
ok('un visiteur non connecté est refusé',
   (await q1(`select public.verifier_mon_mot_de_passe('SecretBien1') as v`)).v === false)
await connecte(admin)
// On ne peut pas tester le mot de passe de quelqu'un d'autre : la fonction
// ne regarde que le compte connecté.
ok('la fonction ne teste que son propre compte',
   (await q1(`select public.verifier_mon_mot_de_passe('SecretBien1') as v`)).v === false)

// ══════════════════════════════════════ 12. SUPPRESSIONS PROTÉGÉES ═════

section('Suppressions protégées')
await connecte(bureau)
// La remise à zéro vient d'effacer l'historique de paie : on reclôture le
// mois pour retrouver des bulletins, sinon la protection n'a rien à protéger.
await q1(`select public.valider_pointage_mois($1,2026,3)`, [co])
const ap = (await q1(`select public.apercu_suppression_employe($1) as a`, [ePlein])).a
ok('un employé déjà passé en paie n’est pas supprimable', ap.supprimable === false)
await refuse('la suppression est refusée avec le motif',
  `select public.supprimer_employe($1)`, [ePlein], /bulletin|paie/i)

const eErreur = await creerEmploye('SAISIE ERRONEE', aPort, { cin: 'ZZ9' })
const ap2 = (await q1(`select public.apercu_suppression_employe($1) as a`, [eErreur])).a
ok('une fiche vierge est supprimable', ap2.supprimable === true && ap2.pointages === 0)
await q1(`select public.supprimer_employe($1)`, [eErreur])
ok('la fiche créée par erreur est supprimée',
   (await rows(`select 1 from public.employees where id=$1`, [eErreur])).length === 0)

await refuse('une annexe avec des employés ne se supprime pas sans destination',
  `select public.supprimer_site($1)`, [aAgdal], /employé/i)
const avant = Number((await q1(`select count(*) as c from public.employees where site_id in ($1,$2)`, [aAgdal, aRiad])).c)
await q1(`select public.supprimer_site($1,$2)`, [aAgdal, aRiad])
ok('les employés sont déplacés, jamais supprimés',
   Number((await q1(`select count(*) as c from public.employees where site_id=$1`, [aRiad])).c) === avant)

await q1(`select public.supprimer_site_principal($1)`, [commune])
ok('supprimer un site principal conserve ses annexes',
   !!(await q1(`select 1 from public.sites where id=$1`, [aRiad])))
ok('… en les détachant simplement',
   (await q1(`select site_principal_id from public.sites where id=$1`, [aRiad])).site_principal_id === null)

// ═══════════════════════════════════════════ 13. CAS LIMITES ═════

section('Cas limites')
await connecte(admin)

ok('toutes les tables ont la sécurité au niveau ligne activée',
   sansRlsInstall.length === 0, sansRlsInstall.join(', '))

// Un employé sans salaire ne casse pas la paie
const eZero = await creerEmploye('SANS SALAIRE', aRiad, { salaire: null, cin: 'ZS1' })
await connecte(bureau)
await q1(`select public.marquer_present($1,'2026-04-02'::date,'X')`, [eZero])
const perAvril = (await q1(`select public.valider_pointage_mois($1,2026,4) as id`, [co])).id
const lZero = await q1(`select * from public.lignes_paie where periode_id=$1 and employee_id=$2`,
                       [perAvril, eZero])
ok('un employé sans salaire donne 0, sans erreur', Number(lZero.net_a_payer) === 0)

// Un employé sans heures par jour : pas d'heures calculées, mais pas de plantage
await db.query(`update public.employees set heures_par_jour = null where id=$1`, [eZero])
await connecte(paie)
await q1(`select public.generer_lignes_paie($1)`, [perAvril])
const lZero2 = await q1(`select heures_effectuees from public.lignes_paie
                         where periode_id=$1 and employee_id=$2`, [perAvril, eZero])
ok('sans heures par jour, les heures restent vides', lZero2.heures_effectuees === null)

// Retenue négative refusée
await connecte(paie)
await refuse('une retenue négative est refusée',
  `select public.maj_ligne_paie($1,-5,0,0,null)`, [lZero.id], /négatif/i)

// Un congé à l'envers
await connecte(bureau)
await refuse('un congé dont la fin précède le début est refusé',
  `select public.creer_conge($1,'2026-05-10'::date,'2026-05-01'::date,'C',null)`,
  [eZero], /après la date de début/i)

// Un type de garde inventé
await refuse('un type de garde inconnu est refusé',
  `select public.marquer_present($1,'2026-05-04'::date,'ZZZ')`, [eZero], /invalide/i)

// Deux entreprises ne peuvent pas porter le même nom
await connecte(admin)
await refuse('deux entreprises ne peuvent pas porter le même nom',
  `select public.admin_creer_entreprise('Groupe Triple A')`, [], /déjà ce nom/i)

// Deux annexes du même nom dans la même société
await connecte(bureau)
await refuse('deux annexes ne peuvent pas porter le même nom',
  `select public.creer_site($1,'PORT')`, [co], /existe déjà/i)

// Le matricule reste unique dans une société
await refuse('deux employés ne peuvent pas avoir le même matricule',
  `insert into public.employees(company_id,site_id,nom_prenom,matricule)
   values($1,$2,'DOUBLON',$3)`,
  [co, aRiad, Number((await q1(`select matricule from public.employees where id=$1`, [ePlein])).matricule)],
  /unique|duplicat/i)

// On ne peut pas clôturer un mois qui n'a pas commencé
await refuse('impossible de clôturer un mois à venir',
  `select public.valider_pointage_mois($1,2099,1)`, [co], /pas encore commencé/i)

// ═══════════════════════════════════════════════════════ RÉSULTAT ═════

console.log('\n' + '═'.repeat(66))
if (F === 0) {
  console.log(`  ✅  ${P} vérifications, toutes réussies`)
} else {
  console.log(`  ❌  ${P} réussies, ${F} échouée(s) :`)
  for (const e of echecs) console.log('      · ' + e)
}
console.log('═'.repeat(66) + '\n')

await db.close()
process.exit(F ? 1 : 0)
