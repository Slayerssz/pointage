-- ============================================================================
--  ANNULER LE REMPLISSAGE DE SEPTEMBRE 2026
--  ============================================================
--  Supabase → SQL Editor → coller TOUT ce fichier → Run.
--
--  Retire uniquement les X que REMPLIR_septembre_present.sql avait posés,
--  et remet les compteurs. Les X que le bureau a depuis passés en M, C ou
--  autre ne sont pas concernés : ils ont changé de lettre.
-- ============================================================================

do $annule$
declare
  v_marque timestamptz := '2026-09-01 00:00:00+01';
  v_n int;
begin
  update public.employees e
     set jours_travailles = greatest(0, jours_travailles - s.n)
    from (select employee_id, count(*) as n
            from public.pointages
           where pointed_at = v_marque and type_garde = 'X'
           group by employee_id) s
   where s.employee_id = e.id;

  delete from public.pointages where pointed_at = v_marque and type_garde = 'X';
  get diagnostics v_n = row_count;
  raise notice '% journées retirées.', v_n;
end $annule$;
