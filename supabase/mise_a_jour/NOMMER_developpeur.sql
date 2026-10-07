-- ============================================================================
--  NOMMER UN DÉVELOPPEUR (ou un propriétaire)
--  ============================================================
--  Supabase → SQL Editor → remplacer le nom, puis Run.
--
--  Seul un développeur peut en nommer un autre depuis l'application.
--  La toute première nomination se fait donc ici, en SQL — l'éditeur
--  n'est soumis à aucun contrôle de rôle.
--
--  Remplacez 'VOTRE_NOM_UTILISATEUR' par le nom du compte, celui avec
--  lequel on se connecte. Mettez 'dev' ou 'owner' selon ce que vous
--  voulez accorder.
-- ============================================================================

update public.profiles
   set role = 'dev'            -- ou 'owner'
 where username = 'VOTRE_NOM_UTILISATEUR';

-- Vérification : le compte et son nouveau rôle.
select username, full_name, role::text as role, actif
  from public.profiles
 where username = 'VOTRE_NOM_UTILISATEUR';
