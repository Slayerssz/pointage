-- ============================================================
-- 076 — Le pointage et la paie comptent au même endroit
-- À exécuter après 075_acces_par_societe.sql
--
-- Le compte du mois — journées travaillées, congés, maladies,
-- absences, repos, journées doubles — était écrit en toutes lettres
-- dans generer_lignes_paie. Tout contrôle écrit ailleurs recopiait ces
-- expressions, et deux copies finissent toujours par divergir : c'est
-- ainsi qu'on découvre un écart entre le pointage et la paie en fin de
-- mois, sans savoir lequel des deux a tort.
--
-- Il n'y a plus qu'un seul compte : compte_pointage_mois(). La paie le
-- lit pour écrire ses lignes, le relevé de contrôle le lit pour les
-- vérifier. Un écart ne peut donc plus venir de deux calculs
-- différents — seulement d'une paie générée AVANT que le pointage ne
-- change, ce que le relevé dit alors noir sur blanc.
--
-- Les bornes du contrat restent dans le compte : une journée pointée
-- avant l'embauche ou après la sortie n'entre pas dans la paie, et ne
-- doit pas entrer dans le contrôle non plus.
-- ============================================================

create or replace function public.compte_pointage_mois(
  p_company uuid,
  p_debut date,
  p_fin date
)
returns table (
  employee_id uuid,
  gardes_travaillees numeric,
  jours_conge integer,
  jours_maladie integer,
  jours_sans_solde integer,
  jours_absents integer,
  jours_feries_travailles integer,
  jours_supplementaires integer,
  jours_repos integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    coalesce(sum(case when p.type_garde in ('X05','X','X15','XX','RT','F','XF')
                      then public.garde_valeur(p.type_garde) end), 0)::numeric,
    coalesce(count(*) filter (where p.type_garde = 'C'), 0)::integer,
    coalesce(count(*) filter (where p.type_garde = 'M'), 0)::integer,
    coalesce(count(*) filter (where p.type_garde in ('CS','AJ')), 0)::integer,
    -- L'ABSENCE EST UNE LETTRE, PAS UN VIDE : seules les journées
    -- marquées « A » comptent comme absences.
    coalesce(count(*) filter (where p.type_garde = 'AJ'), 0)::integer,
    coalesce(count(*) filter (where p.type_garde = 'XF'), 0)::integer,
    -- La journée EN PLUS que valent le repos travaillé et le férié
    -- travaillé : la seule part qui échappe au plafond du mois.
    coalesce(count(*) filter (where p.type_garde in ('RT','XF')), 0)::integer,
    -- Le repos ne se déduit pas d'un jour fixe de la fiche : on compte
    -- les R réellement posés sur le mois.
    coalesce(count(*) filter (where p.type_garde = 'R'), 0)::integer
  from public.employees e
  left join public.pointages p
    on p.employee_id = e.id
   and p.status = 'validated'
   and p.pointed_on between p_debut and p_fin
   and (e.date_sortie is null or p.pointed_on <= e.date_sortie)
   and (e.date_embauche is null or p.pointed_on >= e.date_embauche)
  where e.company_id = p_company
  group by e.id;
$$;

revoke all on function public.compte_pointage_mois(uuid, date, date) from public;
grant execute on function public.compte_pointage_mois(uuid, date, date) to authenticated;

-- La paie écrit ses lignes à partir de ce compte-là, et d'aucun autre.

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
      -- LE COMPTE DU POINTAGE VIENT D'UN SEUL ENDROIT : la fonction
      -- compte_pointage_mois. Le relevé de contrôle lit la même, si
      -- bien qu'un écart entre le pointage et la paie ne peut plus
      -- venir de deux calculs différents — seulement d'une paie
      -- générée avant que le pointage ne change.
      coalesce(t.gardes_travaillees, 0) as gardes_travaillees,
      coalesce(t.jours_conge, 0) as jours_conge,
      coalesce(t.jours_maladie, 0) as jours_maladie,
      coalesce(t.jours_sans_solde, 0) as jours_sans_solde,
      coalesce(t.jours_absents, 0) as jours_absents,
      coalesce(t.jours_feries_travailles, 0) as jours_feries_travailles,
      coalesce(t.jours_supplementaires, 0) as jours_supplementaires,
      coalesce(t.jours_repos, 0) as jours_repos
    from public.employees e
    join public.sites s on s.id = e.site_id
    left join public.sites_principaux sp on sp.id = s.site_principal_id
    left join public.compte_pointage_mois(v_p.company_id, v_debut, v_fin) t
      on t.employee_id = e.id
    where e.company_id = v_p.company_id
      and public.dans_la_paie(e.id, v_debut, v_fin)
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
