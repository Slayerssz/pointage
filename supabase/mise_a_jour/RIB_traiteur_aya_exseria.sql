-- ============================================================================
--  LES R.I.B. DE TRAITEUR AYA ET D'EXSERIA GROUPE
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  Les deux dernières sociétés sans R.I.B. L'ordre de virement imprime
--  ce numéro en « RIB ORDINATEUR » : sans lui, la case sort vide et la
--  banque refuse l'ordre.
--
--  Les deux numéros concordent avec le pied de page de leur papier à
--  en-tête — BMCE Agence Mesnana pour Traiteur Aya, et le compte porté
--  au bas du papier d'Exseria.
--
--  Le nom enregistré peut varier (« EXSERIA » ou « EXSERIA GROUPE ») :
--  les deux graphies sont acceptées. Relancer ce fichier ne fait rien
--  de plus.
-- ============================================================================

update public.companies c
   set rib_ordinateur = r.rib
  from (values
    ('TRAITEUR AYA',   '011640000017210001134476'),
    ('EXSERIA',        '007640000601400000127274'),
    ('EXSERIA GROUPE', '007640000601400000127274')
  ) as r(nom, rib)
 where upper(trim(c.name)) = r.nom;

-- Le résultat : toutes les sociétés et leur R.I.B. Celles qui n'en ont
-- toujours pas remontent en tête de liste.
select name                                   as societe,
       coalesce(regexp_replace(rib_ordinateur, '(.{3})', '\1 ', 'g'),
                '⚠ AUCUN')                    as rib_ordinateur,
       case when rib_ordinateur is null then '⚠ à renseigner'
            when length(rib_ordinateur) <> 24 then '⚠ ' || length(rib_ordinateur) || ' chiffres'
            else 'ok' end                     as controle
  from public.companies
 order by (rib_ordinateur is null) desc, name;
