-- ============================================================================
--  BLOC 54 sur 54 — Sortir quelqu'un depuis sa case de pointage
--  ============================================================
--  Supabase → SQL Editor → coller TOUT ce fichier → Run.
--  À exécuter APRÈS le BLOC 53.
--
--  Un départ se constate en pointant : « il n'est pas venu, et il ne
--  reviendra pas ». Jusqu'ici il fallait quitter la grille, ouvrir la
--  fiche, changer le statut, saisir la date. Quatre écrans pour une
--  chose qu'on sait à la seconde où on la voit.
--
--  Désormais, « Sortie » sur une case fait les trois gestes d'un coup :
--
--     · la date de sortie est posée à la veille de cette case — la
--       case cliquée est le premier jour où il n'est plus là ;
--     · les journées déjà posées après cette date sont retirées : ce
--       ne sont pas les siennes, et elles seraient payées ;
--     · un départ est ouvert dans la section Sorties, à compléter
--       (solde de tout compte, motif) quand on le voudra.
--
--  Le reste du mois s'affiche alors « Sortie » : rien n'est écrit dans
--  ces cases, c'est la date de sortie qui parle.
-- ============================================================================

create or replace function public.sortir_employe_depuis(
  p_employee uuid,
  p_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_embauche date;
  v_veille date;
  v_id uuid;
begin
  select company_id, date_embauche into v_company, v_embauche
    from public.employees where id = p_employee for update;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;
  if not public.peut_pointer(v_company) then
    raise exception 'Réservé aux validateurs, ou au personnel autorisé sur cette société.';
  end if;
  if p_date is null then
    raise exception 'Indiquez le premier jour d''absence.';
  end if;

  -- La case cliquée est le premier jour où il n'est plus là : son
  -- dernier jour travaillé est donc la veille.
  v_veille := p_date - 1;
  if v_embauche is not null and v_veille < v_embauche then
    raise exception 'Il n''a pas encore commencé le %.',
      to_char(v_veille, 'DD/MM/YYYY');
  end if;

  -- Une sortie déjà validée ne se remanie pas : le reçu est signé.
  if exists (select 1 from public.sorties
              where employee_id = p_employee and valide) then
    raise exception 'La sortie de cet employé est déjà validée.';
  end if;

  update public.employees
     set date_sortie = v_veille,
         actif = false
   where id = p_employee;

  -- Les journées d'après ne sont pas les siennes : les laisser
  -- reviendrait à les payer.
  perform public.nettoyer_pointages_apres_sortie(p_employee);

  -- Le départ s'ouvre dans la section Sorties, à compléter plus tard.
  insert into public.sorties
    (company_id, employee_id, date_sortie, montant, created_by)
  values (v_company, p_employee, v_veille, 0, auth.uid())
  on conflict (employee_id) where not valide do update
    set date_sortie = excluded.date_sortie
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.sortir_employe_depuis(uuid, date) from public;
grant execute on function public.sortir_employe_depuis(uuid, date) to authenticated;
