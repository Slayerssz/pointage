-- ============================================================
-- 019 — Entreprises, sites et droits par rôle
-- À exécuter après 018_role_paie.sql
--
-- Qui fait quoi :
--   admin      → tout, et SEUL à pouvoir créer une entreprise
--   validator  → crée les sites, gère les employés, valide le pointage
--   paie       → la paie et les bulletins de paie
--   agent      → pointe sur le terrain
-- ============================================================

-- 1. Le responsable de paie doit voir les employés et les pointages ------------
-- (les policies de lecture existantes sont déjà « using (true) » pour tout
--  utilisateur connecté : rien à changer côté SELECT.)

-- 2. Entreprises : création réservée à l'administrateur -------------------------
-- Aucune policy INSERT/UPDATE/DELETE sur public.companies : tout passe par
-- les fonctions ci-dessous, qui vérifient le rôle.

create or replace function public.admin_creer_entreprise(p_nom text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nom text := trim(p_nom);
begin
  if coalesce(public.current_user_role()::text, '') <> 'admin' then
    raise exception 'Seul l''administrateur peut créer une entreprise';
  end if;
  if v_nom = '' then
    raise exception 'Le nom de l''entreprise est obligatoire';
  end if;
  if exists (select 1 from public.companies where lower(name) = lower(v_nom)) then
    raise exception 'Une entreprise porte déjà ce nom';
  end if;

  insert into public.companies (name) values (v_nom) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_creer_entreprise(text) from public;
grant execute on function public.admin_creer_entreprise(text) to authenticated;

create or replace function public.admin_renommer_entreprise(p_company uuid, p_nom text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text := trim(p_nom);
begin
  if coalesce(public.current_user_role()::text, '') <> 'admin' then
    raise exception 'Seul l''administrateur peut modifier une entreprise';
  end if;
  if v_nom = '' then
    raise exception 'Le nom de l''entreprise est obligatoire';
  end if;
  if exists (select 1 from public.companies where lower(name) = lower(v_nom) and id <> p_company) then
    raise exception 'Une entreprise porte déjà ce nom';
  end if;

  update public.companies set name = v_nom where id = p_company;
end;
$$;

revoke all on function public.admin_renommer_entreprise(uuid, text) from public;
grant execute on function public.admin_renommer_entreprise(uuid, text) to authenticated;

-- 3. Sites : création par le validateur (et l'admin) ------------------------------

create or replace function public.creer_site(
  p_company uuid,
  p_nom text,
  p_pointage_actif boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nom text := trim(p_nom);
begin
  if coalesce(public.current_user_role()::text, '') not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs et à l''administrateur';
  end if;
  if v_nom = '' then
    raise exception 'Le nom du site est obligatoire';
  end if;
  if exists (select 1 from public.sites
             where company_id = p_company and lower(name) = lower(v_nom)) then
    raise exception 'Ce site existe déjà dans cette entreprise';
  end if;

  insert into public.sites (company_id, name, pointage_actif)
  values (p_company, v_nom, coalesce(p_pointage_actif, true))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.creer_site(uuid, text, boolean) from public;
grant execute on function public.creer_site(uuid, text, boolean) to authenticated;

create or replace function public.maj_site(
  p_site uuid,
  p_nom text,
  p_pointage_actif boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_nom text := trim(p_nom);
begin
  if coalesce(public.current_user_role()::text, '') not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs et à l''administrateur';
  end if;
  if v_nom = '' then
    raise exception 'Le nom du site est obligatoire';
  end if;

  select company_id into v_company from public.sites where id = p_site;
  if v_company is null then
    raise exception 'Site introuvable';
  end if;
  if exists (select 1 from public.sites
             where company_id = v_company and lower(name) = lower(v_nom) and id <> p_site) then
    raise exception 'Un autre site porte déjà ce nom';
  end if;

  update public.sites
    set name = v_nom, pointage_actif = coalesce(p_pointage_actif, true)
    where id = p_site;
end;
$$;

revoke all on function public.maj_site(uuid, text, boolean) from public;
grant execute on function public.maj_site(uuid, text, boolean) to authenticated;

create or replace function public.supprimer_site(p_site uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.current_user_role()::text, '') not in ('validator', 'admin') then
    raise exception 'Réservé aux validateurs et à l''administrateur';
  end if;
  if exists (select 1 from public.employees where site_id = p_site) then
    raise exception 'Ce site a encore des employés : déplacez-les d''abord';
  end if;

  delete from public.sites where id = p_site;
end;
$$;

revoke all on function public.supprimer_site(uuid) from public;
grant execute on function public.supprimer_site(uuid) to authenticated;

-- 4. Le rôle « paie » est accepté à la création de comptes ------------------------

create or replace function public.admin_creer_utilisateur(
  p_username text,
  p_password text,
  p_full_name text,
  p_role text
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_username text := lower(trim(p_username));
  v_login_id text := lower(trim(p_username)) || '@pointage.local';
begin
  if coalesce(public.current_user_role()::text, '') <> 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  if v_username = '' or v_username !~ '^[a-z0-9._-]+$' then
    raise exception 'Nom d''utilisateur invalide (lettres, chiffres, . _ - ; sans espace)';
  end if;
  if length(p_password) < 6 then
    raise exception 'Le mot de passe doit contenir au moins 6 caractères';
  end if;
  if coalesce(p_role, '') not in ('agent', 'validator', 'admin', 'paie') then
    raise exception 'Rôle invalide';
  end if;
  if exists (select 1 from public.profiles where username = v_username) then
    raise exception 'Ce nom d''utilisateur existe déjà';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_login_id, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', v_username), now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_login_id, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (user_id, username, full_name, role)
  values (v_id, v_username, nullif(trim(p_full_name), ''), p_role::public.user_role);

  return v_username;
end;
$$;

revoke all on function public.admin_creer_utilisateur(text, text, text, text) from public;
grant execute on function public.admin_creer_utilisateur(text, text, text, text) to authenticated;

create or replace function public.admin_modifier_utilisateur(
  p_user_id uuid,
  p_full_name text,
  p_role text,
  p_password text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if coalesce(public.current_user_role()::text, '') <> 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  if coalesce(p_role, '') not in ('agent', 'validator', 'admin', 'paie') then
    raise exception 'Rôle invalide';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Vous ne pouvez pas retirer votre propre rôle d''administrateur';
  end if;

  update public.profiles
    set full_name = nullif(trim(p_full_name), ''), role = p_role::public.user_role
    where user_id = p_user_id;

  if p_password is not null and length(p_password) >= 6 then
    update auth.users
      set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
          updated_at = now()
      where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_modifier_utilisateur(uuid, text, text, text) from public;
grant execute on function public.admin_modifier_utilisateur(uuid, text, text, text) to authenticated;

-- 5. Le rôle « paie » peut lire les employés / modifier les dettes ------------------
-- (déjà couvert par les policies de 017). On complète l'accès aux employés
-- pour les validateurs et admins uniquement — le responsable de paie ne
-- modifie pas les fiches employés.

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
  for update to authenticated
  using (public.current_user_role()::text in ('validator', 'admin'))
  with check (true);

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert to authenticated
  with check (public.current_user_role()::text in ('validator', 'admin'));
