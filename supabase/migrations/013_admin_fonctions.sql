-- ============================================================
-- 013 — Admin : accès, gestion des utilisateurs, analytics
-- À exécuter APRÈS 012_role_admin.sql (dans une exécution séparée).
-- ============================================================

-- ---------- Accès admin (RLS) ------------------------------------------

-- Un admin voit tous les profils (pour l'onglet Utilisateurs)
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.current_user_role() = 'admin');

-- Un admin peut modifier / ajouter des employés (comme un validateur)
drop policy if exists employees_update_admin on public.employees;
create policy employees_update_admin on public.employees
  for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (true);

drop policy if exists employees_insert_admin on public.employees;
create policy employees_insert_admin on public.employees
  for insert to authenticated
  with check (public.current_user_role() = 'admin');

-- ---------- Création d'utilisateur par un admin (depuis l'app) ---------

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
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  if v_username = '' or v_username !~ '^[a-z0-9._-]+$' then
    raise exception 'Nom d''utilisateur invalide (lettres, chiffres, . _ - ; sans espace)';
  end if;
  if length(p_password) < 6 then
    raise exception 'Le mot de passe doit contenir au moins 6 caractères';
  end if;
  if p_role not in ('agent', 'validator', 'admin') then
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

-- Changer le rôle d'un utilisateur / réinitialiser son mot de passe --------

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
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  if p_role not in ('agent', 'validator', 'admin') then
    raise exception 'Rôle invalide';
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

