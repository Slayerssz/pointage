-- ============================================================
-- 034 — Les sorties et le reçu pour solde de tout compte
-- À exécuter après 033_champs_document.sql
--
-- Un départ se prépare : la personne prévient deux semaines avant, on
-- établit son reçu, et ce n'est qu'au dernier jour qu'on valide. Tant
-- que la sortie n'est pas validée, l'employé reste au registre et
-- continue d'être pointé.
--
-- Valider ne supprime rien : la fiche garde sa date de sortie, ses
-- pointages et son historique de paie. Elle quitte simplement les
-- listes actives.
-- ============================================================

create table if not exists public.sorties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  -- Le dernier jour travaillé
  date_sortie date not null,
  motif text,
  -- Ce que porte le reçu
  montant numeric(10, 2) not null default 0 check (montant >= 0),
  mode_reglement text,
  champs_document jsonb not null default '{}'::jsonb,
  -- Tant que c'est faux, l'employé est toujours en poste
  valide boolean not null default false,
  valide_le timestamptz,
  valide_par uuid references public.profiles(user_id),
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now()
);

create index if not exists sorties_employee_idx on public.sorties (employee_id);
create index if not exists sorties_company_idx on public.sorties (company_id, valide);

-- Une seule sortie en préparation à la fois par personne
create unique index if not exists sorties_une_en_cours
  on public.sorties (employee_id) where not valide;

alter table public.sorties enable row level security;

drop policy if exists sorties_lecture on public.sorties;
create policy sorties_lecture on public.sorties
  for select to authenticated
  using (public.current_user_role() in ('admin', 'validator', 'rh', 'paie'));

-- L'écriture passe par les fonctions ci-dessous.

-- ---------- Préparer ou corriger une sortie ----------

create or replace function public.enregistrer_sortie(
  p_employee uuid,
  p_date_sortie date,
  p_montant numeric,
  p_mode text,
  p_motif text,
  p_champs jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_id uuid;
begin
  perform public.exiger_role('admin', 'validator', 'rh');

  select company_id into v_company from public.employees where id = p_employee;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if p_date_sortie is null then
    raise exception 'La date de sortie est obligatoire.';
  end if;
  if coalesce(p_montant, 0) < 0 then
    raise exception 'Le solde de tout compte ne peut pas être négatif.';
  end if;

  -- Une sortie déjà validée ne se remanie pas : le reçu est signé.
  if exists (select 1 from public.sorties
              where employee_id = p_employee and valide) then
    raise exception 'La sortie de cet employé est déjà validée.';
  end if;

  insert into public.sorties
    (company_id, employee_id, date_sortie, montant, mode_reglement, motif,
     champs_document, created_by)
  values (v_company, p_employee, p_date_sortie, coalesce(p_montant, 0), p_mode,
          nullif(trim(coalesce(p_motif, '')), ''), coalesce(p_champs, '{}'::jsonb), auth.uid())
  on conflict (employee_id) where not valide do update
    set date_sortie     = excluded.date_sortie,
        montant         = excluded.montant,
        mode_reglement  = excluded.mode_reglement,
        motif           = excluded.motif,
        champs_document = excluded.champs_document
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------- Valider : la personne quitte les listes ----------

create or replace function public.valider_sortie(p_sortie uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
  v_date date;
begin
  perform public.exiger_role('admin', 'validator', 'rh');

  select employee_id, date_sortie into v_employee, v_date
    from public.sorties where id = p_sortie and not valide;
  if v_employee is null then
    raise exception 'Sortie introuvable ou déjà validée.';
  end if;

  update public.sorties
     set valide = true, valide_le = now(), valide_par = auth.uid()
   where id = p_sortie;

  -- « actif » se déduit de la date de sortie : renseigner l'une bascule
  -- l'autre. La fiche n'est pas supprimée — pointages, contrats, congés et
  -- bulletins de paie restent consultables.
  update public.employees
     set date_sortie = v_date
   where id = v_employee;
end;
$$;

-- ---------- Annuler une sortie en préparation ----------

create or replace function public.annuler_sortie(p_sortie uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exiger_role('admin', 'validator', 'rh');

  delete from public.sorties where id = p_sortie and not valide;
  if not found then
    raise exception 'Sortie introuvable, ou déjà validée : elle ne peut plus être annulée.';
  end if;
end;
$$;

-- ---------- Remettre en poste après coup (erreur de saisie) ----------

create or replace function public.reintegrer_employe(p_employee uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exiger_role('admin');

  delete from public.sorties where employee_id = p_employee;
  update public.employees set date_sortie = null where id = p_employee;
end;
$$;

revoke all on function public.enregistrer_sortie(uuid, date, numeric, text, text, jsonb) from public;
revoke all on function public.valider_sortie(uuid) from public;
revoke all on function public.annuler_sortie(uuid) from public;
revoke all on function public.reintegrer_employe(uuid) from public;
grant execute on function public.enregistrer_sortie(uuid, date, numeric, text, text, jsonb) to authenticated;
grant execute on function public.valider_sortie(uuid) to authenticated;
grant execute on function public.annuler_sortie(uuid) to authenticated;
grant execute on function public.reintegrer_employe(uuid) to authenticated;
