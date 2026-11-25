-- ============================================================
-- 068 — Les remplaçants, hors des sociétés
-- À exécuter après 067_repos_par_jour.sql
--
-- Un remplaçant ne travaille pas pour une société : il va où l'on a
-- besoin de lui. Sa fiche et ses journées vivent donc hors du
-- cloisonnement par société. Chaque journée retient qui a été
-- remplacé, dans quelle société, et pour combien — figé à la pose.
--
-- Ce fichier ne déplace rien : les remplaçants rangés dans des sites
-- « REMPLACEMENT » ou « JOKER » restent où ils sont jusqu'au transfert.
-- ============================================================

-- 1. Le remplaçant --------------------------------------------------------------

create table if not exists public.remplacants (
  id uuid primary key default gen_random_uuid(),
  matricule integer unique,
  nom_prenom text not null check (length(trim(nom_prenom)) > 0),
  cin text,
  cnss text,
  date_naissance date,
  telephone text,
  adresse text,
  ville text,
  qualification text,
  departement text,
  mode_reglement text,
  banque text,
  rib text,
  -- Ce qu'il touche par journée remplacée. Laissé vide, c'est le tarif
  -- de la personne remplacée qui s'applique — un joker qui couvre un
  -- chef d'équipe n'est pas payé comme s'il couvrait un agent.
  tarif_journalier numeric(10, 2) check (tarif_journalier is null or tarif_journalier >= 0),
  photo_path text,
  notes text,
  actif boolean not null default true,
  archive_le timestamptz,
  cree_par uuid references public.profiles(user_id),
  cree_le timestamptz not null default now()
);

comment on table public.remplacants is
  'Les remplaçants du groupe. Hors société : la liste est la même depuis n''importe quel compte.';

create index if not exists remplacants_nom_idx on public.remplacants (nom_prenom);

-- Un compteur à part : les matricules des remplaçants ne doivent pas
-- se mêler à ceux des employés, qui appartiennent à une société.
create table if not exists public.remplacant_compteur (
  id boolean primary key default true check (id),
  dernier integer not null default 0
);
insert into public.remplacant_compteur (id, dernier) values (true, 0)
  on conflict (id) do nothing;

create or replace function public.remplacants_assign_matricule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suivant integer;
begin
  if new.matricule is not null then
    update public.remplacant_compteur
       set dernier = greatest(dernier, new.matricule);
    return new;
  end if;
  update public.remplacant_compteur
     set dernier = dernier + 1
   returning dernier into v_suivant;
  new.matricule := v_suivant;
  return new;
end;
$$;

drop trigger if exists remplacants_matricule on public.remplacants;
create trigger remplacants_matricule
  before insert on public.remplacants
  for each row execute function public.remplacants_assign_matricule();

-- 2. Les journées remplacées -----------------------------------------------------

create table if not exists public.remplacant_journees (
  id uuid primary key default gen_random_uuid(),
  remplacant_id uuid not null references public.remplacants(id) on delete cascade,
  -- Où il a remplacé : c'est cette société qui doit la journée.
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  -- Qui il a remplacé, et la case du pointage correspondante.
  employee_id uuid references public.employees(id) on delete set null,
  pointage_id uuid references public.pointages(id) on delete set null,
  date_jour date not null,
  -- Figé à la pose : un tarif qui change plus tard ne réécrit pas le passé.
  montant numeric(10, 2) not null default 0 check (montant >= 0),
  motif text,
  cree_par uuid references public.profiles(user_id),
  cree_le timestamptz not null default now()
);

comment on table public.remplacant_journees is
  'Une ligne par journée remplacée. Le montant y est figé au moment où la journée est posée.';

-- Un remplaçant ne tient qu'un poste par jour : sans cela, on le
-- paierait deux fois pour la même journée.
create unique index if not exists remplacant_journees_un_par_jour
  on public.remplacant_journees (remplacant_id, date_jour);

-- Et une personne absente n'est remplacée que par un seul joker.
create unique index if not exists remplacant_journees_un_par_absent
  on public.remplacant_journees (employee_id, date_jour)
  where employee_id is not null;

create index if not exists remplacant_journees_mois_idx
  on public.remplacant_journees (date_jour);
create index if not exists remplacant_journees_societe_idx
  on public.remplacant_journees (company_id, date_jour);

-- 3. Qui lit, qui écrit ----------------------------------------------------------
--  Tout compte connecté du groupe lit la liste : c'est le but même
--  d'une section partagée. L'écriture passe par les fonctions, qui
--  vérifient le rôle — comme partout ailleurs dans ce logiciel.

