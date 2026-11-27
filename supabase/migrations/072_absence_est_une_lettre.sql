-- ============================================================
-- 072 — Une case vide n'est pas une absence, et un matricule
--       de remplaçant se donne sans bloquer l'insertion
-- À exécuter après 071_poser_la_journee.sql
--
-- DEUX CHOSES, TOUTES DEUX DES CAUSES, PAS DES SYMPTÔMES.
--
-- 1. « UPDATE requires a WHERE clause » en ajoutant un remplaçant.
--    Ce n'est pas la fiche qui est en cause, c'est le compteur de
--    matricules : le déclencheur posé au BLOC 52 faisait
--    « update remplacant_compteur set dernier = dernier + 1 » sans
--    condition. Le garde-fou de Supabase (pg_safeupdate) refuse toute
--    mise à jour sans WHERE, y compris au fond d'une fonction — et le
--    refus remontait au moment de l'INSERT, d'où le message trompeur.
--    Le compteur des employés, lui, portait bien son « where id »
--    depuis le BLOC 12 : c'est la ligne qui manquait ici.
--
-- 2. Une case vide comptait comme une absence. jours_absent se
--    déduisait du calendrier : tous les jours du mois, moins les repos,
--    moins ce qui était pointé. Un mois saisi à moitié affichait donc
--    quinze absences pour quelqu'un qui n'avait simplement pas encore
--    été pointé. Désormais on compte les journées marquées « A », et
--    rien d'autre. Le salaire ne change pas : il suit les journées
--    pointées, comme avant.
-- ============================================================

-- 1. Le matricule du remplaçant -----------------------------------------------

create or replace function public.remplacants_assign_matricule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suivant integer;
begin
  -- « where id » : la table n'a qu'une ligne, celle dont la clé vaut
  -- vrai. Sans cette condition, Supabase refuse la mise à jour.
  if new.matricule is not null then
    update public.remplacant_compteur
       set dernier = greatest(dernier, new.matricule)
     where id;
    return new;
  end if;

  update public.remplacant_compteur
     set dernier = dernier + 1
   where id
   returning dernier into v_suivant;

  new.matricule := v_suivant;
  return new;
end;
$$;

-- 2. L'absence est une lettre, pas un vide ------------------------------------

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
      -- L'ABSENCE EST UNE LETTRE, PAS UN VIDE : seules les journées
      -- marquées « A » comptent comme absences.
      coalesce(count(*) filter (where p.type_garde = 'AJ'), 0) as jours_absents,
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
    calc.jours_absents,
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
