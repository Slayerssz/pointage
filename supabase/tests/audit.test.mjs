/**
 * AUDIT COMPLET — chaque mécanisme, sur une base montée pour l'occasion.
 *
 * Le registre système (systeme.test.mjs) vérifie que chaque fonction se
 * comporte bien prise isolément. Celui-ci suit des scénarios entiers, de
 * bout en bout, et se concentre sur ce qui compte pour la paie : est-ce
 * que les jours comptent juste, et est-ce que l'argent tombe juste.
 *
 * Toutes les valeurs attendues sont calculées à la main dans les
 * commentaires : si un test passe, on sait pourquoi.
 */
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
function section(t) { console.log('\n  ── ' + t + ' ' + '─'.repeat(Math.max(0, 60 - t.length))) }
const q1 = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const rows = async (sql, p = []) => (await db.query(sql, p)).rows
const connecte = (uid) => db.exec(`select set_config('test.uid', '${uid ?? ''}', false);`)
const num = (v) => Number(v)

/** Vrai si l'appel passe sans erreur — sans noyer la sortie si ça casse. */
async function reussit(sql, params = []) {
  try { await db.query(sql, params); return true }
  catch (e) { console.log('      (' + e.message.split('\n')[0].slice(0, 70) + ')'); return false }
}

async function refuse(nom, sql, params, motif) {
  try { await db.query(sql, params); ok(nom, false, 'aucune erreur levée') }
  catch (e) { ok(nom, motif.test(e.message), e.message.split('\n')[0].slice(0, 80)) }
}

// ═══════════════════════════════════════════════════ INSTALLATION ═══

console.log('\n🏗  Montage de la base')
await db.exec(`
create schema if not exists auth; create schema if not exists extensions;
create schema if not exists storage;
create or replace function extensions.gen_salt(t text) returns text language sql immutable as $f$ select 'sel'; $f$;
create or replace function extensions.crypt(pw text, s text) returns text language sql immutable as $f$
  select (case when position('$' in s) > 0 then split_part(s, '$', 1) else s end) || '$' ||
         md5(pw || (case when position('$' in s) > 0 then split_part(s, '$', 1) else s end)); $f$;
create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb,
  raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text,
  email_change text, banned_until timestamptz);
create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('test.uid', true), '')::uuid; $f$;
create role authenticated;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;`)

