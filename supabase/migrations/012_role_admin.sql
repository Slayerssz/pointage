-- ============================================================
-- 012 — Ajout du rôle « admin »
-- ⚠️  IMPORTANT : exécutez CE FICHIER SEUL, puis ensuite le 013.
--     (PostgreSQL interdit d'ajouter une valeur d'enum et de
--      l'utiliser dans la même transaction.)
-- ============================================================

alter type public.user_role add value if not exists 'admin';
