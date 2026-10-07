-- ============================================================================
--  BLOC 39 sur 39 — Le personnel pointe les sociétés qu'on lui confie
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 38.
--
--  L'administrateur rattache des sociétés à un compte « personnel ».
--  Sur celles-là, et sur aucune autre, l'onglet Pointage s'ouvre.
--
--  Le personnel continue de voir toutes les sociétés et tous les
--  dossiers. Il ne valide toujours pas le mois, ne touche pas à la paie
--  et ne sort personne du registre.
-- ============================================================================

-- ============================================================
-- 056 — Le personnel pointe les sociétés qu'on lui confie
-- À exécuter après 055_gain_saisi.sql
--
-- Jusqu'ici le pointage était réservé au bureau et à l'administrateur.
-- Le personnel tient les dossiers, mais ne pouvait pas pointer.
--
-- L'administrateur lui rattache désormais des sociétés, une par une.
-- Sur celles-là — et sur aucune autre — l'onglet Pointage s'ouvre, et
-- le personnel y saisit comme le bureau.
--
-- Le reste ne bouge pas : il continue de voir toutes les sociétés et
-- tous les dossiers, comme avant. Il ne valide pas le mois, ne touche
-- pas à la paie, et ne sort personne du registre.
--
-- Les autres rôles ne sont pas concernés : le bureau et
-- l'administrateur pointent partout, comme avant.
-- ============================================================

create table if not exists public.acces_societes (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  accorde_par uuid references auth.users(id),
  accorde_le timestamptz not null default now(),
  primary key (user_id, company_id)
);

comment on table public.acces_societes is
  'Les sociétés qu''un compte du personnel a le droit de pointer.';

create index if not exists acces_societes_user_idx on public.acces_societes (user_id);

alter table public.acces_societes enable row level security;

-- Chacun lit les rattachements : le personnel pour savoir où il va,
-- l'administrateur pour les gérer. L'écriture passe par les fonctions.
drop policy if exists acces_societes_select on public.acces_societes;
create policy acces_societes_select on public.acces_societes
  for select to authenticated using (true);

-- 1. Qui peut pointer quoi ----------------------------------------------------

create or replace function public.peut_pointer(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case coalesce(public.current_user_role()::text, '')
    when 'admin' then true
    when 'validator' then true
    -- Le personnel : seulement les sociétés qu'on lui a confiées.
    when 'rh' then exists (
      select 1 from public.acces_societes
       where user_id = auth.uid() and company_id = p_company)
    else false
  end;
$$;

-- 2. L'administrateur confie, ou retire ---------------------------------------
-- On pose la liste entière plutôt qu'une société à la fois : l'écran
-- montre des cases à cocher, et ce qui est décoché doit disparaître.

create or replace function public.admin_definir_acces_societes(
  p_user uuid,
  p_companies uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  perform public.exiger_role('admin');

  select role::text into v_role from public.profiles where user_id = p_user;
  if v_role is null then
    raise exception 'Compte introuvable.';
  end if;
  if v_role <> 'rh' then
    raise exception
      'Seul un compte « personnel » se rattache à des sociétés : % les voit déjà toutes.',
      v_role;
  end if;

  delete from public.acces_societes
   where user_id = p_user
     and company_id <> all (coalesce(p_companies, '{}'::uuid[]));

  insert into public.acces_societes (user_id, company_id, accorde_par)
  select p_user, c, auth.uid()
    from unnest(coalesce(p_companies, '{}'::uuid[])) as c
   where exists (select 1 from public.companies where id = c)
  on conflict (user_id, company_id) do nothing;
end;
$$;

-- 3. Les gestes du pointage s'ouvrent au personnel autorisé -------------
-- Le refus immédiat reste en tête — un inconnu n'apprend pas au passage
-- si tel employé existe. Mais pour le personnel, c'est la société qui
-- décide, et elle ne se connaît qu'après l'avoir cherchée : d'où le
-- second contrôle, plus bas.

CREATE OR REPLACE FUNCTION public.marquer_present(p_employee_id uuid, p_date date, p_type text DEFAULT 'X'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_company uuid;
  v_site uuid;
begin
  if coalesce(p_type, '') not in
     ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ', 'F', 'XF') then
    raise exception 'Type de garde invalide';
  end if;

  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin', 'rh') then
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
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
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
$function$;

CREATE OR REPLACE FUNCTION public.supprimer_pointage(p_pointage_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_employee uuid;
  v_type text;
  v_status public.pointage_status;
  v_company uuid;
  v_date date;
  v_conge uuid;
begin
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin', 'rh') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, type_garde, status, company_id, pointed_on, conge_id
    into v_employee, v_type, v_status, v_company, v_date, v_conge
    from public.pointages where id = p_pointage_id for update;

  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
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
$function$;

CREATE OR REPLACE FUNCTION public.validate_pointage(p_pointage_id uuid, p_decision text, p_type text DEFAULT 'X'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_employee uuid;
  v_old_status public.pointage_status;
  v_company uuid;
  v_date date;
begin
  if coalesce(p_decision, '') not in ('validated', 'refused') then
    raise exception 'Décision invalide';
  end if;
  if p_decision = 'validated'
     and p_type not in ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ') then
    raise exception 'Type de garde invalide';
  end if;

  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin', 'rh') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, status, company_id, pointed_on
    into v_employee, v_old_status, v_company, v_date
    from public.pointages where id = p_pointage_id for update;
  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;

  if v_old_status <> 'pending' then
    raise exception 'Ce pointage a déjà été traité';
  end if;

  perform public.assert_mois_ouvert(v_company, v_date);

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
$function$;


CREATE OR REPLACE FUNCTION public.changer_type_garde(p_pointage_id uuid, p_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_employee uuid;
  v_status public.pointage_status;
  v_old_type text;
  v_company uuid;
  v_date date;
  v_conge uuid;
begin
  if coalesce(p_type, '') not in
     ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ', 'F', 'XF') then
    raise exception 'Type de garde invalide';
  end if;

  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin', 'rh') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, status, type_garde, company_id, pointed_on, conge_id
    into v_employee, v_status, v_old_type, v_company, v_date, v_conge
    from public.pointages where id = p_pointage_id for update;
  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;

  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;
  if v_status <> 'validated' then
    raise exception 'Seuls les pointages validés peuvent changer de type';
  end if;
  if v_conge is not null then
    raise exception 'Ce jour fait partie d''un congé : modifiez ou supprimez le congé.';
  end if;

  perform public.assert_mois_ouvert(v_company, v_date);

  update public.pointages
     set type_garde = p_type,
         ferie_id = case when p_type = 'F' then ferie_id else null end
   where id = p_pointage_id;

  update public.employees
    set jours_travailles = greatest(0, jours_travailles
      + public.garde_valeur(p_type) - public.garde_valeur(coalesce(v_old_type, 'X')))
    where id = v_employee;
end;
$function$;

revoke all on function public.peut_pointer(uuid) from public;
revoke all on function public.admin_definir_acces_societes(uuid, uuid[]) from public;
grant execute on function public.peut_pointer(uuid) to authenticated;
grant execute on function public.admin_definir_acces_societes(uuid, uuid[]) to authenticated;
