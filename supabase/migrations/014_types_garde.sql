-- ============================================================
-- 014 — Types de garde (X, X̸, XX, RT) choisis à la validation
-- À exécuter après 013_admin_fonctions.sql.
--
--   -   Absent           (automatique : aucun pointage)
--   X   Une garde        (valeur 1)   ← défaut à l'acceptation
--   X̸   Une garde et demi (valeur 1.5)
--   XX  Deux gardes       (valeur 2)
--   R   Repos            (automatique : jour de repos)
--   RT  Repos travaillé   (valeur 1)
-- ============================================================

-- Le compteur devient décimal (1,5 garde possible)
alter table public.employees
  alter column jours_travailles type numeric(8, 1) using jours_travailles::numeric;

-- Type de garde sur le pointage (null tant que non validé)
alter table public.pointages
  add column if not exists type_garde text
  check (type_garde in ('X', 'X15', 'XX', 'RT'));

-- Les pointages déjà validés = une garde (X)
update public.pointages set type_garde = 'X'
  where status = 'validated' and type_garde is null;

-- Valeur (en gardes) d'un type
create or replace function public.garde_valeur(p_type text)
returns numeric
language sql
immutable
as $$
  select case p_type
    when 'X' then 1 when 'X15' then 1.5 when 'XX' then 2 when 'RT' then 1
    else 0 end::numeric;
$$;

-- ---------- Validation avec type de garde ------------------------------

drop function if exists public.validate_pointage(uuid, text);
create or replace function public.validate_pointage(
  p_pointage_id uuid,
  p_decision text,
  p_type text default 'X'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_employee uuid;
  v_old_status public.pointage_status;
begin
  if p_decision not in ('validated', 'refused') then
    raise exception 'Décision invalide';
  end if;
  if p_decision = 'validated' and p_type not in ('X', 'X15', 'XX', 'RT') then
    raise exception 'Type de garde invalide';
  end if;

  select role into v_role from public.profiles where user_id = auth.uid();
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, status into v_employee, v_old_status
    from public.pointages where id = p_pointage_id for update;
  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;
  if v_old_status <> 'pending' then
    raise exception 'Ce pointage a déjà été traité';
  end if;

  if p_decision = 'validated' then
    update public.pointages
      set status = 'validated', validated_by = auth.uid(), validated_at = now(),
          type_garde = p_type
      where id = p_pointage_id;
    update public.employees
      set jours_travailles = jours_travailles + public.garde_valeur(p_type)
      where id = v_employee;
  else
    update public.pointages
      set status = 'refused', validated_by = auth.uid(), validated_at = now()
      where id = p_pointage_id;
  end if;
end;
$$;

revoke all on function public.validate_pointage(uuid, text, text) from public;
grant execute on function public.validate_pointage(uuid, text, text) to authenticated;

-- ---------- Changer le type d'un pointage déjà validé ------------------

create or replace function public.changer_type_garde(p_pointage_id uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_employee uuid;
  v_status public.pointage_status;
  v_old_type text;
begin
  if p_type not in ('X', 'X15', 'XX', 'RT') then
    raise exception 'Type de garde invalide';
  end if;
  select role into v_role from public.profiles where user_id = auth.uid();
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, status, type_garde into v_employee, v_status, v_old_type
    from public.pointages where id = p_pointage_id for update;
  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;
  if v_status <> 'validated' then
    raise exception 'Seuls les pointages validés peuvent changer de type';
  end if;

  update public.pointages set type_garde = p_type where id = p_pointage_id;
  update public.employees
    set jours_travailles = jours_travailles
      + public.garde_valeur(p_type) - public.garde_valeur(coalesce(v_old_type, 'X'))
    where id = v_employee;
end;
$$;

revoke all on function public.changer_type_garde(uuid, text) from public;
grant execute on function public.changer_type_garde(uuid, text) to authenticated;

-- ---------- Présence manuelle avec type de garde -----------------------

drop function if exists public.marquer_present(uuid, date);
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
  v_role public.user_role;
  v_company uuid;
  v_site uuid;
begin
  if p_type not in ('X', 'X15', 'XX', 'RT') then
    raise exception 'Type de garde invalide';
  end if;
  select role into v_role from public.profiles where user_id = auth.uid();
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;
  if p_date > (now() at time zone 'Africa/Casablanca')::date then
    raise exception 'Impossible de marquer une présence dans le futur';
  end if;

  select company_id, site_id into v_company, v_site
    from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Employé introuvable';
  end if;

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
