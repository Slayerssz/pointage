process.on('uncaughtException', e => { console.log('\nERREUR TEST: ' + e.message); process.exit(1) })
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Dossier des migrations, relatif à ce fichier
const MIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
const db = new PGlite()

await db.exec(`
create schema if not exists auth; create schema if not exists extensions;
create or replace function extensions.gen_salt(t text) returns text language sql immutable as $f$ select 'salt'; $f$;
create or replace function extensions.crypt(pw text, s text) returns text language sql immutable as $f$ select md5(pw||s); $f$;
create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text,
  email_change_token_new text, email_change text);
create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('test.uid', true), '')::uuid; $f$;
create role authenticated;`)

for (const f of ['001_schema.sql','002_rls.sql','007_ameliorations.sql','008_details_paie.sql',
  '012_role_admin.sql','013_admin_fonctions.sql','014_types_garde.sql','015_heures_contrats.sql',
  '016_absences_conges.sql','017_paie.sql','018_role_paie.sql','019_organisations_permissions.sql',
  '020_verrouillage_complet.sql']) {
  let sql = fs.readFileSync(path.join(MIG,f),'utf8')
  if (f==='007_ameliorations.sql') { const c=sql.indexOf('do $$'); if(c>0) sql=sql.slice(0,c) }
  await db.exec(sql)
}
// RLS désactivée pour le test : on teste la logique des fonctions (qui vérifient le rôle elles-mêmes)
for (const t of ['companies','sites','employees','profiles','pointages','contrats','conges',
                 'dettes','periodes_paie','lignes_paie','remboursements_dette','parametres_paie'])
  await db.exec(`alter table public.${t} disable row level security;`)

let pass=0, fail=0
const ok = (name, cond, extra='') => { if(cond){pass++;console.log(`  ✓ ${name}`)} else {fail++;console.log(`  ✗ ${name}  ${extra}`)} }
const as = async (uid) => db.exec(`select set_config('test.uid', '${uid}', false);`)
const one = async (sql,p=[]) => (await db.query(sql,p)).rows[0]

// --- comptes ---
const mk = async (uname, role) => {
  const id = (await one(`select gen_random_uuid() as id`)).id
  await db.query(`insert into auth.users(id,email) values($1,$2)`,[id,uname+'@x'])
  await db.query(`insert into public.profiles(user_id,username,role) values($1,$2,$3)`,[id,uname,role])
  return id
}
const admin = await mk('admin1','admin'), valid = await mk('bureau1','validator')
const paie  = await mk('paie1','paie'),  agent = await mk('agent1','agent')

console.log('\n— Rôles & organisations —')
await as(agent)
try { await one(`select public.admin_creer_entreprise('Test SARL')`); ok('agent ne peut PAS créer une entreprise', false) }
catch { ok('agent ne peut PAS créer une entreprise', true) }
await as(valid)
try { await one(`select public.admin_creer_entreprise('Test SARL')`); ok('validateur ne peut PAS créer une entreprise', false) }
catch { ok('validateur ne peut PAS créer une entreprise', true) }
await as(admin)
const co = (await one(`select public.admin_creer_entreprise('Test SARL') as id`)).id
ok('admin crée une entreprise', !!co)
ok('paramètres de paie créés automatiquement (26 j)',
   Number((await one(`select jours_base from public.parametres_paie where company_id=$1`,[co])).jours_base)===26)

await as(paie)
try { await one(`select public.creer_site($1,'Site A')`,[co]); ok('paie ne peut PAS créer un site', false) }
catch { ok('paie ne peut PAS créer un site', true) }
await as(valid)
const siteA = (await one(`select public.creer_site($1,'SITE A') as id`,[co])).id
ok('validateur crée un site', !!siteA)

// --- employés : salaire 5200 / 26 j = 200 DH par jour, 8 h par jour ---
const mkEmp = async (nom, sal, mode, banque) => (await one(
  `insert into public.employees(company_id,site_id,nom_prenom,salaire,heures_par_jour,mode_reglement,banque,jour_de_repos)
   values($1,$2,$3,$4,8,$5,$6,7) returning id`,[co,siteA,nom,sal,mode,banque])).id
