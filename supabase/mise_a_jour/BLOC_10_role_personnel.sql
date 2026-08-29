-- ============================================================================
--  BLOC 10 sur 11 — Rôle « personnel » (RH) et champ Département
--  ============================================================
--  Supabase → SQL Editor → coller → Run.  À exécuter APRÈS le BLOC 9.
--
--  ⚠️  Le BLOC 10 doit être exécuté SEUL, puis vous relancez Run pour
--      le BLOC 11 (PostgreSQL exige qu'un nouveau rôle soit enregistré
--      avant d'être utilisé — comme pour le rôle « paie »).
--
--  Ce fichier = migration 027 (doit être exécutée SEULE)
-- ============================================================================

-- ============================================================
-- 027 — Nouveau rôle : personnel (RH)
-- À exécuter SEUL (comme 012 et 018), puis 028.
--
-- PostgreSQL exige qu'une nouvelle valeur d'énumération soit
-- validée avant d'être utilisée : ce fichier ne contient que
-- cette ligne. Exécutez-le, puis exécutez 028.
-- ============================================================

alter type public.user_role add value if not exists 'rh';
