-- ============================================================================
--  RELEVÉ — LE POINTAGE ET LA PAIE DISENT-ILS LA MÊME CHOSE ? (lecture seule)
--  ============================================================
--  Ce fichier NE MODIFIE RIEN.
--
--  Depuis le BLOC 60, la paie et ce relevé lisent le MÊME compte —
--  compte_pointage_mois(). Un écart ne peut donc plus venir de deux
--  calculs différents : il veut dire que la paie a été générée AVANT que
--  le pointage ne change. La correction est alors de relancer le calcul
--  de la période (bouton « Recalculer » dans La Paie), tant qu'elle
--  n'est pas validée.
--
--  Lancez la section 1 : si elle ne rend aucune ligne, le pointage et la
--  paie sont d'accord partout.
-- ============================================================================


-- ▶ 1. LES ÉCARTS, LIGNE PAR LIGNE
select c.name as societe,
       pp.annee, pp.mois, pp.statut,
       lp.nom_prenom,
       lp.gardes_travaillees as paie_gardes,
       t.gardes_travaillees  as pointage_gardes,
       lp.jours_conge   as paie_conges,   t.jours_conge   as pointage_conges,
       lp.jours_maladie as paie_maladies, t.jours_maladie as pointage_maladies,
       lp.jours_absent  as paie_absences, t.jours_absents as pointage_absences,
       lp.jours_repos   as paie_repos,    t.jours_repos   as pointage_repos,
       lp.jours_payes, lp.salaire_brut
  from public.lignes_paie lp
  join public.periodes_paie pp on pp.id = lp.periode_id
  join public.companies c on c.id = pp.company_id
  left join public.compte_pointage_mois(
         pp.company_id,
         make_date(pp.annee, pp.mois, 1),
         (make_date(pp.annee, pp.mois, 1) + interval '1 month - 1 day')::date) t
    on t.employee_id = lp.employee_id
 where lp.gardes_travaillees is distinct from coalesce(t.gardes_travaillees, 0)
    or lp.jours_conge   is distinct from coalesce(t.jours_conge, 0)
    or lp.jours_maladie is distinct from coalesce(t.jours_maladie, 0)
    or lp.jours_absent  is distinct from coalesce(t.jours_absents, 0)
    or lp.jours_repos   is distinct from coalesce(t.jours_repos, 0)
 order by pp.annee desc, pp.mois desc, c.name, lp.nom_prenom
 limit 300;


-- ▶ 2. LE RÉSUMÉ PAR PÉRIODE
--   Combien de lignes ne correspondent plus, période par période. Une
--   période à zéro est en règle.
select c.name as societe, pp.annee, pp.mois, pp.statut,
       count(*) as lignes,
       count(*) filter (
         where lp.gardes_travaillees is distinct from coalesce(t.gardes_travaillees, 0)
            or lp.jours_conge   is distinct from coalesce(t.jours_conge, 0)
            or lp.jours_maladie is distinct from coalesce(t.jours_maladie, 0)
            or lp.jours_absent  is distinct from coalesce(t.jours_absents, 0)
            or lp.jours_repos   is distinct from coalesce(t.jours_repos, 0)
       ) as a_recalculer
  from public.lignes_paie lp
  join public.periodes_paie pp on pp.id = lp.periode_id
  join public.companies c on c.id = pp.company_id
  left join public.compte_pointage_mois(
         pp.company_id,
         make_date(pp.annee, pp.mois, 1),
         (make_date(pp.annee, pp.mois, 1) + interval '1 month - 1 day')::date) t
    on t.employee_id = lp.employee_id
 group by c.name, pp.annee, pp.mois, pp.statut
 order by pp.annee desc, pp.mois desc, c.name;


-- ▶ 3. QUI MANQUE À LA PAIE
--   Des journées pointées sur le mois, mais aucune ligne de paie : la
--   personne a été ajoutée après le calcul, ou sa fiche la met hors paie.
select c.name as societe, pp.annee, pp.mois,
       e.nom_prenom, e.date_embauche, e.date_sortie,
       t.gardes_travaillees as gardes_pointees
  from public.periodes_paie pp
  join public.companies c on c.id = pp.company_id
  join public.compte_pointage_mois(
         pp.company_id,
         make_date(pp.annee, pp.mois, 1),
         (make_date(pp.annee, pp.mois, 1) + interval '1 month - 1 day')::date) t
    on true
  join public.employees e on e.id = t.employee_id
 where t.gardes_travaillees > 0
   and not exists (select 1 from public.lignes_paie lp
                    where lp.periode_id = pp.id and lp.employee_id = t.employee_id)
 order by pp.annee desc, pp.mois desc, c.name, e.nom_prenom
 limit 300;
