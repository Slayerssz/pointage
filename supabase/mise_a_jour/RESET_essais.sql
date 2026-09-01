-- ============================================================================
--  REMISE À ZÉRO COMPLÈTE DES ESSAIS
--  ============================================================
--  Supabase → SQL Editor. ⚠️ CE FICHIER SUPPRIME DES DONNÉES.
--
--  À utiliser après la période de tests : efface les paies, les pointages
--  saisis pendant les essais et remet les compteurs de gardes à zéro.
--
--  CE QUI N'EST JAMAIS TOUCHÉ :
--    vos employés, vos sites, vos entreprises, vos comptes,
--    vos contrats, et les photos de profil.
-- ============================================================================


-- ÉTAPE 0 — VOIR ce qu'il y a, avant de décider (ne supprime rien) ───────────

select
  (select count(*) from public.periodes_paie)                  as periodes_de_paie,
  (select count(*) from public.lignes_paie)                    as lignes_de_paie,
  (select count(*) from public.pointages)                      as pointages,
  (select count(*) from public.pointages where photo_path is not null) as dont_avec_photo,
  (select count(*) from public.conges)                         as conges,
  (select count(*) from public.employees where jours_travailles <> 0) as employes_avec_gardes,
  (select coalesce(sum(dette), 0) from public.employees)       as total_des_dettes;


-- ============================================================================
--  BLOC A — TOUT remettre à zéro  (le cas courant après les essais)
--
--  Efface : toutes les paies, tous les pointages, tous les congés.
--  Remet   : les compteurs de gardes à 0.
--  Conserve : employés, sites, entreprises, comptes, contrats, dettes.
-- ============================================================================

do $$
declare
  v_paies int; v_pointages int; v_conges int; v_employes int;
begin
  -- 1. Les paies (les lignes partent avec les périodes)
  delete from public.periodes_paie;
  get diagnostics v_paies = row_count;

  -- 2. Les pointages, y compris ceux posés par les congés
  delete from public.pointages;
  get diagnostics v_pointages = row_count;

  -- 3. Les congés
  delete from public.conges;
  get diagnostics v_conges = row_count;

  -- 4. Les compteurs de gardes des fiches employés
  update public.employees set jours_travailles = 0 where jours_travailles <> 0;
  get diagnostics v_employes = row_count;

  raise notice 'Remise à zéro : % période(s) de paie, % pointage(s), % congé(s), % compteur(s) remis à 0.',
    v_paies, v_pointages, v_conges, v_employes;
  raise notice 'Employés, sites, entreprises, comptes et contrats : intacts.';
end $$;


-- ============================================================================
--  BLOC B — remettre aussi les DETTES à zéro
--  (à décommenter seulement si les dettes saisies étaient des essais)
-- ============================================================================
/*
update public.employees set dette = 0 where dette <> 0;
*/


-- ============================================================================
--  BLOC C — effacer aussi les CONTRATS d'essai
--  (à décommenter seulement si les contrats saisis étaient des essais)
-- ============================================================================
/*
delete from public.documents where type = 'contrat';
delete from public.contrats;
*/


-- ============================================================================
--  BLOC D — repartir d'un matricule choisi
--  Par défaut le compteur reprend au plus grand matricule existant.
--  Pour forcer une valeur, décommentez et ajustez :
-- ============================================================================
/*
update public.matricule_compteur
   set dernier = greatest(
         (select coalesce(max(matricule), 0) from public.employees),
         1200                                     -- ← le prochain sera 1201
       );
*/


-- ÉTAPE FINALE — revérifier ─────────────────────────────────────────────────
-- Réexécutez la requête de l'ÉTAPE 0 : tout doit être à zéro,
-- sauf le nombre d'employés, de sites et de contrats.
