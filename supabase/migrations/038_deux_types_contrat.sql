-- ============================================================
-- 038 — Deux types de contrat, et rien d'autre
-- À exécuter après 037_bureau_fait_la_paie.sql
--
-- Six types (CDI, CDD, ANAPEC, STAGE, INTERIM, ESSAI) obligeaient à
-- choisir une nuance juridique que le contrat imprimé ne reprend nulle
-- part. Il n'en reste que deux : un contrat, ou un stage.
--
-- Les couleurs de fin de contrat ne changent pas, et n'ont jamais
-- dépendu du type : `contrat_statut()` ne regarde que les dates.
-- ============================================================

-- Les contrats déjà saisis gardent leur sens : un stage reste un stage,
-- tout le reste devient un contrat.
alter table public.contrats drop constraint if exists contrats_type_contrat_check;

update public.contrats
   set type_contrat = case
                        when upper(trim(type_contrat)) = 'STAGE' then 'STAGE'
                        else 'CONTRAT'
                      end;

alter table public.contrats
  alter column type_contrat set default 'CONTRAT',
  add constraint contrats_type_contrat_check
    check (type_contrat in ('CONTRAT', 'STAGE'));

comment on column public.contrats.type_contrat is
  'CONTRAT ou STAGE. Ne conditionne aucune alerte : les couleurs de fin '
  'suivent les dates, quel que soit le type.';
