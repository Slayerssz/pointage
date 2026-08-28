-- ============================================================
-- 017 — La Paie
-- À exécuter après 016_absences_conges.sql
--
-- Cycle d'un mois :
--   1. ouvert                → le pointage se saisit normalement
--   2. valider_pointage_mois → le mois est figé et bascule en paie
--   3. la paie s'ajuste (dettes, primes, retenues) puis valider_paie
--   4. paie_validee          → plus aucune modification possible
--   5. demander_reouverture  → une demande part vers l'administrateur
--   6. approuver_reouverture → l'admin rouvre le mois
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'periode_statut') then
    create type public.periode_statut as enum (
      'ouvert',
      'pointage_valide',
      'paie_validee',
      'reouverture_demandee'
    );
  end if;
end $$;

-- 1. Dettes / avances de l'employé -------------------------------------------

create table if not exists public.dettes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  libelle text not null,
  montant_total numeric(10, 2) not null check (montant_total > 0),
  montant_rembourse numeric(10, 2) not null default 0 check (montant_rembourse >= 0),
  date_creation date not null default (now() at time zone 'Africa/Casablanca')::date,
  soldee boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists dettes_employee_idx on public.dettes (employee_id) where not soldee;
create index if not exists dettes_company_idx on public.dettes (company_id);

alter table public.dettes enable row level security;

drop policy if exists dettes_select on public.dettes;
create policy dettes_select on public.dettes
  for select to authenticated using (true);

drop policy if exists dettes_insert on public.dettes;
create policy dettes_insert on public.dettes
  for insert to authenticated
  with check (public.current_user_role()::text in ('validator', 'admin', 'paie'));

drop policy if exists dettes_update on public.dettes;
create policy dettes_update on public.dettes
  for update to authenticated
  using (public.current_user_role()::text in ('validator', 'admin', 'paie'))
  with check (true);

drop policy if exists dettes_delete on public.dettes;
create policy dettes_delete on public.dettes
  for delete to authenticated
  using (public.current_user_role()::text in ('admin', 'paie'));

-- 2. Périodes de paie (un mois × une entreprise) -------------------------------

create table if not exists public.periodes_paie (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  annee integer not null check (annee between 2020 and 2100),
  mois integer not null check (mois between 1 and 12),
  statut public.periode_statut not null default 'ouvert',
  -- Paramètres figés au moment de la validation du pointage
  jours_base numeric(5, 2) not null default 26,
  maladie_payee boolean not null default true,
  conge_paye boolean not null default true,
  -- Traçabilité
  pointage_valide_par uuid references auth.users(id),
  pointage_valide_le timestamptz,
  paie_validee_par uuid references auth.users(id),
  paie_validee_le timestamptz,
  reouverture_motif text,
  reouverture_demandee_par uuid references auth.users(id),
  reouverture_demandee_le timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, annee, mois)
);

create index if not exists periodes_paie_company_idx
  on public.periodes_paie (company_id, annee desc, mois desc);

alter table public.periodes_paie enable row level security;

drop policy if exists periodes_paie_select on public.periodes_paie;
create policy periodes_paie_select on public.periodes_paie
  for select to authenticated using (true);

-- 3. Lignes de paie (une par employé et par mois) --------------------------------
-- Tout est figé au moment de la génération : si l'employé change de site ou
-- de salaire ensuite, le bulletin déjà validé ne bouge pas.

