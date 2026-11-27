-- ============================================================
-- BLOC 57 — La date de sortie est celle qu'on a cliquée, et une sortie
--       s'annule sans perdre les journées retirées
-- À exécuter après le BLOC 56. Une instruction à la fois.
--
-- TROIS CHOSES.
--
-- 1. LA DATE. « Sortie » sur une case posait la date de sortie à la
--    VEILLE : on cliquait le 11, la section Sorties affichait le 10, et
--    personne ne retrouvait sa date. Désormais la case cliquée EST la
--    date de sortie — son dernier jour. Les journées retirées sont
--    celles d'APRÈS, strictement.
--
-- 2. CE QU'ON RETIRE EST GARDÉ. Retirer les journées d'après était
--    nécessaire — les laisser, c'était les payer — mais c'était aussi
--    irréversible : une sortie posée par erreur effaçait un mois de
--    pointage. Ces journées partent maintenant dans une archive, d'où
--    l'annulation les remet exactement comme elles étaient.
--
-- 3. ANNULER. Une sortie non validée s'annule : la personne revient en
--    poste, sa date de sortie s'effface, ses journées reviennent, et la
--    ligne de la section Sorties s'en va. Une sortie VALIDÉE ne
--    s'annule pas — le reçu est signé, l'argent est sorti.
-- ============================================================

-- 1. L'archive des journées retirées ------------------------------------------

create table if not exists public.pointages_retires (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  agent_id uuid,
  photo_path text,
  pointed_at timestamptz,
  pointed_on date not null,
  status public.pointage_status not null,
  type_garde text,
  conge_id uuid,
  ferie_id uuid,
  -- La sortie qui les a retirées, et son retour éventuel.
  date_sortie date,
  retire_le timestamptz not null default now(),
  retire_par uuid,
  restaure_le timestamptz
);

comment on table public.pointages_retires is
  'Les journées retirées par une sortie. Annuler la sortie les remet en place.';

create index if not exists pointages_retires_employe_idx
  on public.pointages_retires (employee_id) where restaure_le is null;

alter table public.pointages_retires enable row level security;

drop policy if exists pointages_retires_select on public.pointages_retires;
create policy pointages_retires_select on public.pointages_retires
  for select to authenticated
  using (public.peut_pointer(company_id));

-- 2. Retirer, mais garder -----------------------------------------------------

