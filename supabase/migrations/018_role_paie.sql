-- ============================================================
-- 018 — Nouveau rôle : responsable de paie
-- À exécuter SEUL (comme 012_role_admin.sql), puis 019.
--
-- PostgreSQL exige qu'une nouvelle valeur d'énumération soit
-- validée avant d'être utilisée : ce fichier ne contient donc
-- que cette ligne. Exécutez-le, puis exécutez 019.
-- ============================================================

alter type public.user_role add value if not exists 'paie';
