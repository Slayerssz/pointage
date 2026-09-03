-- ============================================================================
--  BLOC 18 sur 18 — Le départ se fait en deux temps
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 17.
--
--  Valider une sortie marque la personne « sortie » : elle reste visible
--  au registre. C'est en fin de mois que l'administrateur passe en revue
--  les départs du mois et les archive d'un coup — ils quittent alors la
--  liste des employés, sans que rien ne soit supprimé.
-- ============================================================================

-- ============================================================
-- 035 — Le départ se fait en deux temps
-- À exécuter après 034_sorties.sql
--
-- Valider une sortie marque la personne « sortie » : elle reste au
-- registre, visible, mais ne travaille plus. C'est en fin de mois que
-- l'administrateur passe en revue tous les départs du mois et les
-- archive d'un coup — ils quittent alors la liste des employés.
--
-- Rien n'est supprimé, jamais. Une fiche archivée garde ses pointages,
-- ses contrats, ses congés et ses bulletins de paie ; elle sort
-- simplement de l'écran de tous les jours.
-- ============================================================

alter table public.employees
  add column if not exists archive_le timestamptz;

comment on column public.employees.archive_le is
  'Départ archivé en fin de mois : la fiche quitte la liste des employés.';

create index if not exists employees_archive_idx
  on public.employees (company_id) where archive_le is null;

-- ---------- Ce que l'archivage de fin de mois emporterait ----------

create or replace function public.apercu_archivage(
  p_company uuid,
  p_annee int,
  p_mois int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  perform public.exiger_role('admin');

  select coalesce(jsonb_agg(jsonb_build_object(
           'employee_id', e.id,
           'matricule', e.matricule,
           'nom_prenom', e.nom_prenom,
           'date_sortie', e.date_sortie,
           'montant', s.montant,
           'motif', s.motif
         ) order by e.nom_prenom), '[]'::jsonb)
    into v_res
    from public.employees e
    join public.sorties s
      on s.employee_id = e.id and s.valide
   where e.company_id = p_company
     and e.archive_le is null
     and e.date_sortie is not null
     and date_part('year', e.date_sortie)::int = p_annee
     and date_part('month', e.date_sortie)::int = p_mois;

  return v_res;
end;
$$;

-- ---------- L'archivage lui-même ----------

create or replace function public.archiver_sorties(
  p_company uuid,
  p_annee int,
  p_mois int
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  -- Réservé à l'administrateur : c'est lui qui arrête le mois.
  perform public.exiger_role('admin');

  update public.employees e
     set archive_le = now()
   where e.company_id = p_company
     and e.archive_le is null
     and e.date_sortie is not null
     and date_part('year', e.date_sortie)::int = p_annee
     and date_part('month', e.date_sortie)::int = p_mois
     and exists (select 1 from public.sorties s
                  where s.employee_id = e.id and s.valide);

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------- Sortir une fiche des archives ----------

create or replace function public.desarchiver_employe(p_employee uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exiger_role('admin');
  update public.employees set archive_le = null where id = p_employee;
end;
$$;

-- Réintégrer quelqu'un le sort aussi des archives : on ne remet pas en
-- poste une fiche qui resterait invisible.
create or replace function public.reintegrer_employe(p_employee uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exiger_role('admin');

  delete from public.sorties where employee_id = p_employee;
  update public.employees
     set date_sortie = null, archive_le = null
   where id = p_employee;
end;
$$;

revoke all on function public.apercu_archivage(uuid, int, int) from public;
revoke all on function public.archiver_sorties(uuid, int, int) from public;
revoke all on function public.desarchiver_employe(uuid) from public;
grant execute on function public.apercu_archivage(uuid, int, int) to authenticated;
grant execute on function public.archiver_sorties(uuid, int, int) to authenticated;
grant execute on function public.desarchiver_employe(uuid) to authenticated;