create or replace function public.nettoyer_pointages_apres_sortie(p_employee uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_sortie date;
  v_n int := 0;
  v_valeur numeric := 0;
begin
  select company_id, date_sortie into v_company, v_sortie
    from public.employees where id = p_employee;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;
  if v_sortie is null then
    return 0;   -- la personne est en poste : rien à retirer
  end if;

  -- On copie d'abord, on supprime ensuite : l'archive est ce qui rend
  -- l'annulation possible.
  insert into public.pointages_retires
    (employee_id, company_id, site_id, agent_id, photo_path, pointed_at,
     pointed_on, status, type_garde, conge_id, ferie_id, date_sortie, retire_par)
  select p.employee_id, p.company_id, p.site_id, p.agent_id, p.photo_path,
         p.pointed_at, p.pointed_on, p.status, p.type_garde, p.conge_id,
         p.ferie_id, v_sortie, auth.uid()
    from public.pointages p
   where p.employee_id = p_employee
     and p.pointed_on > v_sortie;

  select coalesce(sum(public.garde_valeur(type_garde)), 0), count(*)
    into v_valeur, v_n
    from public.pointages
   where employee_id = p_employee
     and pointed_on > v_sortie
     and status = 'validated';

  delete from public.pointages
   where employee_id = p_employee
     and pointed_on > v_sortie;

  -- Le compteur rend ce que valaient vraiment ces journées : un XX en
  -- valait deux, un repos n'en valait aucune.
  update public.employees
     set jours_travailles = greatest(0, jours_travailles - v_valeur)
   where id = p_employee;

  return v_n;
end;
$$;

revoke all on function public.nettoyer_pointages_apres_sortie(uuid) from public;
grant execute on function public.nettoyer_pointages_apres_sortie(uuid) to authenticated;

-- 3. Sortir depuis la case : la date cliquée est la date de sortie ------------

create or replace function public.sortir_employe_depuis(
  p_employee uuid,
  p_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_embauche date;
  v_id uuid;
begin
  select company_id, date_embauche into v_company, v_embauche
    from public.employees where id = p_employee for update;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;
  if p_date is null then
    raise exception 'Indiquez son dernier jour.';
  end if;
  if v_embauche is not null and p_date < v_embauche then
    raise exception 'Il n''a pas encore commencé le %.', to_char(p_date, 'DD/MM/YYYY');
  end if;

  -- Une sortie déjà validée ne se remanie pas : le reçu est signé.
  if exists (select 1 from public.sorties
              where employee_id = p_employee and valide) then
    raise exception 'La sortie de cet employé est déjà validée.';
  end if;

  -- La case cliquée est son DERNIER JOUR. C'est cette date-là que la
  -- section Sorties affichera, sans décalage d'un jour.
  update public.employees
     set date_sortie = p_date,
         actif = false
   where id = p_employee;

  perform public.nettoyer_pointages_apres_sortie(p_employee);

  insert into public.sorties
    (company_id, employee_id, date_sortie, montant, created_by)
  values (v_company, p_employee, p_date, 0, auth.uid())
  on conflict (employee_id) where not valide do update
    set date_sortie = excluded.date_sortie
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.sortir_employe_depuis(uuid, date) from public;
grant execute on function public.sortir_employe_depuis(uuid, date) to authenticated;

-- 4. Annuler la sortie --------------------------------------------------------
--  annuler_sortie(p_sortie) existe depuis le BLOC 17 : elle ne retire
--  que la ligne de la section Sorties, sans remettre la personne en
--  poste ni rendre ses journées. Celle-ci fait le geste entier, et
--  porte donc un autre nom.

create or replace function public.annuler_sortie_employe(p_employee uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_sortie date;
  v_rendues int := 0;
  v_valeur numeric := 0;
begin
  select company_id, date_sortie into v_company, v_sortie
    from public.employees where id = p_employee for update;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;
  if exists (select 1 from public.sorties
              where employee_id = p_employee and valide) then
    raise exception 'Cette sortie est validée : le solde a été réglé, elle ne s''annule plus.';
  end if;

  -- Le départ en cours s'efface : la ligne de la section Sorties s'en va.
  delete from public.sorties where employee_id = p_employee and not valide;

  update public.employees
     set date_sortie = null,
         actif = true
   where id = p_employee;

  -- Les journées retirées reviennent telles qu'elles étaient — sauf
  -- celles dont la case a été repointée entre-temps : on ne va pas
  -- écraser ce que le bureau a saisi depuis.
  perform set_config('app.pointage_manuel', 'on', true);

  with rendues as (
    insert into public.pointages
      (company_id, site_id, employee_id, agent_id, photo_path, pointed_at,
       pointed_on, status, type_garde, conge_id, ferie_id, validated_by, validated_at)
    select r.company_id, coalesce(r.site_id, e.site_id), r.employee_id,
           coalesce(r.agent_id, auth.uid()), r.photo_path,
           coalesce(r.pointed_at, now()), r.pointed_on, r.status, r.type_garde,
           r.conge_id, r.ferie_id, auth.uid(), now()
      from public.pointages_retires r
      join public.employees e on e.id = r.employee_id
     where r.employee_id = p_employee
       and r.restaure_le is null
       and not exists (select 1 from public.pointages p
                        where p.employee_id = r.employee_id
                          and p.pointed_on = r.pointed_on
                          and p.status <> 'refused')
    returning pointed_on, type_garde, status
  )
  select count(*),
         coalesce(sum(case when status = 'validated'
                          then public.garde_valeur(type_garde) else 0 end), 0)
    into v_rendues, v_valeur
    from rendues;

  perform set_config('app.pointage_manuel', 'off', true);

  update public.pointages_retires
     set restaure_le = now()
   where employee_id = p_employee
     and restaure_le is null;

  update public.employees
     set jours_travailles = jours_travailles + v_valeur
   where id = p_employee;

  return v_rendues;
end;
$$;

revoke all on function public.annuler_sortie_employe(uuid) from public;
grant execute on function public.annuler_sortie_employe(uuid) to authenticated;
