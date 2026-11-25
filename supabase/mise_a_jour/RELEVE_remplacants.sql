-- ============================================================================
--  CE QUE LE TRANSFERT DES REMPLAÇANTS DÉPLACERAIT
--  ============================================================
--  Supabase → SQL Editor → coller → Run. Ne change RIEN, regarde.
--
--  À lancer après le BLOC 52, et à lire AVANT de lancer le transfert.
--
--  Les remplaçants sont aujourd'hui rangés dans des sites nommés
--  « REMPLACEMENT », « AGENT DE REMPLACEMENT », « JOKER », « JOKER
--  CONGE 1 »… — un jeu par société. Le transfert les sortira de là pour
--  les mettre dans la section partagée.
--
--  Ce relevé répond à trois questions :
--    1. quels sites seraient concernés, combien de monde dedans, et
--       quel historique ils portent ;
--    2. qui exactement serait transféré ;
--    3. ce qui empêcherait de supprimer un site ensuite.
--
--  Si un site de la liste n'est PAS un site de remplaçants, dites-le
--  avant que le transfert ne tourne : la règle de nommage est la seule
--  chose qui les distingue.
-- ============================================================================

-- 1. Les sites qui seraient vidés ---------------------------------------------

-- Chaque compte est une requête à part. Les joindre toutes dans un
-- même FROM multiplie les lignes les unes par les autres : trois agents
-- et quarante-quatre pointages donnaient « 132 agents ».

select
  c.name as societe,
  s.name as site,
  (select count(*) from public.employees e
    where e.site_id = s.id and e.archive_le is null)              as agents,
  (select count(*) from public.employees e
    where e.site_id = s.id and e.archive_le is null
      and e.date_sortie is null)                                  as encore_en_poste,
  (select count(*) from public.pointages p where p.site_id = s.id) as pointages,
  (select count(*) from public.lignes_paie l where l.site_id = s.id) as lignes_paie,
  -- Ce que le site emporterait s'il était supprimé. C'est la raison
  -- pour laquelle on ne le supprimera pas : on l'éteindra.
  case when (select count(*) from public.pointages p where p.site_id = s.id) > 0
            or (select count(*) from public.lignes_paie l where l.site_id = s.id) > 0
       then '⚠ porte de l''historique — à éteindre, pas à supprimer'
       else 'vide, supprimable' end                               as ce_qu_il_porte
from public.sites s
join public.companies c on c.id = s.company_id
where upper(s.name) like '%REMPLAC%'
   or upper(s.name) like '%JOKER%'
order by c.name, s.name;

-- 2. Qui serait transféré ------------------------------------------------------

select
  c.name                as societe,
  s.name                as site_actuel,
  e.matricule,
  e.nom_prenom,
  e.cin,
  e.cnss,
  e.qualification,
  e.mode_reglement,
  coalesce(e.salaire, 0)                   as salaire,
  e.date_embauche,
  e.date_sortie,
  case when e.date_sortie is not null then 'sorti'
       when not e.actif then 'inactif'
       else 'en poste' end                 as etat,
  -- Deux fiches du même nom dans deux sociétés : c'est la même
  -- personne, et elle ne doit pas arriver en double dans la section.
  count(*) over (partition by upper(trim(e.nom_prenom))) as fiches_du_meme_nom
from public.employees e
join public.sites s on s.id = e.site_id
join public.companies c on c.id = e.company_id
where (upper(s.name) like '%REMPLAC%' or upper(s.name) like '%JOKER%')
  and e.archive_le is null
order by upper(trim(e.nom_prenom)), c.name;

-- 3. Le résumé -----------------------------------------------------------------

select
  count(distinct s.id)                                   as sites_concernes,
  count(distinct c.id)                                   as societes_concernees,
  count(distinct e.id) filter (where e.archive_le is null) as fiches,
  count(distinct upper(trim(e.nom_prenom)))
    filter (where e.archive_le is null)                  as personnes_distinctes,
  count(distinct e.id) filter (where e.archive_le is null
                                 and e.date_sortie is null) as encore_en_poste
from public.sites s
join public.companies c on c.id = s.company_id
left join public.employees e on e.site_id = s.id
where upper(s.name) like '%REMPLAC%'
   or upper(s.name) like '%JOKER%';