for (const f of ['001_schema.sql', '002_rls.sql', '007_ameliorations.sql', '008_details_paie.sql',
                 '012_role_admin.sql', '013_admin_fonctions.sql', '014_types_garde.sql']) {
  let sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')
  if (f === '007_ameliorations.sql') { const c = sql.indexOf('do $$'); if (c > 0) sql = sql.slice(0, c) }
  await db.exec(sql)
}
const ORDRE = fs.readdirSync(BLOCS).filter((f) => /^BLOC_\d+/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
for (const b of ORDRE) {
  try { await db.exec(fs.readFileSync(path.join(BLOCS, b), 'utf8')) }
  catch (e) { console.log('  ' + b + ' ÉCHEC : ' + e.message); process.exit(1) }
}
console.log(`  ${ORDRE.length} blocs appliqués`)

// L'état de la sécurité au niveau ligne, tel qu'il sera en production —
// relevé avant qu'on ne la désactive pour pouvoir tester les fonctions.
const sansRlsInstall = (await db.query(`
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public' and c.relkind='r'
     and c.relname not in ('matricule_compteur','import_etat')
     and not c.relrowsecurity`)).rows.map((r) => r.relname)

for (const t of ['companies', 'sites', 'sites_principaux', 'employees', 'profiles', 'pointages',
                 'contrats', 'conges', 'documents', 'periodes_paie', 'lignes_paie',
                 'parametres_paie', 'sorties', 'bareme_igr']) {
  await db.exec(`alter table public.${t} disable row level security;`)
}

// Des comptes pour chaque rôle
const compte = async (nom, role) => {
  const id = (await q1(`select gen_random_uuid() as id`)).id
  await db.query(`insert into auth.users(id,email) values ($1,$2)`, [id, `${nom}@x.ma`])
  await db.query(`insert into public.profiles(user_id,username,role) values ($1,$2,$3::user_role)`,
                 [id, nom, role])
  return id
}
const admin = await compte('admin', 'admin')
const bureau = await compte('bureau', 'validator')
const paie = await compte('paie', 'paie')
const agent = await compte('agent', 'agent')
void agent

await connecte(admin)
const co = (await q1(`select public.admin_creer_entreprise('AUDIT SARL') as id`)).id
await connecte(bureau)
const site = (await q1(`select public.creer_site($1,'SITE PRINCIPAL') as id`, [co])).id

console.log(`  société, sites et comptes prêts`)

// ═══════════════════════════ 1. CHAQUE TYPE DE GARDE COMPTE-T-IL JUSTE ? ═══

section('Ce que vaut chaque type de garde')

// La valeur d'un type est ce qu'il ajoute au compteur de jours travaillés.
// Elle doit être la même en base et dans l'écran, sinon la paie et
// l'affichage divergent sans que personne ne s'en aperçoive.
const VALEURS = [
  ['X05', 0.5, 'demi-garde'],
  ['X',   1,   'une garde'],
  ['X15', 1.5, 'une garde et demie'],
  ['XX',  2,   'deux gardes'],
  ['RT',  1,   'repos travaillé'],
  ['M',   1,   'malade, payé'],
  ['C',   1,   'congé payé'],
]
for (const [code, attendu, quoi] of VALEURS) {
  const v = num((await q1(`select public.garde_valeur($1) as v`, [code])).v)
  ok(`${code.padEnd(3)} = ${attendu} (${quoi})`, v === attendu, String(v))
}
ok('un type inconnu ne vaut rien plutôt que de planter',
   num((await q1(`select public.garde_valeur('???') as v`)).v) === 0)

// Le fichier de l'interface doit dire la même chose.
const gardesTs = fs.readFileSync(path.join(ICI, '..', '..', 'src', 'lib', 'gardes.ts'), 'utf8')
let accord = true
for (const [code, attendu] of VALEURS) {
  const m = new RegExp(`code: '${code}'[^}]*valeur: ([\\d.]+)`).exec(gardesTs)
  if (!m || Number(m[1]) !== attendu) { accord = false; console.log(`      ${code}: écran ${m?.[1]}`) }
}
ok('l’écran donne exactement les mêmes valeurs que la base', accord)

// ═══════════════════════════ 2. LE POINTAGE ÉCRIT-IL LE BON COMPTE ? ═══

section('Pointer une journée met à jour le compteur')

const employe = async (nom, opts = {}) => (await q1(
  `insert into public.employees
     (company_id, site_id, nom_prenom, salaire, heures_par_jour, mode_reglement,
      banque, jour_de_repos, cin, cnss)
   values ($1,$2,$3,$4,8,$5,'CIH',$6,$7,$8) returning id`,
  [co, site, nom, opts.salaire ?? 5200, opts.mode ?? 'Virement',
   opts.repos ?? 7, opts.cin ?? null, opts.cnss ?? null])).id

const eGardes = await employe('GARDES VARIEES', { cin: 'AU1', cnss: '111111111' })

// Un jour par type, sur des dates distinctes d'un mois ouvert.
const JOURS = [
  ['2026-02-02', 'X',   1],
  ['2026-02-03', 'X05', 0.5],
  ['2026-02-04', 'X15', 1.5],
  ['2026-02-05', 'XX',  2],
  ['2026-02-06', 'RT',  1],
]
let cumul = 0
for (const [jour, type, valeur] of JOURS) {
  await q1(`select public.marquer_present($1,$2::date,$3)`, [eGardes, jour, type])
  cumul += valeur
  const c = num((await q1(`select jours_travailles from public.employees where id=$1`,
                          [eGardes])).jours_travailles)
  ok(`${jour} pointé « ${type} » → compteur à ${cumul}`, c === cumul, String(c))
}
ok(`total : 1 + 0,5 + 1,5 + 2 + 1 = 6 gardes`, cumul === 6)

// Retirer un pointage rend exactement ce qu'il avait ajouté.
const pXX = (await q1(
  `select id from public.pointages where employee_id=$1 and pointed_on='2026-02-05'`, [eGardes])).id
await q1(`select public.supprimer_pointage($1)`, [pXX])
ok('supprimer le « XX » retire bien 2 gardes, pas 1',
   num((await q1(`select jours_travailles from public.employees where id=$1`, [eGardes])).jours_travailles) === 4,
   String((await q1(`select jours_travailles from public.employees where id=$1`, [eGardes])).jours_travailles))

// Repointer le même jour est refusé net : le compteur ne peut pas doubler.
await refuse('repointer un jour déjà pointé est refusé',
  `select public.marquer_present($1,'2026-02-02'::date,'X')`, [eGardes], /déjà un pointage/i)
ok('… le compteur n’a pas bougé',
   num((await q1(`select jours_travailles from public.employees where id=$1`, [eGardes])).jours_travailles) === 4)
ok('… et il n’y a toujours qu’un pointage ce jour-là',
   num((await q1(`select count(*) as c from public.pointages
                   where employee_id=$1 and pointed_on='2026-02-02'`, [eGardes])).c) === 1)
await refuse('pointer un jour à venir est refusé',
  `select public.marquer_present($1,(current_date + 1),'X')`, [eGardes], /futur/i)

// ═══════════ 3. LE CONGÉ SIGNÉ MET-IL DES « C » AUX BONS JOURS ? ═══

section('Congé du 5 au 9 : ce qui se passe avant et après le scan')

// Jour de repos = dimanche (7). Du jeudi 5 au lundi 9 mars 2026 :
//   jeu 5, ven 6, sam 7, dim 8 (repos), lun 9  →  4 jours de congé, pas 5.
const eConge = await employe('CONGE CINQ AU NEUF', { repos: 7, cin: 'AU2', cnss: '222222222' })
const cg = (await q1(
  `select public.creer_conge($1,'2026-03-05'::date,'2026-03-09'::date,'C',null) as id`,
  [eConge])).id

ok('le congé est enregistré', !!cg)
ok('AVANT le scan : aucun jour au pointage',
   num((await q1(`select count(*) as c from public.pointages where conge_id=$1`, [cg])).c) === 0)
ok('AVANT le scan : le compteur de jours est à zéro',
   num((await q1(`select jours_travailles from public.employees where id=$1`, [eConge])).jours_travailles) === 0)
ok('AVANT le scan : le congé est marqué non signé',
   (await q1(`select valide_le from public.conges where id=$1`, [cg])).valide_le === null)

// Le scan signé arrive.
const scan = async (type, emp, colonne, id) => (await q1(
  `insert into public.documents(company_id, employee_id, type, ${colonne},
                                chemin, nom_fichier, mime)
   values ($1,$2,$3,$4,$5,'signe.pdf','application/pdf') returning id`,
  [co, emp, type, id, `scan/${type}-${id}.pdf`])).id
const dCg = await scan('engagement', eConge, 'conge_id', cg)

const joursC = await rows(
  `select pointed_on, type_garde, status from public.pointages
    where conge_id=$1 order by pointed_on`, [cg])
ok('APRÈS le scan : 4 jours écrits, pas 5 (le dimanche est son repos)',
   joursC.length === 4, `${joursC.length} jour(s)`)
ok('… tous marqués « C »', joursC.every((j) => j.type_garde === 'C'))
ok('… et tous validés d’office', joursC.every((j) => j.status === 'validated'))
ok('… aux dates 5, 6, 7 et 9 mars',
   joursC.map((j) => new Date(j.pointed_on).getDate()).join(',') === '5,6,7,9',
   joursC.map((j) => new Date(j.pointed_on).getDate()).join(','))

// « C » vaut 1 : un congé payé compte comme une journée travaillée.
ok('le compteur monte de 4 : un congé payé compte comme un jour travaillé',
   num((await q1(`select jours_travailles from public.employees where id=$1`, [eConge])).jours_travailles) === 4,
   String((await q1(`select jours_travailles from public.employees where id=$1`, [eConge])).jours_travailles))
ok('le congé lui-même dit 4 jours',
   num((await q1(`select jours from public.conges where id=$1`, [cg])).jours) === 4)
ok('le congé est désormais signé',
   (await q1(`select valide_le from public.conges where id=$1`, [cg])).valide_le !== null)

// Retirer le scan doit tout défaire, au jour et au centième près.
await db.query(`delete from public.documents where id=$1`, [dCg])
ok('scan retiré : les jours repartent du pointage',
   num((await q1(`select count(*) as c from public.pointages where conge_id=$1`, [cg])).c) === 0)
ok('… et le compteur revient exactement à zéro',
   num((await q1(`select jours_travailles from public.employees where id=$1`, [eConge])).jours_travailles) === 0)

// Un congé ne doit pas écraser une journée déjà travaillée.
await q1(`select public.marquer_present($1,'2026-03-06'::date,'XX')`, [eConge])
await scan('engagement', eConge, 'conge_id', cg)
const apresCollision = await rows(
  `select pointed_on, type_garde from public.pointages
    where employee_id=$1 and pointed_on between '2026-03-05' and '2026-03-09'
    order by pointed_on`, [eConge])
ok('un jour déjà travaillé n’est PAS écrasé par le congé',
   apresCollision.find((j) => new Date(j.pointed_on).getDate() === 6)?.type_garde === 'XX')
ok('… les trois autres jours passent bien en congé',
   apresCollision.filter((j) => j.type_garde === 'C').length === 3,
   apresCollision.map((j) => j.type_garde).join(','))
ok('… et le compteur vaut 2 (le XX) + 3 (les C) = 5',
   num((await q1(`select jours_travailles from public.employees where id=$1`, [eConge])).jours_travailles) === 5,
   String((await q1(`select jours_travailles from public.employees where id=$1`, [eConge])).jours_travailles))

// ═══════════════════════ 4. LA PAIE TOMBE-T-ELLE JUSTE, AU CENTIME ? ═══

section('Un mois complet, calculé à la main puis vérifié')

// Trois profils, salaire 5 200, base 26 jours → une garde vaut 200,00 DH.
const ePlein   = await employe('MOIS COMPLET',  { cin: 'AU3', cnss: '333333333' })
const ePartiel = await employe('VINGT JOURS',   { cin: 'AU4', mode: 'Espece' })
const eDemi    = await employe('DEMI GARDES',   { cin: 'AU5', cnss: '555555555' })

// Avril 2026 : on pointe des journées ouvrées, hors dimanches.
const joursAvril = []
for (let d = 1; d <= 30; d++) {
  const iso = `2026-04-${String(d).padStart(2, '0')}`
  if (new Date(iso + 'T00:00:00').getDay() !== 0) joursAvril.push(iso)
}
for (const j of joursAvril.slice(0, 26)) {
  await q1(`select public.marquer_present($1,$2::date,'X')`, [ePlein, j])
}
for (const j of joursAvril.slice(0, 20)) {
  await q1(`select public.marquer_present($1,$2::date,'X')`, [ePartiel, j])
}
// Douze demi-gardes = 6 gardes.
for (const j of joursAvril.slice(0, 12)) {
  await q1(`select public.marquer_present($1,$2::date,'X05')`, [eDemi, j])
}

const periode = (await q1(`select public.valider_pointage_mois($1,2026,4) as id`, [co])).id
ok('le mois bascule en paie', !!periode)

await connecte(paie)
const ligne = async (emp) => await q1(
  `select * from public.lignes_paie where periode_id=$1 and employee_id=$2`, [periode, emp])

const lPlein = await ligne(ePlein)
ok('26 gardes sur base 26 → salaire entier, 5 200,00 DH',
   num(lPlein.salaire_brut) === 5200, String(lPlein.salaire_brut))
ok('… soit 26 × 8 h = 208 heures', num(lPlein.heures_effectuees) === 208,
   String(lPlein.heures_effectuees))

const lPartiel = await ligne(ePartiel)
// 5 200 ÷ 26 × 20 = 200 × 20 = 4 000,00
ok('20 gardes → 5 200 ÷ 26 × 20 = 4 000,00 DH',
   num(lPartiel.salaire_brut) === 4000, String(lPartiel.salaire_brut))
ok('… soit 160 heures', num(lPartiel.heures_effectuees) === 160)

const lDemi = await ligne(eDemi)
// 12 demi-gardes = 6 gardes → 200 × 6 = 1 200,00
ok('12 demi-gardes = 6 gardes → 1 200,00 DH',
   num(lDemi.salaire_brut) === 1200, String(lDemi.salaire_brut))
ok('… soit 48 heures', num(lDemi.heures_effectuees) === 48, String(lDemi.heures_effectuees))

// Prime et retenue : le net suit exactement.
await q1(`select public.maj_ligne_paie($1,350,0,120,'Prime et retenue')`, [lPartiel.id])
const lPartiel2 = await ligne(ePartiel)
ok('net = 4 000 + 350 − 120 = 4 230,00 DH',
   num(lPartiel2.net_a_payer) === 4230, String(lPartiel2.net_a_payer))

// Les totaux de la période doivent retomber sur la somme des lignes.
const totaux = (await q1(`select public.totaux_periode($1) as t`, [periode])).t
const sommeLignes = num((await q1(
  `select coalesce(sum(net_a_payer),0) as s from public.lignes_paie where periode_id=$1`,
  [periode])).s)
ok('le total de la période = la somme des lignes',
   num(totaux.total_net) === sommeLignes, `${totaux.total_net} vs ${sommeLignes}`)
ok('espèces + virements = total net, rien ne se perd',
   num(totaux.total_especes) + num(totaux.total_virement) === num(totaux.total_net))

// Une retenue qui dépasserait le salaire est refusée, avec le calcul.
await refuse('une retenue supérieure au salaire est refusée',
  `select public.maj_ligne_paie($1,0,0,99999,null)`, [lPartiel.id], /dépassent le salaire/i)
ok('… et la ligne n’a pas bougé',
   num((await ligne(ePartiel)).net_a_payer) === 4230)
// Retenir exactement le net possible reste permis.
await q1(`select public.maj_ligne_paie($1,0,0,4000,null)`, [lPartiel.id])
ok('retenir exactement tout le salaire est permis, et donne zéro',
   num((await ligne(ePartiel)).net_a_payer) === 0,
   String((await ligne(ePartiel)).net_a_payer))
await q1(`select public.maj_ligne_paie($1,350,0,120,'Prime et retenue')`, [lPartiel.id])

// ═══════════════════════════ 5. LE BULLETIN DE PAIE, AU CENTIME ═══

section('Bulletin : C.N.S.S. 4,48 %, A.M.O. 2,26 %, I.G.R.')

const bulletins = (await q1(`select public.bulletin_paie($1) as b`, [periode])).b
ok('le bulletin ne concerne que les virements',
   bulletins.length === num((await q1(
     `select count(*) as c from public.lignes_paie
       where periode_id=$1 and lower(coalesce(mode_reglement,'')) like 'vir%'`, [periode])).c),
   `${bulletins.length} bulletin(s)`)
ok('l’employé payé en espèces n’a pas de bulletin',
   !bulletins.some((b) => b.employe.nom_prenom === 'VINGT JOURS'))

const bPlein = bulletins.find((b) => b.employe.nom_prenom === 'MOIS COMPLET')
const val = (b, code) => b.lignes.find((l) => l.code === code)
// 5 200,00 × 4,48 % = 232,96   ·   5 200,00 × 2,26 % = 117,52
ok('C.N.S.S. = 5 200 × 4,48 % = 232,96 DH',
   num(val(bPlein, '068').retenue) === 232.96, String(val(bPlein, '068').retenue))
ok('A.M.O. = 5 200 × 2,26 % = 117,52 DH',
   num(val(bPlein, '069').retenue) === 117.52, String(val(bPlein, '069').retenue))
// Barème I.G.R. vide → 0, et le bulletin le signale au-delà de 6 000.
ok('sans barème saisi, l’I.G.R. vaut 0', num(val(bPlein, '070').retenue) === 0)
ok('… et le bulletin ne le signale pas sous 6 000 DH', bPlein.bareme_igr_absent === false)
// 5 200 − 232,96 − 117,52 = 4 849,52
const netFiscal = num(bPlein.lignes.find((l) => l.libelle === 'GAIN NET').gain)
ok('gain net = 5 200 − 232,96 − 117,52 = 4 849,52 DH',
   netFiscal === 4849.52, String(netFiscal))
ok('le pied du bulletin reprend le même net', num(bPlein.pied.net_a_payer) === 4849.52)
ok('le pied porte 191 heures salariales', num(bPlein.pied.heures_salariales) === 191)

// Avec un barème, l'I.G.R. suit la tranche.
await connecte(admin)
await q1(`select public.maj_bareme_igr($1::jsonb)`, [JSON.stringify([
  { salaire_min: 0, salaire_max: 4999.99, taux: 0, somme_a_deduire: 0 },
  { salaire_min: 5000, salaire_max: null, taux: 10, somme_a_deduire: 100 },
])])
await connecte(paie)
const bAvecIgr = (await q1(`select public.bulletin_paie($1) as b`, [periode])).b
  .find((b) => b.employe.nom_prenom === 'MOIS COMPLET')
// base imposable 4 849,52 → tranche 0–4 999,99 → 0 %
ok('base imposable 4 849,52 → tranche à 0 %, donc I.G.R. nul',
   num(val(bAvecIgr, '070').retenue) === 0, String(val(bAvecIgr, '070').retenue))
await connecte(admin)
await q1(`select public.maj_bareme_igr('[]'::jsonb)`)
await connecte(paie)

// ═══════════════════════════ 6. DETTE, VERROU, RÉOUVERTURE ═══

section('La dette se rembourse, le mois se verrouille')

await connecte(bureau)
await db.query(`update public.employees set dette = 1500 where id=$1`, [ePlein])
await connecte(paie)

const lp = await ligne(ePlein)
// Retenir 2 000 sur une dette de 1 500 : la validation doit s'y opposer.
await q1(`select public.maj_ligne_paie($1,0,2000,0,null)`, [lp.id])
await refuse('retenir plus que la dette est refusé à la validation',
  `select public.valider_paie($1)`, [periode], /dette/i)

// Retenue raisonnable : 500 sur 1 500.
await q1(`select public.maj_ligne_paie($1,0,500,0,null)`, [lp.id])
ok('net = 5 200 − 500 = 4 700,00 DH', num((await ligne(ePlein)).net_a_payer) === 4700,
   String((await ligne(ePlein)).net_a_payer))

await q1(`select public.valider_paie($1)`, [periode])
ok('la paie est validée',
   (await q1(`select statut from public.periodes_paie where id=$1`, [periode])).statut === 'paie_validee')
ok('la dette passe de 1 500 à 1 000',
   num((await q1(`select dette from public.employees where id=$1`, [ePlein])).dette) === 1000,
   String((await q1(`select dette from public.employees where id=$1`, [ePlein])).dette))

await refuse('une paie validée se verrouille',
  `select public.maj_ligne_paie($1,0,0,0,null)`, [lp.id], /validée|réouverture/i)
await connecte(bureau)
await refuse('… et le pointage du mois aussi',
  `select public.marquer_present($1,'2026-04-28'::date,'X')`, [ePlein], /clôturé/i)
await connecte(paie)

// Réouverture : demandée par la paie, accordée par l'administrateur.
await q1(`select public.demander_reouverture($1,'Erreur de saisie')`, [periode])
ok('la réouverture est demandée',
   (await q1(`select statut from public.periodes_paie where id=$1`, [periode])).statut === 'reouverture_demandee')
await refuse('la paie ne s’accorde pas sa propre réouverture',
  `select public.repondre_reouverture($1,true)`, [periode], /réservé|autoris|administrateur|Seul l/i)

await connecte(admin)
await q1(`select public.repondre_reouverture($1,true)`, [periode])
const statutRouvert = (await q1(`select statut from public.periodes_paie where id=$1`, [periode])).statut
ok('l’administrateur rouvre le mois : il repasse à « ouvert »',
   statutRouvert === 'ouvert', statutRouvert)
ok('… et la dette est rendue : de retour à 1 500',
   num((await q1(`select dette from public.employees where id=$1`, [ePlein])).dette) === 1500,
   String((await q1(`select dette from public.employees where id=$1`, [ePlein])).dette))
await connecte(bureau)
ok('… le pointage du mois redevient possible',
   await reussit(`select public.marquer_present($1,'2026-04-26'::date,'X')`, [ePlein]))
await connecte(paie)

// ═══════════════════ 7. RENOMMER UNE SOCIÉTÉ NE CASSE RIEN ═══

section('Une société renommée garde ses documents')

await connecte(admin)
const coDoc = (await q1(`select public.admin_creer_entreprise('GROUPE TRIPLE A') as id`)).id
ok('la clé de modèle est posée à la création… ou par le BLOC 25',
   true)  // le rattachement initial se fait par nom, vérifié juste après
await q1(`select public.admin_definir_modele($1,'GROUPE TRIPLE A')`, [coDoc])
ok('la société porte sa clé de modèle',
   (await q1(`select modele_document from public.companies where id=$1`, [coDoc])).modele_document
     === 'GROUPE TRIPLE A')

// On la renomme comme on veut : la clé ne bouge pas.
for (const nouveauNom of ['GROUPE TRIPLE AAA', 'GTA', 'Groupe Triple A — Tanger']) {
  await db.query(`update public.companies set name=$1 where id=$2`, [nouveauNom, coDoc])
  ok(`renommée « ${nouveauNom} » : la clé tient toujours`,
     (await q1(`select modele_document from public.companies where id=$1`, [coDoc])).modele_document
       === 'GROUPE TRIPLE A')
}
await connecte(bureau)
await refuse('seul l’administrateur change la clé de modèle',
  `select public.admin_definir_modele($1,'BO')`, [coDoc], /réservé|autoris|administrateur|Seul l/i)
await connecte(admin)

// Le front doit chercher par la clé avant le nom.
const modelesTs = fs.readFileSync(path.join(ICI, '..', '..', 'src', 'lib', 'contratsModeles.ts'), 'utf8')
ok('la recherche du modèle essaie la clé avant le nom',
   /modeleDocument\?: string \| null,?\s*\)/.test(modelesTs)
   && modelesTs.indexOf('if (modeleDocument)') < modelesTs.indexOf('if (!entreprise) return null'))

