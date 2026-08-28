-- ============================================================
-- 016 — Absences justifiées : Malade et Congé
-- À exécuter après 015_heures_contrats.sql
--
-- Nouveaux types de garde :
--   X05 = Demi-garde         → une demi-journée travaillée (0,5)
--   M  = Malade              → absence approuvée (payée par défaut)
--   C  = Congé payé          → compte comme une garde travaillée
--   CS = Congé sans solde    → absence approuvée, non payée
--   AJ = Absence justifiée   → absence approuvée, non payée (autre motif)
--
-- Le congé se saisit sur une période (du … au …) : les jours sont
-- alors créés automatiquement dans le pointage.
-- ============================================================

-- 0. Garde-fou « mois de paie verrouillé » -------------------------------------
-- Version provisoire : remplacée par la vraie implémentation dans 017_paie.sql.
-- (Définie ici pour que les fonctions ci-dessous puissent l'appeler.)

create or replace function public.assert_mois_ouvert(p_company uuid, p_date date)
returns void
language plpgsql
as $$
begin
  return;
end;
$$;

grant execute on function public.assert_mois_ouvert(uuid, date) to authenticated;

-- 1. Nouveaux codes de type de garde ----------------------------------------

alter table public.pointages drop constraint if exists pointages_type_garde_check;
alter table public.pointages
  add constraint pointages_type_garde_check
  check (type_garde in ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ'));

-- Valeur en gardes (compteur « jours travaillés » de la fiche employé).
-- Le calcul de la paie, lui, applique les paramètres de l'entreprise
-- (maladie_payee / conge_paye) — voir 017_paie.sql.
create or replace function public.garde_valeur(p_type text)
returns numeric
language sql
immutable
as $$
  select case p_type
    when 'X05' then 0.5   -- demi-garde
    when 'X'   then 1
    when 'X15' then 1.5
    when 'XX'  then 2
    when 'RT'  then 1
    when 'M'   then 1     -- malade : payé par défaut
    when 'C'   then 1     -- congé payé
    when 'CS'  then 0     -- congé sans solde
    when 'AJ'  then 0     -- absence justifiée non payée
    else 0
  end::numeric;
$$;

-- Un type de garde est-il une absence approuvée (≠ travail effectif) ?
create or replace function public.garde_est_absence(p_type text)
returns boolean
language sql
immutable
as $$
  select p_type in ('M', 'C', 'CS', 'AJ');
$$;

grant execute on function public.garde_est_absence(text) to authenticated;

-- 2. Congés (périodes) --------------------------------------------------------

create table if not exists public.conges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null default 'C' check (type in ('C', 'CS', 'M', 'AJ')),
  date_debut date not null,
  date_fin date not null,
  motif text,
  -- Nombre de jours effectivement créés dans le pointage
  jours integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (date_fin >= date_debut)
);

create index if not exists conges_employee_idx on public.conges (employee_id, date_debut desc);
create index if not exists conges_company_idx on public.conges (company_id, date_debut desc);

alter table public.conges enable row level security;

drop policy if exists conges_select on public.conges;
create policy conges_select on public.conges
  for select to authenticated using (true);

-- Création / suppression uniquement par les fonctions ci-dessous.

-- Lien pointage → congé, pour pouvoir tout annuler d'un coup.
alter table public.pointages
  add column if not exists conge_id uuid references public.conges(id) on delete cascade;

create index if not exists pointages_conge_idx on public.pointages (conge_id)
  where conge_id is not null;

-- 3. Marquer un jour (présence, maladie, congé…) ------------------------------
-- Remplace marquer_present() en acceptant les nouveaux codes.

drop function if exists public.marquer_present(uuid, date, text);

create or replace function public.marquer_present(
  p_employee_id uuid,
  p_date date,
  p_type text default 'X'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_company uuid;
  v_site uuid;
begin
  if p_type not in ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ') then
    raise exception 'Type de garde invalide';
  end if;

  v_role := public.current_user_role()::text;
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  if p_date > (now() at time zone 'Africa/Casablanca')::date then
    raise exception 'Impossible de marquer un jour dans le futur';
  end if;

  select company_id, site_id into v_company, v_site
    from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Employé introuvable';
  end if;

  perform public.assert_mois_ouvert(v_company, p_date);

  perform set_config('app.pointage_manuel', 'on', true);
  begin
    insert into public.pointages
      (company_id, site_id, employee_id, agent_id, photo_path,
       pointed_at, pointed_on, status, type_garde, validated_by, validated_at)
    values
      (v_company, v_site, p_employee_id, auth.uid(), null,
       now(), p_date, 'validated', p_type, auth.uid(), now());
  exception when unique_violation then
    perform set_config('app.pointage_manuel', 'off', true);
    raise exception 'Cet employé a déjà un pointage ce jour-là';
  end;
  perform set_config('app.pointage_manuel', 'off', true);

  update public.employees
    set jours_travailles = jours_travailles + public.garde_valeur(p_type)
    where id = p_employee_id;
end;
$$;

revoke all on function public.marquer_present(uuid, date, text) from public;
grant execute on function public.marquer_present(uuid, date, text) to authenticated;

-- 4. Supprimer un jour marqué manuellement -------------------------------------

create or replace function public.supprimer_pointage(p_pointage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_employee uuid;
  v_type text;
  v_status public.pointage_status;
  v_company uuid;
  v_date date;
  v_conge uuid;
begin
  v_role := public.current_user_role()::text;
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, type_garde, status, company_id, pointed_on, conge_id
    into v_employee, v_type, v_status, v_company, v_date, v_conge
    from public.pointages where id = p_pointage_id for update;

  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;
  if v_conge is not null then
    raise exception 'Ce jour fait partie d''un congé : supprimez le congé.';
  end if;

  perform public.assert_mois_ouvert(v_company, v_date);

  if v_status = 'validated' then
    update public.employees
      set jours_travailles = greatest(0, jours_travailles - public.garde_valeur(coalesce(v_type, 'X')))
      where id = v_employee;
  end if;

  delete from public.pointages where id = p_pointage_id;
end;
$$;

revoke all on function public.supprimer_pointage(uuid) from public;
grant execute on function public.supprimer_pointage(uuid) to authenticated;

-- 5. Créer un congé sur une période ---------------------------------------------
-- Crée un pointage validé (type C / CS / M / AJ) pour chaque jour de la période.
-- Le jour de repos hebdomadaire de l'employé est ignoré (il ne consomme pas
-- de jour de congé) ; les jours déjà pointés sont laissés tels quels.

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
  v_role text;
  v_company uuid;
  v_site uuid;
  v_repos smallint;
  v_conge uuid;
  v_jour date;
  v_n integer := 0;
  v_valeur numeric;
begin
  if p_type not in ('C', 'CS', 'M', 'AJ') then
    raise exception 'Type de congé invalide';
  end if;
  v_role := public.current_user_role()::text;
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;
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

  perform public.assert_mois_ouvert(v_company, p_date_debut);
  perform public.assert_mois_ouvert(v_company, p_date_fin);

  insert into public.conges (company_id, employee_id, type, date_debut, date_fin, motif, created_by)
  values (v_company, p_employee_id, p_type, p_date_debut, p_date_fin, nullif(trim(p_motif), ''), auth.uid())
  returning id into v_conge;

  v_valeur := public.garde_valeur(p_type);

  perform set_config('app.pointage_manuel', 'on', true);
  for v_jour in select generate_series(p_date_debut, p_date_fin, interval '1 day')::date loop
    -- Jour de repos hebdomadaire : ne consomme pas de congé
    if v_repos is not null and extract(isodow from v_jour)::int = v_repos then
      continue;
    end if;
    -- Jour déjà pointé (non refusé) : on n'écrase rien
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

-- 6. Supprimer un congé (et les jours de pointage qu'il a créés) ------------------

create or replace function public.supprimer_conge(p_conge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_employee uuid;
  v_company uuid;
  v_type text;
  v_debut date;
  v_fin date;
  v_n integer;
begin
  v_role := public.current_user_role()::text;
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, company_id, type, date_debut, date_fin
    into v_employee, v_company, v_type, v_debut, v_fin
    from public.conges where id = p_conge_id for update;
  if v_employee is null then
    raise exception 'Congé introuvable';
  end if;

  perform public.assert_mois_ouvert(v_company, v_debut);
  perform public.assert_mois_ouvert(v_company, v_fin);

  delete from public.pointages where conge_id = p_conge_id;
  get diagnostics v_n = row_count;

  update public.employees
    set jours_travailles = greatest(0, jours_travailles - (v_n * public.garde_valeur(v_type)))
    where id = v_employee;

  delete from public.conges where id = p_conge_id;
end;
$$;

revoke all on function public.supprimer_conge(uuid) from public;
grant execute on function public.supprimer_conge(uuid) to authenticated;
