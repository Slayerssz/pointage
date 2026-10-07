-- ============================================================================
--  BLOC 40 sur 42 — Deux rôles au-dessus de l'administrateur
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 39.
--
--  ⚠ Ce bloc ne contient que deux lignes, et c'est voulu : PostgreSQL
--    refuse d'utiliser une nouvelle valeur d'énumération dans la même
--    exécution que sa création. Lancez celui-ci, PUIS le BLOC 41.
-- ============================================================================

alter type public.user_role add value if not exists 'dev';

alter type public.user_role add value if not exists 'owner';