create table if not exists public.lignes_paie (
  id uuid primary key default gen_random_uuid(),
  periode_id uuid not null references public.periodes_paie(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  -- Instantané de l'employé
  matricule integer,
  nom_prenom text not null,
  cin text,
  cnss text,
  site_id uuid,
  site_nom text,
  qualification text,
  mode_reglement text,
  banque text,
  rib text,
  -- Base de calcul
  salaire_base numeric(10, 2) not null default 0,
  jours_base numeric(5, 2) not null default 26,
  heures_par_jour numeric(5, 2),
  -- Comptage issu du pointage
  gardes_travaillees numeric(6, 2) not null default 0,
  jours_conge numeric(6, 2) not null default 0,
  jours_maladie numeric(6, 2) not null default 0,
  jours_sans_solde numeric(6, 2) not null default 0,
  jours_absent numeric(6, 2) not null default 0,
  jours_repos numeric(6, 2) not null default 0,
  -- Jours réellement payés (travaillés + congés/maladie si payés)
  jours_payes numeric(6, 2) not null default 0,
  heures_effectuees numeric(7, 2),
  -- Montants
  salaire_brut numeric(10, 2) not null default 0,
  prime numeric(10, 2) not null default 0,
  retenue_dette numeric(10, 2) not null default 0,
  autres_retenues numeric(10, 2) not null default 0,
  net_a_payer numeric(10, 2) not null default 0,
  observations text,
  unique (periode_id, employee_id)
);

create index if not exists lignes_paie_periode_idx on public.lignes_paie (periode_id);
create index if not exists lignes_paie_employee_idx on public.lignes_paie (employee_id);

alter table public.lignes_paie enable row level security;

drop policy if exists lignes_paie_select on public.lignes_paie;
create policy lignes_paie_select on public.lignes_paie
  for select to authenticated using (true);

-- Les lignes ne se modifient que par maj_ligne_paie() (fonction ci-dessous).

-- 4. Remboursements de dette rattachés à un mois -----------------------------------

create table if not exists public.remboursements_dette (
  id uuid primary key default gen_random_uuid(),
  dette_id uuid not null references public.dettes(id) on delete cascade,
  periode_id uuid not null references public.periodes_paie(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  montant numeric(10, 2) not null check (montant > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists remb_dette_idx on public.remboursements_dette (dette_id);
create index if not exists remb_periode_idx on public.remboursements_dette (periode_id, employee_id);

alter table public.remboursements_dette enable row level security;

drop policy if exists remb_select on public.remboursements_dette;
create policy remb_select on public.remboursements_dette
  for select to authenticated using (true);

-- 5. Verrouillage du pointage d'un mois validé --------------------------------------
-- Vraie implémentation (remplace le garde-fou provisoire de 016).

create or replace function public.assert_mois_ouvert(p_company uuid, p_date date)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_statut public.periode_statut;
begin
  select statut into v_statut
    from public.periodes_paie
    where company_id = p_company
      and annee = date_part('year', p_date)::int
      and mois = date_part('month', p_date)::int;

  if v_statut is null or v_statut = 'ouvert' then
    return;
  end if;

  raise exception 'Le mois % est clôturé (%). Le pointage ne peut plus être modifié — demandez la réouverture à l''administrateur.',
    to_char(p_date, 'MM/YYYY'), v_statut;
end;
$$;

grant execute on function public.assert_mois_ouvert(uuid, date) to authenticated;

-- 6. Les fonctions de pointage respectent le verrouillage ----------------------------

drop function if exists public.validate_pointage(uuid, text, text);

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

-- 7. État d'un mois + aperçu avant validation -----------------------------------------

create or replace function public.apercu_mois(p_company uuid, p_annee int, p_mois int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_debut date := make_date(p_annee, p_mois, 1);
  v_fin date := (make_date(p_annee, p_mois, 1) + interval '1 month - 1 day')::date;
  v_res jsonb;
begin
  select jsonb_build_object(
    'annee', p_annee,
    'mois', p_mois,
    'debut', v_debut,
    'fin', v_fin,
    'statut', coalesce((select statut::text from public.periodes_paie
                        where company_id = p_company and annee = p_annee and mois = p_mois),
                       'ouvert'),
    'employes_actifs', (select count(*) from public.employees
                        where company_id = p_company and actif),
    'en_attente', (select count(*) from public.pointages
                   where company_id = p_company and status = 'pending'
                     and pointed_on between v_debut and v_fin),
    'valides', (select count(*) from public.pointages
                where company_id = p_company and status = 'validated'
                  and pointed_on between v_debut and v_fin),
    'sans_salaire', (select count(*) from public.employees
                     where company_id = p_company and actif
                       and coalesce(salaire, 0) = 0)
  ) into v_res;
  return v_res;
end;
$$;

grant execute on function public.apercu_mois(uuid, int, int) to authenticated;

-- 8. Valider le pointage du mois → génère la paie ---------------------------------------

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

-- 9. Génération (ou régénération) des lignes de paie d'une période -------------------------
-- Les montants saisis à la main (prime, retenues, observations) sont conservés.

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

-- 10. Ajuster une ligne de paie (prime, retenue de dette, autres retenues) --------------

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

-- 11. Valider la paie du mois → verrouillage + remboursement des dettes -------------------

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

-- 12. Demande de réouverture / approbation par l'administrateur ---------------------------

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

-- 13. Bulletin de paie journalier : qui a travaillé, sur quel site, tel jour --------------

create or replace function public.bulletin_journalier(p_company uuid, p_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'site'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'site_id', s.id,
      'site', s.name,
      'employes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'employee_id', e.id,
          'matricule', e.matricule,
          'nom_prenom', e.nom_prenom,
          'qualification', e.qualification,
          'cin', e.cin,
          'type_garde', p.type_garde,
          'heure', to_char(p.pointed_at at time zone 'Africa/Casablanca', 'HH24:MI'),
          'photo', p.photo_path is not null
        ) order by e.matricule nulls last), '[]'::jsonb)
        from public.pointages p
        join public.employees e on e.id = p.employee_id
        where p.site_id = s.id and p.pointed_on = p_date and p.status = 'validated'
      )
    ) as x
    from public.sites s
    where s.company_id = p_company and s.pointage_actif
      and exists (select 1 from public.pointages p
                  where p.site_id = s.id and p.pointed_on = p_date and p.status = 'validated')
  ) t;
$$;

grant execute on function public.bulletin_journalier(uuid, date) to authenticated;

-- 14. Totaux d'une période (pour l'en-tête de l'écran Paie et les exports) ----------------

create or replace function public.totaux_periode(p_periode uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'employes', count(*),
    'total_brut', coalesce(sum(salaire_brut), 0),
    'total_primes', coalesce(sum(prime), 0),
    'total_dettes', coalesce(sum(retenue_dette), 0),
    'total_autres_retenues', coalesce(sum(autres_retenues), 0),
    'total_net', coalesce(sum(net_a_payer), 0),
    'total_virement', coalesce(sum(net_a_payer) filter (
      where lower(coalesce(mode_reglement, '')) like 'vir%'), 0),
    'total_especes', coalesce(sum(net_a_payer) filter (
      where lower(coalesce(mode_reglement, '')) not like 'vir%'), 0),
    'par_banque', (
      select coalesce(jsonb_agg(jsonb_build_object('banque', b, 'n', n, 'montant', m)
                                order by m desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(banque), ''), '(non renseignée)') as b,
                   count(*) as n, sum(net_a_payer) as m
            from public.lignes_paie where periode_id = p_periode
              and lower(coalesce(mode_reglement, '')) like 'vir%'
            group by 1) q)
  )
  from public.lignes_paie where periode_id = p_periode;
$$;

grant execute on function public.totaux_periode(uuid) to authenticated;
