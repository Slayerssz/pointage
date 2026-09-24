-- ============================================================================
--  BLOC 33 sur 34 — La paie du mois est toujours ouverte
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 32.
--
--  Avant : la paie d'un mois n'existait qu'une fois le pointage clôturé.
--  Le bureau travaillait un mois entier sans rien voir, et découvrait les
--  erreurs à la fin.
--
--  Après : le mois en cours a toujours sa paie, recalculée à chaque fois
--  qu'on l'ouvre, d'après le pointage du jour. On la lit, on la corrige,
--  on voit venir les problèmes.
--
--  La clôture se fait à deux mains :
--     1. le mois se termine → le bureau voit « Demander la validation » ;
--     2. l'administrateur accepte → le mois est validé et verrouillé.
--
--  Un mois verrouillé s'imprime encore — bulletins, ordres de virement,
--  listes — mais ne se modifie plus, sauf réouverture par l'administrateur.
--
--  Ce que le bureau saisit (prime, dette, transport, panier) n'est jamais
--  écrasé par un recalcul : seul le pointage est relu.
-- ============================================================================

-- ============================================================
-- 050 — La paie du mois est toujours là
-- À exécuter après 049_statut_validation_demandee.sql
--
-- Jusqu'ici, la paie d'un mois n'existait qu'une fois le pointage
-- clôturé : le bureau travaillait un mois entier sans voir ce qu'il
-- préparait, et découvrait les surprises à la fin.
--
-- Désormais le mois en cours a toujours sa paie, ouverte, recalculée
-- à chaque consultation d'après le pointage. On la lit, on la corrige,
-- on voit venir les erreurs.
--
-- La clôture se fait à deux mains :
--   le bureau DEMANDE la validation, une fois le mois terminé ;
--   l'administrateur l'ACCEPTE — et le mois se verrouille.
-- Verrouillé, tout s'imprime encore ; plus rien ne se modifie, sauf
-- si l'administrateur rouvre le mois.
-- ============================================================

-- 1. La paie du mois, créée au besoin ----------------------------------------
-- Renvoie la période du mois demandé, en la créant si elle n'existe pas,
-- et en rafraîchissant ses lignes tant qu'elle n'est pas verrouillée.
-- Les montants saisis à la paie (prime, dette, transport, panier) sont
-- conservés : c'est generer_lignes_paie qui s'en charge.

