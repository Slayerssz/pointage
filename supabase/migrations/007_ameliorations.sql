-- ============================================================
-- 007 — Améliorations & corrections
-- À exécuter après 006_seed_page4.sql.
--
-- 1. Matricule numérique + attribution automatique (dernier + 1)
-- 2. Les validateurs peuvent AJOUTER et MODIFIER des employés (pas supprimer)
-- 3. Présence manuelle : le bureau peut marquer un employé présent sans photo
-- 4. Le site SUPERVISEUR n'apparaît plus dans le pointage
-- 5. Corrections de données (sites, dates de naissance, modes de règlement)
-- ============================================================

-- 1. Matricule numérique ------------------------------------------------

alter table public.employees
  alter column matricule type integer using nullif(trim(matricule), '')::integer;

-- Attribution automatique : si aucun matricule n'est fourni à la création,
-- prendre le plus grand matricule de l'entreprise + 1.
create or replace function public.employees_assign_matricule()
returns trigger
language plpgsql
as $$
begin
  if new.matricule is null then
    select coalesce(max(matricule), 0) + 1
      into new.matricule
      from public.employees
      where company_id = new.company_id;
  end if;
  return new;
end;
$$;

create trigger employees_assign_matricule
  before insert on public.employees
  for each row execute function public.employees_assign_matricule();

create index if not exists employees_company_matricule_idx
  on public.employees (company_id, matricule);

-- 2. Ajout d'employés par les validateurs --------------------------------

create policy employees_insert on public.employees
  for insert to authenticated
  with check (public.current_user_role() = 'validator');

-- (pas de policy DELETE : la suppression sera réservée plus tard)

-- 3. Présence manuelle ----------------------------------------------------

-- La photo devient optionnelle (présence marquée par le bureau = sans photo)
alter table public.pointages alter column photo_path drop not null;

-- Le trigger ne force les valeurs serveur que pour les pointages « photo »
-- des agents ; la fonction marquer_present() (ci-dessous) le contourne.
create or replace function public.pointages_before_insert()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.pointage_manuel', true) = 'on' then
    return new;
  end if;
  new.pointed_at := now();
  new.pointed_on := (now() at time zone 'Africa/Casablanca')::date;
  new.status := 'pending';
  new.validated_by := null;
  new.validated_at := null;
  new.agent_id := auth.uid();
  return new;
end;
$$;

-- Marquer un employé présent (validateurs uniquement), pour un jour donné
-- de la semaine. Crée directement un pointage VALIDÉ sans photo et
-- incrémente les jours travaillés.
create or replace function public.marquer_present(p_employee_id uuid, p_date date)
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
  select role into v_role from public.profiles where user_id = auth.uid();
  if v_role is distinct from 'validator' then
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
       pointed_at, pointed_on, status, validated_by, validated_at)
    values
      (v_company, v_site, p_employee_id, auth.uid(), null,
       now(), p_date, 'validated', auth.uid(), now());
  exception when unique_violation then
    perform set_config('app.pointage_manuel', 'off', true);
    raise exception 'Cet employé a déjà un pointage ce jour-là';
  end;

  perform set_config('app.pointage_manuel', 'off', true);

  update public.employees
    set jours_travailles = jours_travailles + 1
    where id = p_employee_id;
end;
$$;

revoke all on function public.marquer_present(uuid, date) from public;
grant execute on function public.marquer_present(uuid, date) to authenticated;

-- Valeurs distinctes pour les filtres de l'onglet Employés
create or replace function public.filtres_employes(p_company uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'villes',
      (select coalesce(jsonb_agg(v), '[]'::jsonb)
       from (select distinct ville as v from public.employees
             where company_id = p_company and ville is not null order by 1) t),
    'qualifications',
      (select coalesce(jsonb_agg(v), '[]'::jsonb)
       from (select distinct qualification as v from public.employees
             where company_id = p_company and qualification is not null order by 1) t),
    'modes_reglement',
      (select coalesce(jsonb_agg(v), '[]'::jsonb)
       from (select distinct mode_reglement as v from public.employees
             where company_id = p_company and mode_reglement is not null order by 1) t)
  );
$$;

grant execute on function public.filtres_employes(uuid) to authenticated;

-- 4. Le site SUPERVISEUR ne fait pas partie du pointage ---------------------

alter table public.sites add column if not exists pointage_actif boolean not null default true;

update public.sites set pointage_actif = false where name = 'SUPERVISEUR';

-- Les superviseurs sont ceux qui font la tournée des pointages
update public.employees e
  set qualification = 'SUPERVISEUR'
  from public.sites s
  where e.site_id = s.id and s.name = 'SUPERVISEUR';

-- 5. Corrections de données --------------------------------------------------

-- Changements de site
do $$
declare
  v_company uuid;
begin
  select id into v_company from public.companies where name = 'Groupe Triple A';

  -- 201, 403 → CENTRE MEDICO RAHRAH
  update public.employees e set site_id = s.id
    from public.sites s
    where s.company_id = v_company and s.name = 'CENTRE MEDICO RAHRAH'
      and e.company_id = v_company and e.matricule in (201, 403);

  -- 1093, 1260, 1257, 1256, 1109, 728, 1212 → JOKER
  update public.employees e set site_id = s.id
    from public.sites s
    where s.company_id = v_company and s.name = 'JOKER'
      and e.company_id = v_company and e.matricule in (1093, 1260, 1257, 1256, 1109, 728, 1212);

  -- 867 → PARKING LA COMMUNE
  update public.employees e set site_id = s.id
    from public.sites s
    where s.company_id = v_company and s.name = 'PARKING LA COMMUNE'
      and e.company_id = v_company and e.matricule = 867;

  -- 1017, 1018 → LA COMMUNE GZENAYA
  update public.employees e set site_id = s.id
    from public.sites s
    where s.company_id = v_company and s.name = 'LA COMMUNE GZENAYA'
      and e.company_id = v_company and e.matricule in (1017, 1018);

  -- 1277 → BLOC SANITAIRE PLAYA
  update public.employees e set site_id = s.id
    from public.sites s
    where s.company_id = v_company and s.name = 'BLOC SANITAIRE PLAYA'
      and e.company_id = v_company and e.matricule = 1277;

  -- 1139, 1138, 1233, 1142, 1143, 1137, 1202 → ATLAS BERRY AGADIR
  update public.employees e set site_id = s.id
    from public.sites s
    where s.company_id = v_company and s.name = 'ATLAS BERRY AGADIR'
      and e.company_id = v_company and e.matricule in (1139, 1138, 1233, 1142, 1143, 1137, 1202);

  -- Dates de naissance
  update public.employees set date_naissance = date '1966-01-01'
    where company_id = v_company and matricule = 852;
  update public.employees set date_naissance = date '1956-01-01'
    where company_id = v_company and matricule = 849;

  -- Modes de règlement
  update public.employees set mode_reglement = 'Versement'
    where company_id = v_company and matricule in (1229, 1041);
  update public.employees set mode_reglement = 'Virement'
    where company_id = v_company and matricule in (956, 1040);
end;
$$;
