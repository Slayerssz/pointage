-- ============================================================================
--  BLOC 12 sur 12 — Le matricule ne recule jamais
--  ============================================================
--  Supabase → SQL Editor → coller → Run.  À exécuter APRÈS le BLOC 11.
--
--  Le prochain matricule est désormais le plus grand JAMAIS attribué + 1,
--  toutes entreprises confondues. Un numéro laissé libre par une
--  suppression n'est plus réattribué, et on ne repart plus à 1 dans une
--  entreprise dont les matricules ne sont pas renseignés.
-- ============================================================================

-- ============================================================
-- 029 — Le matricule ne recule jamais et ne se réutilise pas
-- À exécuter après 028_rh_departement.sql
--
-- Avant : le matricule était « le plus grand de CETTE entreprise + 1 ».
-- Deux défauts : dans une entreprise dont les matricules ne sont pas
-- renseignés on repartait à 1, et un numéro libéré par une suppression
-- était réattribué.
--
-- Maintenant : on prend le plus grand numéro JAMAIS attribué, toutes
-- entreprises confondues, et on avance. Un compteur mémorise ce plus
-- grand numéro, donc il ne redescend pas même si une fiche est
-- supprimée.
-- ============================================================

-- 1. Le compteur : une seule ligne, qui ne fait que monter -----------------------

create table if not exists public.matricule_compteur (
  id boolean primary key default true check (id),
  dernier integer not null default 0
);

insert into public.matricule_compteur (id, dernier) values (true, 0)
  on conflict (id) do nothing;

-- On démarre au plus grand matricule déjà présent en base
update public.matricule_compteur
   set dernier = greatest(dernier, coalesce((select max(matricule) from public.employees), 0));

alter table public.matricule_compteur enable row level security;

drop policy if exists matricule_compteur_select on public.matricule_compteur;
create policy matricule_compteur_select on public.matricule_compteur
  for select to authenticated using (true);
-- L'écriture ne passe que par le trigger (security definer).

-- 2. Attribution ------------------------------------------------------------------

create or replace function public.employees_assign_matricule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suivant integer;
begin
  if new.matricule is not null then
    -- Numéro imposé à la main : on fait quand même avancer le compteur,
    -- pour ne jamais le réattribuer ensuite.
    update public.matricule_compteur
       set dernier = greatest(dernier, new.matricule)
     where id;
    return new;
  end if;

  -- Le compteur fait autorité, mais on se recale sur la base au cas où
  -- des fiches auraient été importées sans passer par ici.
  update public.matricule_compteur
     set dernier = greatest(
           dernier,
           coalesce((select max(matricule) from public.employees), 0)
         ) + 1
   where id
   returning dernier into v_suivant;

  new.matricule := v_suivant;
  return new;
end;
$$;

drop trigger if exists employees_assign_matricule on public.employees;
create trigger employees_assign_matricule
  before insert on public.employees
  for each row execute function public.employees_assign_matricule();

-- 3. Le matricule reste unique par entreprise -------------------------------------
-- (l'index existe déjà ; on le rappelle ici pour mémoire)
create unique index if not exists employees_company_matricule_uidx
  on public.employees (company_id, matricule)
  where matricule is not null;
