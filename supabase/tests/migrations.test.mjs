import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Dossier des migrations, relatif à ce fichier
const MIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
const db = new PGlite()

// --- Stubs Supabase (auth schema, auth.uid(), extensions) ---
const bootstrap = `
create schema if not exists auth;
create schema if not exists extensions;
-- pgcrypto n'existe pas dans PGlite : on simule crypt()/gen_salt()
create or replace function extensions.gen_salt(t text) returns text
  language sql immutable as $fn$ select 'salt'; $fn$;
create or replace function extensions.crypt(pw text, salt text) returns text
  language sql immutable as $fn$ select md5(pw || salt); $fn$;

create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz,
  confirmation_token text, recovery_token text,
  email_change_token_new text, email_change text
);
create table auth.identities (
  id uuid primary key, user_id uuid, provider_id text, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
-- auth.uid() : renvoie l'utilisateur "courant" simulé
create or replace function auth.uid() returns uuid language sql stable as $fn$
  select nullif(current_setting('test.uid', true), '')::uuid;
$fn$;
create role authenticated;
`
await db.exec(bootstrap)

const files = [
  '001_schema.sql', '002_rls.sql',
  '007_ameliorations.sql', '008_details_paie.sql',
  '012_role_admin.sql', '013_admin_fonctions.sql', '014_types_garde.sql',
  '015_heures_contrats.sql', '016_absences_conges.sql', '017_paie.sql',
  '018_role_paie.sql', '019_organisations_permissions.sql',
]

let failed = false
for (const f of files) {
  let sql = fs.readFileSync(path.join(MIG, f), 'utf8')
  // 007 contient un bloc de corrections de données propre au registre réel
  if (f === '007_ameliorations.sql') {
    const cut = sql.indexOf('do $$')
    if (cut > 0) sql = sql.slice(0, cut)
  }
  try {
    await db.exec(sql)
    console.log(`  OK    ${f}`)
  } catch (e) {
    failed = true
    console.log(`  FAIL  ${f}\n        ${e.message}`)
  }
}
console.log(failed ? '\n=== DES ERREURS ===' : '\n=== TOUTES LES MIGRATIONS PASSENT ===')
await db.close()
process.exit(failed ? 1 : 0)
