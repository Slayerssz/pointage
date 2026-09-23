-- ============================================================================
--  MEGAINTER : SORTIR LES MATRICULES 11 ET 12
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  Ces deux-là ne travaillent plus avec le groupe. On les marque sortis
--  et on les archive : ils quittent la liste des employés ET la paie.
--
--  Rien n'est supprimé — leurs pointages, contrats et bulletins passés
--  restent. Le remplissage de septembre leur avait posé des X : ils sont
--  retirés eux aussi, sans quoi la paie continuerait de les compter.
-- ============================================================================

do $bloc$
declare
  v_ids uuid[];
  v_n int;
begin
  select array_agg(e.id) into v_ids
    from public.employees e
    join public.companies c on c.id = e.company_id
   where upper(trim(c.name)) like 'MEGAINTER%'
     and e.matricule in (11, 12);

  if v_ids is null then
    raise exception 'Aucun employé 11 ou 12 chez MEGAINTER : rien à faire.';
  end if;

  -- Les journées du mois en cours, posées par le remplissage automatique.
  update public.employees e
     set jours_travailles = greatest(0, e.jours_travailles - s.n)
    from (select employee_id, count(*) as n
            from public.pointages
           where employee_id = any(v_ids)
             and pointed_on >= date_trunc('month', current_date)::date
           group by employee_id) s
   where e.id = s.employee_id;

  delete from public.pointages
   where employee_id = any(v_ids)
     and pointed_on >= date_trunc('month', current_date)::date;
  get diagnostics v_n = row_count;
  raise notice '% pointage(s) du mois retiré(s).', v_n;

  -- Sortis, puis archivés : « actif » se déduit de la date de sortie.
  update public.employees
     set date_sortie = coalesce(date_sortie, (date_trunc('month', current_date) - interval '1 day')::date),
         archive_le = coalesce(archive_le, now())
   where id = any(v_ids);

  -- Et leurs lignes de paie du mois en cours, devenues sans objet.
  delete from public.lignes_paie lp
   using public.periodes_paie pp
   where lp.periode_id = pp.id
     and lp.employee_id = any(v_ids)
     and pp.annee = date_part('year', current_date)::int
     and pp.mois = date_part('month', current_date)::int
     and pp.statut <> 'paie_validee';
  get diagnostics v_n = row_count;
  raise notice '% ligne(s) de paie retirée(s).', v_n;
end $bloc$;

-- Le résultat : MEGAINTER ne doit plus montrer que ses employés en poste.
select e.matricule, e.nom_prenom,
       case when e.actif then 'EN POSTE' else 'SORTI' end as statut,
       case when e.archive_le is null then '' else 'ARCHIVÉ' end as archive
  from public.employees e
  join public.companies c on c.id = e.company_id
 where upper(trim(c.name)) like 'MEGAINTER%'
 order by e.matricule;
