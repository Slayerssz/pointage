-- ============================================================
-- 047 — Transport et panier, saisis au moment de la paie
-- À exécuter après 046_jours_feries.sql
--
-- Ces deux indemnités varient d'un mois à l'autre : untel a pris le
-- bus vingt jours, untel dix. Les figer sur la fiche employé aurait
-- obligé à corriger la fiche chaque mois.
--
-- Elles se saisissent donc sur la ligne de paie, à côté de la prime
-- et des retenues, au moment où l'on arrête le mois — et elles
-- s'ajoutent au net.
--
-- Elles n'entrent PAS dans l'assiette des cotisations : au Maroc ces
-- indemnités sont exonérées, et le bulletin les porte après les
-- retenues. Le salaire brut, la C.N.S.S., l'A.M.O. et l'I.G.R. sont
-- donc exactement ce qu'ils étaient — aucun bulletin déjà édité ne
-- change d'un centime.
--
-- Le bulletin indique aussi combien de jours fériés ont été travaillés
-- dans le mois (les XF), puisque chacun compte double.
-- ============================================================

-- 1. Sur la ligne de paie, et nulle part ailleurs -----------------------------

alter table public.lignes_paie
  add column if not exists frais_transport numeric(10, 2) not null default 0,
  add column if not exists frais_panier    numeric(10, 2) not null default 0,
  add column if not exists jours_feries_travailles numeric(6, 2) not null default 0;

alter table public.lignes_paie drop constraint if exists lignes_paie_frais_positifs;
alter table public.lignes_paie
  add constraint lignes_paie_frais_positifs
  check (frais_transport >= 0 and frais_panier >= 0);

comment on column public.lignes_paie.frais_transport is
  'Indemnité de transport du mois, saisie à la paie. Hors assiette de cotisation.';
comment on column public.lignes_paie.frais_panier is
  'Prime de panier du mois, saisie à la paie. Hors assiette de cotisation.';
comment on column public.lignes_paie.jours_feries_travailles is
  'Nombre de jours fériés travaillés (XF) dans le mois. Chacun compte deux gardes.';

-- La fiche employé ne porte plus ces montants : ils changent tous les
-- mois. Ce bloc défait proprement une version antérieure qui les y avait
-- mis, et ne fait rien si elle n'a jamais été appliquée.
alter table public.employees drop constraint if exists employees_frais_positifs;
alter table public.employees drop column if exists frais_transport;
alter table public.employees drop column if exists frais_panier;

-- 2. Le service paie saisit les deux montants --------------------------------

