-- ============================================================
-- 061 — Un nouvel arrivant est pointé dès son inscription
-- À exécuter après 060_jours_payes_bornes.sql
--
-- Le mois est rempli d'avance : tout le monde est présent, et le bureau
-- ne corrige que les absences. Quelqu'un inscrit en cours de mois
-- arrivait donc avec un mois vide, et paraissait n'avoir rien fait.
--
-- Cette fonction lui pose ses journées, de son embauche (ou du premier
-- du mois, au plus tard) jusqu'à aujourd'hui. Elle épargne son jour de
-- repos — d'où son caractère obligatoire à la saisie — et ne touche à
-- rien de ce qui est déjà marqué.
--
-- Elle ne pointe jamais l'avenir, ni au-delà d'une date de sortie, ni
-- sur un mois clôturé.
-- ============================================================

create or replace function public.pointer_depuis_embauche(p_employee uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_site uuid;
  v_repos int;
  v_embauche date;
  v_sortie date;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
  v_debut date;
  v_fin date;
  v_n int := 0;
begin
  select company_id, site_id, jour_de_repos, date_embauche, date_sortie
    into v_company, v_site, v_repos, v_embauche, v_sortie
    from public.employees where id = p_employee;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;

  -- Du premier du mois, ou de l'embauche si elle est plus tardive.
  v_debut := greatest(coalesce(v_embauche, v_today), date_trunc('month', v_today)::date);
  v_fin := least(v_today, coalesce(v_sortie, v_today));
  if v_debut > v_fin then
    return 0;
  end if;

  perform public.assert_mois_ouvert(v_company, v_debut);

  perform set_config('app.pointage_manuel', 'on', true);

  with inscrits as (
    insert into public.pointages
      (company_id, site_id, employee_id, agent_id, photo_path,
       pointed_at, pointed_on, status, type_garde, validated_by, validated_at)
    select v_company, v_site, p_employee, auth.uid(), null,
           now(), d::date, 'validated', 'X', auth.uid(), now()
      from generate_series(v_debut, v_fin, interval '1 day') d
     where not (v_repos is not null and extract(isodow from d)::int = v_repos)
       and not exists (select 1 from public.pointages p
                        where p.employee_id = p_employee and p.pointed_on = d::date
                          and p.status <> 'refused')
    returning 1
  )
  select count(*) into v_n from inscrits;

  update public.employees
     set jours_travailles = jours_travailles + v_n
   where id = p_employee;

  perform set_config('app.pointage_manuel', 'off', true);
  return v_n;
end;
$$;

revoke all on function public.pointer_depuis_embauche(uuid) from public;
grant execute on function public.pointer_depuis_embauche(uuid) to authenticated;
