-- ============================================================================
--  MEGAINTER SERVICE MAROC — l'orthographe du papier
--  ============================================================
--  La société est enregistrée « MEGANTER » en base, mais son contrat, son
--  logo et son en-tête portent « MEGAINTER », avec un i. C'est le papier
--  qui fait foi.
--
--  L'application reconnaît déjà les deux graphies : ce script n'est donc
--  pas urgent, il remet simplement la base d'accord avec les documents.
-- ============================================================================

-- ▶ Avant : quelle graphie porte la base ?
select name, length(name) as longueur,
       (select count(*) from public.employees e where e.company_id = c.id) as employes
  from public.companies c
 where upper(trim(c.name)) like 'MEG%';

update public.companies
   set name = 'MEGAINTER SERVICE MAROC'
 where upper(trim(name)) = 'MEGANTER SERVICE MAROC';

-- ▶ Après : la base et le papier disent la même chose
select name, (select count(*) from public.employees e where e.company_id = c.id) as employes
  from public.companies c
 where upper(trim(c.name)) like 'MEG%';
