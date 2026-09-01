-- ============================================================
-- 031 — Les chiffres de la paie dans Analytics
-- À exécuter après 030_verrou_analytics.sql
--
-- Ce que l'écran Analytics ne savait pas montrer : combien a-t-on
-- payé, sur quel mois, en espèces ou par virement, et vers quelle
-- banque. Tout est déjà en base — il manquait la lecture.
-- ============================================================

create or replace function public.analytics_paie(
  p_company uuid default null,
  p_annee int default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_annee int := coalesce(p_annee, date_part('year', (now() at time zone 'Africa/Casablanca'))::int);
  v_res jsonb;
begin
  perform public.exiger_role('admin', 'paie');

  select jsonb_build_object(
    'annee', v_annee,

    -- Mois par mois, uniquement les paies validées
    'par_mois', (
      select coalesce(jsonb_agg(x order by (x->>'mois')::int), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'mois', pp.mois,
          'statut', pp.statut::text,
          'employes', count(lp.id),
          'brut', coalesce(sum(lp.salaire_brut), 0),
          'primes', coalesce(sum(lp.prime), 0),
          'retenues', coalesce(sum(lp.retenue_dette + lp.autres_retenues), 0),
          'net', coalesce(sum(lp.net_a_payer), 0),
          'virement', coalesce(sum(lp.net_a_payer) filter (
            where lower(coalesce(lp.mode_reglement, '')) like 'vir%'), 0),
          'especes', coalesce(sum(lp.net_a_payer) filter (
            where lower(coalesce(lp.mode_reglement, '')) not like 'vir%'), 0),
          'heures', coalesce(sum(lp.heures_effectuees), 0)
        ) as x
        from public.periodes_paie pp
        left join public.lignes_paie lp on lp.periode_id = pp.id
        where pp.annee = v_annee
          and (p_company is null or pp.company_id = p_company)
        group by pp.mois, pp.statut
      ) t
    ),

    -- Cumul de l'année
    'annee_totaux', (
      select jsonb_build_object(
        'mois_validés', count(distinct pp.mois) filter (where pp.statut = 'paie_validee'),
        'brut', coalesce(sum(lp.salaire_brut), 0),
        'net', coalesce(sum(lp.net_a_payer), 0),
        'primes', coalesce(sum(lp.prime), 0),
        'retenues', coalesce(sum(lp.retenue_dette + lp.autres_retenues), 0),
        'virement', coalesce(sum(lp.net_a_payer) filter (
          where lower(coalesce(lp.mode_reglement, '')) like 'vir%'), 0),
        'especes', coalesce(sum(lp.net_a_payer) filter (
          where lower(coalesce(lp.mode_reglement, '')) not like 'vir%'), 0)
      )
      from public.periodes_paie pp
      join public.lignes_paie lp on lp.periode_id = pp.id
      where pp.annee = v_annee and pp.statut = 'paie_validee'
        and (p_company is null or pp.company_id = p_company)
    ),

    -- Répartition par banque, sur l'année
    'par_banque', (
      select coalesce(jsonb_agg(jsonb_build_object('banque', b, 'employes', n, 'montant', m)
                                order by m desc), '[]'::jsonb)
      from (
        select coalesce(nullif(trim(lp.banque), ''), '(non renseignée)') as b,
               count(*) as n, sum(lp.net_a_payer) as m
        from public.periodes_paie pp
        join public.lignes_paie lp on lp.periode_id = pp.id
        where pp.annee = v_annee and pp.statut = 'paie_validee'
          and lower(coalesce(lp.mode_reglement, '')) like 'vir%'
          and (p_company is null or pp.company_id = p_company)
        group by 1
      ) q
    ),

    -- Ce que chaque site principal coûte sur l'année
    'par_site_principal', (
      select coalesce(jsonb_agg(jsonb_build_object('site', s, 'employes', n, 'montant', m)
                                order by m desc), '[]'::jsonb)
      from (
        select coalesce(nullif(trim(lp.site_principal_nom), ''), '(sans site principal)') as s,
               count(distinct lp.employee_id) as n, sum(lp.net_a_payer) as m
        from public.periodes_paie pp
        join public.lignes_paie lp on lp.periode_id = pp.id
        where pp.annee = v_annee and pp.statut = 'paie_validee'
          and (p_company is null or pp.company_id = p_company)
        group by 1
      ) q
    ),

    -- Les dettes encore ouvertes
    'dettes', (
      select jsonb_build_object(
        'employes', count(*),
        'total', coalesce(sum(dette), 0)
      )
      from public.employees
      where dette > 0 and actif
        and (p_company is null or company_id = p_company)
    ),

    -- Masse salariale théorique : ce que coûterait un mois complet
    'masse_mensuelle_theorique', (
      select coalesce(sum(salaire), 0) from public.employees
      where actif and (p_company is null or company_id = p_company)
    )
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.analytics_paie(uuid, int) from public;
grant execute on function public.analytics_paie(uuid, int) to authenticated;
