-- ============================================================================
--  EFFACER LES POINTAGES DE DÉMONSTRATION
--  ============================================================
--  Les pointages saisis pendant une démonstration, sans toucher au reste.
--  Employés, sites, contrats, congés et comptes ne bougent pas.
--
--  Deux temps : on regarde d'abord, on efface ensuite.
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
--  ÉTAPE 1 — REGARDER  (ne modifie rien)
-- ═══════════════════════════════════════════════════════════════════════════

-- ▶ 1a. Combien de pointages, par jour et par société ?
--       Repérez les dates de vos essais dans cette liste.
select co.name as societe,
       p.pointed_on as jour,
       count(*) as pointages,
       count(distinct p.employee_id) as employes,
       string_agg(distinct p.status, ', ') as statuts
  from public.pointages p
  join public.companies co on co.id = p.company_id
 group by co.name, p.pointed_on
 order by p.pointed_on desc, co.name
 limit 100;

-- ▶ 1b. Un mois clôturé ne se vide pas sans conséquence : la paie
--       correspondante en dépend. Cette requête dit lesquels sont figés.
select co.name as societe, pp.annee, pp.mois, pp.statut
  from public.periodes_paie pp
  join public.companies co on co.id = pp.company_id
 where pp.statut <> 'ouvert'
 order by pp.annee desc, pp.mois desc;


-- ═══════════════════════════════════════════════════════════════════════════
--  ÉTAPE 2 — EFFACER
--  Choisissez UN des trois blocs, décommentez-le, ajustez, lancez.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── A. Une plage de dates, pour toutes les sociétés ───────────────────────
--     Le cas courant : « j'ai fait des essais du 1er au 3 septembre ».
--
-- begin;
--   -- ce qui va partir
--   select count(*) as pointages_a_effacer
--     from public.pointages
--    where pointed_on between '2026-09-01' and '2026-09-03';
--
--   delete from public.pointages
--    where pointed_on between '2026-09-01' and '2026-09-03';
-- commit;


-- ─── B. Une seule société, une plage de dates ──────────────────────────────
--
-- begin;
--   delete from public.pointages p
--    using public.companies co
--    where co.id = p.company_id
--      and upper(trim(co.name)) = 'GROUPE TRIPLE A'
--      and p.pointed_on between '2026-09-01' and '2026-09-03';
-- commit;


-- ─── C. TOUS les pointages, quels qu'ils soient ────────────────────────────
--     À n'utiliser que si la base ne contient encore aucune vraie journée.
--     Les périodes de paie qui s'appuyaient dessus partent avec — sinon
--     elles resteraient à réclamer des jours qui n'existent plus.
--
-- begin;
--   delete from public.lignes_paie;
--   delete from public.periodes_paie;
--   delete from public.pointages;
--   update public.employees set jours_travailles = 0;
-- commit;


-- ═══════════════════════════════════════════════════════════════════════════
--  ÉTAPE 3 — CONTRÔLER
-- ═══════════════════════════════════════════════════════════════════════════
-- select co.name as societe, count(p.id) as pointages_restants
--   from public.companies co
--   left join public.pointages p on p.company_id = co.id
--  group by co.name order by co.name;
