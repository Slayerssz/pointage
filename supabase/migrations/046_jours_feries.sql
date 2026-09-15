-- ============================================================
-- 046 — Les jours fériés
-- À exécuter après 045_photo_role_personnel.sql
--
-- Un jour férié est payé à tout le monde, qu'on l'ait travaillé ou
-- non. Celui qui vient quand même travailler fait une garde qui
-- compte double.
--
-- Deux nouvelles lettres au pointage :
--   F   férié chômé            1 garde  (payé, personne ne travaille)
--   XF  férié travaillé        2 gardes (la garde + celle du férié)
--
-- Déclarer un férié inscrit F à tout le monde. Le validateur passe
-- ensuite en XF ceux qui ont tenu le poste. Supprimer le férié
-- retire exactement ce qu'il avait inscrit.
-- ============================================================

-- 1. Les deux lettres --------------------------------------------------------

alter table public.pointages drop constraint if exists pointages_type_garde_check;
alter table public.pointages
  add constraint pointages_type_garde_check
  check (type_garde in ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ', 'F', 'XF'));

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
    when 'F'   then 1     -- férié chômé : payé comme un jour travaillé
    when 'XF'  then 2     -- férié travaillé : la garde compte double
    else 0
  end::numeric;
$$;

-- 2. Le calendrier des fériés ------------------------------------------------

create table if not exists public.jours_feries (
  id uuid primary key default gen_random_uuid(),
  -- Null = toutes les sociétés du groupe (cas des fêtes nationales).
  company_id uuid references public.companies(id) on delete cascade,
  nom text not null,
  date_debut date not null,
  date_fin date not null,
  cree_par uuid,
  created_at timestamptz not null default now(),
  constraint jours_feries_ordre check (date_fin >= date_debut)
);

comment on table public.jours_feries is
  'Fériés déclarés par l''administrateur. company_id null = tout le groupe.';

create index if not exists jours_feries_periode_idx
  on public.jours_feries (date_debut, date_fin);

alter table public.jours_feries enable row level security;

-- Tout compte connecté lit le calendrier : la grille de pointage doit
-- pouvoir signaler le jour férié à celui qui pointe.
drop policy if exists jours_feries_select on public.jours_feries;
create policy jours_feries_select on public.jours_feries
  for select to authenticated using (true);

-- L'écriture passe par les fonctions ci-dessous, réservées à l'admin.
drop policy if exists jours_feries_ecriture on public.jours_feries;
create policy jours_feries_ecriture on public.jours_feries
  for all to authenticated
  using (coalesce(public.current_user_role()::text, '') = 'admin')
  with check (coalesce(public.current_user_role()::text, '') = 'admin');

-- Le lien entre un pointage et le férié qui l'a inscrit : il permet de
-- retirer exactement ce qu'on avait posé, sans toucher au reste.
alter table public.pointages
  add column if not exists ferie_id uuid references public.jours_feries(id) on delete cascade;

create index if not exists pointages_ferie_idx
  on public.pointages (ferie_id) where ferie_id is not null;

-- 3. Poser le férié sur le pointage ------------------------------------------
-- Écrit F à chacun, pour chaque jour de la plage. Ne touche jamais à un
-- jour déjà pointé : un congé, une maladie ou une garde déjà saisie
-- restent tels quels, et sont comptés à part dans le retour.

create or replace function public.appliquer_ferie(p_ferie uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f public.jours_feries%rowtype;
  v_jour date;
  v_ecrits int := 0;
  v_deja int := 0;
  v_fermes int := 0;
  v_emp record;
  v_ferme boolean;
begin
  select * into v_f from public.jours_feries where id = p_ferie;
  if v_f.id is null then
    raise exception 'Jour férié introuvable.';
  end if;

  -- Déjà posé : ne rien inscrire deux fois.
  if exists (select 1 from public.pointages where ferie_id = p_ferie) then
    return jsonb_build_object('jours_ecrits', 0, 'deja_pointes', 0, 'mois_clos', 0);
  end if;

  perform set_config('app.pointage_manuel', 'on', true);

  for v_jour in
    select generate_series(v_f.date_debut, v_f.date_fin, interval '1 day')::date
  loop
    for v_emp in
      select e.id, e.company_id, e.site_id, e.jour_de_repos
        from public.employees e
       where (v_f.company_id is null or e.company_id = v_f.company_id)
         and e.archive_le is null
         -- Pas encore embauché ce jour-là, ou déjà parti : rien à inscrire.
         and (e.date_embauche is null or e.date_embauche <= v_jour)
         and (e.date_sortie is null or e.date_sortie >= v_jour)
    loop
      -- Le repos hebdomadaire n'est pas un jour de travail : un férié qui
      -- tombe dessus ne crée pas de journée en plus.
      if v_emp.jour_de_repos is not null
         and extract(isodow from v_jour)::int = v_emp.jour_de_repos then
        continue;
      end if;

      -- Un jour déjà pointé n'est pas écrasé — on le signale.
      if exists (select 1 from public.pointages
                  where employee_id = v_emp.id and pointed_on = v_jour
                    and status <> 'refused') then
        v_deja := v_deja + 1;
        continue;
      end if;

      -- Un mois clôturé ne se rouvre pas en douce.
      begin
        perform public.assert_mois_ouvert(v_emp.company_id, v_jour);
        v_ferme := false;
      exception when others then
        v_ferme := true;
      end;
      if v_ferme then
        v_fermes := v_fermes + 1;
        continue;
      end if;

      insert into public.pointages
        (company_id, site_id, employee_id, agent_id, photo_path,
         pointed_at, pointed_on, status, type_garde, validated_by, validated_at, ferie_id)
      values
        (v_emp.company_id, v_emp.site_id, v_emp.id, auth.uid(), null,
         now(), v_jour, 'validated', 'F', auth.uid(), now(), p_ferie);

      update public.employees
         set jours_travailles = jours_travailles + 1
       where id = v_emp.id;

      v_ecrits := v_ecrits + 1;
    end loop;
  end loop;

  perform set_config('app.pointage_manuel', 'off', true);

  return jsonb_build_object(
    'jours_ecrits', v_ecrits, 'deja_pointes', v_deja, 'mois_clos', v_fermes);
end;
$$;

-- 4. Retirer un férié --------------------------------------------------------
-- Supprime uniquement les F que ce férié avait posés. Les XF saisis par
-- le validateur restent : ces gens ont réellement travaillé.

create or replace function public.retirer_ferie_du_pointage(p_ferie uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
  v_p record;
begin
  for v_p in
    select id, employee_id, type_garde from public.pointages where ferie_id = p_ferie
  loop
    delete from public.pointages where id = v_p.id;
    update public.employees
       set jours_travailles = greatest(0, jours_travailles - public.garde_valeur(v_p.type_garde))
     where id = v_p.employee_id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- 5. Ceux qui ont travaillé le férié -----------------------------------------
-- Quand le férié est déclaré après coup, des gardes sont déjà saisies ce
-- jour-là. Cette fonction les passe en XF : la journée compte double.
-- Elle est appelée sur demande, jamais toute seule — elle change la paie.
-- Ces lignes ne sont pas rattachées au férié : elles existaient avant lui,
-- et supprimer le férié ne doit pas effacer un jour réellement travaillé.

create or replace function public.convertir_travail_ferie(p_ferie uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f public.jours_feries%rowtype;
  v_p record;
  v_n int := 0;
begin
  perform public.exiger_role('admin');

  select * into v_f from public.jours_feries where id = p_ferie;
  if v_f.id is null then
    raise exception 'Jour férié introuvable.';
  end if;

  for v_p in
    select p.id, p.employee_id, p.type_garde, p.company_id, p.pointed_on
      from public.pointages p
      join public.employees e on e.id = p.employee_id
     where p.pointed_on between v_f.date_debut and v_f.date_fin
       and p.status = 'validated'
       and p.ferie_id is null
       and p.type_garde in ('X05', 'X', 'X15', 'XX', 'RT')
       and (v_f.company_id is null or e.company_id = v_f.company_id)
  loop
    perform public.assert_mois_ouvert(v_p.company_id, v_p.pointed_on);

    update public.pointages set type_garde = 'XF' where id = v_p.id;
    update public.employees
       set jours_travailles = jours_travailles
             + 2 - public.garde_valeur(v_p.type_garde)
     where id = v_p.employee_id;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

-- 6. Ce que l'administrateur appelle -----------------------------------------

create or replace function public.admin_creer_ferie(
  p_company uuid,
  p_nom text,
  p_debut date,
  p_fin date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_res jsonb;
begin
  perform public.exiger_role('admin');

  if coalesce(trim(p_nom), '') = '' then
    raise exception 'Donnez un nom au jour férié.';
  end if;
  if p_fin < p_debut then
    raise exception 'La date de fin précède la date de début.';
  end if;
  if p_fin - p_debut > 30 then
    raise exception 'Un férié de plus de 31 jours : vérifiez les dates.';
  end if;

  insert into public.jours_feries (company_id, nom, date_debut, date_fin, cree_par)
  values (p_company, trim(p_nom), p_debut, p_fin, auth.uid())
  returning id into v_id;

  v_res := public.appliquer_ferie(v_id);
  return v_res || jsonb_build_object('ferie_id', v_id);
end;
$$;

create or replace function public.admin_supprimer_ferie(p_ferie uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  perform public.exiger_role('admin');
  v_n := public.retirer_ferie_du_pointage(p_ferie);
  delete from public.jours_feries where id = p_ferie;
  return v_n;
end;
$$;

revoke all on function public.appliquer_ferie(uuid) from public;
revoke all on function public.retirer_ferie_du_pointage(uuid) from public;
revoke all on function public.convertir_travail_ferie(uuid) from public;
revoke all on function public.admin_creer_ferie(uuid, text, date, date) from public;
revoke all on function public.admin_supprimer_ferie(uuid) from public;
grant execute on function public.convertir_travail_ferie(uuid) to authenticated;
grant execute on function public.admin_creer_ferie(uuid, text, date, date) to authenticated;
grant execute on function public.admin_supprimer_ferie(uuid) to authenticated;

-- 7. Les fonctions de pointage connaissent les deux lettres ------------------

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
  if coalesce(p_type, '') not in
     ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ', 'F', 'XF') then
    raise exception 'Type de garde invalide';
  end if;

  v_role := coalesce(public.current_user_role()::text, '');
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

-- Passer un F en XF est le geste normal du validateur : il note qui a
-- tenu le poste le jour férié. La ligne cesse alors d'appartenir au
-- férié — supprimer celui-ci n'effacera pas un jour travaillé.
create or replace function public.changer_type_garde(p_pointage_id uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, status, type_garde, company_id, pointed_on, conge_id
    into v_employee, v_status, v_old_type, v_company, v_date, v_conge
    from public.pointages where id = p_pointage_id for update;
  if v_employee is null then
    raise exception 'Pointage introuvable';
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
$$;
revoke all on function public.changer_type_garde(uuid, text) from public;
grant execute on function public.changer_type_garde(uuid, text) to authenticated;


-- 8. La paie compte les deux lettres ----------------------------------------
-- F et XF entrent dans les gardes travaillées : un férié est payé comme
-- un jour de travail, et un férié travaillé en vaut deux (garde_valeur).
-- Seule cette ligne change ; le reste de la fonction est celui du BLOC 7.

create or replace function public.generer_lignes_paie(p_periode uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.periodes_paie%rowtype;
  v_debut date;
  v_fin date;
  v_n integer := 0;
begin
  perform public.exiger_role('validator', 'admin', 'paie');

  select * into v_p from public.periodes_paie where id = p_periode;
  if v_p.id is null then
    raise exception 'Période introuvable';
  end if;
  if v_p.statut = 'paie_validee' then
    raise exception 'Cette paie est validée : elle ne peut plus être recalculée';
  end if;

  v_debut := make_date(v_p.annee, v_p.mois, 1);
  v_fin := (v_debut + interval '1 month - 1 day')::date;

  with compte as (
    select
      e.id as employee_id,
      e.matricule, e.nom_prenom, e.cin, e.cnss, e.site_id,
      s.name as site_nom, sp.name as site_principal_nom,
      e.qualification, e.mode_reglement, e.banque, e.rib,
      coalesce(e.salaire, 0) as salaire_base,
      e.heures_par_jour,
      e.jour_de_repos,
      coalesce(sum(case when p.type_garde in ('X05','X','X15','XX','RT','F','XF')
                        then public.garde_valeur(p.type_garde) end), 0) as gardes_travaillees,
      coalesce(count(*) filter (where p.type_garde = 'C'), 0)  as jours_conge,
      coalesce(count(*) filter (where p.type_garde = 'M'), 0)  as jours_maladie,
      coalesce(count(*) filter (where p.type_garde in ('CS','AJ')), 0) as jours_sans_solde
    from public.employees e
    join public.sites s on s.id = e.site_id
    left join public.sites_principaux sp on sp.id = s.site_principal_id
    left join public.pointages p
      on p.employee_id = e.id
     and p.status = 'validated'
     and p.pointed_on between v_debut and v_fin
    where e.company_id = v_p.company_id
      and (e.actif or exists (
            select 1 from public.pointages p2
            where p2.employee_id = e.id and p2.status = 'validated'
              and p2.pointed_on between v_debut and v_fin))
    group by e.id, s.name, sp.name
  ),
  calc as (
    select c.*,
      (select count(*) from generate_series(v_debut, v_fin, interval '1 day') d
        where c.jour_de_repos is not null
          and extract(isodow from d)::int = c.jour_de_repos) as jours_repos,
      (c.gardes_travaillees
        + case when v_p.conge_paye then c.jours_conge else 0 end
        + case when v_p.maladie_payee then c.jours_maladie else 0 end) as jours_payes
    from compte c
  )
  insert into public.lignes_paie (
    periode_id, employee_id, matricule, nom_prenom, cin, cnss, site_id, site_nom,
    site_principal_nom, qualification, mode_reglement, banque, rib, salaire_base,
    jours_base, heures_par_jour, gardes_travaillees, jours_conge, jours_maladie,
    jours_sans_solde, jours_absent, jours_repos, jours_payes, heures_effectuees,
    salaire_brut, net_a_payer
  )
  select
    p_periode, calc.employee_id, calc.matricule, calc.nom_prenom, calc.cin, calc.cnss,
    calc.site_id, calc.site_nom, calc.site_principal_nom, calc.qualification,
    calc.mode_reglement, calc.banque, calc.rib, calc.salaire_base, v_p.jours_base,
    calc.heures_par_jour,
    calc.gardes_travaillees, calc.jours_conge, calc.jours_maladie,
    calc.jours_sans_solde,
    greatest(0, round(
      ((v_fin - v_debut + 1) - calc.jours_repos)
      - (calc.gardes_travaillees + calc.jours_conge + calc.jours_maladie + calc.jours_sans_solde)
    , 2)),
    calc.jours_repos,
    calc.jours_payes,
    case when calc.heures_par_jour is null then null
         else round(calc.jours_payes * calc.heures_par_jour, 2) end,
    round(calc.salaire_base * least(calc.jours_payes, v_p.jours_base * 3) / v_p.jours_base, 2),
    round(calc.salaire_base * least(calc.jours_payes, v_p.jours_base * 3) / v_p.jours_base, 2)
  from calc
  on conflict (periode_id, employee_id) do update set
    matricule = excluded.matricule,
    nom_prenom = excluded.nom_prenom,
    cin = excluded.cin,
    cnss = excluded.cnss,
    site_id = excluded.site_id,
    site_nom = excluded.site_nom,
    site_principal_nom = excluded.site_principal_nom,
    qualification = excluded.qualification,
    mode_reglement = excluded.mode_reglement,
    banque = excluded.banque,
    rib = excluded.rib,
    salaire_base = excluded.salaire_base,
    jours_base = excluded.jours_base,
    heures_par_jour = excluded.heures_par_jour,
    gardes_travaillees = excluded.gardes_travaillees,
    jours_conge = excluded.jours_conge,
    jours_maladie = excluded.jours_maladie,
    jours_sans_solde = excluded.jours_sans_solde,
    jours_absent = excluded.jours_absent,
    jours_repos = excluded.jours_repos,
    jours_payes = excluded.jours_payes,
    heures_effectuees = excluded.heures_effectuees,
    salaire_brut = excluded.salaire_brut,
    net_a_payer = round(excluded.salaire_brut
      + lignes_paie.prime
      - lignes_paie.retenue_dette
      - lignes_paie.autres_retenues, 2);

  get diagnostics v_n = row_count;

  delete from public.lignes_paie lp
    where lp.periode_id = p_periode
      and not exists (
        select 1 from public.employees e
        where e.id = lp.employee_id
          and e.company_id = v_p.company_id
          and (e.actif or exists (
                select 1 from public.pointages p2
                where p2.employee_id = e.id and p2.status = 'validated'
                  and p2.pointed_on between v_debut and v_fin)));

  return v_n;
end;
$$;

revoke all on function public.generer_lignes_paie(uuid) from public;
grant execute on function public.generer_lignes_paie(uuid) to authenticated;
