-- ============================================================================
--  SORTIR OULAD M'HIROU ANAS — GROUPE TRIPLE A, MATRICULE 1042
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  Visé par son matricule et sa société, pas par son nom : l'apostrophe
--  de « M'HIROU » avait fait échouer la recherche précédente.
--
--  Il est déjà marqué SORTI mais pas archivé — c'est pour cela qu'il
--  figure encore dans les listes. Ce script l'archive, lui retire ses
--  journées de septembre et ses lignes de paie non validées.
--
--  Rien n'est supprimé : pointages, contrats et bulletins passés restent.
-- ============================================================================

do $bloc$
declare
  v_id uuid;
  v_n int;
begin
  select e.id into v_id
    from public.employees e
    join public.companies c on c.id = e.company_id
   where e.matricule = 1042
     and upper(trim(c.name)) like 'GROUPE TRIPLE%';

  if v_id is null then
    raise exception 'Aucun matricule 1042 chez Groupe Triple A.';
  end if;

  update public.employees e
     set jours_travailles = greatest(0, e.jours_travailles - s.n)
    from (select employee_id, count(*) as n
            from public.pointages
           where employee_id = v_id and pointed_on >= '2026-09-01'
           group by employee_id) s
   where e.id = s.employee_id;

  delete from public.pointages
   where employee_id = v_id and pointed_on >= '2026-09-01';
  get diagnostics v_n = row_count;
  raise notice '% pointage(s) de septembre retiré(s).', v_n;

  update public.employees
     set date_sortie = coalesce(date_sortie, '2026-08-31'::date),
         archive_le = coalesce(archive_le, now())
   where id = v_id;

  delete from public.lignes_paie lp
   using public.periodes_paie pp
   where lp.periode_id = pp.id
     and lp.employee_id = v_id
     and pp.statut <> 'paie_validee';
  get diagnostics v_n = row_count;
  raise notice '% ligne(s) de paie retirée(s).', v_n;
end $bloc$;

select c.name as societe, e.matricule, e.nom_prenom,
       case when e.actif then 'EN POSTE' else 'SORTI' end as statut,
       to_char(e.date_sortie, 'DD/MM/YYYY') as date_sortie,
       case when e.archive_le is null then '⚠ PAS ARCHIVÉ' else 'ARCHIVÉ' end as archive
  from public.employees e
  join public.companies c on c.id = e.company_id
 where e.matricule = 1042
   and upper(trim(c.name)) like 'GROUPE TRIPLE%';
