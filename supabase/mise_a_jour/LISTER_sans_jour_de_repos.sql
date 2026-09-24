-- ============================================================================
--  QUI N'A PAS DE JOUR DE REPOS ?
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  Ces fiches n'ont pas de jour de repos : le pointage leur compte donc
--  tous les jours du mois, dimanches compris — d'où les 30 jours au lieu
--  de 26.
--
--  À corriger dans l'application : Employés → la personne → Modifier →
--  « Jour de repos ». Une fois les fiches remplies, lancez le 2 de
--  RESYNCHRONISER_septembre.sql et tout rentre dans l'ordre.
-- ============================================================================

select c.name                          as societe,
       e.matricule,
       e.nom_prenom,
       coalesce(s.name, '—')           as site,
       coalesce(e.qualification, '—')  as qualification,
       (select count(*) from public.pointages p
         where p.employee_id = e.id
           and p.pointed_on between '2026-09-01' and '2026-09-30'
           and p.type_garde = 'X')     as jours_comptes_en_septembre
  from public.employees e
  join public.companies c on c.id = e.company_id
  left join public.sites s on s.id = e.site_id
 where e.archive_le is null
   and e.date_sortie is null
   and e.jour_de_repos is null
 order by c.name, e.matricule;
