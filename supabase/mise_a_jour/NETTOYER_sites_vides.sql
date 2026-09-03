-- ============================================================================
--  SUPPRIMER LES ANNEXES SANS PERSONNE
--  ============================================================
--  Supabase → SQL Editor → coller → Run.
--
--  L'import a créé une annexe pour chaque site cité par vos états. Celles
--  qui n'ont finalement aucun employé encombrent les listes déroulantes
--  et les filtres sans rien désigner : elles partent.
--
--  Une annexe à laquelle des pointages restent rattachés est conservée —
--  la supprimer les laisserait orphelins. Le script les liste à la fin.
--  Les sites principaux vidés de toutes leurs annexes partent aussi.
-- ============================================================================

begin;

  do $bloc$
  declare
    v_vides int; v_gardees int; v_principaux int;
  begin
    select count(*) into v_vides
      from public.sites s
     where not exists (select 1 from public.employees e where e.site_id = s.id)
       and not exists (select 1 from public.pointages p where p.site_id = s.id);

    select count(*) into v_gardees
      from public.sites s
     where not exists (select 1 from public.employees e where e.site_id = s.id)
       and exists (select 1 from public.pointages p where p.site_id = s.id);

    raise notice '% annexe(s) vide(s) supprimée(s), % gardée(s) pour leurs pointages.',
      v_vides, v_gardees;
  end $bloc$;

  delete from public.sites s
   where not exists (select 1 from public.employees e where e.site_id = s.id)
     and not exists (select 1 from public.pointages p where p.site_id = s.id);

  -- Un site principal qui n'a plus aucune annexe ne regroupe plus rien.
  delete from public.sites_principaux sp
   where not exists (select 1 from public.sites s where s.site_principal_id = sp.id);

commit;


-- ▶ Ce qu'il reste, société par société
select co.name as societe,
       count(s.id) as annexes,
       count(s.id) filter (
         where not exists (select 1 from public.employees e where e.site_id = s.id)
       ) as encore_vides_car_pointees
  from public.companies co
  left join public.sites s on s.company_id = co.id
 group by co.name
 order by co.name;
