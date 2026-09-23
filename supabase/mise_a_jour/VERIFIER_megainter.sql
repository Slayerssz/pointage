-- ============================================================================
--  MEGAINTER : QUI EST DANS LA PAIE, ET POURQUOI
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  La paie prend deux sortes de gens : ceux qui sont en poste, et ceux
--  qui ont un pointage sur le mois même s'ils sont partis — sinon un
--  départ en milieu de mois perdrait ses journées. Cette requête montre
--  lesquels, et ce qui les retient.
-- ============================================================================

select e.matricule,
       e.nom_prenom,
       s.name                                    as site,
       case when e.actif then 'EN POSTE' else 'SORTI' end as statut,
       to_char(e.date_sortie, 'DD/MM/YYYY')      as date_sortie,
       case when e.archive_le is null then '' else 'ARCHIVÉ' end as archive,
       coalesce((select count(*) from public.pointages p
                  where p.employee_id = e.id
                    and p.status = 'validated'
                    and p.pointed_on between date_trunc('month', current_date)::date
                                         and (date_trunc('month', current_date)
                                              + interval '1 month - 1 day')::date), 0)
                                                 as pointages_ce_mois
  from public.employees e
  join public.companies c on c.id = e.company_id
  left join public.sites s on s.id = e.site_id
 where upper(trim(c.name)) like 'MEGAINTER%'
 order by e.matricule;
