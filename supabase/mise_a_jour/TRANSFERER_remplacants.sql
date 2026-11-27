-- ============================================================================
--  TRANSFÉRER LES REMPLAÇANTS DANS LA SECTION PARTAGÉE
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--  À lancer après le BLOC 52, et APRÈS avoir lu RELEVE_remplacants.sql.
--
--  CE QUI SE PASSE, ET CE QUI NE SE PASSE PAS
--
--  Les jokers rangés dans les sites « REMPLACEMENT » et « JOKER » sont
--  COPIÉS dans la section partagée. Quelqu'un qui figure dans trois
--  sociétés n'y entre qu'une fois : c'est la même personne.
--
--  RIEN N'EST SUPPRIMÉ. Ni les fiches, ni les pointages, ni les lignes
--  de paie : ils portent des mois déjà payés et déclarés. Les anciens
--  sites sont seulement ÉTEINTS — ils disparaissent des listes et du
--  pointage, mais leur histoire reste lisible.
--
--  Une copie de sauvegarde est prise d'abord, dans la table
--  `sauvegarde_sites_remplacants`. Pour tout défaire :
--
--      update public.sites s set pointage_actif = v.pointage_actif
--        from public.sauvegarde_sites_remplacants v where v.id = s.id;
--      delete from public.remplacants where cree_le >= 'LA DATE DU JOUR';
--
--  Relancer ce fichier ne fait pas de doublon : on ne crée que ceux qui
--  manquent.
-- ============================================================================

do $transfert$
declare
  v_sauves integer;
  v_crees integer;
  v_eteints integer;
begin
  -- 1. La sauvegarde, avant tout -------------------------------------------
  create table if not exists public.sauvegarde_sites_remplacants (
    id uuid primary key,
    company_id uuid,
    name text,
    pointage_actif boolean,
    site_principal_id uuid,
    employes jsonb,
    sauve_le timestamptz not null default now()
  );

  insert into public.sauvegarde_sites_remplacants
    (id, company_id, name, pointage_actif, site_principal_id, employes)
  select s.id, s.company_id, s.name, s.pointage_actif, s.site_principal_id,
         coalesce((select jsonb_agg(to_jsonb(e))
                     from public.employees e where e.site_id = s.id), '[]'::jsonb)
    from public.sites s
   where (upper(s.name) like '%REMPLAC%' or upper(s.name) like '%JOKER%')
  on conflict (id) do nothing;
  get diagnostics v_sauves = row_count;

  -- 2. Les fiches, sans doublon --------------------------------------------
  --  Une personne présente dans plusieurs sociétés n'entre qu'une fois.
  --  On garde la fiche la plus renseignée : celle qui a le plus de
  --  champs remplis, et à égalité la plus récemment embauchée.
  with candidats as (
    select e.*,
           row_number() over (
             partition by upper(trim(e.nom_prenom))
             order by (
               (e.cin is not null)::int + (e.cnss is not null)::int
               + (e.date_naissance is not null)::int + (e.telephone is not null)::int
               + (e.salaire is not null)::int + (e.rib is not null)::int
             ) desc,
             e.date_embauche desc nulls last
           ) as rang
      from public.employees e
      join public.sites s on s.id = e.site_id
     where (upper(s.name) like '%REMPLAC%' or upper(s.name) like '%JOKER%')
       and e.archive_le is null
  )
  insert into public.remplacants
    (nom_prenom, cin, cnss, date_naissance, telephone, adresse, ville,
     qualification, departement, mode_reglement, banque, rib)
  select c.nom_prenom, c.cin, c.cnss, c.date_naissance, c.telephone, c.adresse,
         c.ville, c.qualification, c.departement, c.mode_reglement, c.banque, c.rib
    from candidats c
   where c.rang = 1
     -- Déjà présent ? On n'en fait pas un second.
     and not exists (select 1 from public.remplacants r
                      where upper(trim(r.nom_prenom)) = upper(trim(c.nom_prenom)));
  get diagnostics v_crees = row_count;

  -- 3. Les anciens sites s'éteignent ----------------------------------------
  --  Éteints, et non supprimés : ils portent des pointages et des
  --  lignes de paie qu'on a payés et déclarés.
  update public.sites
     set pointage_actif = false
   where (upper(name) like '%REMPLAC%' or upper(name) like '%JOKER%')
     and pointage_actif;
  get diagnostics v_eteints = row_count;

  raise notice '% site(s) sauvegardé(s).', v_sauves;
  raise notice '% remplaçant(s) créé(s) dans la section partagée.', v_crees;
  raise notice '% site(s) éteint(s).', v_eteints;
end $transfert$;

-- Ce qu'il y a maintenant dans la section partagée.
select matricule, nom_prenom, qualification, mode_reglement,
       coalesce(cin, '⚠ manquant')  as cin,
       coalesce(cnss, '⚠ manquant') as cnss
  from public.remplacants
 where archive_le is null
 order by nom_prenom;
