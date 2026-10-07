-- ============================================================================
--  BLOC 41 sur 41 — Propriétaire, développeur, et le journal des gestes
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 40.
--
--  Deux rôles au-dessus de l'administrateur : « dev », que tout le monde
--  voit, et « owner », que seul le développeur voit et peut donner.
--
--  Et un journal : qui a fait quoi, et quand. Une phrase par geste,
--  lisible, avec de quoi retrouver la page. Réservé à ces deux rôles.
--
--  ⚠ Ce bloc fait passer l'administrateur actuel en « dev ».
-- ============================================================================

-- ============================================================
-- 057 — Propriétaire, développeur, et le journal des gestes
-- À exécuter après 056_acces_societes.sql, et après le BLOC 40
-- qui crée les deux valeurs de rôle.
--
-- DEUX RÔLES AU-DESSUS DE L'ADMINISTRATEUR
--
--   · « dev » se voit comme les autres : c'est le développeur, au-dessus
--     de l'administrateur.
--   · « owner » ne se voit pas. Il n'apparaît dans aucune liste, sauf
--     pour le développeur et pour lui-même, et seul le développeur peut
--     l'attribuer.
--
-- Plutôt que d'ajouter ces deux rôles aux vingt contrôles qui disent
-- « réservé à l'administrateur », on les y présente comme
-- administrateurs : `current_user_role` répond « admin » pour eux. Le
-- rôle réel reste lisible par `role_reel`, dont se servent l'affichage,
-- la visibilité du propriétaire et le journal.
--
-- LE JOURNAL
--
-- Qui a fait quoi, et quand. Une phrase par geste, le nom de son auteur,
-- l'heure, et de quoi retrouver la page. Réservé au propriétaire et au
-- développeur.
-- ============================================================

-- 1. Le rôle réel, et le rôle qui gouverne les droits -------------------------

create or replace function public.role_reel()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid() and actif;
$$;

comment on function public.role_reel() is
  'Le rôle tel qu''il est inscrit — pour l''afficher et pour décider qui voit quoi.';

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  -- Le propriétaire et le développeur passent partout où passe
  -- l'administrateur. Les y présenter ainsi évite de rouvrir un à un
  -- tous les contrôles de la base — et d'en oublier un.
  select case
           when role in ('owner', 'dev') then 'admin'::public.user_role
           else role
         end
    from public.profiles where user_id = auth.uid() and actif;
$$;

-- 2. Qui voit le journal ------------------------------------------------------

create or replace function public.voit_le_journal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.role_reel()::text, '') in ('owner', 'dev');
$$;

-- 3. Le journal ---------------------------------------------------------------

create table if not exists public.journal (
  id bigint generated always as identity primary key,
  fait_le timestamptz not null default now(),
  user_id uuid,
  -- Le nom au moment du geste : un compte renommé ou supprimé plus tard
  -- ne doit pas effacer qui a fait quoi.
  auteur text,
  action text not null,
  objet text not null,
  objet_id uuid,
  company_id uuid,
  resume text not null,
  -- L'onglet où retrouver la chose : « employes », « validation »…
  lien text
);

comment on table public.journal is
  'Ce qui se passe dans le système : une phrase par geste, avec son auteur et son heure.';

create index if not exists journal_fait_le_idx on public.journal (fait_le desc);
create index if not exists journal_company_idx on public.journal (company_id, fait_le desc);

alter table public.journal enable row level security;

drop policy if exists journal_select on public.journal;
create policy journal_select on public.journal
  for select to authenticated
  using (public.voit_le_journal());

-- 4. Ce qui s'inscrit au journal ----------------------------------------------
-- Une seule fonction, branchée sur les tables qui comptent. Elle écrit
-- une phrase lisible, pas un vidage de colonnes : le propriétaire veut
-- lire ce qui s'est passé, pas le déchiffrer.

create or replace function public.journaliser()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auteur text;
  v_action text;
  v_resume text;
  v_objet_id uuid;
  v_company uuid;
  v_lien text;
  v_nom text;
