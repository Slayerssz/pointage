-- ============================================================
-- 028 — Droits du rôle « personnel » et champ Département
-- À exécuter après 027_role_rh.sql
--
-- Le rôle « personnel » (RH) ne voit QUE les employés : il les
-- consulte, les ajoute, les modifie et imprime leurs fiches.
-- Il ne touche ni au pointage, ni à la paie, ni aux sites, ni
-- aux comptes, et ne peut pas supprimer un employé.
-- ============================================================

-- 1. Le département, exigé par la fiche officielle -----------------------------
-- (ex. NETTOYAGE, SÉCURITÉ) — distinct de la qualification, qui est
-- le poste précis (ex. AGENT DE NETTOYAGE).

alter table public.employees
  add column if not exists departement text;

-- Reprise de l'existant : « AGENT DE NETTOYAGE » → « NETTOYAGE »
update public.employees
   set departement = nullif(trim(regexp_replace(
         upper(qualification), '^AGENT( DE| D''| )?', '', 'i')), '')
 where departement is null and qualification is not null;

-- 2. Le rôle « rh » peut lire et écrire les employés -----------------------------

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
  for update to authenticated
  using (coalesce(public.current_user_role()::text, '') in ('validator', 'admin', 'rh'))
  with check (true);

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert to authenticated
  with check (coalesce(public.current_user_role()::text, '') in ('validator', 'admin', 'rh'));

-- Il consulte aussi les contrats (la fiche y fait référence), sans les modifier
drop policy if exists contrats_select on public.contrats;
create policy contrats_select on public.contrats
  for select to authenticated using (true);

-- 3. Les comptes « rh » se créent comme les autres ---------------------------------

create or replace function public.admin_creer_utilisateur(
  p_username text, p_password text, p_full_name text, p_role text
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
  perform public.exiger_role('admin');

  if v_username = '' or v_username !~ '^[a-z0-9._-]+$' then
    raise exception 'Nom d''utilisateur invalide (lettres, chiffres, . _ - ; sans espace)';
  end if;
  if length(p_password) < 6 then
    raise exception 'Le mot de passe doit contenir au moins 6 caractères';
  end if;
  if coalesce(p_role, '') not in ('agent', 'validator', 'admin', 'paie', 'rh') then
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
    jsonb_build_object('username', v_username), now(), now(), '', '', '', ''
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
  p_user_id uuid, p_full_name text, p_role text, p_password text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.exiger_role('admin');

  if coalesce(p_role, '') not in ('agent', 'validator', 'admin', 'paie', 'rh') then
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
