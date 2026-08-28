-- ============================================================
-- 026 — Une seule dette par employé, un simple solde
-- À exécuter après 025_dossier_employe.sql
--
-- Avant : une liste de dettes par employé, chacune avec un libellé et
-- un suivi de remboursement. Trop lourd pour l'usage réel.
--
-- Maintenant : UN montant sur la fiche de l'employé — ce qu'il doit.
-- Dans la paie on saisit ce qu'on retient ce mois-ci (ex. 500) ; à la
-- validation, le solde baisse d'autant (1500 → 1000). Rouvrir le mois
-- remet le solde comme avant.
-- ============================================================

-- 1. Le solde, sur la fiche de l'employé --------------------------------------

alter table public.employees
  add column if not exists dette numeric(10, 2) not null default 0
    check (dette >= 0);

-- Reprendre ce qui restait dû dans l'ancien système
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'dettes') then
    update public.employees e
       set dette = coalesce(r.reste, 0)
      from (select employee_id,
                   sum(greatest(0, montant_total - montant_rembourse)) as reste
              from public.dettes
             where not soldee
             group by employee_id) r
     where r.employee_id = e.id;
    raise notice 'Soldes de dette repris sur les fiches employés.';
  end if;
end $$;

-- 2. La validation de la paie diminue le solde -----------------------------------

