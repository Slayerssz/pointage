-- ============================================================
-- 015 — Heures mensuelles, paramètres de paie et contrats
-- À exécuter après 014_types_garde.sql
--
-- 1. Chaque employé a un nombre d'heures mensuelles à faire.
-- 2. Chaque entreprise a ses paramètres de paie (base 26 jours…).
-- 3. Table des contrats : début / fin, impression PDF, alertes
--    bleu (fin dans ≤ 10 jours) et jaune (contrat terminé).
-- ============================================================

-- 1. Heures de travail par jour ----------------------------------------------
-- Durée d'une garde normale, en heures (ex. 8).
-- Le nombre d'heures d'un jour suit le type de garde :
--   ½  = 0,5 garde → 4 h      X   = 1 garde   → 8 h
--   X̸  = 1,5 garde → 12 h     XX  = 2 gardes  → 16 h
-- Le salaire journalier, lui, vaut salaire mensuel / jours_base (26).

alter table public.employees
  add column if not exists heures_par_jour numeric(5, 2) default 8;

-- 2. Paramètres de paie par entreprise --------------------------------------

create table if not exists public.parametres_paie (
  company_id uuid primary key references public.companies(id) on delete cascade,
  -- Nombre de jours qui correspond au salaire complet (26 par défaut)
  jours_base numeric(5, 2) not null default 26 check (jours_base > 0),
  -- Un jour « Malade » est-il payé (compté comme un jour travaillé) ?
  maladie_payee boolean not null default true,
  -- Un jour de congé est-il payé (compté comme un jour travaillé) ?
  conge_paye boolean not null default true,
  -- Heures par jour par défaut pour les nouveaux employés
  heures_par_jour_defaut numeric(5, 2) default 8,
  devise text not null default 'DH',
  updated_at timestamptz not null default now()
);

-- Une ligne de paramètres pour chaque entreprise existante
insert into public.parametres_paie (company_id)
  select id from public.companies
  on conflict (company_id) do nothing;

-- …et pour chaque nouvelle entreprise créée ensuite
create or replace function public.companies_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.parametres_paie (company_id) values (new.id)
    on conflict (company_id) do nothing;
  return new;
end;
$$;

drop trigger if exists companies_after_insert on public.companies;
create trigger companies_after_insert
  after insert on public.companies
  for each row execute function public.companies_after_insert();

alter table public.parametres_paie enable row level security;

drop policy if exists parametres_paie_select on public.parametres_paie;
create policy parametres_paie_select on public.parametres_paie
  for select to authenticated using (true);

-- La modification passe par la fonction maj_parametres_paie() ci-dessous.

