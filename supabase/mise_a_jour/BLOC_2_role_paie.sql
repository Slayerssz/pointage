-- ============================================================================
--  MISE À JOUR « PAIE & CONTRATS » — BLOC 2 sur 4
--  ============================================================
--  À exécuter dans : Supabase → SQL Editor → coller → Run
--
--  ⚠️  ORDRE OBLIGATOIRE : BLOC 1, puis BLOC 2, puis BLOC 3, puis BLOC 4.
--      Attendez le « Success » de chaque bloc avant de lancer le suivant.
--
--  Ce fichier = migration 018 (doit être exécutée SEULE)
-- ============================================================================

-- ============================================================
-- 018 — Nouveau rôle : responsable de paie
-- À exécuter SEUL (comme 012_role_admin.sql), puis 019.
--
-- PostgreSQL exige qu'une nouvelle valeur d'énumération soit
-- validée avant d'être utilisée : ce fichier ne contient donc
-- que cette ligne. Exécutez-le, puis exécutez 019.
-- ============================================================

alter type public.user_role add value if not exists 'paie';
