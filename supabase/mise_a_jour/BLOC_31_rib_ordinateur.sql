-- ============================================================================
--  BLOC 31 sur 33 — Le R.I.B. de la société
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 30.
--  (Déjà lancé le 15 septembre 2026 ; relancer ne change rien.)
--
--  L'ordre de virement remis à la banque porte le compte à débiter, le
--  « RIB ORDINATEUR ». C'est le compte de la société. Les dix R.I.B. sont
--  posés par RIB_societes.sql ; l'ordre de virement les reprend.
-- ============================================================================

-- ============================================================
-- 048 — Le R.I.B. de la société, pour l'ordre de virement
-- À exécuter après 047_transport_panier.sql
--
-- L'ordre de virement remis à la banque porte le compte à débiter :
-- « RIB ORDINATEUR ». C'est celui de la société, pas d'un employé.
-- Saisi une fois, chaque ordre le reprend.
-- ============================================================

alter table public.companies
  add column if not exists rib_ordinateur text;

comment on column public.companies.rib_ordinateur is
  'R.I.B. du compte de la société, imprimé en tête de l''ordre de virement.';

create or replace function public.admin_definir_rib_ordinateur(
  p_company uuid,
  p_rib text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rib text := regexp_replace(coalesce(p_rib, ''), '\s', '', 'g');
begin
  perform public.exiger_role('admin');
  if v_rib <> '' and v_rib !~ '^[0-9]{24}$' then
    raise exception 'Un R.I.B. marocain compte 24 chiffres (% reçus).', length(v_rib);
  end if;
  update public.companies
     set rib_ordinateur = nullif(v_rib, '')
   where id = p_company;
  if not found then
    raise exception 'Société introuvable.';
  end if;
end;
$$;
revoke all on function public.admin_definir_rib_ordinateur(uuid, text) from public;
grant execute on function public.admin_definir_rib_ordinateur(uuid, text) to authenticated;
