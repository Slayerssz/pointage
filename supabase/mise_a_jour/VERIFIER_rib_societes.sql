-- ============================================================================
--  LE R.I.B. DE CHAQUE SOCIÉTÉ EST-IL EN PLACE ?
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  C'est ce R.I.B. qui s'imprime en « RIB ORDINATEUR » sur l'ordre de
--  virement. Sans lui, la ligne sort vide et la banque ne sait pas quel
--  compte débiter.
--
--  La colonne « nom_exact » compte : RIB_societes.sql rapproche les
--  sociétés par leur nom. Si un nom a changé depuis, son R.I.B. n'a pas
--  suivi — c'est la cause la plus fréquente d'une ligne vide.
-- ============================================================================

select name                                         as nom_exact,
       coalesce(rib_ordinateur, '⚠ AUCUN R.I.B.')   as rib_ordinateur,
       length(coalesce(rib_ordinateur, ''))         as chiffres
  from public.companies
 order by (rib_ordinateur is null) desc, name;
