-- ============================================================
-- 003 — Stockage des photos de pointage
-- À exécuter après 002_rls.sql
-- ============================================================

-- Bucket privé pour les photos (les photos sont servies via URL signée)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pointages', 'pointages', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Chemin des fichiers : <company_id>/<employee_id>/<fichier>.jpg

-- Upload : agents uniquement
create policy pointages_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pointages'
    and public.current_user_role() = 'agent'
  );

-- Lecture : tout utilisateur connecté (agents + validateurs)
create policy pointages_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'pointages');
