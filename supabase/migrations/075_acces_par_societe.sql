-- ============================================================
-- 075 — Un compte n'ouvre que les sociétés qu'on lui confie
-- À exécuter après 074_remplacant_depuis_employe.sql
--
-- Jusqu'ici, les sociétés confiées ne décidaient que du pointage, et
-- seulement pour les comptes « personnel ». Tout le monde voyait tout le
-- reste : les douze sociétés, leurs employés, leurs pointages, leurs
-- paies. Un chef de site qui n'a affaire qu'à une société lisait les
-- salaires des onze autres.
--
-- Désormais la liste décide de la LECTURE, et pas seulement de la
-- saisie — en base, et non dans l'écran : refuser un onglet ne protège
-- rien, l'adresse suffisait à passer outre.
--
-- CE QUI NE CHANGE POUR PERSONNE AUJOURD'HUI
--
-- Un compte SANS aucune société cochée continue de tout voir, comme
-- avant. C'est la migration : personne ne perd son accès du jour au
-- lendemain, et l'administrateur restreint les comptes un par un, quand
-- il le décide. Un compte administrateur voit tout, toujours.
-- ============================================================

-- 1. Qui a le droit de voir quelle société ------------------------------------

create or replace function public.peut_voir_societe(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- L'administrateur tient le groupe entier.
    when coalesce(public.current_user_role()::text, '') = 'admin' then true
    -- Aucune société confiée : le compte n'a pas été restreint, il voit
    -- tout — l'état d'avant cette règle.
    when not exists (select 1 from public.acces_societes where user_id = auth.uid())
      then true
    else exists (select 1 from public.acces_societes
                  where user_id = auth.uid() and company_id = p_company)
  end;
$$;

revoke all on function public.peut_voir_societe(uuid) from public;
grant execute on function public.peut_voir_societe(uuid) to authenticated;

-- 2. Pointer suit la même liste -----------------------------------------------

create or replace function public.peut_pointer(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case coalesce(public.current_user_role()::text, '')
    when 'admin' then true
    -- Le bureau et le personnel pointent les sociétés qu'on leur a
    -- confiées. Sans liste, toutes — comme avant.
    when 'validator' then public.peut_voir_societe(p_company)
    when 'rh' then exists (
      select 1 from public.acces_societes
       where user_id = auth.uid() and company_id = p_company)
    else false
  end;
$$;

revoke all on function public.peut_pointer(uuid) from public;
grant execute on function public.peut_pointer(uuid) to authenticated;

-- 3. L'administrateur confie à n'importe quel compte --------------------------

create or replace function public.admin_definir_acces_societes(
  p_user uuid,
  p_companies uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  perform public.exiger_role('admin');

  select role::text into v_role from public.profiles where user_id = p_user;
  if v_role is null then
    raise exception 'Compte introuvable.';
  end if;
  if v_role = 'admin' then
    raise exception 'Un administrateur tient le groupe entier : il ne se restreint pas.';
  end if;

  delete from public.acces_societes
   where user_id = p_user
     and company_id <> all (coalesce(p_companies, '{}'::uuid[]));

  insert into public.acces_societes (user_id, company_id, accorde_par)
  select p_user, c, auth.uid()
    from unnest(coalesce(p_companies, '{}'::uuid[])) as c
   where exists (select 1 from public.companies where id = c)
  on conflict (user_id, company_id) do nothing;
end;
$$;

revoke all on function public.admin_definir_acces_societes(uuid, uuid[]) from public;
grant execute on function public.admin_definir_acces_societes(uuid, uuid[]) to authenticated;

-- 4. La lecture, table par table ----------------------------------------------
--  Les règles de lecture disaient « true » : tout compte connecté lisait
--  tout. On les remplace, en gardant leur nom — deux règles permissives
--  s'additionnent, remplacer est le seul moyen de restreindre.

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated using (public.peut_voir_societe(id));

do $regles$
declare
  v_table text;
begin
  foreach v_table in array array[
    'sites', 'sites_principaux', 'employees', 'pointages', 'contrats', 'conges',
    'periodes_paie', 'parametres_paie', 'bulletins_emis', 'jours_feries']
  loop
    execute format('drop policy if exists %I on public.%I', v_table || '_select', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.peut_voir_societe(company_id))',
      v_table || '_select', v_table);
  end loop;
end $regles$;

-- Les lignes de paie n'ont pas de colonne société : elles la tiennent de
-- leur période.
drop policy if exists lignes_paie_select on public.lignes_paie;
create policy lignes_paie_select on public.lignes_paie
  for select to authenticated using (
    exists (select 1 from public.periodes_paie p
             where p.id = lignes_paie.periode_id
               and public.peut_voir_societe(p.company_id)));

-- Les sorties et les documents étaient déjà réservés au bureau et à
-- l'administrateur : ils suivent en plus la société.
drop policy if exists sorties_lecture on public.sorties;
create policy sorties_lecture on public.sorties
  for select to authenticated using (
    public.current_user_role() = any (array['admin', 'validator']::public.user_role[])
    and public.peut_voir_societe(company_id));

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated using (
    coalesce(public.current_user_role()::text, '') = any (array['validator', 'admin'])
    and public.peut_voir_societe(company_id));

-- Ce qui reste commun au groupe le reste : les remplaçants et leurs
-- journées ne sont la propriété d'aucune société, et le barème de
-- l'I.G.R. est celui du pays.

-- 5. Créer un compte avec ses sociétés, d'un seul geste -----------------------
--  Créer puis rattacher en deux appels laissait un intervalle où le
--  compte voyait tout le groupe. Ici les deux tiennent dans la même
--  transaction : ou le compte naît avec sa liste, ou il ne naît pas.

create or replace function public.admin_creer_utilisateur_avec_acces(
  p_username text,
  p_password text,
  p_full_name text,
  p_role text,
  p_companies uuid[] default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_user uuid;
begin
  perform public.exiger_role('admin');

  v_username := public.admin_creer_utilisateur(p_username, p_password, p_full_name, p_role);

  if p_companies is not null and array_length(p_companies, 1) is not null
     and coalesce(p_role, '') <> 'admin' then
    select user_id into v_user from public.profiles where username = v_username;
    perform public.admin_definir_acces_societes(v_user, p_companies);
  end if;

  return v_username;
end;
$$;

revoke all on function public.admin_creer_utilisateur_avec_acces(text, text, text, text, uuid[]) from public;
grant execute on function public.admin_creer_utilisateur_avec_acces(text, text, text, text, uuid[]) to authenticated;
