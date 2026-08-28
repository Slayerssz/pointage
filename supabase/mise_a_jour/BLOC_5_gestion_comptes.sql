-- ============================================================================
--  BLOC 5 sur 5 — Désactiver / supprimer un compte, réinitialiser un mot de passe
--  ============================================================
--  Supabase → SQL Editor → coller → Run.  À exécuter APRÈS le BLOC 4.
--
--  ⚠️ Les mots de passe sont stockés hachés (bcrypt) : ils sont
--     irrécupérables. Personne ne peut les « lire », pas même vous.
--     L'administrateur en définit donc un NOUVEAU et le communique.
-- ============================================================================

-- ============================================================
-- 022 — Désactiver, supprimer et réinitialiser un compte
-- À exécuter après 021_securite_roles.sql
--
-- Un compte qui a déjà pointé n'est jamais supprimable : ses
-- pointages doivent rester rattachés à quelqu'un. On le désactive.
-- ============================================================

alter table public.profiles
  add column if not exists actif boolean not null default true;

-- 1. Liste des comptes, avec l'état actif ------------------------------------

drop function if exists public.admin_liste_utilisateurs();

create or replace function public.admin_liste_utilisateurs()
returns table (
  user_id uuid, username text, full_name text, role text,
  actif boolean, supprimable boolean, nb_pointages bigint, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exiger_role('admin');
  return query
    select p.user_id, p.username, p.full_name, p.role::text, p.actif,
           not exists (select 1 from public.pointages pt where pt.agent_id = p.user_id)
             and p.user_id <> auth.uid() as supprimable,
           (select count(*) from public.pointages pt where pt.agent_id = p.user_id) as nb_pointages,
           p.created_at
    from public.profiles p
    order by p.actif desc, p.created_at desc;
end;
$$;

revoke all on function public.admin_liste_utilisateurs() from public;
grant execute on function public.admin_liste_utilisateurs() to authenticated;

-- 2. Activer / désactiver un compte -------------------------------------------
-- Un compte désactivé ne peut plus se connecter : on pose `banned_until`
-- dans auth.users (mécanisme natif de Supabase) en plus du drapeau `actif`.

create or replace function public.admin_activer_utilisateur(
  p_user_id uuid,
  p_actif boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text;
begin
  perform public.exiger_role('admin');

  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas désactiver votre propre compte';
  end if;

  select role::text into v_role from public.profiles where user_id = p_user_id;
  if v_role is null then
    raise exception 'Compte introuvable';
  end if;

  -- Toujours conserver au moins un administrateur actif
  if not p_actif and v_role = 'admin' then
    if (select count(*) from public.profiles
        where role = 'admin' and actif and user_id <> p_user_id) = 0 then
      raise exception 'Impossible : ce serait le dernier administrateur actif';
    end if;
  end if;

  update public.profiles set actif = p_actif where user_id = p_user_id;

  -- `banned_until` n'existe que sur les projets Supabase : on ne l'utilise
  -- que s'il est présent, pour rester compatible.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'banned_until'
  ) then
    if p_actif then
      execute 'update auth.users set banned_until = null where id = $1' using p_user_id;
    else
      execute 'update auth.users set banned_until = ''infinity''::timestamptz where id = $1' using p_user_id;
    end if;
  end if;
end;
$$;

revoke all on function public.admin_activer_utilisateur(uuid, boolean) from public;
grant execute on function public.admin_activer_utilisateur(uuid, boolean) to authenticated;

-- 3. Supprimer définitivement un compte -----------------------------------------

create or replace function public.admin_supprimer_utilisateur(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text;
  v_n bigint;
begin
  perform public.exiger_role('admin');

  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte';
  end if;

  select role::text into v_role from public.profiles where user_id = p_user_id;
  if v_role is null then
    raise exception 'Compte introuvable';
  end if;

  select count(*) into v_n from public.pointages where agent_id = p_user_id;
  if v_n > 0 then
    raise exception
      'Ce compte a % pointage(s) à son nom : il ne peut pas être supprimé sans effacer l''historique. Désactivez-le à la place.', v_n;
  end if;

  if v_role = 'admin' then
    if (select count(*) from public.profiles
        where role = 'admin' and actif and user_id <> p_user_id) = 0 then
      raise exception 'Impossible : ce serait le dernier administrateur';
    end if;
  end if;

  -- Détacher les traces nullables, puis supprimer le compte
  update public.pointages           set validated_by = null            where validated_by = p_user_id;
  update public.contrats            set created_by = null              where created_by = p_user_id;
  update public.conges              set created_by = null              where created_by = p_user_id;
  update public.dettes              set created_by = null              where created_by = p_user_id;
  update public.remboursements_dette set created_by = null             where created_by = p_user_id;
  update public.periodes_paie       set pointage_valide_par = null     where pointage_valide_par = p_user_id;
  update public.periodes_paie       set paie_validee_par = null        where paie_validee_par = p_user_id;
  update public.periodes_paie       set reouverture_demandee_par = null where reouverture_demandee_par = p_user_id;

  delete from public.profiles where user_id = p_user_id;
  delete from auth.identities where user_id = p_user_id;
  delete from auth.users      where id = p_user_id;
end;
$$;

revoke all on function public.admin_supprimer_utilisateur(uuid) from public;
grant execute on function public.admin_supprimer_utilisateur(uuid) to authenticated;

-- 4. Réinitialiser un mot de passe -------------------------------------------------
--
-- ⚠️ Les mots de passe sont stockés hachés (bcrypt) : ils sont
--    mathématiquement irrécupérables, personne ne peut les « lire ».
--    L'administrateur en définit donc un NOUVEAU, qu'il communique à
--    l'employé. C'est la seule méthode possible — et la bonne.

create or replace function public.admin_reinitialiser_mot_de_passe(
  p_user_id uuid,
  p_nouveau text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.exiger_role('admin');

  if p_nouveau is null or length(p_nouveau) < 6 then
    raise exception 'Le mot de passe doit contenir au moins 6 caractères';
  end if;
  if not exists (select 1 from public.profiles where user_id = p_user_id) then
    raise exception 'Compte introuvable';
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(p_nouveau, extensions.gen_salt('bf')),
        updated_at = now()
    where id = p_user_id;
end;
$$;

revoke all on function public.admin_reinitialiser_mot_de_passe(uuid, text) from public;
grant execute on function public.admin_reinitialiser_mot_de_passe(uuid, text) to authenticated;

-- 5. Un compte désactivé ne doit plus rien pouvoir faire ----------------------------
-- `current_user_role()` renvoie null pour un compte désactivé : combiné au
-- correctif 021, toutes les fonctions le refusent automatiquement.

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid() and actif;
$$;

grant execute on function public.current_user_role() to authenticated;