const e26 = await mkEmp('PLEIN MOIS',5200,'Virement','CIH')
const e20 = await mkEmp('VINGT JOURS',5200,'Espece',null)
const eMix= await mkEmp('CONGE MALADE',5200,'Virement','BMCE')

console.log('\n— Pointage : gardes, ½ garde, malade, congé —')
const Y=2026, M=1  // janvier 2026
const d = n => `${Y}-01-${String(n).padStart(2,'0')}`
await as(valid)
// e26 : 26 gardes pleines (on saute les dimanches = jour de repos)
let n=0
for (let j=1; j<=31 && n<26; j++) {
  if (new Date(Y,0,j).getDay()===0) continue
  await one(`select public.marquer_present($1,$2::date,'X')`,[e26,d(j)]); n++
}
ok('26 gardes pointées pour l’employé plein mois', n===26)
// e20 : 20 gardes
n=0
for (let j=1; j<=31 && n<20; j++) {
  if (new Date(Y,0,j).getDay()===0) continue
  await one(`select public.marquer_present($1,$2::date,'X')`,[e20,d(j)]); n++
}
// eMix : 10 X + 1 demi-garde + 1 XX + congé 5 j + 2 malade
n=0; const jours=[]
for (let j=1; j<=31; j++) if (new Date(Y,0,j).getDay()!==0) jours.push(j)
for (let i=0;i<10;i++){ await one(`select public.marquer_present($1,$2::date,'X')`,[eMix,d(jours[i])]) }
await one(`select public.marquer_present($1,$2::date,'X05')`,[eMix,d(jours[10])])
await one(`select public.marquer_present($1,$2::date,'XX')`,[eMix,d(jours[11])])
await one(`select public.marquer_present($1,$2::date,'M')`,[eMix,d(jours[12])])
await one(`select public.marquer_present($1,$2::date,'M')`,[eMix,d(jours[13])])
const conge = (await one(`select public.creer_conge($1,$2::date,$3::date,'C','Congé annuel') as id`,
  [eMix, d(jours[14]), d(jours[19])])).id
ok('congé créé sur une période', !!conge)
const congeJours = Number((await one(`select jours from public.conges where id=$1`,[conge])).jours)
ok('les jours du congé sont écrits dans le pointage', congeJours>0, `jours=${congeJours}`)
ok('½ garde = 0,5', Number((await one(`select public.garde_valeur('X05') as v`)).v)===0.5)

console.log('\n— Dette —')
await one(`insert into public.dettes(company_id,employee_id,libelle,montant_total,created_by)
           values($1,$2,'Avance sur salaire',1500,$3)`,[co,e20,valid])

console.log('\n— Validation du pointage du mois —')
await as(valid)
const per = (await one(`select public.valider_pointage_mois($1,$2,$3) as id`,[co,Y,M])).id
ok('le mois bascule en paie', !!per)
ok('statut = pointage_valide',
   (await one(`select statut from public.periodes_paie where id=$1`,[per])).statut==='pointage_valide')

// pointage verrouillé
try { await one(`select public.marquer_present($1,$2::date,'X')`,[e20,d(28)])
      ok('pointage verrouillé après validation du mois', false) }
catch(e){ ok('pointage verrouillé après validation du mois', /clôturé/.test(e.message), e.message) }

