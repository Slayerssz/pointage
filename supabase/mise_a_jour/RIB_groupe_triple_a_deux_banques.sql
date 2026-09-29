-- ============================================================================
--  GROUPE TRIPLE A — deux R.I.B. sur l'ordre de virement
--  ============================================================
--  Supabase → SQL Editor → coller → Run.
--
--  La société a deux comptes. L'ordre de virement doit les annoncer tous
--  les deux, chacun sous le nom de sa banque :
--
--      BMCE: <l'ancien numéro> / CIH: 230640396300722101680001
--
--  L'ancien numéro n'est pas réécrit à la main : on le reprend tel qu'il
--  est déjà enregistré.
--
--  Ce bloc se repasse sans danger. Il corrige aussi « CHI » en « CIH »
--  si une première version, fautive, avait déjà été appliquée.
-- ============================================================================

-- 1. Rattrapage : « CHI » était une faute de frappe pour « CIH ».
update public.companies
   set rib_ordinateur = replace(rib_ordinateur, 'CHI:', 'CIH:')
 where rib_ordinateur like '%CHI:%';

-- 2. Les deux comptes, si ce n'est pas déjà fait.
update public.companies
   set rib_ordinateur = 'BMCE: ' || trim(rib_ordinateur)
                        || ' / CIH: 230640396300722101680001'
 where name ilike '%triple%'
   and coalesce(trim(rib_ordinateur), '') <> ''
   and rib_ordinateur not like 'BMCE:%';

-- Ce qui est enregistré, pour vérifier d'un coup d'œil.
select name as societe, rib_ordinateur
  from public.companies
 where name ilike '%triple%';