begin
  -- Les grands remplissages passent par l'éditeur SQL, sans session. Ils
  -- inscriraient des milliers de lignes qui n'apprennent rien : on ne
  -- journalise que les gestes faits depuis l'application.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  select coalesce(full_name, username) into v_auteur
    from public.profiles where user_id = auth.uid();

  v_action := case tg_op when 'INSERT' then 'ajout'
                         when 'UPDATE' then 'modification'
                         else 'suppression' end;

  if tg_table_name = 'employees' then
    v_objet_id := coalesce(new.id, old.id);
    v_company := coalesce(new.company_id, old.company_id);
    v_nom := coalesce(new.nom_prenom, old.nom_prenom);
    v_lien := 'employes';
    if tg_op = 'INSERT' then
      v_resume := 'a ajouté ' || v_nom || ' au registre';
    elsif tg_op = 'DELETE' then
      v_resume := 'a supprimé la fiche de ' || v_nom;
    elsif old.date_sortie is null and new.date_sortie is not null then
      v_action := 'sortie';
      v_resume := 'a sorti ' || v_nom || ' le ' || to_char(new.date_sortie, 'DD/MM/YYYY');
    elsif old.date_sortie is not null and new.date_sortie is null then
      v_action := 'retour';
      v_resume := 'a réintégré ' || v_nom;
    elsif to_jsonb(old) - 'jours_travailles' - 'actif'
          = to_jsonb(new) - 'jours_travailles' - 'actif' then
      -- Pointer quelqu'un met à jour son compteur de journées. Ce n'est
      -- pas un geste : sans cela, chaque pointage écrirait deux lignes
      -- au journal, dont une qui n'apprend rien.
      return coalesce(new, old);
    else
      v_resume := 'a modifié la fiche de ' || v_nom;
    end if;

  elsif tg_table_name = 'pointages' then
    v_objet_id := coalesce(new.employee_id, old.employee_id);
    v_company := coalesce(new.company_id, old.company_id);
    v_lien := 'validation';
    select nom_prenom into v_nom from public.employees where id = v_objet_id;
    if tg_op = 'INSERT' then
      v_resume := 'a pointé ' || coalesce(v_nom, '?') || ' le '
                  || to_char(new.pointed_on, 'DD/MM/YYYY')
                  || ' (' || coalesce(new.type_garde, '?') || ')';
    elsif tg_op = 'DELETE' then
      v_resume := 'a retiré le pointage de ' || coalesce(v_nom, '?')
                  || ' du ' || to_char(old.pointed_on, 'DD/MM/YYYY');
    elsif coalesce(old.type_garde, '') <> coalesce(new.type_garde, '') then
      v_resume := 'a changé le pointage de ' || coalesce(v_nom, '?')
                  || ' du ' || to_char(new.pointed_on, 'DD/MM/YYYY')
                  || ' : ' || coalesce(old.type_garde, '?') || ' → '
                  || coalesce(new.type_garde, '?');
    else
      return coalesce(new, old);   -- un détail sans intérêt pour le journal
    end if;

  elsif tg_table_name = 'conges' then
    v_objet_id := coalesce(new.employee_id, old.employee_id);
    v_company := coalesce(new.company_id, old.company_id);
    v_lien := 'employes';
    select nom_prenom into v_nom from public.employees where id = v_objet_id;
    v_resume := case tg_op
      when 'INSERT' then 'a posé un congé pour ' || coalesce(v_nom, '?')
                         || ' du ' || to_char(new.date_debut, 'DD/MM')
                         || ' au ' || to_char(new.date_fin, 'DD/MM')
      when 'DELETE' then 'a supprimé le congé de ' || coalesce(v_nom, '?')
      else 'a modifié le congé de ' || coalesce(v_nom, '?') end;

  elsif tg_table_name = 'contrats' then
    v_objet_id := coalesce(new.employee_id, old.employee_id);
    v_company := coalesce(new.company_id, old.company_id);
    v_lien := 'employes';
    select nom_prenom into v_nom from public.employees where id = v_objet_id;
    v_resume := case tg_op
      when 'INSERT' then 'a établi un contrat pour ' || coalesce(v_nom, '?')
      when 'DELETE' then 'a supprimé un contrat de ' || coalesce(v_nom, '?')
      else 'a modifié le contrat de ' || coalesce(v_nom, '?') end;

  elsif tg_table_name = 'periodes_paie' then
    v_objet_id := coalesce(new.id, old.id);
    v_company := coalesce(new.company_id, old.company_id);
    v_lien := 'paie';
    if tg_op = 'UPDATE' and old.statut <> new.statut then
      v_action := 'paie';
      v_resume := 'a fait passer la paie de '
                  || to_char(make_date(new.annee, new.mois, 1), 'MM/YYYY')
                  || ' en « ' || new.statut::text || ' »';
    else
      return coalesce(new, old);
    end if;

  elsif tg_table_name = 'profiles' then
    v_objet_id := coalesce(new.user_id, old.user_id);
    v_lien := 'utilisateurs';
    if tg_op = 'INSERT' then
      v_resume := 'a créé le compte ' || new.username
                  || ' (' || new.role::text || ')';
    elsif tg_op = 'DELETE' then
      v_resume := 'a supprimé le compte ' || old.username;
    elsif old.role <> new.role then
      v_resume := 'a changé le rôle de ' || new.username
                  || ' : ' || old.role::text || ' → ' || new.role::text;
    elsif old.actif <> new.actif then
      v_resume := case when new.actif then 'a réactivé le compte '
                       else 'a désactivé le compte ' end || new.username;
    else
      return coalesce(new, old);
    end if;

  elsif tg_table_name = 'companies' then
    v_objet_id := coalesce(new.id, old.id);
    v_company := coalesce(new.id, old.id);
    v_lien := 'entreprises';
    v_resume := case tg_op
      when 'INSERT' then 'a ajouté la société ' || new.name
      when 'DELETE' then 'a supprimé la société ' || old.name
      else 'a modifié la société ' || new.name end;

  elsif tg_table_name = 'sites' then
    v_objet_id := coalesce(new.id, old.id);
    v_company := coalesce(new.company_id, old.company_id);
    v_lien := 'sites';
    v_resume := case tg_op
      when 'INSERT' then 'a ajouté le site ' || new.name
      when 'DELETE' then 'a supprimé le site ' || old.name
      else 'a modifié le site ' || new.name end;

  else
    return coalesce(new, old);
  end if;

  insert into public.journal
    (user_id, auteur, action, objet, objet_id, company_id, resume, lien)
  values
    (auth.uid(), coalesce(v_auteur, 'inconnu'), v_action, tg_table_name,
     v_objet_id, v_company, v_resume, v_lien);

  return coalesce(new, old);