create or replace function public.maj_parametres_paie(
  p_company uuid,
  p_jours_base numeric,
  p_maladie_payee boolean,
  p_conge_paye boolean,
  p_heures_defaut numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role()::text not in ('admin', 'paie') then
    raise exception 'Réservé à l''administrateur et au responsable de paie';
  end if;
  if p_jours_base is null or p_jours_base <= 0 then
    raise exception 'Le nombre de jours de base doit être supérieur à 0';
  end if;

  insert into public.parametres_paie
    (company_id, jours_base, maladie_payee, conge_paye, heures_par_jour_defaut, updated_at)
  values
    (p_company, p_jours_base, p_maladie_payee, p_conge_paye, p_heures_defaut, now())
  on conflict (company_id) do update
    set jours_base = excluded.jours_base,
        maladie_payee = excluded.maladie_payee,
        conge_paye = excluded.conge_paye,
        heures_par_jour_defaut =
          coalesce(excluded.heures_par_jour_defaut, parametres_paie.heures_par_jour_defaut),
        updated_at = now();
end;
$$;

revoke all on function public.maj_parametres_paie(uuid, numeric, boolean, boolean, numeric) from public;
grant execute on function public.maj_parametres_paie(uuid, numeric, boolean, boolean, numeric) to authenticated;

-- 3. Contrats ----------------------------------------------------------------

create table if not exists public.contrats (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  numero text,
  type_contrat text not null default 'CDI'
    check (type_contrat in ('CDI', 'CDD', 'ANAPEC', 'STAGE', 'INTERIM', 'ESSAI')),
  date_debut date not null,
  -- null = durée indéterminée (CDI) : aucune alerte de fin
  date_fin date,
  periode_essai_jours integer default 0 check (periode_essai_jours >= 0),
  poste text,
  lieu_travail text,
  salaire_mensuel numeric(10, 2),
  heures_par_jour numeric(5, 2),
  mode_reglement text,
  -- Signature
  signe_a text,
  signe_le date,
  representant_employeur text,
  observations text,
  -- Un contrat archivé n'entre plus dans le calcul des alertes
  archive boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (date_fin is null or date_fin >= date_debut)
);

create index if not exists contrats_employee_idx on public.contrats (employee_id, date_debut desc);
create index if not exists contrats_company_idx on public.contrats (company_id);
create index if not exists contrats_fin_idx on public.contrats (date_fin) where date_fin is not null;

-- Numéro de contrat automatique : CT-<année>-<n°> par entreprise
create or replace function public.contrats_before_insert()
returns trigger
language plpgsql
as $$
declare
  v_n integer;
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  if new.numero is null or trim(new.numero) = '' then
    select count(*) + 1 into v_n
      from public.contrats
      where company_id = new.company_id
        and date_part('year', date_debut) = date_part('year', new.date_debut);
    new.numero := 'CT-' || to_char(new.date_debut, 'YYYY') || '-' || lpad(v_n::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists contrats_before_insert on public.contrats;
create trigger contrats_before_insert
  before insert on public.contrats
  for each row execute function public.contrats_before_insert();

-- Statut d'un contrat, pour la couleur affichée dans l'application :
--   'termine'  → JAUNE  (date de fin dépassée)
--   'bientot'  → BLEU   (se termine dans 10 jours ou moins)
--   'actif'    → normal
--   'a_venir'  → commence plus tard
create or replace function public.contrat_statut(p_debut date, p_fin date, p_ref date default null)
returns text
language sql
immutable
as $$
  select case
    when p_fin is not null and p_fin < coalesce(p_ref, current_date) then 'termine'
    when p_debut > coalesce(p_ref, current_date) then 'a_venir'
    when p_fin is not null
     and p_fin - coalesce(p_ref, current_date) between 0 and 10 then 'bientot'
    else 'actif'
  end;
$$;

grant execute on function public.contrat_statut(date, date, date) to authenticated;

alter table public.contrats enable row level security;

drop policy if exists contrats_select on public.contrats;
create policy contrats_select on public.contrats
  for select to authenticated using (true);

drop policy if exists contrats_insert on public.contrats;
create policy contrats_insert on public.contrats
  for insert to authenticated
  with check (public.current_user_role()::text in ('validator', 'admin'));

drop policy if exists contrats_update on public.contrats;
create policy contrats_update on public.contrats
  for update to authenticated
  using (public.current_user_role()::text in ('validator', 'admin'))
  with check (true);

drop policy if exists contrats_delete on public.contrats;
create policy contrats_delete on public.contrats
  for delete to authenticated
  using (public.current_user_role()::text in ('validator', 'admin'));

-- Contrat courant de chaque employé (le plus récent non archivé) + son statut.
drop view if exists public.contrats_courants;
create view public.contrats_courants
  with (security_invoker = on) as
  select distinct on (c.employee_id)
    c.id, c.employee_id, c.company_id, c.numero, c.type_contrat,
    c.date_debut, c.date_fin, c.poste, c.salaire_mensuel,
    public.contrat_statut(c.date_debut, c.date_fin) as statut,
    case when c.date_fin is null then null
         else c.date_fin - (now() at time zone 'Africa/Casablanca')::date end as jours_restants
  from public.contrats c
  where not c.archive
  order by c.employee_id, c.date_debut desc, c.created_at desc;

grant select on public.contrats_courants to authenticated;
