-- ============================================================
-- 033 — Garder ce qui a été saisi sur le document
-- À exécuter après 032_bulletin_paie.sql
--
-- Un contrat et un engagement de congé portent des mentions qui
-- n'existent nulle part ailleurs en base : le numéro du marché, la
-- qualité du salarié en arabe, la durée en toutes lettres. Sans les
-- conserver, réimprimer la pièce six mois plus tard donnerait un
-- document différent de celui qui a été signé.
-- ============================================================

alter table public.contrats
  add column if not exists champs_document jsonb not null default '{}'::jsonb;

alter table public.conges
  add column if not exists champs_document jsonb not null default '{}'::jsonb;

comment on column public.contrats.champs_document is
  'Ce qui a été tapé sur le contrat imprimé et qui n''a pas de colonne à soi.';
comment on column public.conges.champs_document is
  'Ce qui a été tapé sur l''engagement imprimé et qui n''a pas de colonne à soi.';
