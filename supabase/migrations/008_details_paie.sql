-- ============================================================
-- 008 — Champs paie & statut (RIB, banque, salaire, sortie)
-- À exécuter après 007_ameliorations.sql.
-- ============================================================

alter table public.employees
  add column if not exists rib text,
  add column if not exists banque text,
  add column if not exists salaire numeric(10, 2),
  add column if not exists date_sortie date;

-- « Actif » est dérivé automatiquement de la date de sortie :
-- une date de sortie renseignée => employé sorti (actif = false).
create or replace function public.employees_set_actif()
returns trigger
language plpgsql
as $$
begin
  new.actif := new.date_sortie is null;
  return new;
end;
$$;

drop trigger if exists employees_set_actif on public.employees;
create trigger employees_set_actif
  before insert or update on public.employees
  for each row execute function public.employees_set_actif();

update public.employees set actif = (date_sortie is null);

-- Un matricule est unique au sein d'une même entreprise.
create unique index if not exists employees_company_matricule_uidx
  on public.employees (company_id, matricule)
  where matricule is not null;
