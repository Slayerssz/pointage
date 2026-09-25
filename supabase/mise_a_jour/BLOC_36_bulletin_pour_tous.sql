-- ============================================================================
--  BLOC 36 sur 37 — Le bulletin de paie pour tout le monde
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 35.
--
--  Le bulletin ne se limite plus aux employés payés par virement :
--  espèces et versements en ont un aussi.
--
--  Le mode de règlement réel s'imprime — jusqu'ici le bulletin affichait
--  « Virement » en dur, ce qui serait devenu faux.
-- ============================================================================

-- ============================================================
-- 053 — Le bulletin de paie pour tout le monde
-- À exécuter après 052_bulletin_saisi.sql
--
-- Le bulletin était réservé aux employés payés par virement, au
-- motif qu'eux seuls sont déclarés à la C.N.S.S. Le bureau en veut
-- pour tous : espèces et versements y ont droit aussi.
--
-- Le mode de règlement réel remonte désormais avec le bulletin —
-- il y était écrit « Virement » en dur, ce qui serait devenu faux.
-- ============================================================

create or replace function public.bulletin_paie(
  p_periode uuid,
  p_employee uuid default null,
  -- Saisis à l'édition du bulletin, pour UN employé à la fois. Laissés
  -- vides, ce sont les chiffres de la paie qui servent.
  p_salaire_brut numeric default null,
  p_jours numeric default null,
  p_avance numeric default null
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

  if p_employee is null and
     (p_salaire_brut is not null or p_jours is not null or p_avance is not null) then
    raise exception 'Les montants saisis ne valent que pour un employé à la fois.';
  end if;
  if coalesce(p_salaire_brut, 0) < 0 or coalesce(p_jours, 0) < 0 or coalesce(p_avance, 0) < 0 then
    raise exception 'Un montant saisi ne peut pas être négatif.';
  end if;

  with base as (
    select
      lp.* ,
      -- Ce que l'utilisateur a saisi prime sur ce que la paie a calculé.
      coalesce(p_salaire_brut, lp.salaire_brut) as brut_retenu,
      coalesce(p_jours, lp.jours_payes)         as jours_retenus,
      coalesce(p_avance, 0)                     as avance,
      pp.annee, pp.mois, pp.statut,
      c.name as entreprise_nom,
      e.date_embauche, e.adresse, e.situation_familiale, e.nombre_enfants,
      -- Assiette C.N.S.S. : écrêtée si un plafond est paramétré
      least(coalesce(p_salaire_brut, lp.salaire_brut),
            coalesce(v_par.plafond_cnss, coalesce(p_salaire_brut, lp.salaire_brut))) as assiette_cnss
    from public.lignes_paie lp
    join public.periodes_paie pp on pp.id = lp.periode_id
    join public.companies c on c.id = pp.company_id
    left join public.employees e on e.id = lp.employee_id
    where lp.periode_id = p_periode
      and (p_employee is null or lp.employee_id = p_employee)
  ),
  calc as (
    select b.*,
      round(b.assiette_cnss * v_par.taux_cnss / 100, 2) as mt_cnss,
      round(b.brut_retenu   * v_par.taux_amo  / 100, 2) as mt_amo
    from base b
  ),
  calc2 as (
    select c.*,
      case when c.brut_retenu >= v_par.seuil_igr
           then public.calculer_igr(c.brut_retenu - c.mt_cnss - c.mt_amo)
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
        'mode_reglement', c.mode_reglement,
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
          'base', c.salaire_base, 'taux', c.jours_retenus,
          'gain', c.brut_retenu, 'retenue', null),
        jsonb_build_object('code', '068', 'libelle', 'COTISATION C.N.S.S.',
          'base', c.assiette_cnss, 'taux', v_par.taux_cnss,
          'gain', null, 'retenue', c.mt_cnss),
        jsonb_build_object('code', '069', 'libelle', 'ASSURANCE A.M.O.',
          'base', c.brut_retenu, 'taux', v_par.taux_amo,
          'gain', null, 'retenue', c.mt_amo),
        jsonb_build_object('code', '070', 'libelle', 'I.G.R.',
          'base', round(c.brut_retenu - c.mt_cnss - c.mt_amo, 2), 'taux', null,
          'gain', null, 'retenue', c.igr),
        jsonb_build_object('code', '012', 'libelle', 'AVANCE',
          'base', null, 'taux', null,
          'gain', null, 'retenue', c.avance),
        jsonb_build_object('code', '010', 'libelle', 'FRAIS DE TRANSPORT',
          'base', null, 'taux', null,
          'gain', c.frais_transport, 'retenue', null),
        jsonb_build_object('code', '011', 'libelle', 'FRAIS DE PANIER',
          'base', null, 'taux', null,
          'gain', c.frais_panier, 'retenue', null),
        jsonb_build_object('code', '', 'libelle', 'GAIN NET',
          'base', null, 'taux', null,
          'gain', round(c.brut_retenu - c.mt_cnss - c.mt_amo - c.igr
                        + c.frais_transport + c.frais_panier - c.avance, 2), 'retenue', null)
      ),
      'pied', jsonb_build_object(
        'jours_travailles', c.jours_retenus,
        'jours_feries_travailles', c.jours_feries_travailles,
        'cumul_igr', coalesce(cu.cum_igr, 0),
        'cumul_cnss', coalesce(cu.cum_cnss, 0),
        'heures_salariales', v_par.heures_mensuelles,
        'net_a_payer', round(c.brut_retenu - c.mt_cnss - c.mt_amo - c.igr
                             + c.frais_transport + c.frais_panier - c.avance, 2)
      ),
      'frais_transport', c.frais_transport,
      'frais_panier', c.frais_panier,
      -- Le net RÉEL versé tient compte des primes et retenues internes ;
      -- il peut différer du GAIN NET fiscal ci-dessus. On expose les deux.
      'net_verse', case when p_salaire_brut is null and p_avance is null
                        then c.net_a_payer
                        else round(c.brut_retenu - c.mt_cnss - c.mt_amo - c.igr
                                   + c.frais_transport + c.frais_panier - c.avance, 2) end,
      'avance', c.avance,
      'prime', c.prime,
      'retenues_internes', c.retenue_dette + c.autres_retenues,
      'bareme_igr_absent', v_bareme_vide and c.brut_retenu >= v_par.seuil_igr
    ) as x
    from calc2 c
    left join cumuls cu on cu.employee_id = c.employee_id
  ) q;

  return v_res;
end;
$$;

revoke all on function public.bulletin_paie(uuid, uuid, numeric, numeric, numeric) from public;
grant execute on function public.bulletin_paie(uuid, uuid, numeric, numeric, numeric)
  to authenticated;

-- L'ancienne signature à deux arguments s'efface : deux fonctions du même
-- nom rendraient l'appel ambigu quand l'application omet les trois derniers.
drop function if exists public.bulletin_paie(uuid, uuid);
