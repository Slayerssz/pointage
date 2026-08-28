-- ============================================================
-- 020 — Verrouillage complet d'un mois clôturé
-- À exécuter après 019_organisations_permissions.sql
--
-- Deux trous bouchés :
--  1. Un agent pouvait encore envoyer une photo sur un mois déjà
--     clôturé (son insertion ne passait pas par les fonctions).
--  2. Un congé à cheval sur 3 mois ou plus ne vérifiait que le
--     premier et le dernier mois : un mois clôturé au milieu
--     passait au travers.
-- ============================================================

-- 1. Vérifier TOUS les mois couverts par une période ---------------------------

create or replace function public.assert_periode_ouverte(
  p_company uuid,
  p_debut date,
  p_fin date
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mois date;
begin
  for v_mois in
    select generate_series(date_trunc('month', p_debut),
                           date_trunc('month', p_fin),
                           interval '1 month')::date
  loop
    perform public.assert_mois_ouvert(p_company, v_mois);
  end loop;
end;
$$;

grant execute on function public.assert_periode_ouverte(uuid, date, date) to authenticated;

-- 2. L'agent ne peut plus pointer sur un mois clôturé ---------------------------

create or replace function public.pointages_before_insert()
returns trigger
language plpgsql
as $$
begin
  -- Saisie par le bureau : les fonctions (marquer_present, creer_conge)
  -- ont déjà vérifié le verrouillage du mois.
  if current_setting('app.pointage_manuel', true) = 'on' then
    return new;
  end if;

  new.pointed_at := now();
  new.pointed_on := (now() at time zone 'Africa/Casablanca')::date;
  new.status := 'pending';
  new.validated_by := null;
  new.validated_at := null;
  new.agent_id := auth.uid();
  new.conge_id := null;

  -- Pointage terrain : refuser si le mois est déjà clôturé
  perform public.assert_mois_ouvert(new.company_id, new.pointed_on);

  return new;
end;
$$;

-- 3. Les congés vérifient chaque mois traversé ----------------------------------

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
  if coalesce(p_type, '') not in ('C', 'CS', 'M', 'AJ') then
    raise exception 'Type de congé invalide';
  end if;
  v_role := coalesce(public.current_user_role()::text, '');
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

  -- Tous les mois traversés doivent être ouverts
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
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, company_id, type, date_debut, date_fin
    into v_employee, v_company, v_type, v_debut, v_fin
    from public.conges where id = p_conge_id for update;
  if v_employee is null then
    raise exception 'Congé introuvable';
  end if;

  perform public.assert_periode_ouverte(v_company, v_debut, v_fin);

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
