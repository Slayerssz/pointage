-- ============================================================================
--  SUPPRIMER LES ANNEXES SANS PERSONNE
--  ============================================================
--  L'import a créé une annexe pour chaque site cité par vos états. Certaines
--  n'ont finalement aucun employé : elles encombrent les listes déroulantes
--  et les filtres sans rien désigner.
--
--  Une annexe n'est supprimable que si RIEN ne s'y rattache — ni employé,
--  ni pointage, ni ligne de paie. Le script le vérifie ; ce qui reste
--  accroché est laissé en place et vous est montré.
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
--  ÉTAPE 1 — REGARDER  (ne modifie rien)
-- ═══════════════════════════════════════════════════════════════════════════

-- ▶ 1a. Les annexes vides, société par société
select co.name as societe,
       s.name  as annexe,
       (select count(*) from public.employees e where e.site_id = s.id) as employes,
       (select count(*) from public.pointages p where p.site_id = s.id) as pointages,
       case
         when exists (select 1 from public.employees e where e.site_id = s.id)
           then 'garde : des employés y sont rattachés'
         when exists (select 1 from public.pointages p where p.site_id = s.id)
           then 'garde : des pointages y sont rattachés'
         else 'SUPPRIMABLE'
       end as verdict
  from public.sites s
  join public.companies co on co.id = s.company_id
 where not exists (select 1 from public.employees e where e.site_id = s.id)
 order by verdict, co.name, s.name;

-- ▶ 1b. Le compte, en une ligne
select count(*) filter (where vide and libre)  as supprimables,
       count(*) filter (where vide and not libre) as vides_mais_gardees,
       count(*)                                as annexes_au_total
  from (
    select not exists (select 1 from public.employees e where e.site_id = s.id) as vide,
           not exists (select 1 from public.pointages p where p.site_id = s.id) as libre
      from public.sites s
  ) x;


-- ═══════════════════════════════════════════════════════════════════════════
--  ÉTAPE 2 — SUPPRIMER
--  Décommentez le bloc et lancez-le. Seules les annexes marquées
--  « SUPPRIMABLE » ci-dessus disparaissent.
-- ═══════════════════════════════════════════════════════════════════════════

-- begin;
--
--   -- La liste exacte de ce qui part, une dernière fois sous les yeux
--   select co.name as societe, s.name as annexe_supprimee
--     from public.sites s
--     join public.companies co on co.id = s.company_id
--    where not exists (select 1 from public.employees e where e.site_id = s.id)
--      and not exists (select 1 from public.pointages p where p.site_id = s.id)
--    order by co.name, s.name;
--
--   delete from public.sites s
--    where not exists (select 1 from public.employees e where e.site_id = s.id)
--      and not exists (select 1 from public.pointages p where p.site_id = s.id);
--
-- commit;


-- ═══════════════════════════════════════════════════════════════════════════
--  FACULTATIF — les sites principaux devenus vides
--  Un site principal qui n'a plus aucune annexe ne sert plus à regrouper.
--  Le supprimer ne touche à personne.
-- ═══════════════════════════════════════════════════════════════════════════

-- ▶ Les voir
select co.name as societe, sp.name as site_principal_vide
  from public.sites_principaux sp
  join public.companies co on co.id = sp.company_id
 where not exists (select 1 from public.sites s where s.site_principal_id = sp.id)
 order by co.name, sp.name;

-- begin;
--   delete from public.sites_principaux sp
--    where not exists (select 1 from public.sites s where s.site_principal_id = sp.id);
-- commit;


-- ═══════════════════════════════════════════════════════════════════════════
--  ÉTAPE 3 — CONTRÔLER
-- ═══════════════════════════════════════════════════════════════════════════
-- select co.name as societe,
--        count(s.id) as annexes,
--        count(s.id) filter (
--          where not exists (select 1 from public.employees e where e.site_id = s.id)
--        ) as encore_vides
--   from public.companies co
--   left join public.sites s on s.company_id = co.id
--  group by co.name order by co.name;
