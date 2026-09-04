-- ============================================================================
--  BLOC 27 sur 27 — Matin ou nuit
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 26.
--
--  Une colonne sur la fiche employé : matin, nuit, journée, ou rien quand
--  l'horaire n'est pas fixe.
-- ============================================================================

-- ============================================================
-- 044 — Matin ou nuit
-- À exécuter après 043_net_jamais_negatif.sql
--
-- Un agent de sécurité de nuit et une agente de nettoyage du matin ne
-- se remplacent pas et ne se planifient pas ensemble. Le registre ne
-- savait pas les distinguer.
--
-- Trois valeurs seulement, et la possibilité de n'en donner aucune :
-- beaucoup de postes n'ont pas d'horaire fixe, et forcer un choix
-- reviendrait à inventer une information.
-- ============================================================

alter table public.employees
  add column if not exists horaire text
    check (horaire is null or horaire in ('MATIN', 'NUIT', 'JOURNEE'));

comment on column public.employees.horaire is
  'MATIN, NUIT ou JOURNEE. Null quand l''horaire n''est pas fixe.';

create index if not exists employees_horaire_idx
  on public.employees (company_id, horaire) where horaire is not null;
