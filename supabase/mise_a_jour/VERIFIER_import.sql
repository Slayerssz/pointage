-- ============================================================================
--  CONTRÔLE DE L'IMPORT — tout est-il bien passé ?
--  ============================================================
--  À lancer après IMPORT_1, IMPORT_2 et IMPORT_3.
--  Une seule requête, un seul tableau : chaque ligne dit OK ou PROBLÈME.
--  Rien n'est modifié.
--
--  Lisez la colonne « verdict » : s'il n'y a que des OK, l'import est bon.
--
--  Les noms de sociétés sont comparés en majuscules : « Groupe Triple A »
--  en base et « GROUPE TRIPLE A » sur l'état désignent bien la même.
-- ============================================================================

with attendu (societe, employes, sites) as (
  values
    ('AL SAFAE EL MAGHREB', 51, 9),
    ('BO', 66, 8),
    ('EDEN VERT SERVICE', 161, 16),
    ('GROUPE TRIPLE A', 104, 17),
    ('NORD PLANET', 7, 4),
    ('SERCLEAN NEGOCE', 5, 2),
    ('TRIMAX', 67, 17),
    ('VIGILMA GARD MAROC', 83, 19)
),
reel as (
  select upper(trim(co.name)) as societe,
         count(*) filter (where e.date_sortie is null)::int as employes,
         count(distinct e.site_id)::int                     as sites,
         count(*) filter (where e.date_sortie is not null)::int as sortis
    from public.companies co
    left join public.employees e on e.company_id = co.id
   group by co.name
),
controles as (

  -- 1. L'effectif de chaque société doit retomber sur son état
  select 1 as ordre,
         'Effectif — ' || a.societe                as controle,
         a.employes::text                          as attendu,
         coalesce(r.employes, 0)::text             as trouve,
         case when coalesce(r.employes, 0) = a.employes
              then 'OK' else 'PROBLÈME' end        as verdict
    from attendu a left join reel r on r.societe = upper(a.societe)

  union all
  -- 2. Chaque société doit avoir au moins les sites de son état
  select 2, 'Sites — ' || a.societe,
         '≥ ' || a.sites, coalesce(r.sites, 0)::text,
         case when coalesce(r.sites, 0) >= a.sites then 'OK' else 'PROBLÈME' end
    from attendu a left join reel r on r.societe = upper(a.societe)

  union all
  -- 3. Personne en trop dans les huit sociétés fournies
  select 3, 'Total en poste sur les 8 sociétés', '544',
         (select count(*)::text from public.employees e
            join public.companies co on co.id = e.company_id
           where e.date_sortie is null
             and upper(trim(co.name)) in (select upper(societe) from attendu)),
         case when (select count(*) from public.employees e
                      join public.companies co on co.id = e.company_id
                     where e.date_sortie is null
                       and upper(trim(co.name)) in (select upper(societe) from attendu))
                   = (select sum(employes) from attendu)
              then 'OK' else 'PROBLÈME' end

  union all
  -- 4. Deux personnes ne peuvent pas porter le même matricule chez le même employeur
  select 4, 'Matricules en double dans une société', '0',
         (select count(*)::text from (
            select company_id, matricule from public.employees
             where matricule is not null
             group by company_id, matricule having count(*) > 1) x),
         case when (select count(*) from (
                      select company_id, matricule from public.employees
                       where matricule is not null
                       group by company_id, matricule having count(*) > 1) x) = 0
              then 'OK' else 'PROBLÈME' end

  union all
  -- 5. Un C.I.N. identifie une personne : deux fiches pour un même C.I.N.
  --    signifient un doublon à fusionner à la main
  select 5, 'C.I.N. présent sur deux fiches', '0',
         (select count(*)::text from (
            select upper(trim(cin)) c from public.employees
             where cin is not null and trim(cin) <> ''
             group by 1 having count(*) > 1) x),
         case when (select count(*) from (
                      select upper(trim(cin)) c from public.employees
                       where cin is not null and trim(cin) <> ''
                       group by 1 having count(*) > 1) x) = 0
              then 'OK' else 'à vérifier' end

  union all
  -- 6. Tout le monde doit avoir un matricule
  select 6, 'Employés sans matricule', '0',
         (select count(*)::text from public.employees where matricule is null),
         case when (select count(*) from public.employees where matricule is null) = 0
              then 'OK' else 'PROBLÈME' end

  union all
  -- 7. Un employé ne peut pas être rattaché au site d'une autre société
  select 7, 'Employés rattachés au site d''une autre société', '0',
         (select count(*)::text from public.employees e
            join public.sites s on s.id = e.site_id
           where s.company_id <> e.company_id),
         case when (select count(*) from public.employees e
                      join public.sites s on s.id = e.site_id
                     where s.company_id <> e.company_id) = 0
              then 'OK' else 'PROBLÈME' end

  union all
  -- 8. Le département sert à la paie et au tri : il ne doit pas manquer
  select 8, 'Employés sans département', '0',
         (select count(*)::text from public.employees e
            join public.companies co on co.id = e.company_id
           where e.date_sortie is null
             and upper(trim(co.name)) in (select upper(societe) from attendu)
             and coalesce(trim(e.departement), '') = ''),
         case when (select count(*) from public.employees e
                      join public.companies co on co.id = e.company_id
                     where e.date_sortie is null
                       and upper(trim(co.name)) in (select upper(societe) from attendu)
                       and coalesce(trim(e.departement), '') = '') = 0
              then 'OK' else 'PROBLÈME' end

  union all
  -- 9. Les virements sont ceux qui auront un bulletin de paie
  select 9, 'Payés par virement (donc avec bulletin)', '408',
         (select count(*)::text from public.employees e
            join public.companies co on co.id = e.company_id
           where e.date_sortie is null
             and upper(trim(co.name)) in (select upper(societe) from attendu)
             and lower(coalesce(e.mode_reglement, '')) like 'vir%'),
         case when (select count(*) from public.employees e
                      join public.companies co on co.id = e.company_id
                     where e.date_sortie is null
                       and upper(trim(co.name)) in (select upper(societe) from attendu)
                       and lower(coalesce(e.mode_reglement, '')) like 'vir%') = 408
              then 'OK' else 'à vérifier' end

  union all
  -- 10. Le compteur ne doit jamais redistribuer un matricule déjà donné
  select 10, 'Compteur de matricules à jour',
         '≥ ' || (select coalesce(max(matricule), 0)::text from public.employees),
         (select dernier::text from public.matricule_compteur),
         case when (select dernier from public.matricule_compteur)
                   >= (select coalesce(max(matricule), 0) from public.employees)
              then 'OK' else 'PROBLÈME' end

  union all
  -- 11. Duo et Meganter devaient rester intacts
  select 11, 'Duo + Meganter — employés conservés', 'inchangé',
         (select count(*)::text from public.employees e
            join public.companies co on co.id = e.company_id
           where upper(trim(co.name)) in ('DUO MULTI SERVICE', 'MEGANTER SERVICE MAROC')),
         'pour information'

  union all
  -- 12. La table de travail de l'import ne doit pas rester derrière
  select 12, 'Table de travail import_etat supprimée', 'absente',
         case when exists (select 1 from pg_class where relname = 'import_etat')
              then 'encore là' else 'absente' end,
         case when exists (select 1 from pg_class where relname = 'import_etat')
              then 'lancez le MÉNAGE' else 'OK' end
)
select controle, attendu, trouve, verdict
  from controles order by ordre, controle;