create or replace function public.maj_ligne_paie(
  p_ligne uuid,
  p_prime numeric default null,
  p_retenue_dette numeric default null,
  p_autres_retenues numeric default null,
  p_observations text default null,
  p_frais_transport numeric default null,
  p_frais_panier numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut public.periode_statut;
  v_prime numeric;
  v_dette numeric;
  v_autres numeric;
  v_transport numeric;
  v_panier numeric;
  v_brut numeric;
  v_net numeric;
begin
  perform public.exiger_role('paie', 'admin');

  select pp.statut, lp.salaire_brut, lp.prime, lp.retenue_dette, lp.autres_retenues,
         lp.frais_transport, lp.frais_panier
    into v_statut, v_brut, v_prime, v_dette, v_autres, v_transport, v_panier
    from public.lignes_paie lp
    join public.periodes_paie pp on pp.id = lp.periode_id
    where lp.id = p_ligne
    for update of lp;

  if v_brut is null then
    raise exception 'Ligne de paie introuvable.';
  end if;
  if v_statut = 'paie_validee' then
    raise exception 'Cette paie est validée : demandez la réouverture à l''administrateur.';
  end if;

  v_prime     := coalesce(p_prime, v_prime);
  v_dette     := coalesce(p_retenue_dette, v_dette);
  v_autres    := coalesce(p_autres_retenues, v_autres);
  v_transport := coalesce(p_frais_transport, v_transport);
  v_panier    := coalesce(p_frais_panier, v_panier);

  if v_prime < 0 or v_dette < 0 or v_autres < 0 then
    raise exception 'Les montants ne peuvent pas être négatifs.';
  end if;
  if v_transport < 0 or v_panier < 0 then
    raise exception 'Les frais de transport et de panier ne peuvent pas être négatifs.';
  end if;

  v_net := round(v_brut + v_prime + v_transport + v_panier - v_dette - v_autres, 2);
  if v_net < 0 then
    raise exception
      'Les retenues (% DH) dépassent le salaire, les primes et les indemnités (% DH) : '
      'le net serait de % DH. Étalez la retenue sur plusieurs mois.',
      to_char(v_dette + v_autres, 'FM999999990.00'),
      to_char(v_brut + v_prime + v_transport + v_panier, 'FM999999990.00'),
      to_char(v_net, 'FM999999990.00');
  end if;

  update public.lignes_paie
    set prime = v_prime,
        retenue_dette = v_dette,
        autres_retenues = v_autres,
        frais_transport = v_transport,
        frais_panier = v_panier,
        observations = coalesce(nullif(trim(p_observations), ''), observations),
        net_a_payer = v_net
    where id = p_ligne;
end;
$$;

-- L'ancienne signature à cinq arguments disparaît : la laisser vivre
-- ferait deux fonctions du même nom, et PostgreSQL ne saurait laquelle
-- appeler quand l'application omet les deux derniers paramètres.
drop function if exists public.maj_ligne_paie(uuid, numeric, numeric, numeric, text);

revoke all on function
  public.maj_ligne_paie(uuid, numeric, numeric, numeric, text, numeric, numeric) from public;
grant execute on function
  public.maj_ligne_paie(uuid, numeric, numeric, numeric, text, numeric, numeric)
  to authenticated;


-- 3. La génération compte les fériés et respecte la saisie -------------------
-- Le brut reste le salaire au prorata des jours payés. Transport et panier
-- ne sont pas touchés : ils appartiennent à la saisie de la paie, pas au
-- pointage, et régénérer un mois ne doit pas les remettre à zéro.

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
      coalesce(sum(case when p.type_garde in ('X05','X','X15','XX','RT','F','XF')
                        then public.garde_valeur(p.type_garde) end), 0) as gardes_travaillees,
      coalesce(count(*) filter (where p.type_garde = 'C'), 0)  as jours_conge,
      coalesce(count(*) filter (where p.type_garde = 'M'), 0)  as jours_maladie,
      coalesce(count(*) filter (where p.type_garde in ('CS','AJ')), 0) as jours_sans_solde,
      coalesce(count(*) filter (where p.type_garde = 'XF'), 0) as jours_feries_travailles
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
    salaire_brut, jours_feries_travailles, net_a_payer
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
    calc.jours_feries_travailles,
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
    jours_feries_travailles = excluded.jours_feries_travailles,
    -- frais_transport et frais_panier ne figurent pas ici : ils sont
    -- saisis par le service paie, et régénérer le mois ne doit pas les
    -- effacer. On les relit tels quels pour le net.
    net_a_payer = round(excluded.salaire_brut
      + lignes_paie.frais_transport
      + lignes_paie.frais_panier
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


-- 4. Le bulletin porte les indemnités et signale les fériés ------------------
-- Les deux indemnités s'inscrivent en gain APRÈS les retenues : elles ne
-- passent ni par la C.N.S.S., ni par l'A.M.O., ni par l'I.G.R. Le pied du
-- bulletin dit combien de jours fériés ont été travaillés dans le mois.

create or replace function public.bulletin_paie(
  p_periode uuid,
  p_employee uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_co uuid;
  v_par record;
  v_bareme_vide boolean;
  v_res jsonb;
begin
  perform public.exiger_role('admin', 'paie');

  select company_id into v_co from public.periodes_paie where id = p_periode;
  if v_co is null then
    raise exception 'Période de paie introuvable.';
  end if;

  select coalesce(taux_cnss, 4.48) as taux_cnss,
         plafond_cnss,
         coalesce(taux_amo, 2.26) as taux_amo,
         coalesce(heures_mensuelles, 191) as heures_mensuelles,
         coalesce(seuil_igr, 6000) as seuil_igr,
         coalesce(devise, 'DH') as devise
    into v_par
    from public.parametres_paie where company_id = v_co;

  if v_par is null then
    select 4.48, null::numeric, 2.26, 191, 6000, 'DH'
      into v_par.taux_cnss, v_par.plafond_cnss, v_par.taux_amo,
           v_par.heures_mensuelles, v_par.seuil_igr, v_par.devise;
  end if;

  select not exists (select 1 from public.bareme_igr) into v_bareme_vide;

  with base as (
    select
      lp.*,
      pp.annee, pp.mois, pp.statut,
      c.name as entreprise_nom,
      e.date_embauche, e.adresse, e.situation_familiale, e.nombre_enfants,
      -- Assiette C.N.S.S. : écrêtée si un plafond est paramétré
      least(lp.salaire_brut, coalesce(v_par.plafond_cnss, lp.salaire_brut)) as assiette_cnss
    from public.lignes_paie lp
    join public.periodes_paie pp on pp.id = lp.periode_id
    join public.companies c on c.id = pp.company_id
    left join public.employees e on e.id = lp.employee_id
    where lp.periode_id = p_periode
      -- LE BULLETIN N'EST QUE POUR LES VIREMENTS
      and lower(coalesce(lp.mode_reglement, '')) like 'vir%'
      and (p_employee is null or lp.employee_id = p_employee)
  ),
  calc as (
    select b.*,
      round(b.assiette_cnss * v_par.taux_cnss / 100, 2) as mt_cnss,
      round(b.salaire_brut  * v_par.taux_amo  / 100, 2) as mt_amo
    from base b
  ),
  calc2 as (
    select c.*,
      case when c.salaire_brut >= v_par.seuil_igr
           then public.calculer_igr(c.salaire_brut - c.mt_cnss - c.mt_amo)
           else 0 end as igr
    from calc c
  ),
  -- Cumuls de l'année : tous les mois DÉJÀ VALIDÉS jusqu'à celui-ci inclus
  cumuls as (
    select lp.employee_id,
           sum(round(least(lp.salaire_brut,
               coalesce(v_par.plafond_cnss, lp.salaire_brut)) * v_par.taux_cnss / 100, 2)) as cum_cnss,
           sum(case when lp.salaire_brut >= v_par.seuil_igr
                    then public.calculer_igr(
                           lp.salaire_brut
                           - round(least(lp.salaire_brut, coalesce(v_par.plafond_cnss, lp.salaire_brut))
                                   * v_par.taux_cnss / 100, 2)
                           - round(lp.salaire_brut * v_par.taux_amo / 100, 2))
                    else 0 end) as cum_igr
      from public.lignes_paie lp
      join public.periodes_paie pp on pp.id = lp.periode_id
     where pp.company_id = v_co
       and pp.annee = (select annee from public.periodes_paie where id = p_periode)
       -- Le mois du bulletin compte toujours dans son propre cumul, même
       -- s'il vient d'être rouvert ; les mois antérieurs ne comptent que
       -- s'ils ont été validés.
       and (pp.id = p_periode
            or (pp.mois < (select mois from public.periodes_paie where id = p_periode)
                and pp.statut = 'paie_validee'))
       and lower(coalesce(lp.mode_reglement, '')) like 'vir%'
     group by lp.employee_id
  )
  select coalesce(jsonb_agg(x order by x->'employe'->>'nom_prenom'), '[]'::jsonb)
    into v_res
  from (
    select jsonb_build_object(
      'ligne_id', c.id,
      'employe', jsonb_build_object(
        'id', c.employee_id,
        'matricule', c.matricule,
        'nom_prenom', c.nom_prenom,
        'cin', c.cin,
        'cnss', c.cnss,
        'qualification', c.qualification,
        'adresse', c.adresse,
        'date_embauche', c.date_embauche,
        'situation_familiale', c.situation_familiale,
        'nombre_enfants', c.nombre_enfants,
        'banque', c.banque,
        'rib', c.rib,
        'site_nom', c.site_nom,
        'site_principal_nom', c.site_principal_nom
      ),
      'entreprise', jsonb_build_object('nom', c.entreprise_nom),
      'periode', jsonb_build_object(
        'annee', c.annee, 'mois', c.mois, 'statut', c.statut, 'devise', v_par.devise
      ),
      -- Le corps du bulletin, dans l'ordre d'impression
      'lignes', jsonb_build_array(
        jsonb_build_object('code', '001', 'libelle', 'SALAIRE BRUT',
          'base', c.salaire_base, 'taux', c.jours_payes,
          'gain', c.salaire_brut, 'retenue', null),
        jsonb_build_object('code', '068', 'libelle', 'COTISATION C.N.S.S.',
          'base', c.assiette_cnss, 'taux', v_par.taux_cnss,
          'gain', null, 'retenue', c.mt_cnss),
        jsonb_build_object('code', '069', 'libelle', 'ASSURANCE A.M.O.',
          'base', c.salaire_brut, 'taux', v_par.taux_amo,
          'gain', null, 'retenue', c.mt_amo),
        jsonb_build_object('code', '070', 'libelle', 'I.G.R.',
          'base', round(c.salaire_brut - c.mt_cnss - c.mt_amo, 2), 'taux', null,
          'gain', null, 'retenue', c.igr),
        jsonb_build_object('code', '010', 'libelle', 'FRAIS DE TRANSPORT',
          'base', null, 'taux', null,
          'gain', c.frais_transport, 'retenue', null),
        jsonb_build_object('code', '011', 'libelle', 'FRAIS DE PANIER',
          'base', null, 'taux', null,
          'gain', c.frais_panier, 'retenue', null),
        jsonb_build_object('code', '', 'libelle', 'GAIN NET',
          'base', null, 'taux', null,
          'gain', round(c.salaire_brut - c.mt_cnss - c.mt_amo - c.igr
                        + c.frais_transport + c.frais_panier, 2), 'retenue', null)
      ),
      'pied', jsonb_build_object(
        'jours_travailles', c.jours_payes,
        'jours_feries_travailles', c.jours_feries_travailles,
        'cumul_igr', coalesce(cu.cum_igr, 0),
        'cumul_cnss', coalesce(cu.cum_cnss, 0),
        'heures_salariales', v_par.heures_mensuelles,
        'net_a_payer', round(c.salaire_brut - c.mt_cnss - c.mt_amo - c.igr
                             + c.frais_transport + c.frais_panier, 2)
      ),
      'frais_transport', c.frais_transport,
      'frais_panier', c.frais_panier,
      -- Le net RÉEL versé tient compte des primes et retenues internes ;
      -- il peut différer du GAIN NET fiscal ci-dessus. On expose les deux.
      'net_verse', c.net_a_payer,
      'prime', c.prime,
      'retenues_internes', c.retenue_dette + c.autres_retenues,
      'bareme_igr_absent', v_bareme_vide and c.salaire_brut >= v_par.seuil_igr
    ) as x
    from calc2 c
    left join cumuls cu on cu.employee_id = c.employee_id
  ) q;

  return v_res;
end;
$$;

revoke all on function public.bulletin_paie(uuid, uuid) from public;
grant execute on function public.bulletin_paie(uuid, uuid) to authenticated;
