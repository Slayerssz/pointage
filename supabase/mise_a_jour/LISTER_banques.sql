-- ============================================================================
--  LES BANQUES TELLES QU'ELLES ONT ÉTÉ TAPÉES
--  ============================================================
--  Supabase → SQL Editor → coller → Run.
--
--  Le champ « Banque » de la fiche était en saisie libre : « AL BARID
--  BANK », « al barid cash », « Al Barid »… La liste des versements
--  regroupe par banque, donc chaque orthographe fait un groupe à part.
--
--  Cette requête montre chaque orthographe, combien de personnes la
--  portent, et sous quelle forme normalisée elle tomberait. Deux lignes
--  avec la même « forme_normalisee » sont la même banque écrite deux fois.
-- ============================================================================

select
  upper(regexp_replace(trim(e.banque), '\s+', ' ', 'g')) as forme_normalisee,
  e.banque                                               as telle_que_tapee,
  count(*)                                               as employes,
  count(*) filter (where lower(coalesce(e.mode_reglement, '')) like 'vir%')  as par_virement,
  count(*) filter (where lower(coalesce(e.mode_reglement, '')) like 'vers%') as par_versement,
  string_agg(distinct c.name, ', ' order by c.name)      as societes
from public.employees e
join public.companies c on c.id = e.company_id
where e.archive_le is null
  and nullif(trim(e.banque), '') is not null
group by 1, 2
order by 1, 3 desc;


-- ▶ UNIFIER — met chaque banque en majuscules, sans espaces en trop.
--   C'est tout : « al barid cash » devient « AL BARID CASH », pas
--   « AL BARID BANK » — décider que deux noms sont la même banque, c'est
--   à vous, pas à une requête. Sélectionnez ces lignes seules.

-- update public.employees
--    set banque = upper(regexp_replace(trim(banque), '\s+', ' ', 'g'))
--  where banque is not null
--    and banque <> upper(regexp_replace(trim(banque), '\s+', ' ', 'g'));


-- ▶ RENOMMER UNE BANQUE — quand deux orthographes sont bien la même.
--   Remplacez les deux textes, sélectionnez ces lignes seules.

-- update public.employees
--    set banque = 'AL BARID BANK'
--  where upper(trim(banque)) in ('AL BARID', 'BARID BANK', 'ALBARID BANK');
