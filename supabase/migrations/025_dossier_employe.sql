-- ============================================================
-- 025 — Dossier de l'employé : état civil, photo, documents signés
-- À exécuter après 024_sites_principaux.sql
--
-- Le circuit visé :
--   1. on crée le congé (ou le contrat) dans l'application
--   2. on imprime le document depuis l'application
--   3. l'employé le signe (et pour un contrat, on le fait légaliser)
--   4. on scanne la feuille signée et on la rattache ici
-- ============================================================

-- 1. État civil et photo de profil ---------------------------------------------

alter table public.employees
  add column if not exists situation_familiale text
    check (situation_familiale in ('Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf/Veuve')),
  add column if not exists nombre_enfants integer not null default 0
    check (nombre_enfants >= 0 and nombre_enfants <= 30),
  -- Chemin dans le bucket « photos » (photo de profil, choisie depuis la fiche)
  add column if not exists photo_path text;

-- 2. Documents signés (engagements de congé, contrats légalisés…) ----------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  -- À quoi le document se rapporte
  type text not null default 'autre'
    check (type in ('engagement', 'contrat', 'autre')),
  conge_id uuid references public.conges(id) on delete cascade,
  contrat_id uuid references public.contrats(id) on delete cascade,
  -- Fichier dans le bucket « documents »
  chemin text not null unique,
  nom_fichier text not null,
  mime text,
  taille integer,
  libelle text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists documents_employee_idx on public.documents (employee_id, created_at desc);
create index if not exists documents_conge_idx   on public.documents (conge_id)   where conge_id is not null;
create index if not exists documents_contrat_idx on public.documents (contrat_id) where contrat_id is not null;

alter table public.documents enable row level security;

-- Lecture, dépôt et suppression : bureau et administrateur uniquement.
-- Le responsable de paie n'a pas accès à ces pièces signées.

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated
  using (coalesce(public.current_user_role()::text, '') in ('validator', 'admin'));

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert to authenticated
  with check (coalesce(public.current_user_role()::text, '') in ('validator', 'admin'));

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete to authenticated
  using (coalesce(public.current_user_role()::text, '') in ('validator', 'admin'));

-- 3. Les deux buckets de fichiers -------------------------------------------------

-- Documents signés : PDF ou photo de la feuille scannée (10 Mo max)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Photos de profil (5 Mo max)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Chemins : <company_id>/<employee_id>/<fichier>

drop policy if exists documents_storage_select on storage.objects;
create policy documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and coalesce(public.current_user_role()::text, '') in ('validator', 'admin')
  );

drop policy if exists documents_storage_insert on storage.objects;
create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and coalesce(public.current_user_role()::text, '') in ('validator', 'admin')
  );

drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and coalesce(public.current_user_role()::text, '') in ('validator', 'admin')
  );

-- Photos de profil : visibles par tous les comptes connectés (elles servent
-- à reconnaître la personne), déposées par le bureau et l'administrateur.

drop policy if exists photos_storage_select on storage.objects;
create policy photos_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'photos');

drop policy if exists photos_storage_insert on storage.objects;
create policy photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and coalesce(public.current_user_role()::text, '') in ('validator', 'admin')
  );

drop policy if exists photos_storage_update on storage.objects;
create policy photos_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and coalesce(public.current_user_role()::text, '') in ('validator', 'admin')
  );

drop policy if exists photos_storage_delete on storage.objects;
create policy photos_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and coalesce(public.current_user_role()::text, '') in ('validator', 'admin')
  );

-- 4. Congés multiples : signaler les chevauchements ---------------------------------
-- Un employé peut avoir autant de congés qu'on veut. En revanche, deux congés
-- qui se recouvrent produisaient des jours silencieusement ignorés : on prévient
-- désormais explicitement.

create or replace function public.creer_conge(
  p_employee_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_type text default 'C',
  p_motif text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_site uuid;
  v_repos smallint;
  v_conge uuid;
  v_jour date;
  v_n integer := 0;
  v_valeur numeric;
  v_chevauche record;
begin
  if coalesce(p_type, '') not in ('C', 'CS', 'M', 'AJ') then
    raise exception 'Type de congé invalide';
  end if;
  perform public.exiger_role('validator', 'admin');
  if p_date_fin < p_date_debut then
    raise exception 'La date de fin doit être après la date de début';
  end if;
  if p_date_fin - p_date_debut > 365 then
    raise exception 'Période trop longue (365 jours maximum)';
  end if;

  select company_id, site_id, jour_de_repos
    into v_company, v_site, v_repos
    from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Employé introuvable';
  end if;

  -- Un congé existant recouvre-t-il déjà cette période ?
  select date_debut, date_fin into v_chevauche
    from public.conges
   where employee_id = p_employee_id
     and date_debut <= p_date_fin
     and date_fin   >= p_date_debut
   limit 1;
  if v_chevauche.date_debut is not null then
    raise exception
      'Un congé existe déjà du % au % pour cet employé. Modifiez-le ou choisissez d''autres dates.',
      to_char(v_chevauche.date_debut, 'DD/MM/YYYY'), to_char(v_chevauche.date_fin, 'DD/MM/YYYY');
  end if;

  perform public.assert_periode_ouverte(v_company, p_date_debut, p_date_fin);

  insert into public.conges (company_id, employee_id, type, date_debut, date_fin, motif, created_by)
  values (v_company, p_employee_id, p_type, p_date_debut, p_date_fin, nullif(trim(p_motif), ''), auth.uid())
  returning id into v_conge;

  v_valeur := public.garde_valeur(p_type);

  perform set_config('app.pointage_manuel', 'on', true);
  for v_jour in select generate_series(p_date_debut, p_date_fin, interval '1 day')::date loop
    if v_repos is not null and extract(isodow from v_jour)::int = v_repos then
      continue;
    end if;
    if exists (
      select 1 from public.pointages
      where employee_id = p_employee_id and pointed_on = v_jour and status <> 'refused'
    ) then
      continue;
    end if;

    insert into public.pointages
      (company_id, site_id, employee_id, agent_id, photo_path,
       pointed_at, pointed_on, status, type_garde, validated_by, validated_at, conge_id)
    values
      (v_company, v_site, p_employee_id, auth.uid(), null,
       now(), v_jour, 'validated', p_type, auth.uid(), now(), v_conge);
    v_n := v_n + 1;
  end loop;
  perform set_config('app.pointage_manuel', 'off', true);

  update public.conges set jours = v_n where id = v_conge;

  if v_valeur > 0 then
    update public.employees
      set jours_travailles = jours_travailles + (v_n * v_valeur)
      where id = p_employee_id;
  end if;

  return v_conge;
end;
$$;

revoke all on function public.creer_conge(uuid, date, date, text, text) from public;
grant execute on function public.creer_conge(uuid, date, date, text, text) to authenticated;