create or replace function public.periode_du_mois(
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
  v_id uuid;
  v_statut public.periode_statut;
  v_par public.parametres_paie%rowtype;
  v_debut date;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
begin
  perform public.exiger_role('validator', 'admin', 'paie');

  if p_mois < 1 or p_mois > 12 then
    raise exception 'Mois invalide : %', p_mois;
  end if;
  v_debut := make_date(p_annee, p_mois, 1);
  if v_debut > v_today then
    raise exception 'Ce mois n''a pas encore commencé.';
  end if;

  select id, statut into v_id, v_statut
    from public.periodes_paie
   where company_id = p_company and annee = p_annee and mois = p_mois;

  if v_id is null then
    select * into v_par from public.parametres_paie where company_id = p_company;
    if v_par.company_id is null then
      insert into public.parametres_paie (company_id) values (p_company)
        on conflict (company_id) do nothing;
      select * into v_par from public.parametres_paie where company_id = p_company;
    end if;

    insert into public.periodes_paie
      (company_id, annee, mois, statut, jours_base, maladie_payee, conge_paye)
    values
      (p_company, p_annee, p_mois, 'ouvert', v_par.jours_base,
       v_par.maladie_payee, v_par.conge_paye)
    on conflict (company_id, annee, mois) do nothing
    returning id into v_id;

    if v_id is null then
      select id, statut into v_id, v_statut
        from public.periodes_paie
       where company_id = p_company and annee = p_annee and mois = p_mois;
    else
      v_statut := 'ouvert';
    end if;
  end if;

  -- Un mois verrouillé ou en attente de l'administrateur ne bouge plus :
  -- ce qu'on y lit doit être ce qui a été validé.
  if v_statut in ('ouvert', 'pointage_valide', 'reouverture_demandee') then
    perform public.generer_lignes_paie(v_id);
  end if;

  return v_id;
end;
$$;

-- 2. Le bureau demande la validation -----------------------------------------
-- Seulement une fois le mois terminé : valider un mois en cours reviendrait
-- à arrêter la paie avant d'avoir pointé les derniers jours.

create or replace function public.demander_validation_paie(p_periode uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.periodes_paie%rowtype;
  v_dernier date;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
begin
  perform public.exiger_role('validator', 'admin', 'paie');

  select * into v_p from public.periodes_paie where id = p_periode for update;
  if v_p.id is null then
    raise exception 'Période introuvable.';
  end if;
  if v_p.statut = 'paie_validee' then
    raise exception 'Cette paie est déjà validée.';
  end if;
  if v_p.statut = 'validation_demandee' then
    raise exception 'La validation a déjà été demandée ; elle attend l''administrateur.';
  end if;

  v_dernier := (make_date(v_p.annee, v_p.mois, 1) + interval '1 month - 1 day')::date;
  if v_today < v_dernier then
    raise exception
      'Le mois n''est pas terminé : la validation s''ouvrira le %.',
      to_char(v_dernier, 'DD/MM/YYYY');
  end if;

  if exists (select 1 from public.pointages
              where company_id = v_p.company_id and status = 'pending'
                and pointed_on between make_date(v_p.annee, v_p.mois, 1) and v_dernier) then
    raise exception 'Il reste des pointages en attente de validation sur ce mois.';
  end if;

  -- Un dernier calcul avant de figer : le pointage a pu bouger aujourd'hui.
  perform public.generer_lignes_paie(p_periode);

  if exists (select 1 from public.lignes_paie
              where periode_id = p_periode and net_a_payer < 0) then
    raise exception 'Un net à payer est négatif : corrigez les retenues avant de demander la validation.';
  end if;

  update public.periodes_paie
     set statut = 'validation_demandee',
         pointage_valide_par = auth.uid(),
         pointage_valide_le = now()
   where id = p_periode;
end;
$$;

-- 3. Le bureau peut retirer sa demande ---------------------------------------

create or replace function public.annuler_demande_validation(p_periode uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut public.periode_statut;
begin
  perform public.exiger_role('validator', 'admin', 'paie');

  select statut into v_statut from public.periodes_paie where id = p_periode for update;
  if v_statut is null then
    raise exception 'Période introuvable.';
  end if;
  if v_statut <> 'validation_demandee' then
    raise exception 'Aucune demande de validation en cours sur ce mois.';
  end if;

  update public.periodes_paie
     set statut = 'ouvert', pointage_valide_par = null, pointage_valide_le = null
   where id = p_periode;
end;
$$;

-- 4. L'administrateur accepte, ou refuse -------------------------------------
-- Accepter, c'est valider la paie : les retenues de dette s'imputent et le
-- mois se verrouille. C'est valider_paie qui fait ce travail.

create or replace function public.repondre_validation_paie(
  p_periode uuid,
  p_accepter boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut public.periode_statut;
begin
  perform public.exiger_role('admin');

  select statut into v_statut from public.periodes_paie where id = p_periode for update;
  if v_statut is null then
    raise exception 'Période introuvable.';
  end if;
  if v_statut <> 'validation_demandee' then
    raise exception 'Ce mois n''attend pas de réponse : son état est « % ».', v_statut;
  end if;

  if p_accepter then
    perform public.valider_paie(p_periode);
  else
    update public.periodes_paie
       set statut = 'ouvert', pointage_valide_par = null, pointage_valide_le = null
     where id = p_periode;
  end if;
end;
$$;

revoke all on function public.periode_du_mois(uuid, int, int) from public;
revoke all on function public.demander_validation_paie(uuid) from public;
revoke all on function public.annuler_demande_validation(uuid) from public;
revoke all on function public.repondre_validation_paie(uuid, boolean) from public;
grant execute on function public.periode_du_mois(uuid, int, int) to authenticated;
grant execute on function public.demander_validation_paie(uuid) to authenticated;
grant execute on function public.annuler_demande_validation(uuid) to authenticated;
grant execute on function public.repondre_validation_paie(uuid, boolean) to authenticated;


-- ============================================================================
--  ▶ CONTRÔLE — à lancer après, en sélectionnant ces lignes seules
--    L'état de la paie de chaque société, mois par mois.
-- ============================================================================

-- select c.name as societe, pp.annee, pp.mois, pp.statut,
--        (select count(*) from public.lignes_paie lp where lp.periode_id = pp.id) as lignes
--   from public.periodes_paie pp
--   join public.companies c on c.id = pp.company_id
--  order by pp.annee desc, pp.mois desc, c.name;