create or replace function public.valider_paie(p_periode uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.periodes_paie%rowtype;
  v_ligne record;
begin
  perform public.exiger_role('paie', 'admin');

  select * into v_p from public.periodes_paie where id = p_periode for update;
  if v_p.id is null then
    raise exception 'Période introuvable';
  end if;
  if v_p.statut = 'paie_validee' then
    raise exception 'Cette paie est déjà validée';
  end if;
  if v_p.statut = 'ouvert' then
    raise exception 'Le pointage de ce mois doit d''abord être validé';
  end if;

  if exists (select 1 from public.lignes_paie where periode_id = p_periode and net_a_payer < 0) then
    raise exception 'Un net à payer est négatif : corrigez les retenues avant de valider';
  end if;

  -- On ne peut pas retenir plus que ce que la personne doit
  for v_ligne in
    select lp.employee_id, lp.nom_prenom, lp.retenue_dette, e.dette
      from public.lignes_paie lp
      join public.employees e on e.id = lp.employee_id
     where lp.periode_id = p_periode and lp.retenue_dette > 0
  loop
    if v_ligne.retenue_dette > v_ligne.dette then
      raise exception
        'Retenue de % DH pour % alors que sa dette n''est que de % DH.',
        v_ligne.retenue_dette, v_ligne.nom_prenom, v_ligne.dette;
    end if;
  end loop;

  -- Diminuer le solde de chacun du montant retenu ce mois-ci
  update public.employees e
     set dette = greatest(0, e.dette - lp.retenue_dette)
    from public.lignes_paie lp
   where lp.periode_id = p_periode
     and lp.employee_id = e.id
     and lp.retenue_dette > 0;

  update public.periodes_paie
    set statut = 'paie_validee',
        paie_validee_par = auth.uid(),
        paie_validee_le = now(),
        reouverture_motif = null,
        reouverture_demandee_par = null,
        reouverture_demandee_le = null
    where id = p_periode;
end;
$$;

revoke all on function public.valider_paie(uuid) from public;
grant execute on function public.valider_paie(uuid) to authenticated;

-- 3. Rouvrir un mois remet les soldes comme avant -----------------------------------

create or replace function public.repondre_reouverture(p_periode uuid, p_approuver boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.periodes_paie%rowtype;
begin
  perform public.exiger_role('admin');

  select * into v_p from public.periodes_paie where id = p_periode for update;
  if v_p.id is null then
    raise exception 'Période introuvable';
  end if;
  if v_p.statut <> 'reouverture_demandee' then
    raise exception 'Aucune demande de réouverture en cours sur ce mois';
  end if;

  if p_approuver then
    -- Rendre ce que la validation avait retenu
    if v_p.paie_validee_le is not null then
      update public.employees e
         set dette = e.dette + lp.retenue_dette
        from public.lignes_paie lp
       where lp.periode_id = p_periode
         and lp.employee_id = e.id
         and lp.retenue_dette > 0;
    end if;

    update public.periodes_paie
      set statut = 'ouvert',
          paie_validee_par = null,
          paie_validee_le = null,
          pointage_valide_par = null,
          pointage_valide_le = null,
          reouverture_motif = null,
          reouverture_demandee_par = null,
          reouverture_demandee_le = null
      where id = p_periode;
  else
    update public.periodes_paie
      set statut = case when paie_validee_le is not null
                        then 'paie_validee'::public.periode_statut
                        else 'pointage_valide'::public.periode_statut end,
          reouverture_motif = null,
          reouverture_demandee_par = null,
          reouverture_demandee_le = null
      where id = p_periode;
  end if;
end;
$$;

revoke all on function public.repondre_reouverture(uuid, boolean) from public;
grant execute on function public.repondre_reouverture(uuid, boolean) to authenticated;

-- 4. L'aperçu de suppression d'un employé lit le nouveau solde -----------------------

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
    'lignes_paie', (select count(*) from public.lignes_paie where employee_id = p_employee_id),
    'mois_de_paie', (select coalesce(jsonb_agg(distinct (pp.mois || '/' || pp.annee)), '[]'::jsonb)
                      from public.lignes_paie lp
                      join public.periodes_paie pp on pp.id = lp.periode_id
                      where lp.employee_id = p_employee_id)
  ) into v;

  return v || jsonb_build_object('supprimable', (v->>'lignes_paie')::int = 0);
end;
$$;

revoke all on function public.apercu_suppression_employe(uuid) from public;
grant execute on function public.apercu_suppression_employe(uuid) to authenticated;

-- 5. La suppression d'un compte ne référence plus les anciennes tables ------------------

create or replace function public.admin_supprimer_utilisateur(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text;
  v_n bigint;
begin
  perform public.exiger_role('admin');

  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte';
  end if;

  select role::text into v_role from public.profiles where user_id = p_user_id;
  if v_role is null then
    raise exception 'Compte introuvable';
  end if;

  select count(*) into v_n from public.pointages where agent_id = p_user_id;
  if v_n > 0 then
    raise exception
      'Ce compte a % pointage(s) à son nom : il ne peut pas être supprimé sans effacer l''historique. Désactivez-le à la place.', v_n;
  end if;

  if v_role = 'admin' then
    if (select count(*) from public.profiles
        where role = 'admin' and actif and user_id <> p_user_id) = 0 then
      raise exception 'Impossible : ce serait le dernier administrateur';
    end if;
  end if;

  update public.pointages     set validated_by = null            where validated_by = p_user_id;
  update public.contrats      set created_by = null              where created_by = p_user_id;
  update public.conges        set created_by = null              where created_by = p_user_id;
  update public.documents     set created_by = null              where created_by = p_user_id;
  update public.periodes_paie set pointage_valide_par = null     where pointage_valide_par = p_user_id;
  update public.periodes_paie set paie_validee_par = null        where paie_validee_par = p_user_id;
  update public.periodes_paie set reouverture_demandee_par = null where reouverture_demandee_par = p_user_id;

  delete from public.profiles where user_id = p_user_id;
  delete from auth.identities where user_id = p_user_id;
  delete from auth.users      where id = p_user_id;
end;
$$;

revoke all on function public.admin_supprimer_utilisateur(uuid) from public;
grant execute on function public.admin_supprimer_utilisateur(uuid) to authenticated;

-- 6. Retirer l'ancien système (les soldes ont été repris à l'étape 1) -------------------

drop table if exists public.remboursements_dette;
drop table if exists public.dettes;
