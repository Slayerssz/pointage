-- ============================================================================
--  BLOC 37 sur 37 — Les bulletins établis sont conservés
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 36.
--
--  Chaque bulletin édité est gardé tel quel : on peut y revenir des mois
--  plus tard et le retrouver identique, même si les taux ou le pointage
--  ont changé depuis.
--
--  Qui peut quoi :
--     · la paie et l'administrateur ÉTABLISSENT un bulletin ;
--     · pour le refaire, la paie DEMANDE l'autorisation — l'administrateur
--       l'accorde, et le bulletin peut être refait une fois ;
--     · la suppression n'appartient qu'à l'administrateur.
-- ============================================================================

-- ============================================================
-- 054 — Les bulletins établis sont conservés
-- À exécuter après 053_bulletin_pour_tous.sql
--
-- Un bulletin remis à quelqu'un est une pièce : il doit rester
-- consultable tel qu'il a été édité, même si les taux, le salaire
-- ou le pointage changent après coup. On en garde donc une copie
-- complète — le document, pas les ingrédients.
--
-- Qui peut quoi :
--   · la paie et l'administrateur ÉTABLISSENT un bulletin — les mêmes
--     que pour l'édition elle-même (BLOC 35) ;
--   · la paie ne le modifie pas : elle DEMANDE la modification, et
--     l'administrateur l'autorise — alors seulement il peut être
--     refait ;
--   · la paie ne le supprime jamais : cela n'appartient qu'à
--     l'administrateur.
-- ============================================================

