-- ============================================================================
--  EFFACER LES POINTAGES DE DÉMONSTRATION
--  ============================================================
--  Supabase → SQL Editor → coller → Run.
--
--  Efface TOUS les pointages, ainsi que les périodes de paie et les
--  bulletins qui en découlaient — sans eux, ces périodes réclameraient
--  des jours qui n'existent plus.
--
--  Ne touche à rien d'autre : employés, sites, sociétés, contrats,
--  congés, sorties et comptes restent en place.
--
--  ⚠ À n'utiliser que tant qu'aucune vraie journée n'a été pointée.
-- ============================================================================

begin;

  -- Ce qui va disparaître, pour mémoire dans le journal
  do $bloc$
  declare
    v_p int; v_l int; v_pp int;
  begin
    select count(*) into v_p  from public.pointages;
    select count(*) into v_l  from public.lignes_paie;
    select count(*) into v_pp from public.periodes_paie;
    raise notice 'Effacement : % pointage(s), % ligne(s) de paie, % période(s).',
      v_p, v_l, v_pp;
  end $bloc$;

  delete from public.lignes_paie;
  delete from public.periodes_paie;
  delete from public.pointages;

  -- Le compteur de jours travaillés repart de zéro.
  update public.employees set jours_travailles = 0 where jours_travailles <> 0;

commit;


-- ▶ Contrôle : tout doit être à zéro
select (select count(*) from public.pointages)      as pointages,
       (select count(*) from public.periodes_paie)  as periodes_de_paie,
       (select count(*) from public.lignes_paie)    as lignes_de_paie,
       (select count(*) from public.employees where jours_travailles <> 0) as compteurs_non_nuls;
