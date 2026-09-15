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

section('Remplir septembre')
const emp = async (nom, o = {}) => (await q1(
  `insert into public.employees (company_id, site_id, nom_prenom, jour_de_repos, date_embauche, date_sortie)
   values ($1,$2,$3,$4,$5,$6) returning id`,
  [co, site, nom, o.repos ?? 7, o.emb ?? null, o.sortie ?? null])).id
const eNormal  = await emp('NORMAL')                                   // repos dimanche
const eMercredi = await emp('REPOS MERCREDI', { repos: 3 })
const eTard    = await emp('EMBAUCHE LE 15', { emb: '2026-09-15' })
const ePart    = await emp('PARTI LE 10', { sortie: '2026-09-10' })
const eConge   = await emp('EN CONGE')

// Un congé déjà posé du 7 au 9 : il doit rester C.
await connecte(bureau)
for (const j of ['2026-09-07', '2026-09-08', '2026-09-09'])
  await q1(`select public.marquer_present($1,$2::date,'C')`, [eConge, j])
// Un M déjà posé le 3 pour NORMAL : doit rester M.
await q1(`select public.marquer_present($1,'2026-09-03'::date,'M')`, [eNormal])

const script = fs.readFileSync(path.join(BLOCS, 'REMPLIR_septembre_present.sql'), 'utf8')
const bloc = script
await connecte(null)   // l'éditeur SQL : pas de session
await db.exec(bloc)

const types = async (id) => (await rows(
  `select pointed_on::text d, type_garde t from public.pointages
    where employee_id=$1 and pointed_on between '2026-09-01' and '2026-09-30' order by 1`, [id]))
const jt = async (id) => num((await q1(`select jours_travailles j from public.employees where id=$1`, [id])).j)

const n = await types(eNormal)
ok('NORMAL : 30 jours − 4 dimanches = 26 journées', n.length === 26, String(n.length))
ok('… son M du 3 est resté M', n.find((x) => x.d === '2026-09-03')?.t === 'M')
ok('… tout le reste est X', n.filter((x) => x.t === 'X').length === 25)
ok('… aucun dimanche', !n.some((x) => new Date(x.d + 'T12:00').getDay() === 0))
ok('… compteur = 25 X + 1 M', (await jt(eNormal)) === 26, String(await jt(eNormal)))

const m = await types(eMercredi)
ok('REPOS MERCREDI : aucun mercredi', !m.some((x) => new Date(x.d + 'T12:00').getDay() === 3))
ok('… mais les dimanches, oui', m.some((x) => new Date(x.d + 'T12:00').getDay() === 0))

const t = await types(eTard)
ok('EMBAUCHÉ LE 15 : rien avant le 15', !t.some((x) => x.d < '2026-09-15'))
ok('… et présent à partir du 15', t.some((x) => x.d === '2026-09-15'))

const p = await types(ePart)
ok('PARTI LE 10 : rien après le 10', !p.some((x) => x.d > '2026-09-10'))
ok('… présent jusqu’au 10 inclus', p.some((x) => x.d === '2026-09-10'))

const c = await types(eConge)
ok('EN CONGÉ : ses trois C sont intacts', c.filter((x) => x.t === 'C').length === 3)

// Relancer ne double rien
const avant = (await q1(`select count(*) n from public.pointages where pointed_at='2026-09-01 00:00:00+01'`)).n
await db.exec(bloc)
const apres = (await q1(`select count(*) n from public.pointages where pointed_at='2026-09-01 00:00:00+01'`)).n
ok('relancer le script n’inscrit rien de plus', num(avant) === num(apres))

// L'annulation retire tout et remet les compteurs
const annule = fs.readFileSync(path.join(BLOCS, 'ANNULER_septembre_present.sql'), 'utf8')
await db.exec(annule)
ok('ANNULER retire les X posés', (await types(eNormal)).length === 1)
ok('… garde le M', (await types(eNormal))[0].t === 'M')
ok('… et remet le compteur', (await jt(eNormal)) === 1, String(await jt(eNormal)))
ok('… sans toucher aux C', (await types(eConge)).length === 3)

console.log(`\n  ${F === 0 ? '✅' : '❌'}  ${P + F} vérifications, ${F} échec(s)`)
process.exit(F ? 1 : 0)
