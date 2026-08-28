-- ============================================================
-- 024 — Sites principaux et annexes
-- À exécuter après 023_supprimer_employe.sql
--
-- Les sites existants deviennent des ANNEXES : rien n'est recréé,
-- rien n'est déplacé, les employés restent rattachés exactement où
-- ils sont. On ajoute simplement un niveau AU-DESSUS.
--
--   Site principal  (ex. « LA COMMUNE »)
--     └── annexe    (ex. « COMMUNE DE HAY RIAD »)   ← les employés sont ici
--     └── annexe    (ex. « COMMUNE D'AGDAL »)
--
-- Une annexe peut n'être rattachée à rien : elle fonctionne comme avant.
-- ============================================================

-- 1. Les sites principaux -----------------------------------------------------

create table if not exists public.sites_principaux (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists sites_principaux_company_idx
  on public.sites_principaux (company_id);

alter table public.sites_principaux enable row level security;

drop policy if exists sites_principaux_select on public.sites_principaux;
create policy sites_principaux_select on public.sites_principaux
  for select to authenticated using (true);

-- 2. Rattachement d'une annexe à un site principal -----------------------------
-- « on delete set null » : supprimer un site principal ne supprime jamais
-- les annexes ni leurs employés — il les détache, simplement.

alter table public.sites
  add column if not exists site_principal_id uuid
    references public.sites_principaux(id) on delete set null;

create index if not exists sites_principal_idx
  on public.sites (site_principal_id) where site_principal_id is not null;

-- 3. Créer / renommer / supprimer un site principal -----------------------------

create or replace function public.creer_site_principal(p_company uuid, p_nom text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nom text := trim(p_nom);
begin
  perform public.exiger_role('validator', 'admin');
  if v_nom = '' then
    raise exception 'Le nom du site principal est obligatoire';
  end if;
  if exists (select 1 from public.sites_principaux
             where company_id = p_company and lower(name) = lower(v_nom)) then
    raise exception 'Un site principal porte déjà ce nom';
  end if;

  insert into public.sites_principaux (company_id, name)
  values (p_company, v_nom) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.creer_site_principal(uuid, text) from public;
grant execute on function public.creer_site_principal(uuid, text) to authenticated;

create or replace function public.maj_site_principal(p_id uuid, p_nom text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_nom text := trim(p_nom);
begin
  perform public.exiger_role('validator', 'admin');
  if v_nom = '' then
    raise exception 'Le nom du site principal est obligatoire';
  end if;

  select company_id into v_company from public.sites_principaux where id = p_id;
  if v_company is null then
    raise exception 'Site principal introuvable';
  end if;
  if exists (select 1 from public.sites_principaux
             where company_id = v_company and lower(name) = lower(v_nom) and id <> p_id) then
    raise exception 'Un autre site principal porte déjà ce nom';
  end if;

  update public.sites_principaux set name = v_nom where id = p_id;
end;
$$;

revoke all on function public.maj_site_principal(uuid, text) from public;
grant execute on function public.maj_site_principal(uuid, text) to authenticated;

create or replace function public.supprimer_site_principal(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exiger_role('validator', 'admin');
  if not exists (select 1 from public.sites_principaux where id = p_id) then
    raise exception 'Site principal introuvable';
  end if;
  -- Les annexes rattachées sont simplement détachées (on delete set null)
  delete from public.sites_principaux where id = p_id;
end;
$$;

revoke all on function public.supprimer_site_principal(uuid) from public;
grant execute on function public.supprimer_site_principal(uuid) to authenticated;

-- 4. Rattacher plusieurs annexes d'un coup ---------------------------------------
-- p_principal = null → détacher les annexes sélectionnées.

create or replace function public.lier_annexes(
  p_annexes uuid[],
  p_principal uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_n integer;
begin
  perform public.exiger_role('validator', 'admin');

  if p_annexes is null or array_length(p_annexes, 1) is null then
    raise exception 'Sélectionnez au moins une annexe';
  end if;

  if p_principal is not null then
    select company_id into v_company from public.sites_principaux where id = p_principal;
    if v_company is null then
      raise exception 'Site principal introuvable';
    end if;
    -- Une annexe ne peut être rattachée qu'à un site principal de SA société
    if exists (select 1 from public.sites
               where id = any(p_annexes) and company_id <> v_company) then
      raise exception 'Une annexe ne peut être rattachée qu''à un site principal de la même entreprise';
    end if;
  end if;

  update public.sites set site_principal_id = p_principal where id = any(p_annexes);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.lier_annexes(uuid[], uuid) from public;
grant execute on function public.lier_annexes(uuid[], uuid) to authenticated;

-- 5. Supprimer une annexe, en déplaçant ses employés ------------------------------
-- Auparavant la suppression était simplement refusée si le site avait des
-- employés. On peut désormais indiquer où les déplacer.

drop function if exists public.supprimer_site(uuid);

create or replace function public.supprimer_site(
  p_site uuid,
  p_site_cible uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n bigint;
  v_company uuid;
  v_company_cible uuid;
begin
  perform public.exiger_role('validator', 'admin');

  select company_id into v_company from public.sites where id = p_site;
  if v_company is null then
    raise exception 'Annexe introuvable';
  end if;

  select count(*) into v_n from public.employees where site_id = p_site;

  if v_n > 0 then
    if p_site_cible is null then
      raise exception
        'Cette annexe compte % employé(s). Choisissez l''annexe vers laquelle les déplacer.', v_n;
    end if;
    if p_site_cible = p_site then
      raise exception 'L''annexe de destination doit être différente';
    end if;

    select company_id into v_company_cible from public.sites where id = p_site_cible;
    if v_company_cible is null then
      raise exception 'Annexe de destination introuvable';
    end if;
    if v_company_cible <> v_company then
      raise exception 'L''annexe de destination doit appartenir à la même entreprise';
    end if;

    -- Déplacer les employés ET leurs pointages, pour que l'historique
    -- reste cohérent avec le site où ils apparaissent désormais.
    update public.employees set site_id = p_site_cible where site_id = p_site;
    update public.pointages set site_id = p_site_cible where site_id = p_site;
  end if;

  delete from public.sites where id = p_site;
end;
$$;

revoke all on function public.supprimer_site(uuid, uuid) from public;
grant execute on function public.supprimer_site(uuid, uuid) to authenticated;

-- 6. Le site principal est repris dans la paie -------------------------------------

alter table public.lignes_paie
  add column if not exists site_principal_nom text;

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
  perform public.exiger_role('validator', 'admin', 'paie');

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
      s.name as site_nom, sp.name as site_principal_nom,
      e.qualification, e.mode_reglement, e.banque, e.rib,
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
    left join public.sites_principaux sp on sp.id = s.site_principal_id
    left join public.pointages p
      on p.employee_id = e.id
     and p.status = 'validated'
     and p.pointed_on between v_debut and v_fin
    where e.company_id = v_p.company_id
      and (e.actif or exists (
            select 1 from public.pointages p2
            where p2.employee_id = e.id and p2.status = 'validated'
              and p2.pointed_on between v_debut and v_fin))
    group by e.id, s.name, sp.name
  ),
  calc as (
    select c.*,
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
    site_principal_nom, qualification, mode_reglement, banque, rib, salaire_base,
    jours_base, heures_par_jour, gardes_travaillees, jours_conge, jours_maladie,
    jours_sans_solde, jours_absent, jours_repos, jours_payes, heures_effectuees,
    salaire_brut, net_a_payer
  )
  select
    p_periode, calc.employee_id, calc.matricule, calc.nom_prenom, calc.cin, calc.cnss,
    calc.site_id, calc.site_nom, calc.site_principal_nom, calc.qualification,
    calc.mode_reglement, calc.banque, calc.rib, calc.salaire_base, v_p.jours_base,
    calc.heures_par_jour,
    calc.gardes_travaillees, calc.jours_conge, calc.jours_maladie,
    calc.jours_sans_solde,
    greatest(0, round(
      ((v_fin - v_debut + 1) - calc.jours_repos)
      - (calc.gardes_travaillees + calc.jours_conge + calc.jours_maladie + calc.jours_sans_solde)
    , 2)),
    calc.jours_repos,
    calc.jours_payes,
    case when calc.heures_par_jour is null then null
         else round(calc.jours_payes * calc.heures_par_jour, 2) end,
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
    site_principal_nom = excluded.site_principal_nom,
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
    net_a_payer = round(excluded.salaire_brut
      + lignes_paie.prime
      - lignes_paie.retenue_dette
      - lignes_paie.autres_retenues, 2);

  get diagnostics v_n = row_count;

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
