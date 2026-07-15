-- ============================================================
-- 002 — Row Level Security (RLS)
-- À exécuter après 001_schema.sql
--
-- Règle actuelle : tout utilisateur connecté voit TOUTES les
-- entreprises et choisit celle sur laquelle travailler.
-- (Une restriction par entreprise pourra être ajoutée plus tard.)
-- ============================================================

-- Fonction utilitaire (security definer pour éviter la récursion RLS) ----

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid();
$$;

grant execute on function public.current_user_role() to authenticated;

-- Activer RLS ---------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.sites enable row level security;
alter table public.employees enable row level security;
alter table public.profiles enable row level security;
alter table public.pointages enable row level security;

-- Lecture : tout utilisateur connecté ----------------------------------------

create policy companies_select on public.companies
  for select to authenticated
  using (true);

create policy sites_select on public.sites
  for select to authenticated
  using (true);

create policy employees_select on public.employees
  for select to authenticated
  using (true);

-- employees : modification réservée aux validateurs --------------------------

create policy employees_update on public.employees
  for update to authenticated
  using (public.current_user_role() = 'validator')
  with check (true);

-- profiles : chacun lit son propre profil ------------------------------------

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

-- pointages -------------------------------------------------------------------

-- Lecture : tout utilisateur connecté
create policy pointages_select on public.pointages
  for select to authenticated
  using (true);

-- Insertion : agents uniquement
-- (le trigger force agent_id/pointed_at/status côté serveur)
create policy pointages_insert on public.pointages
  for insert to authenticated
  with check (public.current_user_role() = 'agent');

-- Pas de policy UPDATE/DELETE : la validation passe exclusivement
-- par la fonction validate_pointage() (security definer).
