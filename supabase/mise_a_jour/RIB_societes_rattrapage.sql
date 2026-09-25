-- ============================================================================
--  RATTRAPER LES R.I.B. DE SOCIÉTÉ MANQUANTS
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  D'après la feuille « RIP des sociétés ». Contrairement à la première
--  version, le rapprochement se fait sur un MOT-CLÉ du nom, pas sur le
--  nom entier : une société renommée « NORD PLANET NEGOCE » retrouve
--  quand même son R.I.B.
--
--  N'écrase rien : seules les sociétés sans R.I.B. sont complétées. Pour
--  corriger un R.I.B. déjà posé, passez par Entreprises → Renommer.
-- ============================================================================

update public.companies c
   set rib_ordinateur = r.rib
  from (values
    ('AL SAFAE',   '011640000027200000921013'),
    ('BO',         '011640000017210001247578'),
    ('DUO',        '011640000019210000701077'),
    ('VERT',       '011640000027200000921110'),
    ('TRIPLE',     '011640000017210001250197'),
    ('MEGAINTER',  '011640000033210000201021'),
    ('NORD PLANET','011640000017210001353987'),
    ('SERCLEAN',   '007640000601200000079948'),
    ('TRIMAX',     '011640000019210000701174'),
    ('VIGILMA',    '007640000601200000078590')
  ) as r(mot, rib)
 where c.rib_ordinateur is null
   and (upper(trim(c.name)) = r.mot or upper(trim(c.name)) like r.mot || '%'
        or upper(trim(c.name)) like '%' || r.mot || '%');

-- Le résultat : plus aucune société ne doit dire « AUCUN R.I.B. ».
select name                                        as societe,
       coalesce(rib_ordinateur, '⚠ AUCUN R.I.B.')  as rib_ordinateur
  from public.companies
 order by (rib_ordinateur is null) desc, name;
