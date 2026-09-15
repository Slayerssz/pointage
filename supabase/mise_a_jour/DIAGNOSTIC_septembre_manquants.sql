-- ============================================================================
--  POURQUOI CE JOUR DE SEPTEMBRE EST-IL VIDE ?
--  ============================================================
--  Supabase → SQL Editor → coller → Run.
--
--  Pour chaque employé et chaque jour de septembre 2026 sans pointage
--  validé, la raison. Le remplissage n'a laissé un jour vide que pour
--  l'une de celles-ci ; « INEXPLIQUÉ » voudrait dire que quelque chose
--  a été retiré après coup.
-- ============================================================================

with jours as (
  select generate_series('2026-09-01'::date, '2026-09-30'::date, interval '1 day')::date as jour
),
attendu as (
  select e.id, e.nom_prenom, e.matricule, c.name as societe, j.jour,
         e.jour_de_repos, e.date_embauche, e.date_sortie, e.archive_le,
         (select p.status::text from public.pointages p
           where p.employee_id = e.id and p.pointed_on = j.jour
           order by (p.status = 'validated') desc limit 1) as statut_pointage
    from public.employees e
    join public.companies c on c.id = e.company_id
    cross join jours j
)
select societe, matricule, nom_prenom,
       to_char(jour, 'DD/MM') as jour,
       case
         when statut_pointage = 'validated'                        then null
         when statut_pointage = 'pending'                          then 'PHOTO EN ATTENTE DE VALIDATION'
         when statut_pointage = 'refused'                          then 'POINTAGE REFUSÉ'
         when archive_le is not null                               then 'FICHE ARCHIVÉE'
         when date_sortie is not null and date_sortie < jour       then 'SORTI LE ' || to_char(date_sortie, 'DD/MM/YYYY')
         when date_embauche is not null and date_embauche > jour   then 'EMBAUCHÉ LE ' || to_char(date_embauche, 'DD/MM/YYYY')
         when jour_de_repos is not null
              and extract(isodow from jour)::int = jour_de_repos  then 'JOUR DE REPOS'
         else 'INEXPLIQUÉ'
       end as raison
  from attendu
 where statut_pointage is distinct from 'validated'
 order by
   case
     when statut_pointage = 'pending' then 1
     when statut_pointage is null and archive_le is null
          and not (date_sortie is not null and date_sortie < jour)
          and not (date_embauche is not null and date_embauche > jour)
          and not (jour_de_repos is not null and extract(isodow from jour)::int = jour_de_repos)
       then 0
     else 2
   end,
   societe, nom_prenom, jour;


-- ▶ Le même, résumé : combien de jours vides, par raison.
--   Sélectionnez ces lignes seules.

-- with jours as (
--   select generate_series('2026-09-01'::date, '2026-09-30'::date, interval '1 day')::date as jour
-- )
-- select
--   case
--     when p.status = 'pending'                                  then 'photo en attente'
--     when p.status = 'refused'                                  then 'pointage refusé'
--     when e.archive_le is not null                              then 'fiche archivée'
--     when e.date_sortie is not null and e.date_sortie < j.jour  then 'sorti'
--     when e.date_embauche is not null and e.date_embauche > j.jour then 'pas encore embauché'
--     when e.jour_de_repos is not null
--          and extract(isodow from j.jour)::int = e.jour_de_repos then 'jour de repos'
--     else 'INEXPLIQUÉ'
--   end as raison,
--   count(*) as jours,
--   count(distinct e.id) as employes
-- from public.employees e
-- cross join jours j
-- left join public.pointages p
--   on p.employee_id = e.id and p.pointed_on = j.jour and p.status <> 'refused'
-- where p.status is distinct from 'validated'
-- group by 1 order by jours desc;