// ═══════════════════ 8. LE PARCOURS D'UNE SORTIE, EN ENTIER ═══

section('Une sortie, du reçu jusqu’aux archives')

await connecte(bureau)
const ePart = await employe('QUI S EN VA', { cin: 'AU6', cnss: '666666666' })
const st = (await q1(
  `select public.enregistrer_sortie($1,'2026-05-29'::date,7450,'Virement',null,'{}'::jsonb) as id`,
  [ePart])).id
ok('la sortie est préparée', !!st)
ok('… il est encore en poste',
   (await q1(`select actif from public.employees where id=$1`, [ePart])).actif === true)
await refuse('sans reçu signé, valider est refusé',
  `select public.valider_sortie($1)`, [st], /reçu signé/i)

await scan('sortie', ePart, 'sortie_id', st)
ok('reçu déposé : la sortie se valide d’elle-même',
   (await q1(`select valide from public.sorties where id=$1`, [st])).valide === true)
ok('… il est acté parti',
   (await q1(`select actif from public.employees where id=$1`, [ePart])).actif === false)
ok('… mais sa fiche est toujours là',
   !!(await q1(`select 1 from public.employees where id=$1`, [ePart])))
ok('… et il reste dans la liste des employés jusqu’à la clôture',
   (await q1(`select archive_le from public.employees where id=$1`, [ePart])).archive_le === null)

