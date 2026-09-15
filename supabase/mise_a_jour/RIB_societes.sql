-- ============================================================================
--  LES R.I.B. DES DIX SOCIÉTÉS
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--  D'après la feuille « RIP des sociétés » du 15 septembre 2026. Les cinq
--  sociétés de la feuille absentes du système (Amarsi, Traiteur Aya,
--  Traiteur Jannat, MFA3, Exseria) ne sont pas reprises.
--  L'ordre de virement imprime ce R.I.B. en « RIB ORDINATEUR ».
-- ============================================================================

update public.companies c
   set rib_ordinateur = r.rib
  from (values
    ('AL SAFAE EL MAGHREB',     '011640000027200000921013'),
    ('BO',                      '011640000017210001247578'),
    ('DUO MULTI SERVICE',       '011640000019210000701077'),
    ('EDEN VERT SERVICE',       '011640000027200000921110'),
    ('GROUPE TRIPLE AAA',       '011640000017210001250197'),
    ('MEGAINTER SERVICE MAROC', '011640000033210000201021'),
    ('NORD PLANET',             '011640000017210001353987'),
    ('SERCLEAN NEGOCE',         '007640000601200000079948'),
    ('TRIMAX',                  '011640000019210000701174'),
    ('VIGILMA GARD MAROC',      '007640000601200000078590')
  ) as r(nom, rib)
 where upper(trim(c.name)) = r.nom;

-- Le résultat : chaque société et son R.I.B. Dix lignes, aucune vide.
select name as societe,
       coalesce(regexp_replace(rib_ordinateur, '(.{3})', '\1 ', 'g'), '⚠ AUCUN') as rib_ordinateur
  from public.companies
 order by (rib_ordinateur is null) desc, name;
