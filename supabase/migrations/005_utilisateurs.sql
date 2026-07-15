-- ============================================================
-- 005 — Création des utilisateurs (SANS e-mail)
-- À exécuter après 004_seed.sql
--
-- Cette fonction crée un compte complet en une seule commande :
-- nom d'utilisateur + mot de passe + rôle. Aucun e-mail n'est
-- demandé ni utilisé (un identifiant technique interne est généré
-- automatiquement, invisible pour tout le monde).
-- ============================================================

create or replace function public.creer_utilisateur(
  p_username text,
  p_password text,
  p_full_name text,
  p_role text  -- 'agent' (pointeur terrain) ou 'validator' (bureau)
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_username text := lower(trim(p_username));
  -- Identifiant technique interne (jamais visible, jamais utilisé pour envoyer quoi que ce soit)
  v_login_id text := v_username || '@pointage.local';
begin
  if v_username = '' or v_username !~ '^[a-z0-9._-]+$' then
    raise exception 'Nom d''utilisateur invalide : lettres/chiffres/._- uniquement, sans espace';
  end if;
  if length(p_password) < 6 then
    raise exception 'Le mot de passe doit contenir au moins 6 caractères';
  end if;
  if p_role not in ('agent', 'validator') then
    raise exception 'Rôle invalide : ''agent'' ou ''validator''';
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

  return 'Utilisateur « ' || v_username || ' » créé avec le rôle ' || p_role;
end;
$$;

-- Cette fonction est réservée au SQL Editor (administrateur) :
revoke all on function public.creer_utilisateur(text, text, text, text) from public;
revoke all on function public.creer_utilisateur(text, text, text, text) from authenticated;

-- ============================================================
-- EXEMPLES — copiez, adaptez, exécutez :
-- ============================================================

-- Un agent (pointeur terrain) :
-- select public.creer_utilisateur('agent1', 'MotDePasse123', 'Nom de l''agent', 'agent');

-- Un validateur (bureau) :
-- select public.creer_utilisateur('bureau1', 'MotDePasse123', 'Nom du validateur', 'validator');