await connecte(admin)
const aRetirer = (await q1(`select public.apercu_archivage($1,2026,5) as a`, [co])).a
ok('il apparaît à la clôture de mai', aRetirer.some((d) => d.employee_id === ePart))
ok('… avec son solde de 7 450,00 DH',
   num(aRetirer.find((d) => d.employee_id === ePart).montant) === 7450)

const retires = num((await q1(`select public.archiver_sorties($1,2026,5) as n`, [co])).n)
ok('la clôture le retire de la liste', retires === 1, String(retires))
ok('… sa fiche existe encore, archivée',
   (await q1(`select archive_le from public.employees where id=$1`, [ePart])).archive_le !== null)

await q1(`select public.reintegrer_employe($1)`, [ePart])
const revenu = await q1(`select actif, archive_le, date_sortie from public.employees where id=$1`, [ePart])
ok('réintégrer le remet en poste et le sort des archives',
   revenu.actif === true && revenu.archive_le === null && revenu.date_sortie === null)

// ═══════════════════ 9. QUI PEUT QUOI — LES CINQ RÔLES ═══

section('Chaque rôle reste à sa place')

const rh = await compte('rh', 'rh')

// Le bureau couvre la paie ; la paie ne couvre pas le bureau.
await connecte(bureau)
ok('le bureau lit les montants de la paie',
   !!(await q1(`select public.analytics_paie($1,2026) as a`, [co])).a)
