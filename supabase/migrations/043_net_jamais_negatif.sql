-- ============================================================
-- 043 — Un net à payer ne peut pas être négatif
-- À exécuter après 042_modele_par_societe.sql
--
-- Les montants saisis étaient bien contrôlés un par un — aucun ne
-- pouvait être négatif — mais rien ne vérifiait leur somme. Une retenue
-- de 99 999 DH sur un salaire de 4 000 donnait un net de −95 999,00 DH,
-- accepté sans un mot, imprimé sur le bulletin et repris dans l'Excel.
--
-- Une retenue ne peut pas dépasser ce qu'il y a à retenir.
-- ============================================================

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
  v_statut public.periode_statut;
  v_prime numeric;
  v_dette numeric;
  v_autres numeric;
  v_brut numeric;
  v_net numeric;
begin
  perform public.exiger_role('paie', 'admin');

  select pp.statut, lp.salaire_brut, lp.prime, lp.retenue_dette, lp.autres_retenues
    into v_statut, v_brut, v_prime, v_dette, v_autres
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

  v_prime  := coalesce(p_prime, v_prime);
  v_dette  := coalesce(p_retenue_dette, v_dette);
  v_autres := coalesce(p_autres_retenues, v_autres);

  if v_prime < 0 or v_dette < 0 or v_autres < 0 then
    raise exception 'Les montants ne peuvent pas être négatifs.';
  end if;

  v_net := round(v_brut + v_prime - v_dette - v_autres, 2);
  if v_net < 0 then
    raise exception
      'Les retenues (% DH) dépassent le salaire et les primes (% DH) : le net serait de % DH. '
      'Étalez la retenue sur plusieurs mois.',
      to_char(v_dette + v_autres, 'FM999999990.00'),
      to_char(v_brut + v_prime, 'FM999999990.00'),
      to_char(v_net, 'FM999999990.00');
  end if;

  update public.lignes_paie
    set prime = v_prime,
        retenue_dette = v_dette,
        autres_retenues = v_autres,
        observations = coalesce(nullif(trim(p_observations), ''), observations),
        net_a_payer = v_net
    where id = p_ligne;
end;
$$;

-- Ceinture et bretelles : la table elle-même refuse un net négatif, quel
-- que soit le chemin par lequel on y arrive.
alter table public.lignes_paie drop constraint if exists lignes_paie_net_positif;
alter table public.lignes_paie
  add constraint lignes_paie_net_positif check (net_a_payer >= 0);
