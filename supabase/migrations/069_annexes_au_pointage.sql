-- ============================================================
-- 069 — Les annexes se tiennent depuis le pointage
-- À exécuter après 068_remplacants.sql
--
-- Les annexes quittent la liste générale des sites et se gèrent dans
-- l'écran de pointage. Renommer et supprimer touchent l'historique de
-- tout le monde : ces deux-là passent à l'administrateur seul.
-- ============================================================

-- 1. Renommer une annexe : administrateur seulement ----------------------------

create or replace function public.maj_site(
  p_site uuid,
  p_nom text,
  p_pointage_actif boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text := trim(coalesce(p_nom, ''));
  v_company uuid;
begin
  -- Renommer une annexe renomme ce qui s'imprime sur les états de paie
  -- déjà sortis : c'est un geste d'administrateur.
  perform public.exiger_role('admin');

  select company_id into v_company from public.sites where id = p_site;
  if v_company is null then
    raise exception 'Annexe introuvable';
  end if;
  if v_nom = '' then
    raise exception 'Le nom de l''annexe est obligatoire';
  end if;
  if exists (select 1 from public.sites
              where company_id = v_company and lower(name) = lower(v_nom) and id <> p_site) then
    raise exception 'Une annexe porte déjà ce nom';
  end if;

  update public.sites
     set name = v_nom,
         pointage_actif = coalesce(p_pointage_actif, pointage_actif)
   where id = p_site;
end;
$$;

revoke all on function public.maj_site(uuid, text, boolean) from public;
grant execute on function public.maj_site(uuid, text, boolean) to authenticated;

-- 2. Supprimer une annexe : administrateur seulement ---------------------------

create or replace function public.supprimer_site(
  p_site uuid,
  p_site_cible uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n bigint;
  v_company uuid;
  v_company_cible uuid;
begin
  -- Supprimer déplace les employés ET leurs pointages : l'historique de
  -- plusieurs mois change de site. Administrateur seulement.
  perform public.exiger_role('admin');

  select company_id into v_company from public.sites where id = p_site;
  if v_company is null then
    raise exception 'Annexe introuvable';
  end if;

  select count(*) into v_n from public.employees where site_id = p_site;

  if v_n > 0 then
    if p_site_cible is null then
      raise exception
        'Cette annexe compte % employé(s). Choisissez l''annexe vers laquelle les déplacer.', v_n;
    end if;
    if p_site_cible = p_site then
      raise exception 'L''annexe de destination doit être différente';
    end if;

    select company_id into v_company_cible from public.sites where id = p_site_cible;
    if v_company_cible is null then
      raise exception 'Annexe de destination introuvable';
    end if;
    if v_company_cible <> v_company then
      raise exception 'L''annexe de destination doit appartenir à la même entreprise';
    end if;

    update public.employees set site_id = p_site_cible where site_id = p_site;
    update public.pointages set site_id = p_site_cible where site_id = p_site;
  end if;

  delete from public.sites where id = p_site;
end;
$$;

revoke all on function public.supprimer_site(uuid, uuid) from public;
grant execute on function public.supprimer_site(uuid, uuid) to authenticated;

-- 3. Ajouter une annexe sous un site principal ---------------------------------

create or replace function public.creer_annexe(
  p_principal uuid,
  p_nom text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_id uuid;
begin
  perform public.exiger_role('validator', 'admin');

  select company_id into v_company
    from public.sites_principaux where id = p_principal;
  if v_company is null then
    raise exception 'Site principal introuvable';
  end if;

  v_id := public.creer_site(v_company, p_nom, true);
  update public.sites set site_principal_id = p_principal where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.creer_annexe(uuid, text) from public;
grant execute on function public.creer_annexe(uuid, text) to authenticated;

-- 4. Affecter quelqu'un à une annexe -------------------------------------------
--  Depuis la grille : on choisit la personne, on choisit l'annexe. Ses
--  pointages du mois en cours suivent — ils ont été faits là où elle
--  travaille désormais. Les mois clos ne bougent pas.

create or replace function public.affecter_employe_annexe(
  p_employee uuid,
  p_site uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_company_site uuid;
  v_debut date := date_trunc('month', (now() at time zone 'Africa/Casablanca'))::date;
begin
  select company_id into v_company from public.employees where id = p_employee;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;

  select company_id into v_company_site from public.sites where id = p_site;
  if v_company_site is null then
    raise exception 'Annexe introuvable.';
  end if;
  if v_company_site <> v_company then
    raise exception 'Cette annexe n''est pas celle de sa société.';
  end if;

  update public.employees set site_id = p_site where id = p_employee;

  -- Ses journées du mois ouvert suivent ; celles des mois clos restent
  -- où elles ont été payées.
  update public.pointages p
     set site_id = p_site
   where p.employee_id = p_employee
     and p.pointed_on >= v_debut
     and not exists (
       select 1 from public.periodes_paie pp
        where pp.company_id = v_company
          and pp.annee = extract(year from p.pointed_on)::int
          and pp.mois = extract(month from p.pointed_on)::int
          and pp.statut <> 'ouvert');
end;
$$;

revoke all on function public.affecter_employe_annexe(uuid, uuid) from public;
grant execute on function public.affecter_employe_annexe(uuid, uuid) to authenticated;
