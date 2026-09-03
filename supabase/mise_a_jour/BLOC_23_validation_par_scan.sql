-- ============================================================================
--  BLOC 23 sur 23 — Rien n'est validé tant que le scan signé n'est pas là
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 22.
--
--  Contrat, congé et sortie suivent le même chemin : on crée, on imprime,
--  on fait signer, on dépose le scan — et c'est le dépôt qui vaut
--  validation. Retirer le scan la retire aussi.
-- ============================================================================

-- ============================================================
-- 040 — Rien n'est validé tant que le scan signé n'est pas là
-- À exécuter après 039_date_fin_obligatoire.sql
--
-- Un contrat, un congé et une sortie suivent le même chemin :
--
--   on le crée  →  on l'imprime  →  on le fait signer
--                →  on dépose le scan  →  il est validé
--
-- Tant que le scan manque, la pièce existe mais n'engage personne. La
-- validation ne se décrète donc pas : elle se constate. C'est le dépôt
-- du document signé qui la déclenche, et son retrait qui l'annule.
--
-- Une sortie garde en plus sa validation manuelle : le scan la rend
-- possible, l'utilisateur choisit le jour.
-- ============================================================

-- ---------- 1. Les documents peuvent viser une sortie ----------

alter table public.documents
  add column if not exists sortie_id uuid references public.sorties(id) on delete cascade;

alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents
  add constraint documents_type_check
    check (type in ('engagement', 'contrat', 'sortie', 'autre'));

create index if not exists documents_sortie_idx on public.documents (sortie_id);

-- ---------- 2. Ce que chaque pièce retient de sa validation ----------

alter table public.contrats
  add column if not exists valide_le timestamptz;
alter table public.conges
  add column if not exists valide_le timestamptz;

comment on column public.contrats.valide_le is
  'Renseignée quand le contrat signé a été scanné et déposé. Vidée si le scan part.';
comment on column public.conges.valide_le is
  'Idem pour l''engagement de congé signé.';

-- ---------- 3. La validation se constate au dépôt ----------

create or replace function public.documents_maj_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contrat uuid := coalesce(new.contrat_id, old.contrat_id);
  v_conge   uuid := coalesce(new.conge_id, old.conge_id);
  v_sortie  uuid := coalesce(new.sortie_id, old.sortie_id);
begin
  -- Un contrat est validé tant qu'au moins un scan lui reste attaché.
  if v_contrat is not null then
    update public.contrats c
       set valide_le = case
             when exists (select 1 from public.documents d
                           where d.contrat_id = v_contrat and d.type = 'contrat')
               then coalesce(c.valide_le, now())
             else null
           end
     where c.id = v_contrat;
  end if;

  if v_conge is not null then
    update public.conges g
       set valide_le = case
             when exists (select 1 from public.documents d
                           where d.conge_id = v_conge and d.type = 'engagement')
               then coalesce(g.valide_le, now())
             else null
           end
     where g.id = v_conge;
  end if;

  -- La sortie ne se valide pas toute seule : retirer son scan la ramène
  -- seulement à l'état « en préparation ».
  if v_sortie is not null
     and not exists (select 1 from public.documents d
                      where d.sortie_id = v_sortie and d.type = 'sortie') then
    update public.sorties set valide = false, valide_le = null, valide_par = null
     where id = v_sortie and valide;
  end if;

  return null;
end;
$$;

drop trigger if exists documents_validation on public.documents;
create trigger documents_validation
  after insert or delete on public.documents
  for each row execute function public.documents_maj_validation();

-- ---------- 4. Valider une sortie exige son scan ----------

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
  perform public.exiger_role('admin', 'validator');

  select employee_id, date_sortie into v_employee, v_date
    from public.sorties where id = p_sortie and not valide;
  if v_employee is null then
    raise exception 'Sortie introuvable ou déjà validée.';
  end if;

  -- Le reçu signé fait foi. Sans lui, rien ne prouve que le solde a été
  -- accepté, et l'employé ne doit pas quitter les listes.
  if not exists (select 1 from public.documents d
                  where d.sortie_id = p_sortie and d.type = 'sortie') then
    raise exception
      'Le reçu signé n''a pas encore été déposé : la sortie ne peut pas être validée.';
  end if;

  update public.sorties
     set valide = true, valide_le = now(), valide_par = auth.uid()
   where id = p_sortie;

  update public.employees
     set date_sortie = v_date
   where id = v_employee;
end;
$$;

revoke all on function public.valider_sortie(uuid) from public;
grant execute on function public.valider_sortie(uuid) to authenticated;