alter table public.remplacants enable row level security;
alter table public.remplacant_journees enable row level security;
alter table public.remplacant_compteur enable row level security;

drop policy if exists remplacants_select on public.remplacants;
create policy remplacants_select on public.remplacants
  for select to authenticated using (true);

drop policy if exists remplacant_journees_select on public.remplacant_journees;
create policy remplacant_journees_select on public.remplacant_journees
  for select to authenticated using (true);

drop policy if exists remplacant_compteur_select on public.remplacant_compteur;
create policy remplacant_compteur_select on public.remplacant_compteur
  for select to authenticated using (true);

-- 4. Tenir la fiche d'un remplaçant -----------------------------------------------

create or replace function public.enregistrer_remplacant(
  p_id uuid,
  p_fiche jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nom text := trim(coalesce(p_fiche ->> 'nom_prenom', ''));
begin
  perform public.exiger_role('validator', 'admin', 'rh');
  if v_nom = '' then
    raise exception 'Le nom est obligatoire.';
  end if;

  if p_id is null then
    insert into public.remplacants (
      nom_prenom, cin, cnss, date_naissance, telephone, adresse, ville,
      qualification, departement, mode_reglement, banque, rib,
      tarif_journalier, notes, cree_par)
    values (
      v_nom,
      nullif(p_fiche ->> 'cin', ''),
      nullif(p_fiche ->> 'cnss', ''),
      (nullif(p_fiche ->> 'date_naissance', ''))::date,
      nullif(p_fiche ->> 'telephone', ''),
      nullif(p_fiche ->> 'adresse', ''),
      nullif(p_fiche ->> 'ville', ''),
      nullif(p_fiche ->> 'qualification', ''),
      nullif(p_fiche ->> 'departement', ''),
      nullif(p_fiche ->> 'mode_reglement', ''),
      nullif(p_fiche ->> 'banque', ''),
      nullif(p_fiche ->> 'rib', ''),
      (nullif(p_fiche ->> 'tarif_journalier', ''))::numeric,
      nullif(p_fiche ->> 'notes', ''),
      auth.uid())
    returning id into v_id;
  else
    update public.remplacants set
      nom_prenom = v_nom,
      cin = nullif(p_fiche ->> 'cin', ''),
      cnss = nullif(p_fiche ->> 'cnss', ''),
      date_naissance = (nullif(p_fiche ->> 'date_naissance', ''))::date,
      telephone = nullif(p_fiche ->> 'telephone', ''),
      adresse = nullif(p_fiche ->> 'adresse', ''),
      ville = nullif(p_fiche ->> 'ville', ''),
      qualification = nullif(p_fiche ->> 'qualification', ''),
      departement = nullif(p_fiche ->> 'departement', ''),
      mode_reglement = nullif(p_fiche ->> 'mode_reglement', ''),
      banque = nullif(p_fiche ->> 'banque', ''),
      rib = nullif(p_fiche ->> 'rib', ''),
      tarif_journalier = (nullif(p_fiche ->> 'tarif_journalier', ''))::numeric,
      notes = nullif(p_fiche ->> 'notes', ''),
      actif = coalesce((p_fiche ->> 'actif')::boolean, actif)
     where id = p_id
     returning id into v_id;
    if v_id is null then
      raise exception 'Remplaçant introuvable.';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.enregistrer_remplacant(uuid, jsonb) from public;
grant execute on function public.enregistrer_remplacant(uuid, jsonb) to authenticated;

-- 5. Poser une journée de remplacement --------------------------------------------
--  Le tarif retenu : celui du remplaçant s'il en a un, sinon la
--  journée de la personne remplacée (son salaire ÷ la base de jours du
--  mois). Dans les deux cas le montant est figé ici même.

create or replace function public.poser_remplacement(
  p_remplacant uuid,
  p_employee uuid,
  p_date date,
  p_motif text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_site uuid;
  v_salaire numeric;
  v_base numeric;
  v_tarif numeric;
  v_pointage uuid;
  v_id uuid;
begin
  select company_id, site_id, coalesce(salaire, 0)
    into v_company, v_site, v_salaire
    from public.employees where id = p_employee;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;
  if not exists (select 1 from public.remplacants
                  where id = p_remplacant and archive_le is null) then
    raise exception 'Remplaçant introuvable.';
  end if;

  perform public.assert_mois_ouvert(v_company, p_date);

  -- La base de jours de la société pour ce mois : 26 d'ordinaire.
  select coalesce(pp.jours_base, par.jours_base, 26)
    into v_base
    from public.companies c
    left join public.parametres_paie par on par.company_id = c.id
    left join public.periodes_paie pp
      on pp.company_id = c.id
     and pp.annee = extract(year from p_date)::int
     and pp.mois = extract(month from p_date)::int
   where c.id = v_company;
  v_base := coalesce(nullif(v_base, 0), 26);

  select tarif_journalier into v_tarif
    from public.remplacants where id = p_remplacant;
  v_tarif := coalesce(v_tarif, round(v_salaire / v_base, 2));

  select id into v_pointage
    from public.pointages
   where employee_id = p_employee and pointed_on = p_date and status <> 'refused'
   limit 1;

  -- Déjà pris ce jour-là, pour quelqu'un d'autre ? On refuse en le
  -- disant. Laisser l'enregistrement se recouvrir déplacerait le joker
  -- sans un mot, et la case qu'il couvrait resterait marquée remplacée
  -- alors que plus personne n'y serait.
  if exists (select 1 from public.remplacant_journees
              where remplacant_id = p_remplacant
                and date_jour = p_date
                and employee_id is distinct from p_employee) then
    raise exception 'Ce remplaçant couvre déjà % le %.',
      coalesce((select e.nom_prenom from public.remplacant_journees j
                  join public.employees e on e.id = j.employee_id
                 where j.remplacant_id = p_remplacant and j.date_jour = p_date),
               'quelqu''un'),
      to_char(p_date, 'DD/MM/YYYY');
  end if;

  insert into public.remplacant_journees (
    remplacant_id, company_id, site_id, employee_id, pointage_id,
    date_jour, montant, motif, cree_par)
  values (
    p_remplacant, v_company, v_site, p_employee, v_pointage,
    p_date, v_tarif, nullif(trim(coalesce(p_motif, '')), ''), auth.uid())
  on conflict (remplacant_id, date_jour) do update set
    company_id = excluded.company_id,
    site_id = excluded.site_id,
    employee_id = excluded.employee_id,
    pointage_id = excluded.pointage_id,
    montant = excluded.montant,
    motif = excluded.motif
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.poser_remplacement(uuid, uuid, date, text) from public;
grant execute on function public.poser_remplacement(uuid, uuid, date, text) to authenticated;

create or replace function public.retirer_remplacement(p_employee uuid, p_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_n integer;
begin
  select company_id into v_company from public.employees where id = p_employee;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;
  perform public.assert_mois_ouvert(v_company, p_date);

  delete from public.remplacant_journees
   where employee_id = p_employee and date_jour = p_date;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.retirer_remplacement(uuid, date) from public;
grant execute on function public.retirer_remplacement(uuid, date) to authenticated;

-- 6. Le tableau de paie d'un remplaçant -------------------------------------------
--  Un seul tableau, pour le mois : ses journées, ce qu'elles valent,
--  et le détail par société — c'est elle qui doit la somme.

create or replace function public.paie_remplacants(p_annee integer, p_mois integer)
returns table (
  remplacant_id uuid,
  matricule integer,
  nom_prenom text,
  mode_reglement text,
  banque text,
  rib text,
  jours integer,
  montant numeric,
  par_societe jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with bornes as (
    select make_date(p_annee, p_mois, 1) as debut,
           (make_date(p_annee, p_mois, 1) + interval '1 month - 1 day')::date as fin
  ),
  journees as (
    select j.*, c.name as societe
      from public.remplacant_journees j
      join public.companies c on c.id = j.company_id
      cross join bornes b
     where j.date_jour between b.debut and b.fin
  )
  select r.id, r.matricule, r.nom_prenom, r.mode_reglement, r.banque, r.rib,
         count(j.id)::integer as jours,
         coalesce(sum(j.montant), 0) as montant,
         coalesce(jsonb_agg(jsonb_build_object(
           'societe', j.societe, 'jours', 1, 'montant', j.montant,
           'date', j.date_jour) order by j.date_jour)
           filter (where j.id is not null), '[]'::jsonb) as par_societe
    from public.remplacants r
    left join journees j on j.remplacant_id = r.id
   where r.archive_le is null
   group by r.id, r.matricule, r.nom_prenom, r.mode_reglement, r.banque, r.rib
   order by r.nom_prenom;
$$;

revoke all on function public.paie_remplacants(integer, integer) from public;
grant execute on function public.paie_remplacants(integer, integer) to authenticated;
