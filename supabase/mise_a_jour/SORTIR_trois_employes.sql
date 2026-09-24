-- ============================================================================
--  SORTIR TROIS EMPLOYÉS
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--     TRIMAX          matricule 61   BAKHADDA BADR EDDINE
--     TRIMAX          matricule 51   ES SIH OMAR
--     EDEN VERT       (par le nom)   AMAICH HOUDA
--
--  Marqués sortis fin août et archivés : ils quittent la liste des
--  employés et la paie. Rien n'est supprimé — pointages, contrats et
--  bulletins passés restent.
--
--  Leurs journées de septembre posées par le remplissage leur sont
--  retirées, et leurs lignes de paie non validées avec.
--
--  Le tableau en fin de script dit qui a été touché : vérifiez les trois
--  noms et les deux sociétés avant de passer à autre chose.
-- ============================================================================

do $bloc$
declare
  v_ids uuid[];
  v_n int;
begin
  select array_agg(e.id) into v_ids
    from public.employees e
    join public.companies c on c.id = e.company_id
   where e.archive_le is null
     and (
       (upper(trim(c.name)) like 'TRIMAX%' and e.matricule in (51, 61))
       or (upper(trim(c.name)) like 'EDEN VERT%'
           and upper(regexp_replace(e.nom_prenom, '\s+', ' ', 'g')) like '%AMAICH%HOUDA%')
     );

  if v_ids is null then
    raise exception 'Aucun des trois n''a été trouvé parmi les employés actifs.';
  end if;
  raise notice '% fiche(s) concernée(s).', array_length(v_ids, 1);

  -- Les journées de septembre.
  update public.employees e
     set jours_travailles = greatest(0, e.jours_travailles - s.n)
    from (select employee_id, count(*) as n
            from public.pointages
           where employee_id = any(v_ids) and pointed_on >= '2026-09-01'
           group by employee_id) s
   where e.id = s.employee_id;

  delete from public.pointages
   where employee_id = any(v_ids) and pointed_on >= '2026-09-01';
  get diagnostics v_n = row_count;
  raise notice '% pointage(s) de septembre retiré(s).', v_n;

  -- Sortis fin août, puis archivés.
  update public.employees
     set date_sortie = coalesce(date_sortie, '2026-08-31'::date),
         archive_le = coalesce(archive_le, now())
   where id = any(v_ids);

  -- Et leurs lignes de paie des mois non validés.
  delete from public.lignes_paie lp
   using public.periodes_paie pp
   where lp.periode_id = pp.id
     and lp.employee_id = any(v_ids)
     and pp.statut <> 'paie_validee';
  get diagnostics v_n = row_count;
  raise notice '% ligne(s) de paie retirée(s).', v_n;
end $bloc$;

-- Qui a été touché.
select c.name as societe, e.matricule, e.nom_prenom,
       case when e.actif then 'EN POSTE' else 'SORTI' end as statut,
       to_char(e.date_sortie, 'DD/MM/YYYY') as date_sortie,
       case when e.archive_le is null then '' else 'ARCHIVÉ' end as archive
  from public.employees e
  join public.companies c on c.id = e.company_id
 where (upper(trim(c.name)) like 'TRIMAX%' and e.matricule in (51, 61))
    or upper(regexp_replace(e.nom_prenom, '\s+', ' ', 'g')) like '%AMAICH%HOUDA%'
 order by c.name, e.matricule;
