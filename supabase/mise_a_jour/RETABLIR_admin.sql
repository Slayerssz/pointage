-- ============================================================================
--  REMETTRE LES DÉVELOPPEURS EN ADMINISTRATEURS
--  ============================================================
--  Supabase → SQL Editor → coller → Run.
--
--  À n'utiliser que si une version précédente du BLOC 41 avait fait
--  passer vos administrateurs en « dev » : ce fichier les remet comme
--  ils étaient. Si le rôle de personne n'a bougé, il ne fait rien.
--
--  ⚠ Après cela, plus aucun développeur n'existe — et comme seul un
--    développeur peut en nommer un autre, la prochaine nomination se
--    fera en SQL : voir NOMMER_developpeur.sql.
-- ============================================================================

update public.profiles
   set role = 'admin'
 where role = 'dev';

-- Ce qui reste, pour vérifier d'un coup d'œil.
select role::text as role, count(*) as comptes
  from public.profiles
 group by role
 order by role;
