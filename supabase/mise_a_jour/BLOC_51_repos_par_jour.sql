-- ============================================================================
--  BLOC 51 sur 51 — Le repos se pose au jour le jour
--  ============================================================
--  Supabase → SQL Editor → coller TOUT ce fichier → Run.
--  À exécuter APRÈS le BLOC 50.
--
--  Jusqu'ici, le jour de repos était fixé sur la fiche de l'agent : le
--  même jour de la semaine, tous les mois. La réalité ne s'y tient pas
--  — on change de planning, on couvre un collègue, on décale.
--
--  Le repos devient donc une lettre du pointage, comme les autres :
--
--      R = repos, posé sur le jour qu'on veut.
--
--  Il ne vaut aucune journée de travail et n'est pas une absence : il
--  ne retire rien du salaire, exactement comme le jour de repos fixe de
--  naguère. Les jours de repos du mois se comptent désormais à partir
--  des « R » réellement posés.
--
--  Disparaissent du choix : la demi-garde (X05) et la garde et demie
--  (X15). Les pointages déjà enregistrés sous ces lettres gardent leur
--  valeur — un mois passé se relit comme il a été payé ; ce sont
--  seulement de nouveaux pointages qu'on ne peut plus créer ainsi.
--
--  ⚠ Les mois déjà VALIDÉS ne bougent pas. Pour les mois ouverts,
--  régénérer la paie du mois fait reprendre le calcul.
-- ============================================================================

-- 1. La lettre R est admise ---------------------------------------------------

