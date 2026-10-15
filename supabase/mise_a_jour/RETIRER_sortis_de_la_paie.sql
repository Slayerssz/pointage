-- ============================================================================
--  RETIRER DE LA PAIE CEUX QUI ÉTAIENT DÉJÀ PARTIS
--  ============================================================
--  Supabase → SQL Editor → coller → Run.
--
--  ⚠ À lire avant de lancer.
--
--  Ce fichier ne retire QUE les lignes de paie de ceux qui étaient déjà
--  partis AVANT le début du mois. Quelqu'un parti en cours de mois garde
--  la sienne : il a travaillé ces jours-là, et il faut les lui payer.
--  Les retirer serait ne pas payer quelqu'un pour un travail fait.
--
--  Les mois DÉJÀ VALIDÉS ne sont pas touchés : ce qui est clos est clos.
--
--  Si quelqu'un paraît encore alors qu'il ne devrait pas, c'est que sa
--  date de sortie est fausse — corrigez-la dans l'onglet Sorties
--  (« Modifier la date »), et la paie se refera d'elle-même.
-- ============================================================================

with retirees as (
  delete from public.lignes_paie lp
   using public.periodes_paie pp, public.employees e
   where pp.id = lp.periode_id
     and e.id = lp.employee_id
     and pp.statut::text <> 'paie_validee'
     and e.date_sortie is not null
     -- Parti avant le premier jour du mois : il n'y a rien fait.
     and e.date_sortie < make_date(pp.annee, pp.mois, 1)
  returning lp.employee_id, pp.annee, pp.mois
)
select
  (select count(*) from retirees)                      as lignes_retirees,
  coalesce((select string_agg(distinct lpad(mois::text, 2, '0') || '/' || annee, ', ')
              from retirees), '—')                     as mois_touches;
