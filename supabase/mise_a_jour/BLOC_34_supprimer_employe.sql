-- ============================================================================
--  BLOC 34 sur 35 — Supprimer un employé redevient possible
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 33.
--
--  Depuis le BLOC 33, la paie du mois est toujours ouverte : chaque
--  employé y a une ligne dès le premier jour du mois. Or la suppression
--  refusait quiconque figurait « dans une paie » — donc tout le monde.
--
--  Le garde-fou visait l'historique, pas le mois en cours. Il ne regarde
--  plus que les mois VALIDÉS : ceux-là restent intouchables, et l'on
--  peut de nouveau supprimer quelqu'un ajouté par erreur.
--
--  L'administrateur ET le bureau peuvent supprimer, comme avant.
-- ============================================================================

-- ============================================================
-- 051 — Supprimer un employé malgré la paie du mois en cours
-- À exécuter après 050_paie_toujours_ouverte.sql
--
-- Depuis que la paie du mois est toujours ouverte (BLOC 33), chaque
-- employé en poste a une ligne de paie dès le premier jour du mois.
-- Or la suppression refusait quiconque figurait « dans une paie » —
-- ce qui, désormais, veut dire tout le monde. Plus personne ne
-- pouvait être supprimé.
--
-- Le garde-fou visait l'HISTORIQUE, pas le mois en cours : une ligne
-- d'un mois ouvert n'est qu'un calcul, refait à chaque consultation.
-- Seules comptent désormais les lignes d'un mois validé.
-- ============================================================

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
  v_dette numeric;
begin
  perform public.exiger_role('validator', 'admin');

  select nom_prenom, dette into v_nom, v_dette
    from public.employees where id = p_employee_id;
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
    'documents', (select count(*) from public.documents where employee_id = p_employee_id),
    'dette_restante', coalesce(v_dette, 0),
    -- Seuls les mois VALIDÉS comptent : eux seuls sont de l'histoire.
    'lignes_paie', (select count(*) from public.lignes_paie lp
                     join public.periodes_paie pp on pp.id = lp.periode_id
                    where lp.employee_id = p_employee_id
                      and pp.statut = 'paie_validee'),
    'mois_de_paie', (select coalesce(jsonb_agg(distinct (pp.mois || '/' || pp.annee)), '[]'::jsonb)
                      from public.lignes_paie lp
                      join public.periodes_paie pp on pp.id = lp.periode_id
                      where lp.employee_id = p_employee_id
                        and pp.statut = 'paie_validee')
  ) into v;

  return v || jsonb_build_object('supprimable', (v->>'lignes_paie')::int = 0);
end;
$$;

create or replace function public.supprimer_employe(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text;
  v_paie int;
  v_verrou int;
begin
  perform public.exiger_role('validator', 'admin');

  select nom_prenom into v_nom
    from public.employees where id = p_employee_id;
  if v_nom is null then
    raise exception 'Employé introuvable';
  end if;

  -- Jamais supprimable s'il est passé dans une paie VALIDÉE : c'est
  -- l'historique. Une ligne du mois en cours, elle, n'est qu'un calcul.
  select count(*) into v_paie
    from public.lignes_paie lp
    join public.periodes_paie pp on pp.id = lp.periode_id
   where lp.employee_id = p_employee_id
     and pp.statut = 'paie_validee';
  if v_paie > 0 then
    raise exception
      '% figure dans % bulletin(s) de paie validés : le supprimer effacerait cet historique. Déclarez plutôt son départ dans Sorties.',
      v_nom, v_paie;
  end if;

  -- Ni s'il a des pointages dans un mois clôturé. « Ouvert » et
  -- « validation demandée » ne clôturent rien : le mois peut encore
  -- être rouvert, et ses lignes sont recalculées.
  select count(*) into v_verrou
    from public.pointages p
    join public.periodes_paie pp
      on pp.company_id = p.company_id
     and pp.annee = date_part('year', p.pointed_on)::int
     and pp.mois  = date_part('month', p.pointed_on)::int
   where p.employee_id = p_employee_id
     and pp.statut = 'paie_validee';
  if v_verrou > 0 then
    raise exception
      '% a des pointages dans un mois validé : il ne peut pas être supprimé. Déclarez plutôt son départ dans Sorties.', v_nom;
  end if;

  -- Les lignes des mois encore ouverts s'en vont avec lui : elles ne
  -- représentent rien d'autre que le calcul du moment.
  delete from public.lignes_paie lp
   using public.periodes_paie pp
   where lp.periode_id = pp.id
     and lp.employee_id = p_employee_id
     and pp.statut <> 'paie_validee';

  -- Le reste part en cascade (pointages, contrats, congés, dettes).
  delete from public.employees where id = p_employee_id;
end;
$$;

revoke all on function public.apercu_suppression_employe(uuid) from public;
revoke all on function public.supprimer_employe(uuid) from public;
grant execute on function public.apercu_suppression_employe(uuid) to authenticated;
grant execute on function public.supprimer_employe(uuid) to authenticated;