console.log('\n— Calcul de la paie —')
const L = async (id) => one(`select * from public.lignes_paie where periode_id=$1 and employee_id=$2`,[per,id])
const l26 = await L(e26), l20 = await L(e20), lmix = await L(eMix)
ok('26 jours = salaire complet (5200)', Number(l26.net_a_payer)===5200, `net=${l26.net_a_payer}`)
ok('26 jours × 8 h = 208 h', Number(l26.heures_effectuees)===208, `h=${l26.heures_effectuees}`)
ok('20 jours = 4000 DH (20 × 200)', Number(l20.net_a_payer)===4000, `net=${l20.net_a_payer}`)
ok('20 jours × 8 h = 160 h', Number(l20.heures_effectuees)===160, `h=${l20.heures_effectuees}`)
// eMix : 10 + 0,5 + 2 = 12,5 gardes + 2 malade (payé) + congé (payé)
const attendu = 12.5 + 2 + congeJours
ok(`jours payés = ${attendu} (12,5 travaillés + 2 malade + ${congeJours} congé)`,
   Number(lmix.jours_payes)===attendu, `jours_payes=${lmix.jours_payes}`)
ok('salaire proratisé correct', Number(lmix.net_a_payer)===Math.round(5200*attendu/26*100)/100,
   `net=${lmix.net_a_payer} attendu=${Math.round(5200*attendu/26*100)/100}`)
ok('mode de règlement repris (Espece)', l20.mode_reglement==='Espece')
ok('banque reprise (CIH)', l26.banque==='CIH')

console.log('\n— Retenue de dette & validation de la paie —')
await as(valid)
try { await one(`select public.maj_ligne_paie($1,0,500,0,null)`,[l20.id]); ok('validateur ne touche PAS la paie', false) }
catch { ok('validateur ne touche PAS la paie', true) }
await as(paie)
await one(`select public.maj_ligne_paie($1,0,500,0,'Retenue avance')`,[l20.id])
const l20b = await L(e20)
ok('retenue de dette 500 → net 3500', Number(l20b.net_a_payer)===3500, `net=${l20b.net_a_payer}`)
const tot = (await one(`select public.totaux_periode($1) as t`,[per])).t
ok('totaux : espèces et virement séparés', Number(tot.total_especes)===3500,
   `especes=${tot.total_especes} virement=${tot.total_virement}`)

await one(`select public.valider_paie($1)`,[per])
ok('paie validée', (await one(`select statut from public.periodes_paie where id=$1`,[per])).statut==='paie_validee')
const dette = await one(`select * from public.dettes where employee_id=$1`,[e20])
ok('dette remboursée de 500 (reste 1000)', Number(dette.montant_rembourse)===500, `remb=${dette.montant_rembourse}`)
try { await one(`select public.maj_ligne_paie($1,100,null,null,null)`,[l20.id]); ok('paie validée = verrouillée', false) }
catch { ok('paie validée = verrouillée', true) }

console.log('\n— Demande de réouverture —')
await as(paie)
await one(`select public.demander_reouverture($1,'Erreur sur les gardes de janvier')`,[per])
ok('demande enregistrée',
   (await one(`select statut from public.periodes_paie where id=$1`,[per])).statut==='reouverture_demandee')
await as(paie)
try { await one(`select public.repondre_reouverture($1,true)`,[per]); ok('seul l’admin approuve', false) }
catch { ok('seul l’admin approuve', true) }
await as(admin)
await one(`select public.repondre_reouverture($1,true)`,[per])
ok('mois rouvert par l’admin',
   (await one(`select statut from public.periodes_paie where id=$1`,[per])).statut==='ouvert')
ok('remboursement de dette annulé à la réouverture',
   Number((await one(`select montant_rembourse from public.dettes where id=$1`,[dette.id])).montant_rembourse)===0)
await as(valid)
await one(`select public.marquer_present($1,$2::date,'X')`,[e20,d(28)])
ok('pointage de nouveau modifiable après réouverture', true)

console.log('\n— Verrouillage : agent & congés multi-mois —')
// Un agent pointe toujours pour AUJOURD'HUI (forcé par le trigger) : le trou
// réel est donc « le mois EN COURS a été clôturé ». On teste exactement ça.
const maintenant = await one(`select date_part('year',(now() at time zone 'Africa/Casablanca'))::int as a,
                                     date_part('month',(now() at time zone 'Africa/Casablanca'))::int as m`)