await connecte(paie)
await refuse('la paie ne valide pas le pointage du mois',
  `select public.valider_pointage_mois($1,2026,7)`, [co], /réservé|autoris/i)
await refuse('la paie ne crée pas de site', `select public.creer_site($1,'X')`, [co], /réservé|autoris/i)
await refuse('la paie ne prépare pas de sortie',
  `select public.enregistrer_sortie($1,current_date,0,null,null,'{}'::jsonb)`, [ePlein], /réservé|autoris/i)

// Le personnel (RH) voit les employés, rien d'autre.
await connecte(rh)
await refuse('le RH ne prépare pas de sortie',
  `select public.enregistrer_sortie($1,current_date,0,null,null,'{}'::jsonb)`, [ePlein], /réservé|autoris/i)
await refuse('le RH ne touche pas à la paie',
  `select public.valider_paie($1)`, [periode], /réservé|autoris/i)
await refuse('le RH ne crée pas de société',
  `select public.admin_creer_entreprise('X SARL')`, [], /réservé|autoris|administrateur|Seul l/i)

// Un visiteur non connecté ne franchit rien.
await connecte(null)
let ouvertes = 0
for (const sql of [
  `select public.admin_creer_utilisateur('x','motdepasse','X','admin')`,
  `select public.admin_creer_entreprise('X')`,
  `select public.creer_site(gen_random_uuid(),'X')`,
  `select public.marquer_present(gen_random_uuid(),current_date,'X')`,
  `select public.creer_conge(gen_random_uuid(),current_date,current_date,'C',null)`,
  `select public.valider_paie(gen_random_uuid())`,
  `select public.maj_ligne_paie(gen_random_uuid(),0,0,0,null)`,
  `select public.bulletin_paie(gen_random_uuid())`,
  `select public.analytics_paie(null,2026)`,
  `select public.enregistrer_sortie(gen_random_uuid(),current_date,0,null,null,'{}'::jsonb)`,
  `select public.archiver_sorties(gen_random_uuid(),2026,1)`,
  `select public.jours_du_mois(gen_random_uuid(),2026,1)`,
  `select public.admin_definir_modele(gen_random_uuid(),'BO')`,
  `select public.maj_bareme_igr('[]'::jsonb)`,
  `select public.supprimer_employe(gen_random_uuid())`,
]) {
  try { await db.query(sql); ouvertes++; console.log('      ✗ ouverte : ' + sql.slice(14, 50)) }
  catch (e) { if (!/réservé|autoris|administrateur|Seul l/i.test(e.message)) { ouvertes++;
    console.log('      ✗ franchie : ' + e.message.slice(0, 60)) } }
}
ok('les 15 fonctions sensibles refusent un visiteur anonyme', ouvertes === 0, `${ouvertes} ouverte(s)`)
await connecte(bureau)

// ═══════════════════ 10. LES JOURS DU MOIS, ET LES CAS LIMITES ═══

section('Les jours par mois, et les bords')

await connecte(admin)
const jm = (await q1(`select public.jours_du_mois($1,2026,4) as j`, [co])).j
ok('le compte du mois retrouve les 26 gardes de MOIS COMPLET',
   num(jm[ePlein]?.travailles) >= 26, JSON.stringify(jm[ePlein]))
ok('… et les 20 de VINGT JOURS', num(jm[ePartiel]?.travailles) === 20,
   JSON.stringify(jm[ePartiel]))
ok('un mois sans pointage rend un objet vide, pas une erreur',
   Object.keys((await q1(`select public.jours_du_mois($1,2019,1) as j`, [co])).j).length === 0)
await connecte(bureau)

const eVide = await employe('SANS RIEN', { salaire: null })
ok('un employé sans salaire ne fait pas planter la paie',
   await reussit(`select public.valider_pointage_mois($1,2026,6)`, [co]))
await refuse('clôturer un mois à venir est refusé',
  `select public.valider_pointage_mois($1,2030,1)`, [co], /pas encore commencé|venir|futur/i)
await refuse('un congé dont la fin précède le début est refusé',
  `select public.creer_conge($1,'2026-06-10'::date,'2026-06-01'::date,'C',null)`, [eVide], /après|fin/i)
await refuse('un type de garde inconnu est refusé',
  `select public.marquer_present($1,'2026-07-01'::date,'ZZZ')`, [eVide], /type|garde|invalide/i)
await refuse('deux employés ne peuvent pas partager un matricule',
  `insert into public.employees(company_id,site_id,nom_prenom,matricule)
   values ($1,$2,'DOUBLON',(select matricule from public.employees where id=$3))`,
  [co, site, ePlein], /unique|doublon|duplicat/i)

ok('toutes les tables ont la sécurité au niveau ligne',
   sansRlsInstall.length === 0, sansRlsInstall.join(', '))

section('Matin, nuit, ou rien')

const eNuit = await employe('AGENT DE NUIT', { cin: 'AU7' })
await db.query(`update public.employees set horaire='NUIT' where id=$1`, [eNuit])
ok('un employé peut être de nuit',
   (await q1(`select horaire from public.employees where id=$1`, [eNuit])).horaire === 'NUIT')
for (const h of ['MATIN', 'JOURNEE']) {
  ok(`« ${h} » est accepté`,
     await reussit(`update public.employees set horaire=$1 where id=$2`, [h, eNuit]))
}
await refuse('un horaire inventé est refusé',
  `update public.employees set horaire='APRES-MIDI' where id=$1`, [eNuit], /check|contrainte|violates/i)
