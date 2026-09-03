-- ============================================================================
-- 039 — La date de fin d'un contrat devient obligatoire
--  ============================================================
-- À exécuter après 038_deux_types_contrat.sql
--
--  Sans date de fin, un contrat n'entre dans aucune alerte : ni bleu à dix
--  jours du terme, ni jaune une fois échu. Il sort du suivi sans le dire.
--
--  Les contrats sans date de fin sont des essais : ils sont supprimés,
--  avec les scans qui leur étaient rattachés.
-- ============================================================================

begin;

  do $bloc$
  declare v_n int;
  begin
    select count(*) into v_n from public.contrats where date_fin is null;
    raise notice '% contrat(s) sans date de fin supprimé(s).', v_n;
  end $bloc$;

  -- Les documents rattachés partent en cascade avec le contrat.
  delete from public.contrats where date_fin is null;

  alter table public.contrats
    alter column date_fin set not null;

  comment on column public.contrats.date_fin is
    'Obligatoire : c''est elle qui déclenche les alertes de fin de contrat.';

commit;


-- ▶ Contrôle : plus aucun contrat sans date de fin
select count(*) as contrats_restants,
       count(*) filter (where date_fin is null) as encore_sans_date_de_fin
  from public.contrats;
