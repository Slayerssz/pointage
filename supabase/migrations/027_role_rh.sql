-- ============================================================
-- 027 — Nouveau rôle : personnel (RH)
-- À exécuter SEUL (comme 012 et 018), puis 028.
--
-- PostgreSQL exige qu'une nouvelle valeur d'énumération soit
-- validée avant d'être utilisée : ce fichier ne contient que
-- cette ligne. Exécutez-le, puis exécutez 028.
-- ============================================================

alter type public.user_role add value if not exists 'rh';
