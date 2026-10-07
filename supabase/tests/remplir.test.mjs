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

/**
 * Le même scénario pour chaque mois rempli : ce sont les mêmes règles —
 * le jour de repos épargné, les marques existantes intactes, rien avant
 * l'embauche ni après la sortie — et une seule description vaut mieux
 * que deux qui dérivent.
 */
async function verifierLeRemplissage(o) {
  section(`Remplir ${o.nom}`)
  const emp = async (nom, opts = {}) => (await q1(
    `insert into public.employees (company_id, site_id, nom_prenom, jour_de_repos, date_embauche, date_sortie)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [co, site, `${nom} ${o.mois}`, opts.repos ?? 7, opts.emb ?? null, opts.sortie ?? null])).id

  const eNormal   = await emp('NORMAL')                      // repos dimanche
  const eMercredi = await emp('REPOS MERCREDI', { repos: 3 })
  const eTard     = await emp('EMBAUCHE LE 15', { emb: o.le15 })
  const ePart     = await emp('PARTI LE 10', { sortie: o.le10 })
  const eConge    = await emp('EN CONGE')

  // Un congé déjà posé du 7 au 9 : il doit rester C.
  await connecte(bureau)
  for (const j of o.conge) await q1(`select public.marquer_present($1,$2::date,'C')`, [eConge, j])
  // Un M déjà posé pour NORMAL : doit rester M.
  await q1(`select public.marquer_present($1,$2::date,'M')`, [eNormal, o.leM])

  const bloc = fs.readFileSync(path.join(BLOCS, o.remplir), 'utf8')
  await connecte(null)   // l'éditeur SQL : pas de session
  await db.exec(bloc)

  const types = async (id) => (await rows(
    `select pointed_on::text d, type_garde t from public.pointages
      where employee_id=$1 and pointed_on between $2 and $3 order by 1`, [id, o.debut, o.fin]))
  const jt = async (id) => num((await q1(
    `select jours_travailles j from public.employees where id=$1`, [id])).j)

  const n = await types(eNormal)
  ok(`NORMAL : ${o.jours} jours − ${o.dimanches} dimanches = ${o.ouvres} journées`,
     n.length === o.ouvres, String(n.length))
  ok(`… son M du ${o.leM.slice(8)} est resté M`, n.find((x) => x.d === o.leM)?.t === 'M')
  ok('… tout le reste est X', n.filter((x) => x.t === 'X').length === o.ouvres - 1)
  ok('… aucun dimanche', !n.some((x) => new Date(x.d + 'T12:00').getDay() === 0))
  ok('… compteur = les journées inscrites', (await jt(eNormal)) === o.ouvres,
     String(await jt(eNormal)))

  const m = await types(eMercredi)
  ok('REPOS MERCREDI : aucun mercredi', !m.some((x) => new Date(x.d + 'T12:00').getDay() === 3))
  ok('… mais les dimanches, oui', m.some((x) => new Date(x.d + 'T12:00').getDay() === 0))

  const t = await types(eTard)
  ok('EMBAUCHÉ LE 15 : rien avant le 15', !t.some((x) => x.d < o.le15))
  ok('… et présent à partir du 15', t.some((x) => x.d === o.le15))

  const p = await types(ePart)
  ok('PARTI LE 10 : rien après le 10', !p.some((x) => x.d > o.le10))
  ok('… présent jusqu’au 10 inclus', p.some((x) => x.d === o.le10))

  const c = await types(eConge)
  ok('EN CONGÉ : ses trois C sont intacts', c.filter((x) => x.t === 'C').length === 3)

  // Relancer ne double rien
  const compter = async () => num((await q1(
    `select count(*) n from public.pointages where pointed_at=$1`, [o.marque])).n)
  const avant = await compter()
  await db.exec(bloc)
  ok('relancer le script n’inscrit rien de plus', avant === (await compter()))

  // L'annulation retire tout et remet les compteurs
  await db.exec(fs.readFileSync(path.join(BLOCS, o.annuler), 'utf8'))
  ok('ANNULER retire les X posés', (await types(eNormal)).length === 1)
  ok('… garde le M', (await types(eNormal))[0].t === 'M')
  ok('… et remet le compteur', (await jt(eNormal)) === 1, String(await jt(eNormal)))
  ok('… sans toucher aux C', (await types(eConge)).length === 3)
}

await verifierLeRemplissage({
  nom: 'septembre', mois: 9, debut: '2026-09-01', fin: '2026-09-30',
  jours: 30, dimanches: 4, ouvres: 26,
  leM: '2026-09-03', le10: '2026-09-10', le15: '2026-09-15',
  conge: ['2026-09-07', '2026-09-08', '2026-09-09'],
  marque: '2026-09-01 00:00:00+01',
  remplir: 'REMPLIR_septembre_present.sql', annuler: 'ANNULER_septembre_present.sql',
})

// Octobre 2026 commence un jeudi : ses dimanches sont les 4, 11, 18 et 25.
// Le mois est en cours : on ne peut poser à la main que des jours déjà
// passés — `marquer_present` refuse l'avenir. Le script, lui, inscrit le
// mois entier, et c'est bien ce qu'on lui demande.
await verifierLeRemplissage({
  nom: 'octobre', mois: 10, debut: '2026-10-01', fin: '2026-10-31',
  jours: 31, dimanches: 4, ouvres: 27,
  leM: '2026-10-02', le10: '2026-10-10', le15: '2026-10-15',
  conge: ['2026-10-01', '2026-10-05', '2026-10-06'],
  marque: '2026-10-01 00:00:00+01',
  remplir: 'REMPLIR_octobre_present.sql', annuler: 'ANNULER_octobre_present.sql',
})

console.log(`\n  ${F === 0 ? '✅' : '❌'}  ${P + F} vérifications, ${F} échec(s)`)
process.exit(F ? 1 : 0)
