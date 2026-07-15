-- ============================================================
-- 001 — Schéma principal du système de pointage
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================

-- Types énumérés -------------------------------------------------

create type public.user_role as enum ('agent', 'validator');
create type public.pointage_status as enum ('pending', 'validated', 'refused');

-- Entreprises -----------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Sites / lieux ---------------------------------------------------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create index sites_company_idx on public.sites (company_id);

-- Employés --------------------------------------------------------

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  matricule text,
  nom_prenom text not null,
  cin text,
  cnss text,
  date_naissance date,
  date_embauche date,
  qualification text,
  adresse text,
  ville text,
  mode_reglement text,
  telephone text,
  -- Jour de repos hebdomadaire : 1=lundi … 7=dimanche (ISO), null = non défini
  jour_de_repos smallint check (jour_de_repos between 1 and 7),
  jours_travailles integer not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create index employees_company_idx on public.employees (company_id);
create index employees_site_idx on public.employees (site_id);
create index employees_company_nom_idx on public.employees (company_id, nom_prenom);

-- Profils utilisateurs (agents & validateurs) ----------------------

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

-- Accès entreprise par utilisateur ---------------------------------

create table public.user_companies (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  primary key (user_id, company_id)
);

create index user_companies_company_idx on public.user_companies (company_id);

-- Pointages ---------------------------------------------------------

create table public.pointages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  agent_id uuid not null references auth.users(id),
  photo_path text not null,
  -- Horodatage serveur : le client n'envoie jamais cette valeur
  pointed_at timestamptz not null default now(),
  -- Date locale (Maroc) du pointage, calculée automatiquement
  pointed_on date not null default ((now() at time zone 'Africa/Casablanca')::date),
  status public.pointage_status not null default 'pending',
  validated_by uuid references auth.users(id),
  validated_at timestamptz
);

create index pointages_employee_idx on public.pointages (employee_id, pointed_at desc);
create index pointages_site_day_idx on public.pointages (site_id, pointed_on desc);
create index pointages_company_day_idx on public.pointages (company_id, pointed_on desc);
create index pointages_status_idx on public.pointages (status) where status = 'pending';

-- Un seul pointage actif (non refusé) par employé et par jour :
-- un pointage refusé peut être refait.
create unique index pointages_one_per_day
  on public.pointages (employee_id, pointed_on)
  where status <> 'refused';

-- Trigger : forcer les valeurs serveur à l'insertion ------------------

create or replace function public.pointages_before_insert()
returns trigger
language plpgsql
as $$
begin
  -- Le client ne peut fixer ni l'horodatage, ni le statut, ni le validateur
  new.pointed_at := now();
  new.pointed_on := (now() at time zone 'Africa/Casablanca')::date;
  new.status := 'pending';
  new.validated_by := null;
  new.validated_at := null;
  new.agent_id := auth.uid();
  return new;
end;
$$;

create trigger pointages_before_insert
  before insert on public.pointages
  for each row execute function public.pointages_before_insert();

-- RPC : valider / refuser un pointage ---------------------------------
-- Sécurité : security definer, réservé aux validateurs (vérifié dans 002_rls.sql
-- via la fonction user_role() créée là-bas ; ici on vérifie le rôle directement).

create or replace function public.validate_pointage(p_pointage_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_employee uuid;
  v_company uuid;
  v_old_status public.pointage_status;
begin
  if p_decision not in ('validated', 'refused') then
    raise exception 'Décision invalide';
  end if;

  select role into v_role from public.profiles where user_id = auth.uid();
  if v_role is distinct from 'validator' then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, company_id, status
    into v_employee, v_company, v_old_status
    from public.pointages
    where id = p_pointage_id
    for update;

  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;

  if not exists (
    select 1 from public.user_companies
    where user_id = auth.uid() and company_id = v_company
  ) then
    raise exception 'Accès refusé à cette entreprise';
  end if;

  if v_old_status <> 'pending' then
    raise exception 'Ce pointage a déjà été traité';
  end if;

  update public.pointages
    set status = p_decision::public.pointage_status,
        validated_by = auth.uid(),
        validated_at = now()
    where id = p_pointage_id;

  if p_decision = 'validated' then
    update public.employees
      set jours_travailles = jours_travailles + 1
      where id = v_employee;
  end if;
end;
$$;

revoke all on function public.validate_pointage(uuid, text) from public;
grant execute on function public.validate_pointage(uuid, text) to authenticated;
