-- ============================================================
-- 066 — Reprendre quelqu'un qui était sorti
-- À exécuter après 065_heures_du_mois.sql
--
-- Quelqu'un qui revient garde tout son passé : matricule, ancienneté,
-- contrats, mois déjà payés. On lui demande deux choses — le jour du
-- retour, à partir duquel ses journées se posent, et l'annexe où il
-- reprend, qui n'est pas forcément l'ancienne.
-- ============================================================

-- 1. Le jour du retour --------------------------------------------------------

alter table public.employees
  add column if not exists date_reprise date;

comment on column public.employees.date_reprise is
  'Jour où une personne sortie a repris le travail. Ses journées ne se posent pas avant.';

-- 2. Les journées ne se posent pas avant le retour ----------------------------

create or replace function public.pointer_depuis_embauche(p_employee uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_site uuid;
  v_repos int;
  v_embauche date;
  v_sortie date;
  v_reprise date;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
  v_debut date;
  v_fin date;
  v_n int := 0;
begin
  select company_id, site_id, jour_de_repos, date_embauche, date_sortie, date_reprise
    into v_company, v_site, v_repos, v_embauche, v_sortie, v_reprise
    from public.employees where id = p_employee;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;

  -- Du premier du mois ; ou de l'embauche, ou du retour, si l'un des
  -- deux est plus tardif. Quelqu'un revenu le 12 n'a pas travaillé le 3.
  v_debut := greatest(
    coalesce(v_embauche, v_today),
    coalesce(v_reprise, '0001-01-01'::date),
    date_trunc('month', v_today)::date
  );
  v_fin := least(v_today, coalesce(v_sortie, v_today));
  if v_debut > v_fin then
    return 0;
  end if;

  perform public.assert_mois_ouvert(v_company, v_debut);

  perform set_config('app.pointage_manuel', 'on', true);

  with inscrits as (
    insert into public.pointages
      (company_id, site_id, employee_id, agent_id, photo_path,
       pointed_at, pointed_on, status, type_garde, validated_by, validated_at)
    select v_company, v_site, p_employee, auth.uid(), null,
           now(), d::date, 'validated', 'X', auth.uid(), now()
      from generate_series(v_debut, v_fin, interval '1 day') d
     where not (v_repos is not null and extract(isodow from d)::int = v_repos)
       and not exists (select 1 from public.pointages p
                        where p.employee_id = p_employee and p.pointed_on = d::date
                          and p.status <> 'refused')
    returning 1
  )
  select count(*) into v_n from inscrits;

  update public.employees
     set jours_travailles = jours_travailles + v_n
   where id = p_employee;

  perform set_config('app.pointage_manuel', 'off', true);
  return v_n;
end;
$$;

revoke all on function public.pointer_depuis_embauche(uuid) from public;
grant execute on function public.pointer_depuis_embauche(uuid) to authenticated;

-- 3. Reprendre quelqu'un ------------------------------------------------------

create or replace function public.reprendre_employe(
  p_employee uuid,
  p_date date,
  p_site uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_sortie date;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
begin
  select company_id, date_sortie into v_company, v_sortie
    from public.employees where id = p_employee for update;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;
  if v_sortie is null then
    raise exception 'Cette personne n''est pas sortie : il n''y a rien à reprendre.';
  end if;
  if p_date is null then
    raise exception 'Indiquez le jour du retour.';
  end if;
  if p_date > v_today then
    raise exception 'Le jour du retour ne peut pas être à venir.';
  end if;
  -- Revenir avant d'être parti n'a pas de sens, et fausserait le mois
  -- du départ : ses journées d'alors sont déjà posées.
  if p_date <= v_sortie then
    raise exception 'Le retour doit être postérieur au départ, le %.',
      to_char(v_sortie, 'DD/MM/YYYY');
  end if;
  if p_site is null then
    raise exception 'Choisissez l''annexe où il reprend.';
  end if;
  if not exists (select 1 from public.sites s
                  where s.id = p_site and s.company_id = v_company) then
    raise exception 'Cette annexe n''est pas celle de sa société.';
  end if;

  update public.employees
     set actif = true,
         date_sortie = null,
         date_reprise = p_date,
         site_id = p_site
   where id = p_employee;

  -- Ses journées depuis son retour, si le mois est ouvert. Le mois clos
  -- n'est pas une raison de refuser la reprise : on le remet au travail
  -- et le pointage suivra.
  begin
    return public.pointer_depuis_embauche(p_employee);
  exception when others then
    return 0;
  end;
end;
$$;

revoke all on function public.reprendre_employe(uuid, date, uuid) from public;
grant execute on function public.reprendre_employe(uuid, date, uuid) to authenticated;