-- Liste des utilisateurs (pour l'onglet Utilisateurs) ----------------------

create or replace function public.admin_liste_utilisateurs()
returns table (user_id uuid, username text, full_name text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  return query
    select p.user_id, p.username, p.full_name, p.role::text, p.created_at
    from public.profiles p
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_liste_utilisateurs() from public;
grant execute on function public.admin_liste_utilisateurs() to authenticated;

-- ---------- Tableau de bord / analytics -------------------------------

-- Renvoie tous les indicateurs en un seul appel.
-- p_company : null = toutes les entreprises ; sinon filtre sur une entreprise.
create or replace function public.admin_dashboard(p_company uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
  v_dow int := extract(isodow from v_today);
  v_result jsonb;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;

  with emp as (
    select * from public.employees e
    where (p_company is null or e.company_id = p_company)
  ),
  emp_actifs as (select * from emp where actif),
  -- Employés attendus aujourd'hui : actifs, site pointable, pas en repos
  attendus as (
    select ea.id from emp_actifs ea
    join public.sites s on s.id = ea.site_id and s.pointage_actif
    where coalesce(ea.jour_de_repos, 0) <> v_dow
  ),
  pointes_today as (
    select distinct employee_id, status from public.pointages
    where pointed_on = v_today
      and (p_company is null or company_id = p_company)
  )
  select jsonb_build_object(
    'date', v_today,
    'entreprises', (select count(*) from public.companies
                    where p_company is null or id = p_company),
    'employes_total', (select count(*) from emp),
    'employes_actifs', (select count(*) from emp_actifs),
    'employes_sortis', (select count(*) from emp where not actif),
    'retraite_atteinte', (select count(*) from emp_actifs
      where date_naissance is not null
        and date_part('year', age(v_today, date_naissance)) >= 65),
    'retraite_proche', (select count(*) from emp_actifs
      where date_naissance is not null
        and date_part('year', age(v_today, date_naissance)) < 65
        and (date_naissance + interval '65 years')::date - v_today between 0 and 30),
    'presents_today', (select count(*) from pointes_today where status = 'validated'),
    'en_attente_today', (select count(*) from pointes_today where status = 'pending'),
    'refuses_today', (select count(*) from pointes_today where status = 'refused'),
    'attendus_today', (select count(*) from attendus),
    'absents_today', (select count(*) from attendus a
      where not exists (select 1 from pointes_today p
        where p.employee_id = a.id and p.status in ('validated','pending'))),
    'repos_today', (select count(*) from emp_actifs ea
      join public.sites s on s.id = ea.site_id and s.pointage_actif
      where coalesce(ea.jour_de_repos,0) = v_dow),
    'par_entreprise', (select coalesce(jsonb_agg(x order by x->>'nom'), '[]'::jsonb) from (
      select jsonb_build_object('nom', c.name,
        'employes', (select count(*) from emp e2 where e2.company_id = c.id),
        'actifs', (select count(*) from emp e2 where e2.company_id = c.id and e2.actif),
        'retraite', (select count(*) from emp e2 where e2.company_id = c.id and e2.actif
          and e2.date_naissance is not null
          and date_part('year', age(v_today, e2.date_naissance)) >= 65)) as x
      from public.companies c
      where p_company is null or c.id = p_company) t),
    'par_qualification', (select coalesce(jsonb_agg(x order by (x->>'n')::int desc), '[]'::jsonb) from (
      select jsonb_build_object('label', coalesce(qualification,'(non renseigné)'), 'n', count(*)) as x
      from emp_actifs group by qualification) t),
    'par_ville', (select coalesce(jsonb_agg(x order by (x->>'n')::int desc), '[]'::jsonb) from (
      select jsonb_build_object('label', coalesce(ville,'(non renseigné)'), 'n', count(*)) as x
      from emp_actifs group by ville order by count(*) desc limit 12) t),
    'par_reglement', (select coalesce(jsonb_agg(x order by (x->>'n')::int desc), '[]'::jsonb) from (
      select jsonb_build_object('label', coalesce(mode_reglement,'(non renseigné)'), 'n', count(*)) as x
      from emp_actifs group by mode_reglement) t),
    'age_tranches', (select jsonb_build_object(
      '18-25', count(*) filter (where a >= 18 and a <= 25),
      '26-35', count(*) filter (where a between 26 and 35),
      '36-45', count(*) filter (where a between 36 and 45),
      '46-55', count(*) filter (where a between 46 and 55),
      '56-64', count(*) filter (where a between 56 and 64),
      '65+',   count(*) filter (where a >= 65)
    ) from (select date_part('year', age(v_today, date_naissance))::int as a
            from emp_actifs where date_naissance is not null) ages),
    'embauches_par_mois', (select coalesce(jsonb_agg(x order by x->>'mois'), '[]'::jsonb) from (
      select jsonb_build_object('mois', to_char(m, 'YYYY-MM'),
        'n', (select count(*) from emp e3 where to_char(e3.date_embauche,'YYYY-MM') = to_char(m,'YYYY-MM'))) as x
      from generate_series(date_trunc('month', v_today) - interval '11 months',
                           date_trunc('month', v_today), interval '1 month') m) t),
    'pointages_semaine', (select coalesce(jsonb_agg(x order by x->>'date'), '[]'::jsonb) from (
      select jsonb_build_object('date', d::date,
        'valides', (select count(*) from public.pointages p where p.pointed_on = d::date
          and p.status='validated' and (p_company is null or p.company_id=p_company)),
        'en_attente', (select count(*) from public.pointages p where p.pointed_on = d::date
          and p.status='pending' and (p_company is null or p.company_id=p_company)),
        'refuses', (select count(*) from public.pointages p where p.pointed_on = d::date
          and p.status='refused' and (p_company is null or p.company_id=p_company))) as x
      from generate_series(v_today - 6, v_today, interval '1 day') d) t)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard(uuid) from public;
grant execute on function public.admin_dashboard(uuid) to authenticated;

-- ---------- CRÉER LE PREMIER ADMINISTRATEUR ---------------------------
-- Après avoir exécuté ce fichier, créez votre 1er compte admin en
-- exécutant CES DEUX LIGNES (adaptez le nom et le mot de passe) :
--
--   select public.creer_utilisateur('admin', 'MotDePasseAdmin', 'Administrateur', 'validator');
--   update public.profiles set role = 'admin' where username = 'admin';
--
-- Ensuite, connectez-vous avec « admin » : vous aurez l'onglet Utilisateurs
-- pour créer tous les autres comptes sans SQL.