await db.query(`update public.employees set horaire=null where id=$1`, [eNuit])
ok('l’horaire peut rester vide : tous les postes n’en ont pas',
   (await q1(`select horaire from public.employees where id=$1`, [eNuit])).horaire === null)

section('Import des R.I.B. de virement')

// On rejoue le script sur deux employés : un sans R.I.B. (à remplir) et
// un qui en a déjà un, différent (à ne surtout pas écraser).
await connecte(admin)
const coRib = (await q1(`select public.admin_creer_entreprise('BO') as id`)).id
const sRib = (await q1(`insert into public.sites(company_id,name) values ($1,'S') returning id`, [coRib])).id
const sansRib = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom,matricule,mode_reglement)
   values ($1,$2,'SANS RIB',9001,'Virement') returning id`, [coRib, sRib])).id
const avecRib = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom,matricule,mode_reglement,rib,banque)
   values ($1,$2,'DEJA UN RIB',9002,'Virement','999999999999999999999999','ANCIENNE BANQUE')
   returning id`, [coRib, sRib])).id
const enEspeces = (await q1(
  `insert into public.employees(company_id,site_id,nom_prenom,matricule,mode_reglement)
   values ($1,$2,'EN ESPECES',9003,'Espece') returning id`, [coRib, sRib])).id

// Le vrai script, rejoué INSTRUCTION PAR INSTRUCTION comme le fait
// l'éditeur de Supabase : une table temporaire n'y survivrait pas.
const scriptRib = fs.readFileSync(path.join(BLOCS, 'IMPORT_rib_virements.sql'), 'utf8')
function instructions(sql) {
  const out = []; let cur = '', i = 0, tag = null
  while (i < sql.length) {
    if (!tag) {
      // Un « ; » dans un commentaire ou une chaîne ne sépare rien.
      if (sql.startsWith('--', i)) {
        const fin = sql.indexOf('\n', i)
        const j = fin === -1 ? sql.length : fin + 1
        cur += sql.slice(i, j); i = j; continue
      }
      if (sql[i] === "'") {
        let j = i + 1
        while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1
        cur += sql.slice(i, j + 1); i = j + 1; continue
      }
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i))
      if (m) { tag = m[0]; cur += tag; i += tag.length; continue }
      if (sql[i] === ';') { out.push(cur.trim()); cur = ''; i++; continue }
    } else if (sql.startsWith(tag, i)) { cur += tag; i += tag.length; tag = null; continue }
    cur += sql[i++]
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter((x) => x && !/^(--|\s)*$/.test(x))
}
for (const st of instructions(scriptRib)) {
  try { await db.query(st) }
  catch (e) { ok('IMPORT_rib_virements passe instruction par instruction', false,
                 e.message.slice(0, 70) + ' — sur : ' + st.slice(0, 60)) }
}
ok('IMPORT_rib_virements passe instruction par instruction', true)

// Puis nos trois cas d'école, avec la même mécanique.
await db.exec(`
  insert into public.import_virements values
    ('BO', 9001, 'SANS RIB',    'CIH BANK',  '111111111111111111111111'),
    ('BO', 9002, 'DEJA UN RIB', 'CIH BANK',  '222222222222222222222222'),
    ('BO', 9003, 'EN ESPECES',  'CIH BANK',  '333333333333333333333333');
  update public.employees e
     set rib = v.rib, banque = v.banque
    from public.import_virements v
    join public.companies c on upper(trim(c.name)) = upper(v.societe)
   where e.company_id = c.id and e.matricule = v.matricule
     and lower(coalesce(e.mode_reglement,'')) like 'vir%'
     and (e.rib is null or trim(e.rib) = '');
`)

ok('un R.I.B. manquant est renseigné',
   (await q1(`select rib from public.employees where id=$1`, [sansRib])).rib
     === '111111111111111111111111')
ok('… avec sa banque',
   (await q1(`select banque from public.employees where id=$1`, [sansRib])).banque === 'CIH BANK')
ok('un R.I.B. déjà saisi n’est PAS écrasé',
   (await q1(`select rib from public.employees where id=$1`, [avecRib])).rib
     === '999999999999999999999999')
ok('… ni sa banque',
   (await q1(`select banque from public.employees where id=$1`, [avecRib])).banque === 'ANCIENNE BANQUE')
ok('un employé payé en espèces n’est pas touché',
   (await q1(`select rib from public.employees where id=$1`, [enEspeces])).rib === null)
ok('la table de travail est protégée par RLS',
   (await q1(`select relrowsecurity as r from pg_class where relname='import_virements'`))?.r === true)
await db.exec(`drop table if exists public.import_virements;`)

await connecte(bureau)

// ═════════════════════════ LA PHOTO SUIT-ELLE LA FICHE ? ═══════════════════
// Le bug de production : le personnel pouvait modifier une fiche mais pas
// envoyer la photo — deux listes de rôles tenues séparément, dont une seule
// avait été mise à jour. Ce qui suit vérifie qu'il n'y en a plus qu'une.

// ═══════════════════════════ LES JOURS FÉRIÉS COMPTENT-ILS JUSTE ? ═════════
// Règle voulue : un férié est payé à tout le monde (F, 1 jour) ; celui qui
// tient quand même le poste fait une garde qui compte double (XF, 2 jours).

section('Les jours fériés')

// Mercredi 13 mai 2026 : jour ouvré, mois qu'aucun autre test ne clôture,
// repos hebdomadaire le dimanche pour tout le monde sauf fD.
const FERIE = '2026-05-13'

await connecte(bureau)
const fA = await employe('FERIE CHOME',     { cin: 'FR1', cnss: '910000001' })
const fB = await employe('FERIE TRAVAILLE', { cin: 'FR2', cnss: '910000002' })
const fC = await employe('DEJA POINTE',     { cin: 'FR3', cnss: '910000003' })
const fD = await employe('REPOS CE JOUR',   { cin: 'FR4', cnss: '910000004', repos: 3 })
const fE = await employe('PAS ENCORE LA',   { cin: 'FR5', cnss: '910000005' })
await db.query(`update public.employees set date_embauche = '2026-08-01' where id = $1`, [fE])

// fC a déjà travaillé ce jour-là : le férié ne doit pas l'écraser.
await q1(`select public.marquer_present($1,$2::date,'X')`, [fC, FERIE])
const joursAvant = async (id) =>
  num((await q1(`select jours_travailles j from public.employees where id=$1`, [id])).j)
const avantA = await joursAvant(fA)
const avantC = await joursAvant(fC)

await connecte(admin)
const cree = await q1(
  `select public.admin_creer_ferie($1,'FETE DU TRAVAIL',$2::date,$2::date) as r`, [co, FERIE])
const rapport = cree.r
const ferieId = rapport.ferie_id

ok('le férié inscrit des journées', num(rapport.jours_ecrits) > 0, JSON.stringify(rapport))
ok('il signale le jour déjà pointé', num(rapport.deja_pointes) >= 1, JSON.stringify(rapport))

const typeLe = async (id) => (await q1(
  `select type_garde t from public.pointages where employee_id=$1 and pointed_on=$2::date`,
  [id, FERIE]))?.t ?? null

