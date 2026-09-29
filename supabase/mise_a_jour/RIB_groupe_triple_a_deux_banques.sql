-- ============================================================================
--  GROUPE TRIPLE A — deux R.I.B. sur l'ordre de virement
--  ============================================================
--  Supabase → SQL Editor → coller → Run. Une seule fois.
--
--  La société a deux comptes. L'ordre de virement doit les annoncer tous
--  les deux, chacun sous le nom de sa banque :
--
--      BMCE: <l'ancien numéro> / CHI: 230640396300722101680001
--
--  L'ancien numéro n'est pas réécrit à la main : on le reprend tel qu'il
--  est déjà enregistré. Repasser ce bloc ne l'abîme pas — la condition
--  `not like 'BMCE:%'` empêche d'empiler les étiquettes.
-- ============================================================================

update public.companies
   set rib_ordinateur = 'BMCE: ' || trim(rib_ordinateur)
                        || ' / CHI: 230640396300722101680001'
 where name ilike '%triple%'
   and coalesce(trim(rib_ordinateur), '') <> ''
   and rib_ordinateur not like 'BMCE:%';

-- Ce qui est enregistré, pour vérifier d'un coup d'œil.
select name as societe, rib_ordinateur
  from public.companies
 where name ilike '%triple%';
