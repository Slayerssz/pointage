-- ============================================================
-- 049 — Un état de plus pour la paie : validation demandée
-- À exécuter SEUL (comme 012, 018 et 027), puis 050.
--
-- PostgreSQL exige qu'une nouvelle valeur d'énumération soit
-- validée avant d'être utilisée : ce fichier ne contient que
-- cette ligne. Exécutez-le, puis exécutez 050.
-- ============================================================

alter type public.periode_statut add value if not exists 'validation_demandee';