await as(valid)
const perNow = (await one(`select public.valider_pointage_mois($1,$2,$3) as id`,[co,maintenant.a,maintenant.m])).id
ok('mois en cours clôturé', !!perNow)
await as(agent)
try {
  await db.query(`insert into public.pointages(company_id,site_id,employee_id,agent_id,photo_path)
                  values($1,$2,$3,$4,'photo.jpg')`,[co,siteA,e26,agent])
  ok('un agent ne peut PAS pointer sur un mois clôturé', false)
} catch (e) { ok('un agent ne peut PAS pointer sur un mois clôturé', /clôturé/.test(e.message), e.message) }
// Rouvrir pour la suite
await as(admin)
await db.query(`update public.periodes_paie set statut='ouvert' where id=$1`,[perNow])

// Et sur un mois ouvert, l'agent pointe normalement
await as(agent)
await db.query(`insert into public.pointages(company_id,site_id,employee_id,agent_id,photo_path)
                values($1,$2,$3,$4,'photo.jpg')`,[co,siteA,e26,agent])
ok('un agent pointe normalement sur un mois ouvert', true)
await db.query(`delete from public.pointages where photo_path='photo.jpg'`)

await as(valid)
const perFev = (await one(`select public.valider_pointage_mois($1,$2,$3) as id`,[co,Y,2])).id
ok('février clôturé', !!perFev)

// Un congé qui traverse un mois clôturé au milieu est refusé
await as(valid)
try {
  await one(`select public.creer_conge($1,$2::date,$3::date,'C',null)`,[e26,`${Y}-01-05`,`${Y}-03-05`])
  ok('congé traversant un mois clôturé refusé', false)
} catch (e) { ok('congé traversant un mois clôturé refusé', /clôturé/.test(e.message), e.message) }

// Rouvrir février pour ne pas gêner la suite
await as(admin)
await db.query(`update public.periodes_paie set statut='ouvert' where id=$1`,[perFev])

console.log('\n— Contrats (bleu / jaune) —')
await as(valid)
await one(`insert into public.contrats(company_id,employee_id,type_contrat,date_debut,date_fin,created_by)
   values($1,$2,'CDD',current_date - 100, current_date + 5, $3)`,[co,e26,valid])
const st = async (emp) => (await one(`select statut, jours_restants from public.contrats_courants where employee_id=$1`,[emp]))
await db.query(`update public.contrats set date_fin = current_date + 5 where employee_id=$1`,[e26])
ok('fin dans 5 jours → « bientot » (bleu)', (await st(e26)).statut==='bientot', JSON.stringify(await st(e26)))
await db.query(`update public.contrats set date_fin = current_date - 1 where employee_id=$1`,[e26])
ok('contrat dépassé → « termine » (jaune)', (await st(e26)).statut==='termine')
await db.query(`update public.contrats set date_fin = current_date + 40 where employee_id=$1`,[e26])
ok('fin lointaine → « actif »', (await st(e26)).statut==='actif')
await db.query(`update public.contrats set date_fin = null where employee_id=$1`,[e26])
ok('CDI (sans date de fin) → « actif », aucune alerte', (await st(e26)).statut==='actif')
ok('numéro de contrat automatique',
   /^CT-\d{4}-\d{4}$/.test((await one(`select numero from public.contrats where employee_id=$1`,[e26])).numero))

console.log('\n— Bulletin journalier par site —')
const bul = (await one(`select public.bulletin_journalier($1,$2::date) as b`,[co,d(jours[0])])).b
ok('le bulletin regroupe par site', Array.isArray(bul) && bul.length===1 && bul[0].site==='SITE A',
   JSON.stringify(bul).slice(0,120))
ok('le bulletin liste les employés du jour', bul[0].employes.length===3, `n=${bul[0]?.employes?.length}`)

console.log(`\n=== ${pass} réussis, ${fail} échoués ===`)
await db.close(); process.exit(fail?1:0)
