-- ============================================================================
--  SORTIR MHIROU ANAS
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  Marqué sorti fin août et archivé : il quitte la liste des employés et
--  la paie. Rien n'est supprimé — pointages, contrats et bulletins passés
--  restent. Ses journées de septembre et ses lignes de paie non validées
--  lui sont retirées.
--
--  Le tableau en fin de script dit qui a été touché : vérifiez le nom et
--  la société. S'il y en a plusieurs, dites-le-moi plutôt que de relancer.
-- ============================================================================

do $bloc$
declare
  v_ids uuid[];
  v_n int;
begin
  select array_agg(e.id) into v_ids
    from public.employees e
   where e.archive_le is null
     and upper(regexp_replace(e.nom_prenom, '\s+', ' ', 'g')) like '%MHIROU%ANAS%';

  if v_ids is null then
    raise exception 'Aucun MHIROU ANAS parmi les employés actifs.';
  end if;
  raise notice '% fiche(s) concernée(s).', array_length(v_ids, 1);

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

  update public.employees
     set date_sortie = coalesce(date_sortie, '2026-08-31'::date),
         archive_le = coalesce(archive_le, now())
   where id = any(v_ids);

  delete from public.lignes_paie lp
   using public.periodes_paie pp
   where lp.periode_id = pp.id
     and lp.employee_id = any(v_ids)
     and pp.statut <> 'paie_validee';
  get diagnostics v_n = row_count;
  raise notice '% ligne(s) de paie retirée(s).', v_n;
end $bloc$;

select c.name as societe, e.matricule, e.nom_prenom,
       case when e.actif then 'EN POSTE' else 'SORTI' end as statut,
       to_char(e.date_sortie, 'DD/MM/YYYY') as date_sortie,
       case when e.archive_le is null then '' else 'ARCHIVÉ' end as archive
  from public.employees e
  join public.companies c on c.id = e.company_id
 where upper(regexp_replace(e.nom_prenom, '\s+', ' ', 'g')) like '%MHIROU%ANAS%'
 order by c.name;
