-- ============================================================================
--  021 — CORRECTIF DE SÉCURITÉ  ⚠️  À EXÉCUTER SANS ATTENDRE
--  ============================================================
--  Supabase → SQL Editor → coller → Run
--
--  LE PROBLÈME
--  Les contrôles de rôle que j'ai écrits dans les blocs précédents
--  s'écrivaient « if role not in ('validator','admin') then refuser ».
--  Pour un appelant sans profil (clé publique, non connecté), ce rôle
--  vaut NULL ; or en PL/pgSQL « NULL not in (...) » vaut NULL, et un
--  « if NULL » ne se déclenche jamais. Le refus était donc silencieusement
--  ignoré : n'importe qui disposant de la clé publique — celle qui figure
--  dans le dépôt GitHub public — pouvait appeler ces fonctions.
--
--  LA CORRECTION
--  Le rôle est désormais ramené à '' quand il est absent, ce qui déclenche
--  le refus. Toutes les fonctions concernées sont redéfinies ci-dessous.
--
--  Ce fichier supprime aussi le compte « __sonde__ », créé par erreur
--  pendant mes vérifications — c'est lui qui a révélé la faille.
-- ============================================================================

-- 1. Garde-fou réutilisable, sûr face à NULL ---------------------------------

create or replace function public.exiger_role(variadic p_roles text[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text := coalesce(public.current_user_role()::text, '');
begin
  if not (v = any(p_roles)) then
    raise exception 'Action réservée à : %. Rôle actuel : %.',
      array_to_string(p_roles, ', '), coalesce(nullif(v, ''), 'aucun (non connecté)');
  end if;
end;
$$;

revoke all on function public.exiger_role(text[]) from public;
grant execute on function public.exiger_role(text[]) to authenticated;

-- 2. Redéfinition des fonctions avec une garde sûre ---------------------------

create or replace function public.maj_parametres_paie(
  p_company uuid,
  p_jours_base numeric,
  p_maladie_payee boolean,
  p_conge_paye boolean,
  p_heures_defaut numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.current_user_role()::text, '') not in ('admin', 'paie') then
    raise exception 'Réservé à l''administrateur et au responsable de paie';
  end if;
  if p_jours_base is null or p_jours_base <= 0 then
    raise exception 'Le nombre de jours de base doit être supérieur à 0';
  end if;

  insert into public.parametres_paie
    (company_id, jours_base, maladie_payee, conge_paye, heures_par_jour_defaut, updated_at)
  values
    (p_company, p_jours_base, p_maladie_payee, p_conge_paye, p_heures_defaut, now())
  on conflict (company_id) do update
    set jours_base = excluded.jours_base,
        maladie_payee = excluded.maladie_payee,
        conge_paye = excluded.conge_paye,
        heures_par_jour_defaut =
          coalesce(excluded.heures_par_jour_defaut, parametres_paie.heures_par_jour_defaut),
        updated_at = now();
end;
$$;

revoke all on function public.maj_parametres_paie(uuid, numeric, boolean, boolean, numeric) from public;
grant execute on function public.maj_parametres_paie(uuid, numeric, boolean, boolean, numeric) to authenticated;

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
begin
  if coalesce(p_type, '') not in ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ') then
    raise exception 'Type de garde invalide';
  end if;

  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin') then
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

  perform public.assert_mois_ouvert(v_company, p_date);

  perform set_config('app.pointage_manuel', 'on', true);
  begin
    insert into public.pointages
      (company_id, site_id, employee_id, agent_id, photo_path,
       pointed_at, pointed_on, status, type_garde, validated_by, validated_at)
    values
      (v_company, v_site, p_employee_id, auth.uid(), null,
       now(), p_date, 'validated', p_type, auth.uid(), now());
  exception when unique_violation then
    perform set_config('app.pointage_manuel', 'off', true);
    raise exception 'Cet employé a déjà un pointage ce jour-là';
  end;
  perform set_config('app.pointage_manuel', 'off', true);

  update public.employees
    set jours_travailles = jours_travailles + public.garde_valeur(p_type)
    where id = p_employee_id;
end;
$$;

revoke all on function public.marquer_present(uuid, date, text) from public;
grant execute on function public.marquer_present(uuid, date, text) to authenticated;

create or replace function public.supprimer_pointage(p_pointage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_employee uuid;
  v_type text;
  v_status public.pointage_status;
  v_company uuid;
  v_date date;
  v_conge uuid;
begin
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, type_garde, status, company_id, pointed_on, conge_id
    into v_employee, v_type, v_status, v_company, v_date, v_conge
    from public.pointages where id = p_pointage_id for update;

  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;
  if v_conge is not null then
    raise exception 'Ce jour fait partie d''un congé : supprimez le congé.';
  end if;

  perform public.assert_mois_ouvert(v_company, v_date);

  if v_status = 'validated' then
    update public.employees
      set jours_travailles = greatest(0, jours_travailles - public.garde_valeur(coalesce(v_type, 'X')))
      where id = v_employee;
  end if;

  delete from public.pointages where id = p_pointage_id;
end;
$$;

revoke all on function public.supprimer_pointage(uuid) from public;
grant execute on function public.supprimer_pointage(uuid) to authenticated;

create or replace function public.creer_conge(
  p_employee_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_type text default 'C',
  p_motif text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_company uuid;
  v_site uuid;
  v_repos smallint;
  v_conge uuid;
  v_jour date;
  v_n integer := 0;
  v_valeur numeric;
begin
  if coalesce(p_type, '') not in ('C', 'CS', 'M', 'AJ') then
    raise exception 'Type de congé invalide';
  end if;
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;
  if p_date_fin < p_date_debut then
    raise exception 'La date de fin doit être après la date de début';
  end if;
  if p_date_fin - p_date_debut > 365 then
    raise exception 'Période trop longue (365 jours maximum)';
  end if;

  select company_id, site_id, jour_de_repos
    into v_company, v_site, v_repos
    from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Employé introuvable';
  end if;

  perform public.assert_mois_ouvert(v_company, p_date_debut);
  perform public.assert_mois_ouvert(v_company, p_date_fin);

  insert into public.conges (company_id, employee_id, type, date_debut, date_fin, motif, created_by)
  values (v_company, p_employee_id, p_type, p_date_debut, p_date_fin, nullif(trim(p_motif), ''), auth.uid())
  returning id into v_conge;

  v_valeur := public.garde_valeur(p_type);

  perform set_config('app.pointage_manuel', 'on', true);
  for v_jour in select generate_series(p_date_debut, p_date_fin, interval '1 day')::date loop
    -- Jour de repos hebdomadaire : ne consomme pas de congé
    if v_repos is not null and extract(isodow from v_jour)::int = v_repos then
      continue;
    end if;
    -- Jour déjà pointé (non refusé) : on n'écrase rien
    if exists (
      select 1 from public.pointages
      where employee_id = p_employee_id and pointed_on = v_jour and status <> 'refused'
    ) then
      continue;
    end if;

    insert into public.pointages
      (company_id, site_id, employee_id, agent_id, photo_path,
       pointed_at, pointed_on, status, type_garde, validated_by, validated_at, conge_id)
    values
      (v_company, v_site, p_employee_id, auth.uid(), null,
       now(), v_jour, 'validated', p_type, auth.uid(), now(), v_conge);
    v_n := v_n + 1;
  end loop;
  perform set_config('app.pointage_manuel', 'off', true);

  update public.conges set jours = v_n where id = v_conge;

  if v_valeur > 0 then
    update public.employees
      set jours_travailles = jours_travailles + (v_n * v_valeur)
      where id = p_employee_id;
  end if;

  return v_conge;
end;
$$;

revoke all on function public.creer_conge(uuid, date, date, text, text) from public;
grant execute on function public.creer_conge(uuid, date, date, text, text) to authenticated;

create or replace function public.supprimer_conge(p_conge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_employee uuid;
  v_company uuid;
  v_type text;
  v_debut date;
  v_fin date;
  v_n integer;
begin
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, company_id, type, date_debut, date_fin
    into v_employee, v_company, v_type, v_debut, v_fin
    from public.conges where id = p_conge_id for update;
  if v_employee is null then
    raise exception 'Congé introuvable';
  end if;

  perform public.assert_mois_ouvert(v_company, v_debut);
  perform public.assert_mois_ouvert(v_company, v_fin);

  delete from public.pointages where conge_id = p_conge_id;
  get diagnostics v_n = row_count;

  update public.employees
    set jours_travailles = greatest(0, jours_travailles - (v_n * public.garde_valeur(v_type)))
    where id = v_employee;

  delete from public.conges where id = p_conge_id;
end;
$$;

revoke all on function public.supprimer_conge(uuid) from public;
grant execute on function public.supprimer_conge(uuid) to authenticated;

create or replace function public.validate_pointage(
  p_pointage_id uuid,
  p_decision text,
  p_type text default 'X'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_employee uuid;
  v_old_status public.pointage_status;
  v_company uuid;
  v_date date;
begin
  if coalesce(p_decision, '') not in ('validated', 'refused') then
    raise exception 'Décision invalide';
  end if;
  if p_decision = 'validated'
     and p_type not in ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ') then
    raise exception 'Type de garde invalide';
  end if;

  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, status, company_id, pointed_on
    into v_employee, v_old_status, v_company, v_date
    from public.pointages where id = p_pointage_id for update;
  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;
  if v_old_status <> 'pending' then
    raise exception 'Ce pointage a déjà été traité';
  end if;

  perform public.assert_mois_ouvert(v_company, v_date);

  if p_decision = 'validated' then
    update public.pointages
      set status = 'validated', validated_by = auth.uid(), validated_at = now(),
          type_garde = p_type
      where id = p_pointage_id;
    update public.employees
      set jours_travailles = jours_travailles + public.garde_valeur(p_type)
      where id = v_employee;
  else
    update public.pointages
      set status = 'refused', validated_by = auth.uid(), validated_at = now()
      where id = p_pointage_id;
  end if;
end;
$$;

revoke all on function public.validate_pointage(uuid, text, text) from public;
grant execute on function public.validate_pointage(uuid, text, text) to authenticated;

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
  v_old_type text;
  v_company uuid;
  v_date date;
  v_conge uuid;
begin
  if coalesce(p_type, '') not in ('X05', 'X', 'X15', 'XX', 'RT', 'M', 'C', 'CS', 'AJ') then
    raise exception 'Type de garde invalide';
  end if;

  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, status, type_garde, company_id, pointed_on, conge_id
    into v_employee, v_status, v_old_type, v_company, v_date, v_conge
    from public.pointages where id = p_pointage_id for update;
  if v_employee is null then
    raise exception 'Pointage introuvable';
  end if;
  if v_status <> 'validated' then
    raise exception 'Seuls les pointages validés peuvent changer de type';
  end if;
  if v_conge is not null then
    raise exception 'Ce jour fait partie d''un congé : modifiez ou supprimez le congé.';
  end if;

  perform public.assert_mois_ouvert(v_company, v_date);

  update public.pointages set type_garde = p_type where id = p_pointage_id;
  update public.employees
    set jours_travailles = greatest(0, jours_travailles
      + public.garde_valeur(p_type) - public.garde_valeur(coalesce(v_old_type, 'X')))
    where id = v_employee;
end;
$$;

revoke all on function public.changer_type_garde(uuid, text) from public;
grant execute on function public.changer_type_garde(uuid, text) to authenticated;

create or replace function public.valider_pointage_mois(
  p_company uuid,
  p_annee int,
  p_mois int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_debut date := make_date(p_annee, p_mois, 1);
  v_fin date := (make_date(p_annee, p_mois, 1) + interval '1 month - 1 day')::date;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
  v_periode uuid;
  v_statut public.periode_statut;
  v_par public.parametres_paie%rowtype;
begin
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs et à l''administrateur';
  end if;
  if v_debut > v_today then
    raise exception 'Ce mois n''a pas encore commencé';
  end if;

  select * into v_par from public.parametres_paie where company_id = p_company;
  if v_par.company_id is null then
    insert into public.parametres_paie (company_id) values (p_company)
      on conflict (company_id) do nothing;
    select * into v_par from public.parametres_paie where company_id = p_company;
  end if;

  select id, statut into v_periode, v_statut
    from public.periodes_paie
    where company_id = p_company and annee = p_annee and mois = p_mois
    for update;

  if v_periode is not null and v_statut <> 'ouvert' then
    raise exception 'Ce mois est déjà clôturé (%)', v_statut;
  end if;

  -- Il ne doit plus rester de photos en attente
  if exists (
    select 1 from public.pointages
    where company_id = p_company and status = 'pending'
      and pointed_on between v_debut and v_fin
  ) then
    raise exception 'Il reste des pointages en attente de validation sur ce mois';
  end if;

  if v_periode is null then
    insert into public.periodes_paie
      (company_id, annee, mois, statut, jours_base, maladie_payee, conge_paye,
       pointage_valide_par, pointage_valide_le)
    values
      (p_company, p_annee, p_mois, 'pointage_valide', v_par.jours_base,
       v_par.maladie_payee, v_par.conge_paye, auth.uid(), now())
    returning id into v_periode;
  else
    update public.periodes_paie
      set statut = 'pointage_valide',
          jours_base = v_par.jours_base,
          maladie_payee = v_par.maladie_payee,
          conge_paye = v_par.conge_paye,
          pointage_valide_par = auth.uid(),
          pointage_valide_le = now()
      where id = v_periode;
  end if;

  perform public.generer_lignes_paie(v_periode);
  return v_periode;
end;
$$;

revoke all on function public.valider_pointage_mois(uuid, int, int) from public;
grant execute on function public.valider_pointage_mois(uuid, int, int) to authenticated;

create or replace function public.generer_lignes_paie(p_periode uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.periodes_paie%rowtype;
  v_debut date;
  v_fin date;
  v_n integer := 0;
begin
  if coalesce(public.current_user_role()::text, '') not in ('validator', 'admin', 'paie') then
    raise exception 'Non autorisé';
  end if;

  select * into v_p from public.periodes_paie where id = p_periode;
  if v_p.id is null then
    raise exception 'Période introuvable';
  end if;
  if v_p.statut = 'paie_validee' then
    raise exception 'Cette paie est validée : elle ne peut plus être recalculée';
  end if;

  v_debut := make_date(v_p.annee, v_p.mois, 1);
  v_fin := (v_debut + interval '1 month - 1 day')::date;

  with compte as (
    select
      e.id as employee_id,
      e.matricule, e.nom_prenom, e.cin, e.cnss, e.site_id,
      s.name as site_nom, e.qualification, e.mode_reglement, e.banque, e.rib,
      coalesce(e.salaire, 0) as salaire_base,
      e.heures_par_jour,
      e.jour_de_repos,
      coalesce(sum(case when p.type_garde in ('X05','X','X15','XX','RT')
                        then public.garde_valeur(p.type_garde) end), 0) as gardes_travaillees,
      coalesce(count(*) filter (where p.type_garde = 'C'), 0)  as jours_conge,
      coalesce(count(*) filter (where p.type_garde = 'M'), 0)  as jours_maladie,
      coalesce(count(*) filter (where p.type_garde in ('CS','AJ')), 0) as jours_sans_solde
    from public.employees e
    join public.sites s on s.id = e.site_id
    left join public.pointages p
      on p.employee_id = e.id
     and p.status = 'validated'
     and p.pointed_on between v_debut and v_fin
    where e.company_id = v_p.company_id
      and (e.actif or exists (
            select 1 from public.pointages p2
            where p2.employee_id = e.id and p2.status = 'validated'
              and p2.pointed_on between v_debut and v_fin))
    group by e.id, s.name
  ),
  calc as (
    select c.*,
      -- Jours de repos hebdomadaires tombant dans le mois
      (select count(*) from generate_series(v_debut, v_fin, interval '1 day') d
        where c.jour_de_repos is not null
          and extract(isodow from d)::int = c.jour_de_repos) as jours_repos,
      (c.gardes_travaillees
        + case when v_p.conge_paye then c.jours_conge else 0 end
        + case when v_p.maladie_payee then c.jours_maladie else 0 end) as jours_payes
    from compte c
  )
  insert into public.lignes_paie (
    periode_id, employee_id, matricule, nom_prenom, cin, cnss, site_id, site_nom,
    qualification, mode_reglement, banque, rib, salaire_base, jours_base,
    heures_par_jour, gardes_travaillees, jours_conge, jours_maladie,
    jours_sans_solde, jours_absent, jours_repos, jours_payes, heures_effectuees,
    salaire_brut, net_a_payer
  )
  select
    p_periode, calc.employee_id, calc.matricule, calc.nom_prenom, calc.cin, calc.cnss,
    calc.site_id, calc.site_nom, calc.qualification, calc.mode_reglement,
    calc.banque, calc.rib, calc.salaire_base, v_p.jours_base,
    calc.heures_par_jour,
    calc.gardes_travaillees, calc.jours_conge, calc.jours_maladie,
    calc.jours_sans_solde,
    -- Absent = jours ouvrables du mois non couverts
    greatest(0, round(
      ((v_fin - v_debut + 1) - calc.jours_repos)
      - (calc.gardes_travaillees + calc.jours_conge + calc.jours_maladie + calc.jours_sans_solde)
    , 2)),
    calc.jours_repos,
    calc.jours_payes,
    -- Heures effectuées = jours payés × heures par jour (½ garde = 4 h, XX = 16 h)
    case when calc.heures_par_jour is null then null
         else round(calc.jours_payes * calc.heures_par_jour, 2) end,
    -- Salaire brut proratisé : 26 jours = salaire complet
    round(calc.salaire_base * least(calc.jours_payes, v_p.jours_base * 3) / v_p.jours_base, 2),
    round(calc.salaire_base * least(calc.jours_payes, v_p.jours_base * 3) / v_p.jours_base, 2)
  from calc
  on conflict (periode_id, employee_id) do update set
    matricule = excluded.matricule,
    nom_prenom = excluded.nom_prenom,
    cin = excluded.cin,
    cnss = excluded.cnss,
    site_id = excluded.site_id,
    site_nom = excluded.site_nom,
    qualification = excluded.qualification,
    mode_reglement = excluded.mode_reglement,
    banque = excluded.banque,
    rib = excluded.rib,
    salaire_base = excluded.salaire_base,
    jours_base = excluded.jours_base,
    heures_par_jour = excluded.heures_par_jour,
    gardes_travaillees = excluded.gardes_travaillees,
    jours_conge = excluded.jours_conge,
    jours_maladie = excluded.jours_maladie,
    jours_sans_solde = excluded.jours_sans_solde,
    jours_absent = excluded.jours_absent,
    jours_repos = excluded.jours_repos,
    jours_payes = excluded.jours_payes,
    heures_effectuees = excluded.heures_effectuees,
    salaire_brut = excluded.salaire_brut,
    -- prime / retenues saisies à la main sont conservées ; le net est recalculé
    net_a_payer = round(excluded.salaire_brut
      + lignes_paie.prime
      - lignes_paie.retenue_dette
      - lignes_paie.autres_retenues, 2);

  get diagnostics v_n = row_count;

  -- Les employés qui ne sont plus concernés disparaissent de la période
  delete from public.lignes_paie lp
    where lp.periode_id = p_periode
      and not exists (
        select 1 from public.employees e
        where e.id = lp.employee_id
          and e.company_id = v_p.company_id
          and (e.actif or exists (
                select 1 from public.pointages p2
                where p2.employee_id = e.id and p2.status = 'validated'
                  and p2.pointed_on between v_debut and v_fin)));

  return v_n;
end;
$$;

revoke all on function public.generer_lignes_paie(uuid) from public;
grant execute on function public.generer_lignes_paie(uuid) to authenticated;

create or replace function public.maj_ligne_paie(
  p_ligne uuid,
  p_prime numeric default null,
  p_retenue_dette numeric default null,
  p_autres_retenues numeric default null,
  p_observations text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_statut public.periode_statut;
  v_prime numeric;
  v_dette numeric;
  v_autres numeric;
  v_brut numeric;
begin
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('paie', 'admin') then
    raise exception 'Réservé au responsable de paie et à l''administrateur';
  end if;

  select pp.statut, lp.salaire_brut, lp.prime, lp.retenue_dette, lp.autres_retenues
    into v_statut, v_brut, v_prime, v_dette, v_autres
    from public.lignes_paie lp
    join public.periodes_paie pp on pp.id = lp.periode_id
    where lp.id = p_ligne
    for update of lp;

  if v_brut is null then
    raise exception 'Ligne de paie introuvable';
  end if;
  if v_statut = 'paie_validee' then
    raise exception 'Cette paie est validée : demandez la réouverture à l''administrateur';
  end if;

  v_prime := coalesce(p_prime, v_prime);
  v_dette := coalesce(p_retenue_dette, v_dette);
  v_autres := coalesce(p_autres_retenues, v_autres);

  if v_prime < 0 or v_dette < 0 or v_autres < 0 then
    raise exception 'Les montants ne peuvent pas être négatifs';
  end if;

  update public.lignes_paie
    set prime = v_prime,
        retenue_dette = v_dette,
        autres_retenues = v_autres,
        observations = coalesce(nullif(trim(p_observations), ''), observations),
        net_a_payer = round(v_brut + v_prime - v_dette - v_autres, 2)
    where id = p_ligne;
end;
$$;

revoke all on function public.maj_ligne_paie(uuid, numeric, numeric, numeric, text) from public;
grant execute on function public.maj_ligne_paie(uuid, numeric, numeric, numeric, text) to authenticated;

create or replace function public.valider_paie(p_periode uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_p public.periodes_paie%rowtype;
  v_ligne record;
  v_reste numeric;
  v_dette record;
  v_pris numeric;
begin
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('paie', 'admin') then
    raise exception 'Réservé au responsable de paie et à l''administrateur';
  end if;

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

  -- Imputer les retenues de dette sur les dettes ouvertes de chaque employé
  for v_ligne in
    select employee_id, retenue_dette from public.lignes_paie
    where periode_id = p_periode and retenue_dette > 0
  loop
    v_reste := v_ligne.retenue_dette;
    for v_dette in
      select id, montant_total, montant_rembourse from public.dettes
      where employee_id = v_ligne.employee_id and not soldee
      order by date_creation, created_at
    loop
      exit when v_reste <= 0;
      v_pris := least(v_reste, v_dette.montant_total - v_dette.montant_rembourse);
      exit when v_pris <= 0;

      insert into public.remboursements_dette
        (dette_id, periode_id, employee_id, montant, created_by)
      values (v_dette.id, p_periode, v_ligne.employee_id, v_pris, auth.uid());

      update public.dettes
        set montant_rembourse = montant_rembourse + v_pris,
            soldee = (montant_rembourse + v_pris) >= montant_total
        where id = v_dette.id;

      v_reste := v_reste - v_pris;
    end loop;
  end loop;

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

create or replace function public.demander_reouverture(p_periode uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_statut public.periode_statut;
begin
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('paie', 'validator', 'admin') then
    raise exception 'Non autorisé';
  end if;
  if coalesce(trim(p_motif), '') = '' then
    raise exception 'Indiquez le motif de la demande';
  end if;

  select statut into v_statut from public.periodes_paie where id = p_periode for update;
  if v_statut is null then
    raise exception 'Période introuvable';
  end if;
  if v_statut = 'ouvert' then
    raise exception 'Ce mois est déjà ouvert';
  end if;
  if v_statut = 'reouverture_demandee' then
    raise exception 'Une demande est déjà en cours';
  end if;

  update public.periodes_paie
    set statut = 'reouverture_demandee',
        reouverture_motif = trim(p_motif),
        reouverture_demandee_par = auth.uid(),
        reouverture_demandee_le = now()
    where id = p_periode;
end;
$$;

revoke all on function public.demander_reouverture(uuid, text) from public;
grant execute on function public.demander_reouverture(uuid, text) to authenticated;

create or replace function public.repondre_reouverture(p_periode uuid, p_approuver boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.periodes_paie%rowtype;
begin
  if coalesce(public.current_user_role()::text, '') <> 'admin' then
    raise exception 'Seul l''administrateur peut répondre à une demande de réouverture';
  end if;

  select * into v_p from public.periodes_paie where id = p_periode for update;
  if v_p.id is null then
    raise exception 'Période introuvable';
  end if;
  if v_p.statut <> 'reouverture_demandee' then
    raise exception 'Aucune demande de réouverture en cours sur ce mois';
  end if;

  if p_approuver then
    -- Annuler les remboursements de dette imputés lors de la validation
    update public.dettes d
      set montant_rembourse = greatest(0, d.montant_rembourse - r.total),
          soldee = false
      from (select dette_id, sum(montant) as total
            from public.remboursements_dette
            where periode_id = p_periode group by dette_id) r
      where d.id = r.dette_id;
    delete from public.remboursements_dette where periode_id = p_periode;

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
    -- Refus : on revient à l'état précédent
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

create or replace function public.admin_creer_entreprise(p_nom text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nom text := trim(p_nom);
begin
  if coalesce(public.current_user_role()::text, '') <> 'admin' then
    raise exception 'Seul l''administrateur peut créer une entreprise';
  end if;
  if v_nom = '' then
    raise exception 'Le nom de l''entreprise est obligatoire';
  end if;
  if exists (select 1 from public.companies where lower(name) = lower(v_nom)) then
    raise exception 'Une entreprise porte déjà ce nom';
  end if;

  insert into public.companies (name) values (v_nom) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_creer_entreprise(text) from public;
grant execute on function public.admin_creer_entreprise(text) to authenticated;

create or replace function public.admin_renommer_entreprise(p_company uuid, p_nom text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text := trim(p_nom);
begin
  if coalesce(public.current_user_role()::text, '') <> 'admin' then
    raise exception 'Seul l''administrateur peut modifier une entreprise';
  end if;
  if v_nom = '' then
    raise exception 'Le nom de l''entreprise est obligatoire';
  end if;
  if exists (select 1 from public.companies where lower(name) = lower(v_nom) and id <> p_company) then
    raise exception 'Une entreprise porte déjà ce nom';
  end if;

  update public.companies set name = v_nom where id = p_company;
end;
$$;

revoke all on function public.admin_renommer_entreprise(uuid, text) from public;
grant execute on function public.admin_renommer_entreprise(uuid, text) to authenticated;

create or replace function public.creer_site(
  p_company uuid,
  p_nom text,
  p_pointage_actif boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nom text := trim(p_nom);
begin
  if coalesce(public.current_user_role()::text, '') not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs et à l''administrateur';
  end if;
  if v_nom = '' then
    raise exception 'Le nom du site est obligatoire';
  end if;
  if exists (select 1 from public.sites
             where company_id = p_company and lower(name) = lower(v_nom)) then
    raise exception 'Ce site existe déjà dans cette entreprise';
  end if;

  insert into public.sites (company_id, name, pointage_actif)
  values (p_company, v_nom, coalesce(p_pointage_actif, true))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.creer_site(uuid, text, boolean) from public;
grant execute on function public.creer_site(uuid, text, boolean) to authenticated;

create or replace function public.maj_site(
  p_site uuid,
  p_nom text,
  p_pointage_actif boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_nom text := trim(p_nom);
begin
  if coalesce(public.current_user_role()::text, '') not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs et à l''administrateur';
  end if;
  if v_nom = '' then
    raise exception 'Le nom du site est obligatoire';
  end if;

  select company_id into v_company from public.sites where id = p_site;
  if v_company is null then
    raise exception 'Site introuvable';
  end if;
  if exists (select 1 from public.sites
             where company_id = v_company and lower(name) = lower(v_nom) and id <> p_site) then
    raise exception 'Un autre site porte déjà ce nom';
  end if;

  update public.sites
    set name = v_nom, pointage_actif = coalesce(p_pointage_actif, true)
    where id = p_site;
end;
$$;

revoke all on function public.maj_site(uuid, text, boolean) from public;
grant execute on function public.maj_site(uuid, text, boolean) to authenticated;

create or replace function public.supprimer_site(p_site uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.current_user_role()::text, '') not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs et à l''administrateur';
  end if;
  if exists (select 1 from public.employees where site_id = p_site) then
    raise exception 'Ce site a encore des employés : déplacez-les d''abord';
  end if;

  delete from public.sites where id = p_site;
end;
$$;

revoke all on function public.supprimer_site(uuid) from public;
grant execute on function public.supprimer_site(uuid) to authenticated;

create or replace function public.admin_creer_utilisateur(
  p_username text,
  p_password text,
  p_full_name text,
  p_role text
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_username text := lower(trim(p_username));
  v_login_id text := lower(trim(p_username)) || '@pointage.local';
begin
  if coalesce(public.current_user_role()::text, '') <> 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  if v_username = '' or v_username !~ '^[a-z0-9._-]+$' then
    raise exception 'Nom d''utilisateur invalide (lettres, chiffres, . _ - ; sans espace)';
  end if;
  if length(p_password) < 6 then
    raise exception 'Le mot de passe doit contenir au moins 6 caractères';
  end if;
  if coalesce(p_role, '') not in ('agent', 'validator', 'admin', 'paie') then
    raise exception 'Rôle invalide';
  end if;
  if exists (select 1 from public.profiles where username = v_username) then
    raise exception 'Ce nom d''utilisateur existe déjà';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_login_id, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', v_username), now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_login_id, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (user_id, username, full_name, role)
  values (v_id, v_username, nullif(trim(p_full_name), ''), p_role::public.user_role);

  return v_username;
end;
$$;

revoke all on function public.admin_creer_utilisateur(text, text, text, text) from public;
grant execute on function public.admin_creer_utilisateur(text, text, text, text) to authenticated;

create or replace function public.admin_modifier_utilisateur(
  p_user_id uuid,
  p_full_name text,
  p_role text,
  p_password text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if coalesce(public.current_user_role()::text, '') <> 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  if coalesce(p_role, '') not in ('agent', 'validator', 'admin', 'paie') then
    raise exception 'Rôle invalide';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Vous ne pouvez pas retirer votre propre rôle d''administrateur';
  end if;

  update public.profiles
    set full_name = nullif(trim(p_full_name), ''), role = p_role::public.user_role
    where user_id = p_user_id;

  if p_password is not null and length(p_password) >= 6 then
    update auth.users
      set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
          updated_at = now()
      where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_modifier_utilisateur(uuid, text, text, text) from public;
grant execute on function public.admin_modifier_utilisateur(uuid, text, text, text) to authenticated;

create or replace function public.creer_conge(
  p_employee_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_type text default 'C',
  p_motif text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_company uuid;
  v_site uuid;
  v_repos smallint;
  v_conge uuid;
  v_jour date;
  v_n integer := 0;
  v_valeur numeric;
begin
  if coalesce(p_type, '') not in ('C', 'CS', 'M', 'AJ') then
    raise exception 'Type de congé invalide';
  end if;
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;
  if p_date_fin < p_date_debut then
    raise exception 'La date de fin doit être après la date de début';
  end if;
  if p_date_fin - p_date_debut > 365 then
    raise exception 'Période trop longue (365 jours maximum)';
  end if;

  select company_id, site_id, jour_de_repos
    into v_company, v_site, v_repos
    from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Employé introuvable';
  end if;

  -- Tous les mois traversés doivent être ouverts
  perform public.assert_periode_ouverte(v_company, p_date_debut, p_date_fin);

  insert into public.conges (company_id, employee_id, type, date_debut, date_fin, motif, created_by)
  values (v_company, p_employee_id, p_type, p_date_debut, p_date_fin, nullif(trim(p_motif), ''), auth.uid())
  returning id into v_conge;

  v_valeur := public.garde_valeur(p_type);

  perform set_config('app.pointage_manuel', 'on', true);
  for v_jour in select generate_series(p_date_debut, p_date_fin, interval '1 day')::date loop
    if v_repos is not null and extract(isodow from v_jour)::int = v_repos then
      continue;
    end if;
    if exists (
      select 1 from public.pointages
      where employee_id = p_employee_id and pointed_on = v_jour and status <> 'refused'
    ) then
      continue;
    end if;

    insert into public.pointages
      (company_id, site_id, employee_id, agent_id, photo_path,
       pointed_at, pointed_on, status, type_garde, validated_by, validated_at, conge_id)
    values
      (v_company, v_site, p_employee_id, auth.uid(), null,
       now(), v_jour, 'validated', p_type, auth.uid(), now(), v_conge);
    v_n := v_n + 1;
  end loop;
  perform set_config('app.pointage_manuel', 'off', true);

  update public.conges set jours = v_n where id = v_conge;

  if v_valeur > 0 then
    update public.employees
      set jours_travailles = jours_travailles + (v_n * v_valeur)
      where id = p_employee_id;
  end if;

  return v_conge;
end;
$$;

revoke all on function public.creer_conge(uuid, date, date, text, text) from public;
grant execute on function public.creer_conge(uuid, date, date, text, text) to authenticated;

create or replace function public.supprimer_conge(p_conge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_employee uuid;
  v_company uuid;
  v_type text;
  v_debut date;
  v_fin date;
  v_n integer;
begin
  v_role := coalesce(public.current_user_role()::text, '');
  if v_role not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs';
  end if;

  select employee_id, company_id, type, date_debut, date_fin
    into v_employee, v_company, v_type, v_debut, v_fin
    from public.conges where id = p_conge_id for update;
  if v_employee is null then
    raise exception 'Congé introuvable';
  end if;

  perform public.assert_periode_ouverte(v_company, v_debut, v_fin);

  delete from public.pointages where conge_id = p_conge_id;
  get diagnostics v_n = row_count;

  update public.employees
    set jours_travailles = greatest(0, jours_travailles - (v_n * public.garde_valeur(v_type)))
    where id = v_employee;

  delete from public.conges where id = p_conge_id;
end;
$$;

revoke all on function public.supprimer_conge(uuid) from public;
grant execute on function public.supprimer_conge(uuid) to authenticated;

-- 3. Suppression du compte de sonde créé par erreur ---------------------------

do $$
declare v_id uuid;
begin
  select user_id into v_id from public.profiles where username = '__sonde__';
  if v_id is not null then
    delete from public.profiles  where user_id = v_id;
    delete from auth.identities  where user_id = v_id;
    delete from auth.users       where id      = v_id;
    raise notice 'Compte « __sonde__ » supprimé.';
  else
    raise notice 'Aucun compte « __sonde__ » à supprimer.';
  end if;
end $$;
