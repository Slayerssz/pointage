-- ============================================================
-- 036 — Les jours travaillés du mois, et non depuis toujours
-- À exécuter après 035_archivage_sorties.sql
--
-- `employees.jours_travailles` est un compteur qui monte sans jamais
-- redescendre : il dit combien de jours la personne a faits en tout,
-- ce qui ne renseigne sur rien. Ce qu'on veut savoir, c'est combien
-- elle en a fait en mars.
--
-- Le calcul se lit dans les pointages validés, mois par mois. Rien
-- n'est stocké : le compteur d'origine reste en place pour la paie.
-- ============================================================

create or replace function public.jours_du_mois(
  p_company uuid,
  p_annee int,
  p_mois int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  perform public.exiger_role('admin', 'validator', 'rh', 'paie');

  select coalesce(jsonb_object_agg(x.employee_id, x.compte), '{}'::jsonb)
    into v_res
    from (
      select p.employee_id,
             jsonb_build_object(
               'travailles', count(*) filter (
                 where coalesce(p.type_garde, 'X') not in ('C', 'M', 'X05')),
               'conge', count(*) filter (where p.type_garde = 'C'),
               'maladie', count(*) filter (where p.type_garde = 'M'),
               'repos', count(*) filter (where p.type_garde = 'X05')
             ) as compte
        from public.pointages p
       where p.company_id = p_company
         and p.status = 'validated'
         and date_part('year', p.pointed_on)::int = p_annee
         and date_part('month', p.pointed_on)::int = p_mois
       group by p.employee_id
    ) x;

  return v_res;
end;
$$;

revoke all on function public.jours_du_mois(uuid, int, int) from public;
grant execute on function public.jours_du_mois(uuid, int, int) to authenticated;