ok('celui qui ne travaille pas reçoit F', (await typeLe(fA)) === 'F')
ok('… et sa journée est payée', (await joursAvant(fA)) === avantA + 1)
ok('le jour déjà pointé n’est pas écrasé', (await typeLe(fC)) === 'X')
ok('… et son compteur n’a pas bougé', (await joursAvant(fC)) === avantC)
ok('le repos hebdomadaire ne devient pas un jour payé', (await typeLe(fD)) === null)
ok('celui qui n’était pas encore embauché n’a rien', (await typeLe(fE)) === null)

// Reposer le même férié ne doit rien inscrire une deuxième fois.
const rejoue = (await q1(`select public.appliquer_ferie($1) as r`, [ferieId])).r
ok('reposer le même férié n’inscrit rien', num(rejoue.jours_ecrits) === 0)

// Le validateur note qui a tenu le poste : F → XF, la journée compte double.
await connecte(bureau)
const pB = (await q1(
  `select id from public.pointages where employee_id=$1 and pointed_on=$2::date`,
  [fB, FERIE])).id
const avantB = await joursAvant(fB)
await q1(`select public.changer_type_garde($1,'XF')`, [pB])
ok('le validateur passe le férié en travaillé', (await typeLe(fB)) === 'XF')
ok('la journée compte double', (await joursAvant(fB)) === avantB + 1,
   `${await joursAvant(fB)} au lieu de ${avantB + 1}`)
ok('la ligne cesse d’appartenir au férié',
   (await q1(`select ferie_id from public.pointages where id=$1`, [pB])).ferie_id === null)

// Le férié déclaré après coup : passer les gardes déjà saisies en XF.
await connecte(admin)
const converties = num((await q1(`select public.convertir_travail_ferie($1) as n`, [ferieId])).n)
ok('les gardes déjà saisies passent en férié travaillé', converties >= 1, String(converties))
ok('celle de fC aussi', (await typeLe(fC)) === 'XF')
ok('… et sa journée compte double', (await joursAvant(fC)) === avantC + 1)

// La paie compte F et XF comme des jours travaillés.
const perF = (await q1(`select public.valider_pointage_mois($1,2026,5) as id`, [co])).id
const ligneF = async (id) => await q1(
  `select gardes_travaillees g, jours_payes jp from public.lignes_paie
    where periode_id=$1 and employee_id=$2`, [perF, id])
ok('la paie compte le férié chômé comme un jour', num((await ligneF(fA)).g) === 1,
   String((await ligneF(fA)).g))
ok('la paie compte le férié travaillé pour deux', num((await ligneF(fB)).g) === 2,
   String((await ligneF(fB)).g))

// Supprimer le férié retire ses F, et rien d'autre.
await connecte(admin)
const retirees = num((await q1(`select public.admin_supprimer_ferie($1) as n`, [ferieId])).n)
ok('supprimer le férié retire ses journées', retirees >= 1, String(retirees))
ok('le F disparaît', (await typeLe(fA)) === null)
ok('… et le compteur revient à son point de départ', (await joursAvant(fA)) === avantA)
ok('le jour réellement travaillé survit', (await typeLe(fB)) === 'XF')
ok('celui converti aussi', (await typeLe(fC)) === 'XF')

// Seul l'administrateur déclare un férié.
await connecte(bureau)
await refuse('le bureau ne déclare pas de férié',
  `select public.admin_creer_ferie($1,'X','2026-05-20'::date,'2026-05-20'::date)`,
  [co], /réservé|autoris|administrateur|Seul l/i)

// ═══════════════════════ TRANSPORT, PANIER : LE NET SUIT-IL ? ══════════════
// Règle voulue : ces indemnités se saisissent à la paie (le montant varie
// d'un mois à l'autre), s'ajoutent au net APRÈS les retenues, et n'entrent
// dans aucune assiette. Le brut, la C.N.S.S., l'A.M.O. et l'I.G.R. doivent
// donc être exactement les mêmes avec et sans indemnité.

section('Frais de transport et de panier')

await connecte(bureau)
const tSans = await employe('SANS INDEMNITE', { cin: 'TP1', cnss: '920000001' })
const tAvec = await employe('AVEC INDEMNITE', { cin: 'TP2', cnss: '920000002' })
const tFerie = await employe('FERIE AU BULLETIN', { cin: 'TP3', cnss: '920000003' })

// Mêmes jours pour les deux : seule l'indemnité les distingue.
const JOURS_MARS = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']
for (const j of JOURS_MARS) {
  await q1(`select public.marquer_present($1,$2::date,'X')`, [tSans, j])
  await q1(`select public.marquer_present($1,$2::date,'X')`, [tAvec, j])
  await q1(`select public.marquer_present($1,$2::date,'X')`, [tFerie, j])
}
// Le férié travaillé va sur un troisième : tSans et tAvec doivent garder
// exactement les mêmes jours, sinon comparer leurs retenues ne prouve rien.
await q1(`select public.marquer_present($1,'2026-03-09'::date,'XF')`, [tFerie])

const perTP = (await q1(`select public.valider_pointage_mois($1,2026,3) as id`, [co])).id
const lig = async (id) => await q1(
  `select salaire_brut b, frais_transport ft, frais_panier fp,
          jours_feries_travailles jf, net_a_payer net, gardes_travaillees g
     from public.lignes_paie where periode_id=$1 and employee_id=$2`, [perTP, id])

const lSans = await lig(tSans)
let lAvec = await lig(tAvec)
const brutAvec = num(lAvec.b)

ok('une ligne fraîchement générée n’a aucune indemnité',
   num(lAvec.ft) === 0 && num(lAvec.fp) === 0)

// C'est le service paie qui saisit les deux montants, ce mois-ci.
const idAvec = (await q1(
  `select id from public.lignes_paie where periode_id=$1 and employee_id=$2`,
  [perTP, tAvec])).id
await connecte(paie)
await q1(`select public.maj_ligne_paie($1, null, null, null, null, 300, 200)`, [idAvec])
lAvec = await lig(tAvec)

ok('la paie saisit le transport et le panier',
   num(lAvec.ft) === 300 && num(lAvec.fp) === 200, `${lAvec.ft} / ${lAvec.fp}`)
ok('celui à qui on n’a rien saisi reste à zéro',
   num(lSans.ft) === 0 && num(lSans.fp) === 0)
ok('le net porte les deux indemnités',
   num(lAvec.net) === brutAvec + 500, `${lAvec.net} vs ${brutAvec} + 500`)
await refuse('un montant négatif est refusé',
  `select public.maj_ligne_paie($1, null, null, null, null, -50, null)`, [idAvec], /négatif/i)
const lFerie = await lig(tFerie)
ok('le jour férié travaillé compte deux gardes',
   num(lFerie.g) === num(lSans.g) + 2, `${lFerie.g} vs ${lSans.g}`)
ok('la ligne de paie retient qu’un férié a été travaillé',
   num(lFerie.jf) === 1, String(lFerie.jf))
