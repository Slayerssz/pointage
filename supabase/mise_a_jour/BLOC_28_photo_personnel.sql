-- ============================================================================
--  BLOC 28 sur 30 — La photo refusée au personnel
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 27.
--
--  Le bug : « Envoi impossible : new row violates row-level security
--  policy » quand on ajoute une photo de profil.
--
--  La cause : le bucket « photos » date du BLOC 8, quand il n'existait
--  que le bureau et l'administrateur. Le rôle « personnel » est arrivé
--  au BLOC 10 et a reçu le droit d'écrire les fiches au BLOC 11 — mais
--  pas celui de déposer la photo qui va avec.
--
--  Après ce bloc, la liste des rôles n'est écrite qu'une fois, et la
--  fiche et sa photo la lisent toutes les deux.
-- ============================================================================

-- ============================================================
-- 045 — Le rôle « personnel » peut déposer une photo
-- À exécuter après 044_horaire_matin_nuit.sql
--
-- Le BLOC 8 a créé le bucket « photos » et ses règles quand il
-- n'existait que le bureau et l'administrateur. Le BLOC 10 a
-- ajouté le rôle « personnel » et le BLOC 11 lui a donné le droit
-- d'écrire les employés — mais personne n'est retourné sur les
-- règles du bucket. Résultat : le personnel modifie une fiche,
-- et l'envoi de la photo est refusé (« new row violates
-- row-level security policy »).
--
-- La liste des rôles vivait à deux endroits ; c'est la raison de
-- l'écart. Elle n'existe plus qu'ici, et les deux jeux de règles
-- la lisent : le prochain rôle ne pourra plus les désaccorder.
-- ============================================================

create or replace function public.peut_gerer_employes()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.current_user_role()::text, '')
         in ('validator', 'admin', 'rh');
$$;

grant execute on function public.peut_gerer_employes() to authenticated;

comment on function public.peut_gerer_employes() is
  'Qui tient les fiches employés : bureau, administrateur, personnel. '
  'Seule liste ; la table employees et le bucket photos la lisent.';

-- 1. La fiche employé -------------------------------------------------------

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
  for update to authenticated
  using (public.peut_gerer_employes())
  with check (true);

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert to authenticated
  with check (public.peut_gerer_employes());

-- 2. Sa photo ---------------------------------------------------------------
-- Lecture : tout compte connecté. La photo sert à reconnaître la
-- personne au poste, y compris depuis le téléphone d'un pointeur.

drop policy if exists photos_storage_select on storage.objects;
create policy photos_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'photos');

drop policy if exists photos_storage_insert on storage.objects;
create policy photos_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.peut_gerer_employes());

drop policy if exists photos_storage_update on storage.objects;
create policy photos_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.peut_gerer_employes())
  with check (bucket_id = 'photos' and public.peut_gerer_employes());

drop policy if exists photos_storage_delete on storage.objects;
create policy photos_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.peut_gerer_employes());


-- ============================================================================
--  ▶ CONTRÔLE — à lancer après, en sélectionnant ces lignes seules
--    Chaque rôle doit pouvoir déposer une photo là où il peut tenir la fiche.
-- ============================================================================

-- select p.role,
--        count(*) as comptes,
--        case when p.role::text in ('validator', 'admin', 'rh')
--             then 'peut déposer une photo' else '—' end as photo
--   from public.profiles p
--  where p.actif
--  group by p.role
--  order by p.role;


-- ============================================================================
--  ▶ CE QUE LE PERSONNEL NE FAIT PAS — et c'est voulu
--
--  Le personnel atteint la même fiche, où l'on joint le scan signé d'un
--  contrat, d'un congé ou d'une sortie. Ce dépôt-là n'archive pas un
--  fichier : c'est lui qui APPLIQUE le document — le contrat prend effet,
--  les dates se posent, le congé passe en C sur le pointage.
--
--  Rendre un contrat officiel reste au bureau et à l'administrateur.
--  Le personnel prépare le papier, le bureau dépose le scan.
--
--  Ce bloc ne touche donc pas aux règles du bucket « documents » : elles
--  restent sur ('validator', 'admin'), telles que le BLOC 8 les a posées.
--  Ce n'est pas un oubli — ne les alignez pas sur peut_gerer_employes().
-- ============================================================================
