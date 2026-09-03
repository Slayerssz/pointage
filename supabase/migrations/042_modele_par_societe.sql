-- ============================================================
-- 042 — Renommer une société ne casse plus ses documents
-- À exécuter après 041_effet_au_depot_du_scan.sql
--
-- Les modèles de contrat, les en-têtes et les identités légales étaient
-- retrouvés par le NOM de la société. Renommer « Groupe Triple A » en
-- « GROUPE TRIPLE AAA » suffisait donc à faire disparaître l'aperçu du
-- contrat, sans le moindre message.
--
-- Chaque société porte désormais une clé de modèle, écrite une fois et
-- indépendante de son nom d'affichage. On peut la renommer comme on
-- veut : ses documents suivent.
-- ============================================================

alter table public.companies
  add column if not exists modele_document text;

comment on column public.companies.modele_document is
  'Quel jeu de documents (contrat, en-tête, mentions légales) s''applique. '
  'Indépendant du nom : renommer la société ne change rien.';

-- Rattachement initial, d'après le nom actuel et ses variantes connues.
update public.companies c
   set modele_document = m.cle
  from (values
    ('BO',                      'BO'),
    ('BO NETTOYAGE',            'BO'),
    ('DUO MULTI SERVICE',       'DUO MULTI SERVICE'),
    ('GROUPE TRIPLE A',         'GROUPE TRIPLE A'),
    ('GROUPE TRIPLE AAA',       'GROUPE TRIPLE A'),
    ('GTA',                     'GROUPE TRIPLE A'),
    ('MEGAINTER SERVICE MAROC', 'MEGAINTER SERVICE MAROC'),
    ('MEGANTER SERVICE MAROC',  'MEGAINTER SERVICE MAROC'),
    ('NORD PLANET',             'NORD PLANET'),
    ('NORD PLANET NEGOCE',      'NORD PLANET'),
    ('SERCLEAN',                'SERCLEAN NEGOCE'),
    ('SERCLEAN NEGOCE',         'SERCLEAN NEGOCE'),
    ('TRIMAX',                  'TRIMAX'),
    ('TRIMAX SURVEILLANCE',     'TRIMAX'),
    ('VIGILMA GARD MAROC',      'VIGILMA GARD MAROC'),
    ('VIGILMA GARD',            'VIGILMA GARD MAROC'),
    ('AL SAFAE EL MAGHREB',     'AL SAFAE EL MAGHREB'),
    ('AL SAFAE EL MAGHRIB',     'AL SAFAE EL MAGHREB'),
    ('EDEN VERT SERVICE',       'EDEN VERT SERVICE')
  ) as m(nom, cle)
 where c.modele_document is null
   and upper(regexp_replace(trim(c.name), '[^A-Za-z0-9]+', ' ', 'g')) = m.nom;

-- Seul l'administrateur y touche : se tromper de clé donnerait à une
-- société les contrats d'une autre.
create or replace function public.admin_definir_modele(
  p_company uuid,
  p_modele text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exiger_role('admin');
  update public.companies
     set modele_document = nullif(trim(coalesce(p_modele, '')), '')
   where id = p_company;
  if not found then
    raise exception 'Société introuvable.';
  end if;
end;
$$;

revoke all on function public.admin_definir_modele(uuid, text) from public;
grant execute on function public.admin_definir_modele(uuid, text) to authenticated;
