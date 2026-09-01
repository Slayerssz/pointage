-- ============================================================
-- 032 — Bulletin de paie (employés payés par virement)
-- À exécuter après 031_analytics_paie.sql
--
-- Le bulletin ne concerne que les employés réglés par virement :
-- ce sont eux qui sont déclarés à la C.N.S.S.  Les employés payés
-- en espèces gardent le bulletin de présence existant.
--
-- Ce qui est calculé ici :
--   SALAIRE BRUT   base = salaire mensuel, jours = jours payés
--   C.N.S.S.       brut × taux_cnss  (4,48 % par défaut)
--   A.M.O.         brut × taux_amo   (2,26 % par défaut)
--   I.G.R.         selon le barème saisi dans bareme_igr
--   GAIN NET       brut − retenues
--
-- Les taux et le seuil sont des PARAMÈTRES, pas des constantes :
-- ils se modifient sans nouvelle migration.
-- ============================================================

-- ---------- 1. Les paramètres de cotisation ----------

alter table public.parametres_paie
  add column if not exists taux_cnss numeric(5, 2) not null default 4.48
    check (taux_cnss >= 0 and taux_cnss <= 100),
  -- Plafond mensuel de l'assiette C.N.S.S.  NULL = pas de plafond,
  -- c'est-à-dire le calcul demandé : brut × 4,48 %, sans écrêtage.
  -- Au Maroc l'assiette est en principe plafonnée à 6 000 DH ; mettez
  -- 6000 ici si votre comptable le confirme.
  add column if not exists plafond_cnss numeric(10, 2)
    check (plafond_cnss is null or plafond_cnss > 0),
  add column if not exists taux_amo numeric(5, 2) not null default 2.26
    check (taux_amo >= 0 and taux_amo <= 100),
  -- Heures salariales portées en pied de bulletin (191 h légales au Maroc)
  add column if not exists heures_mensuelles numeric(6, 1) not null default 191,
  -- En dessous de ce brut, aucun I.G.R. n'est retenu
  add column if not exists seuil_igr numeric(10, 2) not null default 6000;

-- ---------- 2. Le barème de l'I.G.R. ----------

-- Volontairement VIDE au départ : tant qu'aucune tranche n'est saisie,
-- l'I.G.R. vaut 0 et le bulletin le signale. Aucun taux n'est inventé.
create table if not exists public.bareme_igr (
  id uuid primary key default gen_random_uuid(),
  salaire_min numeric(10, 2) not null check (salaire_min >= 0),
  salaire_max numeric(10, 2),               -- null = « et au-delà »
  taux numeric(5, 2) not null check (taux >= 0 and taux <= 100),
  somme_a_deduire numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  check (salaire_max is null or salaire_max > salaire_min)
);
create index if not exists bareme_igr_min_idx on public.bareme_igr (salaire_min);

alter table public.bareme_igr enable row level security;

drop policy if exists bareme_igr_lecture on public.bareme_igr;
create policy bareme_igr_lecture on public.bareme_igr
  for select to authenticated using (true);

-- L'écriture passe uniquement par les fonctions ci-dessous.

create or replace function public.maj_bareme_igr(p_tranches jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  perform public.exiger_role('admin');

  if p_tranches is null or jsonb_typeof(p_tranches) <> 'array' then
    raise exception 'Le barème doit être une liste de tranches.';
  end if;

  delete from public.bareme_igr;

  insert into public.bareme_igr (salaire_min, salaire_max, taux, somme_a_deduire)
  select (t->>'salaire_min')::numeric,
         nullif(t->>'salaire_max', '')::numeric,
         (t->>'taux')::numeric,
         coalesce((t->>'somme_a_deduire')::numeric, 0)
  from jsonb_array_elements(p_tranches) t;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.maj_bareme_igr(jsonb) from public;
grant execute on function public.maj_bareme_igr(jsonb) to authenticated;

-- ---------- 3. Le calcul de l'I.G.R. ----------

create or replace function public.calculer_igr(p_base numeric)
returns numeric
language sql
stable
set search_path = public
as $$
  select round(greatest(0, coalesce(
    (select p_base * b.taux / 100 - b.somme_a_deduire
       from public.bareme_igr b
      where p_base >= b.salaire_min
        and (b.salaire_max is null or p_base <= b.salaire_max)
      order by b.salaire_min desc
      limit 1), 0)), 2);
$$;

-- ---------- 4. Le bulletin ----------

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
        jsonb_build_object('code', '', 'libelle', 'GAIN NET',
          'base', null, 'taux', null,
          'gain', round(c.salaire_brut - c.mt_cnss - c.mt_amo - c.igr, 2), 'retenue', null)
      ),
      'pied', jsonb_build_object(
        'jours_travailles', c.jours_payes,
        'cumul_igr', coalesce(cu.cum_igr, 0),
        'cumul_cnss', coalesce(cu.cum_cnss, 0),
        'heures_salariales', v_par.heures_mensuelles,
        'net_a_payer', round(c.salaire_brut - c.mt_cnss - c.mt_amo - c.igr, 2)
      ),
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
