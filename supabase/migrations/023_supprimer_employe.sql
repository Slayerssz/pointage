-- ============================================================
-- 023 — Supprimer un employé (avec garde-fous)
-- À exécuter après 022_gestion_utilisateurs.sql
--
-- Toutes les tables liées à un employé sont en « on delete cascade » :
-- pointages, contrats, congés, dettes ET lignes de paie. Supprimer un
-- employé effacerait donc aussi son historique de paie.
--
-- Règle retenue : dès qu'un employé est passé dans une paie, il n'est
-- plus supprimable — on le marque « Sorti ». La suppression ne sert
-- qu'à corriger une fiche créée par erreur.
-- ============================================================

-- 1. Ce que la suppression entraînerait ---------------------------------------

create or replace function public.apercu_suppression_employe(p_employee_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_nom text;
begin
  perform public.exiger_role('validator', 'admin');

  select nom_prenom into v_nom from public.employees where id = p_employee_id;
  if v_nom is null then
    raise exception 'Employé introuvable';
  end if;

  select jsonb_build_object(
    'nom_prenom', v_nom,
    'pointages', (select count(*) from public.pointages where employee_id = p_employee_id),
    'photos',    (select count(*) from public.pointages
                   where employee_id = p_employee_id and photo_path is not null),
    'contrats',  (select count(*) from public.contrats where employee_id = p_employee_id),
    'conges',    (select count(*) from public.conges where employee_id = p_employee_id),
    'dettes',    (select count(*) from public.dettes where employee_id = p_employee_id),
    'dette_restante', (select coalesce(sum(montant_total - montant_rembourse), 0)
                        from public.dettes where employee_id = p_employee_id and not soldee),
    'lignes_paie', (select count(*) from public.lignes_paie where employee_id = p_employee_id),
    'mois_de_paie', (select coalesce(jsonb_agg(distinct (pp.mois || '/' || pp.annee)), '[]'::jsonb)
                      from public.lignes_paie lp
                      join public.periodes_paie pp on pp.id = lp.periode_id
                      where lp.employee_id = p_employee_id)
  ) into v;

  -- Supprimable seulement si l'employé n'est jamais entré dans une paie
  return v || jsonb_build_object('supprimable', (v->>'lignes_paie')::int = 0);
end;
$$;

revoke all on function public.apercu_suppression_employe(uuid) from public;
grant execute on function public.apercu_suppression_employe(uuid) to authenticated;

-- 2. La suppression elle-même ---------------------------------------------------

create or replace function public.supprimer_employe(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text;
  v_paie int;
  v_company uuid;
  v_verrou int;
begin
  perform public.exiger_role('validator', 'admin');

  select nom_prenom, company_id into v_nom, v_company
    from public.employees where id = p_employee_id;
  if v_nom is null then
    raise exception 'Employé introuvable';
  end if;

  -- Jamais supprimable s'il est déjà passé dans une paie
  select count(*) into v_paie from public.lignes_paie where employee_id = p_employee_id;
  if v_paie > 0 then
    raise exception
      '% figure dans % bulletin(s) de paie : le supprimer effacerait cet historique. Marquez-le « Sorti » à la place.',
      v_nom, v_paie;
  end if;

  -- Ni s'il a des pointages dans un mois déjà clôturé
  select count(*) into v_verrou
    from public.pointages p
    join public.periodes_paie pp
      on pp.company_id = p.company_id
     and pp.annee = date_part('year', p.pointed_on)::int
     and pp.mois  = date_part('month', p.pointed_on)::int
   where p.employee_id = p_employee_id
     and pp.statut <> 'ouvert';
  if v_verrou > 0 then
    raise exception
      '% a des pointages dans un mois clôturé : il ne peut pas être supprimé. Marquez-le « Sorti ».', v_nom;
  end if;

  -- Les tables liées partent en cascade (pointages, contrats, congés, dettes)
  delete from public.employees where id = p_employee_id;
end;
$$;

revoke all on function public.supprimer_employe(uuid) from public;
grant execute on function public.supprimer_employe(uuid) to authenticated;
