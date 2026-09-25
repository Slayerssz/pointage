-- ============================================================================
--  RETROUVER QUELQU'UN DONT ON ORTHOGRAPHIE MAL LE NOM
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  Cherche « MHIR… » et « ANAS… » séparément : apostrophes, doubles
--  consonnes et espaces changent d'une fiche à l'autre (M'HIROU, MHIROU,
--  ANASS…), et une recherche sur le nom entier passe à côté.
--
--  Pour chercher quelqu'un d'autre, remplacez les deux morceaux plus bas.
-- ============================================================================

select c.name                                   as societe,
       e.matricule,
       e.nom_prenom,
       coalesce(s.name, '—')                    as site,
       case when e.actif then 'EN POSTE' else 'SORTI' end as statut,
       case when e.archive_le is null then '' else 'ARCHIVÉ' end as archive
  from public.employees e
  join public.companies c on c.id = e.company_id
  left join public.sites s on s.id = e.site_id
 -- On enlève apostrophes, tirets et espaces avant de comparer.
 where regexp_replace(upper(e.nom_prenom), '[^A-Z]', '', 'g') like '%MHIR%'
    or regexp_replace(upper(e.nom_prenom), '[^A-Z]', '', 'g') like '%ANAS%'
 order by c.name, e.nom_prenom;
