-- ============================================================================
--  BLOC 32 sur 33 — Un état de plus pour la paie
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 31.
--
--  ⚠ Ce bloc ne contient qu'une ligne, et c'est voulu : PostgreSQL refuse
--    d'utiliser une nouvelle valeur d'énumération dans la même exécution
--    que sa création. Lancez celui-ci, PUIS le BLOC 33.
-- ============================================================================

alter type public.periode_statut add value if not exists 'validation_demandee';
