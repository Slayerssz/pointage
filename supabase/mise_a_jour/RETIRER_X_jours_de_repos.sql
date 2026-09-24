-- ============================================================================
--  RETIRER LES X POSÉS SUR LES JOURS DE REPOS
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  Quand septembre a été rempli, la plupart des fiches n'avaient pas de
--  jour de repos : tout le monde a donc reçu un X les dimanches aussi.
--  Les repos sont maintenant saisis — ce script retire les X que le
--  remplissage avait posés sur le jour de repos de chacun.
--
--  Ne touche QUE les journées du remplissage (marquées du même horodatage)
--  et QUE celles tombant sur le jour de repos de la personne. Un X saisi
--  à la main, un congé, un férié : rien de tout cela n'est concerné.
--
--  Sans danger si les repos changent encore : relancez-le, il retirera
--  simplement les nouveaux cas.
-- ============================================================================

-- ▶ 1. APERÇU — ce qui serait retiré. Rien n'est écrit.
--    Sélectionnez ces lignes seules, puis Run.

select c.name as societe,
       count(*)                       as journees_a_retirer,
       count(distinct e.id)           as employes
  from public.pointages p
  join public.employees e on e.id = p.employee_id
  join public.companies c on c.id = e.company_id
 where p.pointed_at = '2026-09-01 00:00:00+01'
   and p.type_garde = 'X'
   and e.jour_de_repos is not null
   and extract(isodow from p.pointed_on)::int = e.jour_de_repos
 group by c.name
 order by c.name;


-- ▶ 2. LE RETRAIT — sélectionnez de « do $bloc$ » à « end $bloc$; », puis Run.

do $bloc$
declare
  v_marque timestamptz := '2026-09-01 00:00:00+01';
  v_n int;
begin
  -- Le compteur de la fiche suit, comme pour toute journée retirée.
  update public.employees e
     set jours_travailles = greatest(0, e.jours_travailles - s.n)
    from (select p.employee_id, count(*) as n
            from public.pointages p
            join public.employees x on x.id = p.employee_id
           where p.pointed_at = v_marque
             and p.type_garde = 'X'
             and x.jour_de_repos is not null
             and extract(isodow from p.pointed_on)::int = x.jour_de_repos
           group by p.employee_id) s
   where e.id = s.employee_id;

  delete from public.pointages p
   using public.employees e
   where e.id = p.employee_id
     and p.pointed_at = v_marque
     and p.type_garde = 'X'
     and e.jour_de_repos is not null
     and extract(isodow from p.pointed_on)::int = e.jour_de_repos;

  get diagnostics v_n = row_count;
  raise notice '% journée(s) de repos retirée(s).', v_n;
end $bloc$;


-- ▶ 3. CONTRÔLE — il ne doit plus rester aucun X sur un jour de repos.

-- select count(*) as restants
--   from public.pointages p
--   join public.employees e on e.id = p.employee_id
--  where p.type_garde = 'X'
--    and e.jour_de_repos is not null
--    and extract(isodow from p.pointed_on)::int = e.jour_de_repos
--    and p.pointed_on >= '2026-09-01';
