-- ============================================================================
--  BLOC 22 sur 22 — La date de fin d'un contrat devient obligatoire
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 21.
--
--  Sans date de fin, un contrat n'entre dans aucune alerte et disparaît du
--  suivi sans le dire. Le bloc s'interrompt s'il en trouve un sans date,
--  en vous donnant la requête pour les retrouver.
-- ============================================================================

-- ============================================================
-- 039 — Un contrat a toujours une fin
-- À exécuter après 038_deux_types_contrat.sql
--
-- Sans date de fin, un contrat n'entre dans aucune alerte : ni bleu à
-- dix jours du terme, ni jaune une fois échu. Il disparaît du suivi
-- sans le dire. La date devient donc obligatoire.
--
-- La base ne porte encore aucun contrat : rien à convertir.
-- ============================================================

do $$
declare v_sans int;
begin
  select count(*) into v_sans from public.contrats where date_fin is null;
  if v_sans > 0 then
    raise exception
      '% contrat(s) sans date de fin. Renseignez-les avant de lancer ce bloc : '
      'select id, employee_id, date_debut from public.contrats where date_fin is null;',
      v_sans;
  end if;
end $$;

alter table public.contrats
  alter column date_fin set not null;

comment on column public.contrats.date_fin is
  'Obligatoire : c''est elle qui déclenche les alertes de fin de contrat.';
