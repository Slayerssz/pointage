-- ============================================================
-- 058 — Le propriétaire n'existe pour personne
-- À exécuter après 057_journal_roles.sql
--
-- La liste des comptes cachait déjà le propriétaire. La table, elle,
-- restait lisible : un administrateur qui interrogeait `profiles`
-- directement — par l'API, hors de l'application — y voyait la ligne et
-- son rôle. Le compte était donc invisible à l'écran, et pas ailleurs.
--
-- Désormais un administrateur voit tous les profils SAUF les
-- propriétaires. Seuls le développeur, et le propriétaire lui-même,
-- voient cette ligne-là.
--
-- La règle vit dans une fonction plutôt que dans la règle de lecture :
-- une politique ne s'interroge pas, et on ne saurait pas dire si elle
-- dit vrai. Celle-ci, on peut la lui demander.
-- ============================================================

create or replace function public.profil_visible(p_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_role::text <> 'owner'
      or coalesce(public.role_reel()::text, '') in ('dev', 'owner');
$$;

comment on function public.profil_visible(public.user_role) is
  'Ce rôle-là peut-il être vu par celui qui regarde ? Le propriétaire ne se montre qu''au développeur.';

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'admin'
    and public.profil_visible(role)
  );

revoke all on function public.profil_visible(public.user_role) from public;
grant execute on function public.profil_visible(public.user_role) to authenticated;