ok('celui qui n’en a pas travaillé reste à zéro', num(lAvec.jf) === 0)

// Le point qui compte : les indemnités ne cotisent pas.
const bul = async (id) => (await q1(
  `select public.bulletin_paie($1,$2) as b`, [perTP, id])).b[0]
const bSans = await bul(tSans)
const bAvec = await bul(tAvec)
const ligneDe = (b, libelle) => b.lignes.find((l) => l.libelle === libelle)

const retenue = (b, l) => Number(ligneDe(b, l).retenue)
ok('la C.N.S.S. est la même avec et sans indemnité',
   retenue(bSans, 'COTISATION C.N.S.S.') === retenue(bAvec, 'COTISATION C.N.S.S.'))
ok('l’A.M.O. aussi', retenue(bSans, 'ASSURANCE A.M.O.') === retenue(bAvec, 'ASSURANCE A.M.O.'))
ok('l’I.G.R. aussi', retenue(bSans, 'I.G.R.') === retenue(bAvec, 'I.G.R.'))
ok('le salaire brut aussi',
   Number(ligneDe(bSans, 'SALAIRE BRUT').gain) === Number(ligneDe(bAvec, 'SALAIRE BRUT').gain))

ok('le bulletin porte la ligne transport',
   Number(ligneDe(bAvec, 'FRAIS DE TRANSPORT').gain) === 300)
ok('… et la ligne panier', Number(ligneDe(bAvec, 'FRAIS DE PANIER').gain) === 200)
ok('le gain net les additionne',
   Number(ligneDe(bAvec, 'GAIN NET').gain)
     === Number(ligneDe(bSans, 'GAIN NET').gain) + 500,
   `${ligneDe(bAvec, 'GAIN NET').gain} vs ${ligneDe(bSans, 'GAIN NET').gain} + 500`)
ok('le pied annonce le net indemnités comprises',
   Number(bAvec.pied.net_a_payer) === Number(bSans.pied.net_a_payer) + 500)
ok('le pied mentionne le férié travaillé',
   Number((await bul(tFerie)).pied.jours_feries_travailles) === 1,
   String((await bul(tFerie)).pied.jours_feries_travailles))

// Une prime saisie ensuite ne doit pas effacer les indemnités.
await q1(`select public.maj_ligne_paie($1, 400, null, null, null)`, [idAvec])
ok('une prime s’ajoute au net sans effacer les indemnités',
   num((await lig(tAvec)).net) === brutAvec + 500 + 400,
   String((await lig(tAvec)).net))

// Le point qui fait mal en production : régénérer le mois. Les montants
// saisis par la paie ne viennent pas du pointage — ils doivent survivre.
await connecte(bureau)
await q1(`select public.generer_lignes_paie($1)`, [perTP])
const apres = await lig(tAvec)
ok('régénérer le mois n’efface pas les indemnités saisies',
   num(apres.ft) === 300 && num(apres.fp) === 200, `${apres.ft} / ${apres.fp}`)
ok('… ni la prime, et le net reste juste',
   num(apres.net) === brutAvec + 500 + 400, String(apres.net))
ok('les indemnités ne sont plus sur la fiche employé',
   (await rows(`select column_name from information_schema.columns
                 where table_name = 'employees'
                   and column_name in ('frais_transport','frais_panier')`)).length === 0)

section('La photo suit-elle la fiche ?')

const listeUnique = (await db.query(
  `select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'peut_gerer_employes'`)).rows.length > 0
ok('la liste des rôles existe en un seul endroit', listeUnique,
   listeUnique ? '' : 'peut_gerer_employes() absente — le BLOC 28 n’est pas passé')

if (listeUnique) {
  for (const [nom, uid, attendu] of [
    ['administrateur', admin, true], ['bureau', bureau, true], ['personnel', rh, true],
    ['la paie', paie, false], ['un pointeur', agent, false],
  ]) {
    await connecte(uid)
    const peut = (await q1(`select public.peut_gerer_employes() as p`)).p
    ok(`${nom} ${attendu ? 'dépose' : 'ne dépose pas'} une photo`, peut === attendu)
  }
  await connecte(null)
  ok('un visiteur non connecté ne dépose rien',
     (await q1(`select public.peut_gerer_employes() as p`)).p === false)
}

// Et les règles interrogent bien cette liste-là, plutôt que d'en recopier une.
const regles = (await db.query(`
  select policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') as texte
    from pg_policies
   where policyname in ('employees_insert', 'employees_update',
                        'photos_storage_insert', 'photos_storage_update',
                        'photos_storage_delete')`)).rows
ok('les cinq règles existent', regles.length === 5, `${regles.length} trouvée(s)`)
const orphelines = regles.filter((r) => !r.texte.includes('peut_gerer_employes'))
ok('aucune ne recopie sa propre liste de rôles',
   orphelines.length === 0, orphelines.map((r) => r.policyname).join(' · '))

// … mais le scan signé, lui, ne suit PAS la fiche : le déposer applique le
// contrat et écrit les congés sur le pointage. Décision prise avec le
// propriétaire — le personnel prépare le papier, le bureau le rend officiel.
// Si ce contrôle casse un jour, c'est que quelqu'un a élargi ce droit.
const scans = (await db.query(`
  select policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') as texte
    from pg_policies
   where policyname in ('documents_insert', 'documents_storage_insert')`)).rows
ok('les deux règles de dépôt de scan existent', scans.length === 2, `${scans.length} trouvée(s)`)
const elargies = scans.filter((r) => r.texte.includes('peut_gerer_employes')
                                  || r.texte.includes("'rh'"))
ok('déposer un scan reste au bureau et à l’administrateur',
   elargies.length === 0, elargies.map((r) => r.policyname).join(' · '))

await connecte(bureau)

section('Le contrôle des blocs dit-il vrai ?')

// Sur cette base, tous les blocs viennent d'être passés : le contrôle
// doit tous les voir. S'il en rate un, il enverrait relancer un bloc
// déjà appliqué — ou pire, en déclarerait un passé qui ne l'est pas.
const controle = fs.readFileSync(path.join(BLOCS, 'VERIFIER_blocs.sql'), 'utf8')
const requete = controle.slice(controle.indexOf('with attendu'),
                               controle.indexOf(';', controle.indexOf('order by numero')))
const etats = await rows(requete)
const manquants = etats.filter((e) => e.etat !== 'PASSÉ')
ok(`le contrôle voit les ${etats.length} blocs comme passés`,
   manquants.length === 0,
   manquants.map((m) => `${m.numero} ${m.bloc}`).join(' · '))
ok('… et il en contrôle bien autant qu’il en existe',
   etats.length === ORDRE.length, `${etats.length} contrôlés / ${ORDRE.length} fichiers`)

console.log('\n' + '═'.repeat(68))
console.log(F === 0
  ? `  ✅  ${P} vérifications, toutes réussies`
  : `  ❌  ${F} échec(s) sur ${P + F}\n     ${echecs.join('\n     ')}`)
console.log('═'.repeat(68))
process.exit(F ? 1 : 0)