alter table public.pointages drop constraint if exists pointages_type_garde_check;
alter table public.pointages
  add constraint pointages_type_garde_check
  check (type_garde in ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ', 'F', 'XF', 'R'));

-- 2. Ce que vaut un repos ------------------------------------------------------

create or replace function public.garde_valeur(p_type text)
returns numeric
language sql
immutable
as $$
  select case p_type
    when 'X05' then 0.5   -- demi-garde : retirée du choix, gardée pour le passé
    when 'X'   then 1
    when 'X15' then 1.5   -- garde et demie : idem
    when 'XX'  then 2
    when 'RT'  then 2     -- repos travaillé : la journée, et celle en plus
    when 'R'   then 0     -- repos : ni travail, ni absence
    when 'M'   then 1     -- malade : payé par défaut
    when 'C'   then 1     -- congé payé
    when 'CS'  then 0     -- congé sans solde
    when 'AJ'  then 0     -- absence justifiée non payée
    when 'F'   then 1     -- férié chômé : payé comme un jour travaillé
    when 'XF'  then 2     -- férié travaillé : la garde compte double
    else 0
  end::numeric;
$$;

-- 3. Les fonctions de pointage acceptent R -------------------------------------

do $maj$
declare
  v_def text;
  v_fn text;
begin
  -- Les trois fonctions portent la même liste de lettres. Plutôt que de
  -- les réécrire en entier — elles sont longues et vivent dans trois
  -- blocs différents — on ajoute R à la liste de chacune, là où elle est.
  foreach v_fn in array array['marquer_present', 'changer_type_garde', 'validate_pointage']
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_fn
     limit 1;
    if v_def is null then
      raise notice 'Fonction % introuvable : rien à faire.', v_fn;
      continue;
    end if;
    if position('''R''' in v_def) > 0 and position(', ''R''' in v_def) > 0 then
      raise notice '% connaît déjà R.', v_fn;
      continue;
    end if;
    v_def := replace(v_def, '''CS'', ''AJ''', '''CS'', ''AJ'', ''R''');
    execute v_def;
    raise notice '% accepte désormais R.', v_fn;
  end loop;
end $maj$;

-- 4. Les jours de repos se comptent sur les R posés ----------------------------

CREATE OR REPLACE FUNCTION public.generer_lignes_paie(p_periode uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_p public.periodes_paie%rowtype;
  v_debut date;
  v_fin date;
  v_n integer := 0;
  -- La durée légale du mois, et la journée pleine qui lui correspond.
  v_heures_mois numeric;
  v_jour_plein numeric;
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

  -- Au Maroc la semaine légale fait 44 heures : cinq journées pleines
  -- et le samedi en demi-journée. Le mois vaut donc 191 heures, et non
  -- 26 × 8 = 208.
  select coalesce(heures_mensuelles, 191),
         coalesce(nullif(heures_par_jour_defaut, 0), 8)
    into v_heures_mois, v_jour_plein
    from public.parametres_paie
   where company_id = v_p.company_id;
  v_heures_mois := coalesce(v_heures_mois, 191);
  v_jour_plein  := coalesce(v_jour_plein, 8);

  with compte as (
    select
      e.id as employee_id,
      e.matricule, e.nom_prenom, e.cin, e.cnss, e.site_id,
      s.name as site_nom, sp.name as site_principal_nom,
      e.qualification, e.mode_reglement, e.banque, e.rib,
      coalesce(e.salaire, 0) as salaire_base,
      e.heures_par_jour,
      coalesce(sum(case when p.type_garde in ('X05','X','X15','XX','RT','F','XF')
                        then public.garde_valeur(p.type_garde) end), 0) as gardes_travaillees,
      coalesce(count(*) filter (where p.type_garde = 'C'), 0)  as jours_conge,
      coalesce(count(*) filter (where p.type_garde = 'M'), 0)  as jours_maladie,
      coalesce(count(*) filter (where p.type_garde in ('CS','AJ')), 0) as jours_sans_solde,
      coalesce(count(*) filter (where p.type_garde = 'XF'), 0) as jours_feries_travailles,
      -- La journée EN PLUS que valent le repos travaillé et le férié
      -- travaillé : la seule part qui échappe au plafond du mois.
      coalesce(count(*) filter (where p.type_garde in ('RT','XF')), 0) as jours_supplementaires,
      -- Le repos ne se déduit plus d'un jour fixe de la fiche : on
      -- compte les R réellement posés sur le mois.
      coalesce(count(*) filter (where p.type_garde = 'R'), 0) as jours_repos
    from public.employees e
    join public.sites s on s.id = e.site_id
    left join public.sites_principaux sp on sp.id = s.site_principal_id
    left join public.pointages p
      on p.employee_id = e.id
     and p.status = 'validated'
     and p.pointed_on between v_debut and v_fin
     and (e.date_sortie is null or p.pointed_on <= e.date_sortie)
     and (e.date_embauche is null or p.pointed_on >= e.date_embauche)
    where e.company_id = v_p.company_id
      and public.dans_la_paie(e.id, v_debut, v_fin)
    group by e.id, s.name, sp.name
  ),
  calc as (
    select c.*,
      -- Le plafond ne s'applique qu'au mois ordinaire. Le repos
      -- travaillé et le férié travaillé ajoutent leur journée par
      -- dessus.
      least(
        c.gardes_travaillees - c.jours_supplementaires
          + case when v_p.conge_paye then c.jours_conge else 0 end
          + case when v_p.maladie_payee then c.jours_maladie else 0 end,
        v_p.jours_base
      ) + c.jours_supplementaires as jours_payes
    from compte c
  )
  insert into public.lignes_paie (
    periode_id, employee_id, matricule, nom_prenom, cin, cnss, site_id, site_nom,
    site_principal_nom, qualification, mode_reglement, banque, rib, salaire_base,
    jours_base, heures_par_jour, gardes_travaillees, jours_conge, jours_maladie,
    jours_sans_solde, jours_absent, jours_repos, jours_payes, heures_effectuees,
    salaire_brut, jours_feries_travailles, net_a_payer
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
    -- Les heures suivent les jours payés, sur la durée légale du mois.
    round(calc.jours_payes / v_p.jours_base * v_heures_mois
          * coalesce(calc.heures_par_jour, v_jour_plein) / v_jour_plein, 2),
    round(calc.salaire_base * calc.jours_payes / v_p.jours_base, 2),
    calc.jours_feries_travailles,
    round(calc.salaire_base * calc.jours_payes / v_p.jours_base, 2)
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
    jours_feries_travailles = excluded.jours_feries_travailles,
    net_a_payer = round(excluded.salaire_brut
      + lignes_paie.frais_transport
      + lignes_paie.frais_panier
      + lignes_paie.prime
      - lignes_paie.retenue_dette
      - lignes_paie.autres_retenues, 2);

  get diagnostics v_n = row_count;

  delete from public.lignes_paie lp
   where lp.periode_id = p_periode
     and not public.dans_la_paie(lp.employee_id, v_debut, v_fin);

  return v_n;
end;
$function$;

-- 5. Le pointage automatique ne suppose plus de jour de repos ------------------
--  Sans jour fixe sur la fiche, il n'y a plus de jour à épargner : on
--  pose la journée, et le bureau met un R là où il le faut.

create or replace function public.pointer_depuis_embauche(p_employee uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_site uuid;
  v_embauche date;
  v_sortie date;
  v_reprise date;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
  v_debut date;
  v_fin date;
  v_n int := 0;
begin
  select company_id, site_id, date_embauche, date_sortie, date_reprise
    into v_company, v_site, v_embauche, v_sortie, v_reprise
    from public.employees where id = p_employee;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;

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
     where not exists (select 1 from public.pointages p
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

-- 6. Un site officiel se pointe tout seul -------------------------------------
--  Pour pointer, il fallait un site principal ET une annexe dessous :
--  les employés s'attachent aux annexes. Quand le site n'a pas de
--  subdivision, on se retrouvait à en inventer une pour la forme.
--
--  Créer un site principal crée donc désormais sa première annexe, du
--  même nom. On pointe dessus immédiatement, et l'on en ajoute d'autres
--  seulement si le lieu en a vraiment.

create or replace function public.creer_site_principal_avec_annexe(
  p_company uuid,
  p_nom text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_principal uuid;
  v_nom text := trim(p_nom);
begin
  v_principal := public.creer_site_principal(p_company, v_nom);

  -- Si une annexe porte déjà ce nom, on la rattache au lieu d'en créer
  -- une seconde : relancer ne doit pas semer des doublons.
  if exists (select 1 from public.sites
              where company_id = p_company and lower(name) = lower(v_nom)) then
    update public.sites
       set site_principal_id = v_principal
     where company_id = p_company and lower(name) = lower(v_nom)
       and site_principal_id is null;
  else
    update public.sites
       set site_principal_id = v_principal
     where id = public.creer_site(p_company, v_nom, true);
  end if;

  return v_principal;
end;
$$;

revoke all on function public.creer_site_principal_avec_annexe(uuid, text) from public;
grant execute on function public.creer_site_principal_avec_annexe(uuid, text) to authenticated;
