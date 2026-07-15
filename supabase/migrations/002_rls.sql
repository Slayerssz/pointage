-- ============================================================
-- 002 — Row Level Security (RLS)
-- À exécuter après 001_schema.sql
-- ============================================================

-- Fonctions utilitaires (security definer pour éviter la récursion RLS) ----

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create or replace function public.user_has_company(p_company uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_companies
    where user_id = auth.uid() and company_id = p_company
  );
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.user_has_company(uuid) to authenticated;

-- Activer RLS ---------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.sites enable row level security;
alter table public.employees enable row level security;
alter table public.profiles enable row level security;
alter table public.user_companies enable row level security;
alter table public.pointages enable row level security;

-- companies : lecture des entreprises accessibles ---------------------------

create policy companies_select on public.companies
  for select to authenticated
  using (public.user_has_company(id));

-- sites : lecture -----------------------------------------------------------

create policy sites_select on public.sites
  for select to authenticated
  using (public.user_has_company(company_id));

-- employees : lecture pour tous les rôles, modification pour validateurs ----

create policy employees_select on public.employees
  for select to authenticated
  using (public.user_has_company(company_id));

create policy employees_update on public.employees
  for update to authenticated
  using (
    public.user_has_company(company_id)
    and public.current_user_role() = 'validator'
  )
  with check (public.user_has_company(company_id));

-- profiles : chacun lit son propre profil ------------------------------------

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

-- user_companies : chacun lit ses propres accès -------------------------------

create policy user_companies_select_own on public.user_companies
  for select to authenticated
  using (user_id = auth.uid());

-- pointages -------------------------------------------------------------------

-- Lecture : toute personne ayant accès à l'entreprise
create policy pointages_select on public.pointages
  for select to authenticated
  using (public.user_has_company(company_id));

-- Insertion : agents uniquement, dans leurs entreprises
-- (le trigger force agent_id/pointed_at/status côté serveur)
create policy pointages_insert on public.pointages
  for insert to authenticated
  with check (
    public.user_has_company(company_id)
    and public.current_user_role() = 'agent'
  );

-- Pas de policy UPDATE/DELETE : la validation passe exclusivement
-- par la fonction validate_pointage() (security definer).
