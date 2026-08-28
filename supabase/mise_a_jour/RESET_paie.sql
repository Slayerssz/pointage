-- ============================================================================
--  REMISE À ZÉRO — annuler des mois de paie validés pendant les essais
--  ============================================================
--  Supabase → SQL Editor. ⚠️ CE FICHIER SUPPRIME DES DONNÉES.
--
--  Lisez d'abord l'ÉTAPE 0 (elle ne supprime rien), puis exécutez
--  UNIQUEMENT le bloc qui correspond à ce que vous voulez annuler.
--
--  Ce qui n'est JAMAIS touché ici : vos employés, vos sites, vos
--  entreprises, vos comptes, et vos pointages (les X, les photos).
--  On n'annule que la PAIE.
-- ============================================================================


-- ÉTAPE 0 — VOIR d'abord ce qui existe (ne supprime rien) ────────────────────

select c.name                     as entreprise,
       pp.annee, pp.mois,
       pp.statut,
       (select count(*) from public.lignes_paie lp where lp.periode_id = pp.id) as lignes,
       (select coalesce(sum(lp.net_a_payer),0) from public.lignes_paie lp where lp.periode_id = pp.id) as total_net,
       (select coalesce(sum(lp.retenue_dette),0) from public.lignes_paie lp where lp.periode_id = pp.id) as dettes_retenues
from public.periodes_paie pp
join public.companies c on c.id = pp.company_id
order by pp.annee desc, pp.mois desc, c.name;


-- ============================================================================
--  BLOC A — annuler UN SEUL mois  (le cas courant)
--  Modifiez l'année et le mois sur la ligne « where », puis exécutez.
-- ============================================================================

do $$
declare
  v_annee int := 2026;   -- ← l'année à annuler
  v_mois  int := 7;      -- ← le mois à annuler (7 = juillet)
  v_p     record;
  v_n     int := 0;
begin
  for v_p in
    select pp.id, pp.paie_validee_le, c.name as entreprise
    from public.periodes_paie pp
    join public.companies c on c.id = pp.company_id
    where pp.annee = v_annee and pp.mois = v_mois
  loop
    -- 1. si la paie avait été validée, rendre aux employés ce qu'elle
    --    avait retenu sur leur dette
    if v_p.paie_validee_le is not null then
      update public.employees e
         set dette = e.dette + lp.retenue_dette
        from public.lignes_paie lp
       where lp.periode_id = v_p.id
         and lp.employee_id = e.id
         and lp.retenue_dette > 0;
    end if;

    -- 2. supprimer la période (les lignes de paie partent avec elle)
    delete from public.periodes_paie where id = v_p.id;

    v_n := v_n + 1;
    raise notice 'Mois %/% annulé pour « % » — le pointage redevient modifiable.',
      v_mois, v_annee, v_p.entreprise;
  end loop;

  if v_n = 0 then
    raise notice 'Aucune période trouvée pour %/%.', v_mois, v_annee;
  end if;
end $$;


-- ============================================================================
--  BLOC B — annuler TOUTES les paies (repartir de zéro côté paie)
--  À n'exécuter que si vous voulez tout effacer.
-- ============================================================================
/*
do $$
declare v_n int;
begin
  -- rendre aux employés tout ce que les paies validées leur ont retenu
  update public.employees e
     set dette = e.dette + r.total
    from (select lp.employee_id, sum(lp.retenue_dette) as total
            from public.lignes_paie lp
            join public.periodes_paie pp on pp.id = lp.periode_id
           where pp.paie_validee_le is not null and lp.retenue_dette > 0
           group by lp.employee_id) r
   where e.id = r.employee_id;

  delete from public.periodes_paie;
  get diagnostics v_n = row_count;
  raise notice '% période(s) de paie supprimée(s). Tous les mois sont rouverts.', v_n;
end $$;
*/


-- ============================================================================
--  BLOC C — effacer AUSSI les essais de contrats / congés / dettes
--  Décommentez seulement les lignes qui vous intéressent.
-- ============================================================================
/*
-- Les congés d'essai (efface aussi les jours qu'ils avaient posés dans le pointage)
delete from public.pointages where conge_id is not null;
delete from public.conges;

-- Les contrats d'essai
delete from public.contrats;

-- Remettre les dettes à zéro
update public.employees set dette = 0;

-- Remettre à zéro le compteur « Gardes » des fiches employés
-- (il se reconstruit au fil des validations suivantes)
update public.employees set jours_travailles = 0;
*/


-- ============================================================================
--  BLOC D — effacer les pointages saisis à la main pendant les essais
--  ⚠️ Ne touche QUE les lignes sans photo (saisies par le bureau).
--     Les vrais pointages photo des agents sont conservés.
-- ============================================================================
/*
delete from public.pointages
 where photo_path is null
   and conge_id is null
   and pointed_on between date '2026-07-01' and date '2026-07-31';   -- ← la période
*/


-- ÉTAPE FINALE — revérifier ────────────────────────────────────────────────
-- Réexécutez la requête de l'ÉTAPE 0 : les mois annulés doivent avoir disparu.
