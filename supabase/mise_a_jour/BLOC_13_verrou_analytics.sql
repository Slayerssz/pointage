-- ============================================================================
--  BLOC 13 sur 13 — Verrou du tableau de bord
--  ============================================================
--  Supabase → SQL Editor → coller → Run.  À exécuter APRÈS le BLOC 12.
--
--  Permet de redemander le mot de passe avant d'ouvrir Analytics :
--  même poste allumé et session ouverte, personne n'y entre sans le
--  mot de passe du compte.
-- ============================================================================

-- ============================================================
-- 030 — Vérifier son propre mot de passe
-- À exécuter après 029_matricule_croissant.sql
--
-- Sert à reverrouiller les écrans sensibles (Analytics) : même si le
-- poste reste allumé et la session ouverte, il faut ressaisir son mot
-- de passe pour y entrer.
--
-- La fonction ne vérifie QUE le mot de passe de l'utilisateur connecté,
-- et ne renvoie qu'un oui/non. Elle ne permet ni de lire un mot de
-- passe, ni de tester celui de quelqu'un d'autre.
-- ============================================================

create or replace function public.verifier_mon_mot_de_passe(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_hash text;
begin
  if auth.uid() is null then
    return false;
  end if;
  if p_password is null or length(p_password) = 0 then
    return false;
  end if;

  select encrypted_password into v_hash from auth.users where id = auth.uid();
  if v_hash is null then
    return false;
  end if;

  -- Comparaison par re-chiffrement : le mot de passe stocké reste illisible
  return v_hash = extensions.crypt(p_password, v_hash);
end;
$$;

revoke all on function public.verifier_mon_mot_de_passe(text) from public;
grant execute on function public.verifier_mon_mot_de_passe(text) to authenticated;