end;
$$;

-- 5. Les tables que l'on suit -------------------------------------------------
-- La paie elle-même n'y est pas : ses lignes se recalculent à chaque
-- consultation, et le journal n'aurait plus que cela à dire.

do $bloc$
declare
  t text;
begin
  foreach t in array array['employees', 'pointages', 'conges', 'contrats',
                           'periodes_paie', 'profiles', 'companies', 'sites']
  loop
    execute format('drop trigger if exists %I on public.%I', 'journal_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.journaliser()',
      'journal_' || t, t);
  end loop;
end $bloc$;

-- 6. L'administrateur en place devient développeur ----------------------------
-- C'est le compte qui tient la maison : il passe au-dessus.

update public.profiles set role = 'dev' where role = 'admin';


CREATE OR REPLACE FUNCTION public.admin_liste_utilisateurs()
 RETURNS TABLE(user_id uuid, username text, full_name text, role text, actif boolean, supprimable boolean, nb_pointages bigint, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.exiger_role('admin');
  return query
    select p.user_id, p.username, p.full_name, p.role::text, p.actif,
           not exists (select 1 from public.pointages pt where pt.agent_id = p.user_id)
             and p.user_id <> auth.uid() as supprimable,
           (select count(*) from public.pointages pt where pt.agent_id = p.user_id) as nb_pointages,
           p.created_at
    from public.profiles p
    -- Le propriétaire ne figure pas dans la liste des autres : seul le
    -- développeur — et lui-même — sait que ce compte existe.
    where p.role::text <> 'owner'
       or public.role_reel()::text in ('dev', 'owner')
    order by p.actif desc, p.created_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_creer_utilisateur(p_username text, p_password text, p_full_name text, p_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
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
  if coalesce(p_role, '') not in ('agent', 'validator', 'admin', 'paie', 'rh', 'dev', 'owner') then
    raise exception 'Rôle invalide';
  end if;
  -- « owner » ne s'attribue pas comme les autres : seul le développeur
  -- le voit et le donne. Les autres n'ont même pas à savoir qu'il existe.
  if p_role = 'owner' and public.role_reel()::text <> 'dev'
     and public.role_reel()::text <> 'owner' then
    raise exception 'Rôle invalide';
  end if;
  -- Le rôle « dev » ne se donne qu'au-dessus de l'administrateur.
  if p_role = 'dev' and public.role_reel()::text not in ('dev', 'owner') then
    raise exception 'Seul un développeur peut nommer un développeur.';
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_modifier_utilisateur(p_user_id uuid, p_full_name text, p_role text, p_password text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
begin
  perform public.exiger_role('admin');

  if coalesce(p_role, '') not in ('agent', 'validator', 'admin', 'paie', 'rh', 'dev', 'owner') then
    raise exception 'Rôle invalide';
  end if;
  -- « owner » ne s'attribue pas comme les autres : seul le développeur
  -- le voit et le donne. Les autres n'ont même pas à savoir qu'il existe.
  if p_role = 'owner' and public.role_reel()::text <> 'dev'
     and public.role_reel()::text <> 'owner' then
    raise exception 'Rôle invalide';
  end if;
  -- Le rôle « dev » ne se donne qu'au-dessus de l'administrateur.
  if p_role = 'dev' and public.role_reel()::text not in ('dev', 'owner') then
    raise exception 'Seul un développeur peut nommer un développeur.';
  end if;
  -- On ne se retire pas à soi-même les clés de la maison.
  if p_user_id = auth.uid() and p_role not in ('admin', 'dev', 'owner') then
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
$function$;

revoke all on function public.role_reel() from public;
revoke all on function public.voit_le_journal() from public;
grant execute on function public.role_reel() to authenticated;
grant execute on function public.voit_le_journal() to authenticated;
