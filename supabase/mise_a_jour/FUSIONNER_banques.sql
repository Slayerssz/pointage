-- ============================================================================
--  FUSIONNER LES BANQUES ÉCRITES DE DEUX FAÇONS
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  Trois banques figuraient sous deux orthographes. Chaque paire est la
--  même banque (confirmé par Adam) : on garde l'orthographe majoritaire.
--     ATTIJARI WAFA BANK  (4)  →  ATTIJARIWAFA BANK  (63)
--     BMCE                (2)  →  BMCE BANK          (17)
--     BARID CASH          (1)  →  AL BARID CASH      (5)
--  Et tout le reste passe en majuscules, sans espaces en trop.
-- ============================================================================

update public.employees
   set banque = case upper(regexp_replace(trim(banque), '\s+', ' ', 'g'))
                  when 'ATTIJARI WAFA BANK' then 'ATTIJARIWAFA BANK'
                  when 'BMCE'               then 'BMCE BANK'
                  when 'BARID CASH'         then 'AL BARID CASH'
                  else upper(regexp_replace(trim(banque), '\s+', ' ', 'g'))
                end
 where banque is not null;

-- Le résultat : chaque banque, une seule fois.
select upper(banque) as banque, count(*) as employes
  from public.employees
 where archive_le is null and nullif(trim(banque), '') is not null
 group by 1 order by 1;
