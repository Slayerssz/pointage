-- ============================================================================
--  BLOC 46 sur 46 — Un départ emporte les journées qu'il n'a pas faites
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 45.
--
--  Quelqu'un passé à « Sorti » le 3 gardait les journées du 4 au 31,
--  posées d'avance par le remplissage du mois, et continuait de paraître
--  dans la paie avec un mois presque complet.
--
--  La paie ne compte désormais que les journées comprises entre
--  l'embauche et la sortie. Les mois encore ouverts se recalculent à la
--  prochaine consultation.
-- ============================================================================

-- ============================================================
-- 062 — Un départ emporte les journées qu'il n'a pas faites
-- À exécuter après 061_pointer_nouvel_employe.sql
--
-- Le mois est rempli d'avance : tout le monde est présent du 1er au 31,
-- et le bureau corrige. Quelqu'un qu'on passe à « Sorti » le 3 gardait
-- donc les journées du 4 au 31 — jamais travaillées — et continuait de
-- paraître dans la paie avec un mois presque complet.
--
-- Deux réponses. La paie ne compte plus que les journées comprises
-- entre l'embauche et la sortie : même si des pointages traînent au-delà,
-- ils ne valent rien. Et une fonction retire ces journées-là, pour que
-- la grille et les compteurs disent la même chose que la paie.
-- ============================================================

-- Qui figure dans la paie d'un mois ------------------------------------------
-- Celui qui est encore là, ou celui qui a travaillé pendant ce mois —
-- en ne comptant que les journées comprises dans son contrat. La règle
-- sert deux fois : pour composer la paie, et pour en retirer ceux qui
-- n'y sont plus. Une seule définition, donc une seule vérité.

create or replace function public.dans_la_paie(
  p_employee uuid, p_debut date, p_fin date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select e.actif or exists (
           select 1 from public.pointages p
            where p.employee_id = e.id
              and p.status = 'validated'
              and p.pointed_on between p_debut and p_fin
              and (e.date_sortie is null or p.pointed_on <= e.date_sortie)
              and (e.date_embauche is null or p.pointed_on >= e.date_embauche))
    from public.employees e
   where e.id = p_employee;
$$;

revoke all on function public.dans_la_paie(uuid, date, date) from public;
grant execute on function public.dans_la_paie(uuid, date, date) to authenticated;

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
      coalesce(count(*) filter (where p.type_garde in ('CS','AJ')), 0) as jours_sans_solde,
      coalesce(count(*) filter (where p.type_garde = 'XF'), 0) as jours_feries_travailles
    from public.employees e
    join public.sites s on s.id = e.site_id
    left join public.sites_principaux sp on sp.id = s.site_principal_id
    left join public.pointages p
      on p.employee_id = e.id
     and p.status = 'validated'
     and p.pointed_on between v_debut and v_fin
     -- Hors de son contrat, un pointage ne compte pas. Le mois est
     -- rempli d'avance pour tout le monde : celui qui part le 3 garde
     -- sinon les journées du 4 au 31, qu'il n'a pas faites.
     and (e.date_sortie is null or p.pointed_on <= e.date_sortie)
     and (e.date_embauche is null or p.pointed_on >= e.date_embauche)
    where e.company_id = v_p.company_id
      and public.dans_la_paie(e.id, v_debut, v_fin)
    group by e.id, s.name, sp.name
  ),
  calc as (
    select c.*,
      (select count(*) from generate_series(v_debut, v_fin, interval '1 day') d
        where c.jour_de_repos is not null
          and extract(isodow from d)::int = c.jour_de_repos) as jours_repos,
      -- Le salaire est fixé sur une base de jours — 26 d'ordinaire — et
      -- ne monte pas parce que le mois en compte 31. Un mois complet
      -- paie un mois complet, pas davantage. Les journées faites en plus,
      -- pour remplacer quelqu'un, s'ajoutent à la main en prime : elles
      -- ne se devinent pas d'un compteur.
      least(
        c.gardes_travaillees
          + case when v_p.conge_paye then c.jours_conge else 0 end
          + case when v_p.maladie_payee then c.jours_maladie else 0 end,
        v_p.jours_base
      ) as jours_payes
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
    case when calc.heures_par_jour is null then null
         else round(calc.jours_payes * calc.heures_par_jour, 2) end,
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
    -- frais_transport et frais_panier ne figurent pas ici : ils sont
    -- saisis par le service paie, et régénérer le mois ne doit pas les
    -- effacer. On les relit tels quels pour le net.
    net_a_payer = round(excluded.salaire_brut
      + lignes_paie.frais_transport
      + lignes_paie.frais_panier
      + lignes_paie.prime
      - lignes_paie.retenue_dette
      - lignes_paie.autres_retenues, 2);

  get diagnostics v_n = row_count;

  -- Qui n'est plus dans le mois n'y garde pas sa ligne. Cette
  -- suppression existait déjà, mais jugeait sans regarder le contrat :
  -- un parti gardait sa ligne puisqu'il avait bien des pointages ce
  -- mois-là — ceux posés d'avance par le remplissage.
  delete from public.lignes_paie lp
    where lp.periode_id = p_periode
      and not public.dans_la_paie(lp.employee_id, v_debut, v_fin);

  return v_n;
end;
$function$;

-- Retirer les journées postérieures à la sortie ------------------------------
-- Appelée quand on pose une date de sortie. Elle ne touche qu'aux jours
-- qui suivent le départ : ceux d'avant sont des journées travaillées.

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

  with retires as (
    delete from public.pointages
     where employee_id = p_employee
       and pointed_on > v_sortie
    returning 1
  )
  select count(*) into v_n from retires;

  update public.employees
     set jours_travailles = greatest(0, jours_travailles - v_n)
   where id = p_employee;

  return v_n;
end;
$$;

revoke all on function public.nettoyer_pointages_apres_sortie(uuid) from public;
grant execute on function public.nettoyer_pointages_apres_sortie(uuid) to authenticated;
