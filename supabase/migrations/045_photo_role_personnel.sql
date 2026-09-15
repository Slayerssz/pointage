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

-- 3. Ce que ce fichier ne fait pas -----------------------------------------
-- Le bucket « documents » garde sa liste à lui, ('validator', 'admin').
-- Déposer un scan n'archive pas un fichier : c'est l'acte qui APPLIQUE le
-- contrat, pose les dates, écrit les C du congé sur le pointage. Rendre un
-- document officiel reste au bureau ; le personnel prépare le papier.
-- Décision prise, pas oubli : ne pas aligner ces règles sur
-- peut_gerer_employes() sans redécider de qui valide un contrat.
