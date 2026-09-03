-- ============================================================================
--  BLOC 20 sur 20 — Le bureau fait aussi la paie
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 19.
--
--  Une seule fonction change : le contrôle de rôle. Partout où « paie »
--  est accepté, le bureau l'est aussi. L'inverse reste faux — qui tient la
--  paie ne valide pas le pointage qu'il paie.
-- ============================================================================

-- ============================================================
-- 037 — Le bureau fait aussi la paie
-- À exécuter après 036_jours_par_mois.sql
--
-- Le bureau valide déjà le pointage du mois ; il enchaîne maintenant
-- sur la paie qui en découle. L'inverse n'est pas vrai : le rôle
-- « paie » ne gagne aucun droit du bureau.
--
-- Cela s'écrit à un seul endroit, dans le contrôle de rôle : partout
-- où « paie » est accepté, le bureau l'est aussi. Réécrire les six
-- fonctions de paie pour changer une ligne dans chacune aurait fini
-- par les faire diverger de leur version d'origine.
-- ============================================================

create or replace function public.exiger_role(variadic p_roles text[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text := coalesce(public.current_user_role()::text, '');
begin
  if v = any(p_roles) then
    return;
  end if;

  -- Le bureau couvre la paie. La réciproque est fausse, et le restera :
  -- qui tient la paie ne doit pas pouvoir valider le pointage qu'il paie.
  if v = 'validator' and 'paie' = any(p_roles) then
    return;
  end if;

  raise exception 'Action réservée à : %. Rôle actuel : %.',
    array_to_string(p_roles, ', '), coalesce(nullif(v, ''), 'aucun (non connecté)');
end;
$$;
