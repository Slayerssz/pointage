-- ============================================================
-- BLOC 55 — Poser la journée, et non l'inscrire une seule fois
-- À exécuter après le BLOC 54. Une instruction à la fois.
--
-- « Cet employé a déjà un pointage ce jour-là. » Le bureau cliquait sur
-- une case pour la corriger et se faisait refuser : marquer_present
-- savait créer une journée, pas en changer une. Il fallait alors deviner
-- si la case portait déjà quelque chose — et, quand l'agent avait envoyé
-- une photo le matin, la journée existait en attente, invisible à qui
-- voulait simplement écrire R.
--
-- Désormais la fonction POSE la lettre demandée : elle crée la journée
-- si elle manque, la remplace si elle est là. Un seul geste, le même
-- résultat, qu'on clique une fois ou dix.
--
-- Deux refus demeurent, parce qu'ils protègent autre chose que la case :
--   — un jour de congé enregistré se modifie depuis le congé, sinon le
--     solde de l'agent et son pointage se contrediraient ;
--   — un mois clôturé ne se retouche pas.
--
-- Le compteur de journées travaillées suit : on retire ce que valait la
-- lettre d'avant, on ajoute ce que vaut la nouvelle. Une journée encore
-- en attente n'avait rien été comptée — on n'en retire donc rien.
-- ============================================================

create or replace function public.marquer_present(
  p_employee_id uuid,
  p_date date,
  p_type text default 'X'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_company uuid;
  v_site uuid;
  -- La journée déjà posée sur cette case, s'il y en a une.
  v_id uuid;
  v_status public.pointage_status;
  v_ancien text;
  v_conge uuid;
begin
  if coalesce(p_type, '') not in
     ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ', 'F', 'XF', 'R') then
    raise exception 'Type de garde invalide';
  end if;

  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin', 'rh') then
    raise exception 'Réservé aux validateurs';
  end if;

  if p_date > (now() at time zone 'Africa/Casablanca')::date then
    raise exception 'Impossible de marquer un jour dans le futur';
  end if;

  select company_id, site_id into v_company, v_site
    from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Employé introuvable';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;

  perform public.assert_mois_ouvert(v_company, p_date);

  -- Un pointage refusé ne compte pas : la journée est libre.
  select id, status, type_garde, conge_id
    into v_id, v_status, v_ancien, v_conge
    from public.pointages
   where employee_id = p_employee_id
     and pointed_on = p_date
     and status <> 'refused'
   limit 1
   for update;

  if v_id is not null then
    if v_conge is not null then
      raise exception 'Ce jour fait partie d''un congé : modifiez ou supprimez le congé.';
    end if;

    -- La photo de l'agent reste attachée : elle prouve qu'il est venu,
    -- même si le bureau corrige la lettre.
    update public.pointages
       set type_garde = p_type,
           status = 'validated',
           validated_by = auth.uid(),
           validated_at = now(),
           ferie_id = case when p_type = 'F' then ferie_id else null end
     where id = v_id;

    update public.employees
       set jours_travailles = greatest(0, jours_travailles
             + public.garde_valeur(p_type)
             - case when v_status = 'validated'
                    then public.garde_valeur(coalesce(v_ancien, 'X'))
                    else 0 end)
     where id = p_employee_id;
    return;
  end if;

  perform set_config('app.pointage_manuel', 'on', true);
  insert into public.pointages
    (company_id, site_id, employee_id, agent_id, photo_path,
     pointed_at, pointed_on, status, type_garde, validated_by, validated_at)
  values
    (v_company, v_site, p_employee_id, auth.uid(), null,
     now(), p_date, 'validated', p_type, auth.uid(), now());
  perform set_config('app.pointage_manuel', 'off', true);

  update public.employees
     set jours_travailles = jours_travailles + public.garde_valeur(p_type)
   where id = p_employee_id;
end;
$$;

revoke all on function public.marquer_present(uuid, date, text) from public;
grant execute on function public.marquer_present(uuid, date, text) to authenticated;

-- Changer le type depuis une ligne précise garde son usage (la liste des
-- pointages à valider, la conversion d'un férié). On l'aligne sur le
-- même personnel et le même contrôle de société que le reste.

create or replace function public.changer_type_garde(p_pointage_id uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_employee uuid;
  v_status public.pointage_status;
  v_ancien text;
  v_company uuid;
  v_date date;
  v_conge uuid;
begin
  if coalesce(p_type, '') not in
     ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ', 'F', 'XF', 'R') then
    raise exception 'Type de garde invalide';
  end if;

  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin', 'rh') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, status, type_garde, company_id, pointed_on, conge_id
    into v_employee, v_status, v_ancien, v_company, v_date, v_conge
    from public.pointages where id = p_pointage_id for update;
  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;
  if v_status = 'refused' then
    raise exception 'Ce pointage a été refusé : repointez la journée.';
  end if;
  if v_conge is not null then
    raise exception 'Ce jour fait partie d''un congé : modifiez ou supprimez le congé.';
  end if;

  perform public.assert_mois_ouvert(v_company, v_date);

  update public.pointages
     set type_garde = p_type,
         status = 'validated',
         validated_by = auth.uid(),
         validated_at = now(),
         ferie_id = case when p_type = 'F' then ferie_id else null end
   where id = p_pointage_id;

  update public.employees
     set jours_travailles = greatest(0, jours_travailles
           + public.garde_valeur(p_type)
           - case when v_status = 'validated'
                  then public.garde_valeur(coalesce(v_ancien, 'X'))
                  else 0 end)
   where id = v_employee;
end;
$$;

revoke all on function public.changer_type_garde(uuid, text) from public;
grant execute on function public.changer_type_garde(uuid, text) to authenticated;