create table if not exists public.bulletins_emis (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  periode_id uuid not null references public.periodes_paie(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  annee int not null,
  mois int not null,
  -- Recopiés pour pouvoir chercher et trier sans ouvrir le document.
  nom_prenom text not null,
  matricule int,
  salaire_brut numeric(10, 2) not null,
  jours numeric(6, 2) not null,
  avance numeric(10, 2) not null default 0,
  net_a_payer numeric(10, 2) not null,
  -- Le bulletin entier, tel qu'il a été édité.
  document jsonb not null,
  cree_par uuid,
  cree_le timestamptz not null default now(),
  -- La demande de modification, et la réponse de l'administrateur.
  modification_motif text,
  modification_demandee_par uuid,
  modification_demandee_le timestamptz,
  -- Vrai quand l'administrateur a autorisé : le bulletin peut alors
  -- être refait une fois, puis le drapeau retombe.
  modification_autorisee boolean not null default false,
  unique (periode_id, employee_id)
);

comment on table public.bulletins_emis is
  'Les bulletins réellement édités, conservés tels quels. Un seul par mois et par employé.';

create index if not exists bulletins_emis_societe_idx
  on public.bulletins_emis (company_id, annee desc, mois desc);

alter table public.bulletins_emis enable row level security;

-- Tout compte connecté les lit ; l'écriture passe par les fonctions.
drop policy if exists bulletins_emis_select on public.bulletins_emis;
create policy bulletins_emis_select on public.bulletins_emis
  for select to authenticated using (true);

-- 1. Établir un bulletin ------------------------------------------------------
-- Le premier pour un mois donné s'enregistre ; le refaire exige
-- l'autorisation de l'administrateur.

create or replace function public.etablir_bulletin(
  p_periode uuid,
  p_employee uuid,
  p_salaire_brut numeric,
  p_jours numeric,
  p_avance numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc jsonb;
  v_b jsonb;
  v_p public.periodes_paie%rowtype;
  v_existe public.bulletins_emis%rowtype;
  v_id uuid;
begin
  perform public.exiger_role('admin', 'paie');

  select * into v_p from public.periodes_paie where id = p_periode;
  if v_p.id is null then
    raise exception 'Période introuvable.';
  end if;

  select * into v_existe
    from public.bulletins_emis
   where periode_id = p_periode and employee_id = p_employee;

  if v_existe.id is not null and not v_existe.modification_autorisee then
    raise exception
      'Le bulletin de % pour %/% a déjà été établi. Demandez à l''administrateur l''autorisation de le modifier.',
      v_existe.nom_prenom, lpad(v_existe.mois::text, 2, '0'), v_existe.annee;
  end if;

  v_doc := public.bulletin_paie(p_periode, p_employee, p_salaire_brut, p_jours, p_avance);
  if v_doc is null or jsonb_array_length(v_doc) = 0 then
    raise exception 'Aucun bulletin à établir pour cet employé sur ce mois.';
  end if;
  v_b := v_doc -> 0;

  insert into public.bulletins_emis
    (company_id, periode_id, employee_id, annee, mois, nom_prenom, matricule,
     salaire_brut, jours, avance, net_a_payer, document, cree_par)
  values
    (v_p.company_id, p_periode, p_employee, v_p.annee, v_p.mois,
     v_b -> 'employe' ->> 'nom_prenom',
     nullif(v_b -> 'employe' ->> 'matricule', '')::int,
     coalesce(p_salaire_brut, 0), coalesce(p_jours, 0), coalesce(p_avance, 0),
     (v_b -> 'pied' ->> 'net_a_payer')::numeric, v_b, auth.uid())
  on conflict (periode_id, employee_id) do update set
    nom_prenom = excluded.nom_prenom,
    matricule = excluded.matricule,
    salaire_brut = excluded.salaire_brut,
    jours = excluded.jours,
    avance = excluded.avance,
    net_a_payer = excluded.net_a_payer,
    document = excluded.document,
    cree_par = excluded.cree_par,
    cree_le = now(),
    -- L'autorisation est à usage unique : elle retombe après emploi.
    modification_autorisee = false,
    modification_motif = null,
    modification_demandee_par = null,
    modification_demandee_le = null
  returning id into v_id;

  return v_id;
end;
$$;

-- 2. Demander la modification d'un bulletin déjà établi -----------------------

create or replace function public.demander_modification_bulletin(
  p_bulletin uuid,
  p_motif text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bulletins_emis%rowtype;
begin
  perform public.exiger_role('admin', 'paie');

  select * into v_b from public.bulletins_emis where id = p_bulletin for update;
  if v_b.id is null then
    raise exception 'Bulletin introuvable.';
  end if;
  if v_b.modification_autorisee then
    raise exception 'La modification est déjà autorisée : refaites le bulletin.';
  end if;
  if coalesce(trim(p_motif), '') = '' then
    raise exception 'Dites pourquoi ce bulletin doit être modifié.';
  end if;

  update public.bulletins_emis
     set modification_motif = trim(p_motif),
         modification_demandee_par = auth.uid(),
         modification_demandee_le = now()
   where id = p_bulletin;
end;
$$;

-- 3. L'administrateur autorise, ou refuse -------------------------------------

create or replace function public.repondre_modification_bulletin(
  p_bulletin uuid,
  p_autoriser boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande timestamptz;
begin
  perform public.exiger_role('admin');

  select modification_demandee_le into v_demande
    from public.bulletins_emis where id = p_bulletin for update;
  if not found then
    raise exception 'Bulletin introuvable.';
  end if;
  if v_demande is null then
    raise exception 'Aucune modification n''a été demandée sur ce bulletin.';
  end if;

  if p_autoriser then
    update public.bulletins_emis set modification_autorisee = true where id = p_bulletin;
  else
    update public.bulletins_emis
       set modification_motif = null,
           modification_demandee_par = null,
           modification_demandee_le = null
     where id = p_bulletin;
  end if;
end;
$$;

-- 4. Supprimer un bulletin : l'administrateur, et lui seul --------------------

create or replace function public.supprimer_bulletin_emis(p_bulletin uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exiger_role('admin');
  delete from public.bulletins_emis where id = p_bulletin;
  if not found then
    raise exception 'Bulletin introuvable.';
  end if;
end;
$$;

revoke all on function public.etablir_bulletin(uuid, uuid, numeric, numeric, numeric) from public;
revoke all on function public.demander_modification_bulletin(uuid, text) from public;
revoke all on function public.repondre_modification_bulletin(uuid, boolean) from public;
revoke all on function public.supprimer_bulletin_emis(uuid) from public;
grant execute on function public.etablir_bulletin(uuid, uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.demander_modification_bulletin(uuid, text) to authenticated;
grant execute on function public.repondre_modification_bulletin(uuid, boolean) to authenticated;
grant execute on function public.supprimer_bulletin_emis(uuid) to authenticated;
