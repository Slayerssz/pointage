-- ============================================================
-- 006 — Données : page 4/7 du registre « Total Salariers »
-- À exécuter après 005 (peut être exécuté même si 001-005 l'ont déjà été).
-- Total registre atteint : 145 salariés. ✅
-- ⚠️  Données saisies à partir de photos : vérifiez CIN/CNSS/dates.
-- ============================================================

insert into public.sites (company_id, name)
select c.id, s.name
from public.companies c,
  (values
    ('REMPLACEMENT'),
    ('FOURRIERE'),
    ('JOKER ATLAS BERRY'),
    ('DRFPO'),
    ('LA COMMUNE GZENAYA')
  ) as s(name)
where c.name = 'Groupe Triple A'
on conflict (company_id, name) do nothing;

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss,
   date_naissance, date_embauche, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss,
       e.date_naissance, e.date_embauche, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  -- ================= REMPLACEMENT =================
  ('REMPLACEMENT', '867',  'EL AMRANI EL HASSAN', 'K256051',  '139833159', date '1975-07-02', date '2024-06-21', 'AGENT DE SECURITE', 'RUE 27 NO 16 LAMSALLAH',   'TANGER',        'Virement'),
  ('REMPLACEMENT', '1117', 'EL HAFIDI MONIR',     'GB128347', null,        date '1983-10-23', date '2025-09-01', 'AGENT DE SECURITE', 'DOUAR EL HARET TADANA',    'SOUK EL ARBAA', 'Versement'),
  ('REMPLACEMENT', '1271', 'BELBADRI MOHAMED',    'J174887',  null,        date '1962-01-02', date '2026-06-12', 'AGENT DE SECURITE', 'HAY RGAYAE 2 RUE 15 NO 6', 'TANGER',        'Espece'),
  ('REMPLACEMENT', '1279', 'ABDESLAM AGHRAIDA',   null,       null,        null,              date '2026-07-01', 'AGENT DE SECURITE', null,                       null,            'Espece'),

  -- ================= AGENCE URBAINE TANGER (suite) =================
  ('AGENCE URBAINE TANGER', '854', 'EL OUARDI MUSTAPHA',   'C169241',  '187986909', date '1964-01-13', date '2023-11-11', 'AGENT DE SECURITE', 'MDR GOURET MHARZA AOUAMA',        'TANGER',   'Virement'),
  ('AGENCE URBAINE TANGER', '851', 'MEZROUB ALI',          'K91383',   null,        date '1954-06-30', date '2023-11-11', 'AGENT DE SECURITE', 'MGHOGHA KEBIRA TANGER',           'TANGER',   'Espece'),
  ('AGENCE URBAINE TANGER', '853', 'EL IBRAHYMY KHALID',   'CD163338', '104880698', date '1986-11-10', date '2023-11-11', 'AGENT DE SECURITE', '3 DERB EL HADDADA FES JDID',      'FES',      'Virement'),
  ('AGENCE URBAINE TANGER', '847', 'MAZNAB ABDELJABBAR',   'G275265',  '137528303', date '1972-09-02', date '2023-11-11', 'AGENT DE SECURITE', 'HAY BENI OUERIAGHEL 03 RUE 34 N', 'TANGER',   'Espece'),
  ('AGENCE URBAINE TANGER', '852', 'AOULAD FKIHI MOHAMED', 'K155976',  '176420133', date '1956-01-01', date '2023-11-11', 'AGENT DE SECURITE', 'MGHOGHA LEKBIRA SECTEUR',         'TANGER',   'Espece'),
  ('AGENCE URBAINE TANGER', '849', 'BARKA BOUJEMAA',       'K107749',  null,        date '1966-01-01', date '2023-11-11', 'AGENT DE SECURITE', 'LOTS AMAL 2 COMPLEXE',            'TANGER',   'Espece'),
  ('AGENCE URBAINE TANGER', '846', 'AMGHAR ARAFA',         'LC264355', '195247319', date '1987-03-10', date '2023-11-11', 'AGENT DE SECURITE', 'DR AOUNAIN BENI MANSOUR',         'CHEFCHAOUEN', 'Virement'),
  ('AGENCE URBAINE TANGER', '850', 'MAKAOUI ABDELLAH',     'G101560',  '182313851', date '1960-12-31', date '2023-11-11', 'AGENT DE SECURITE', 'RUE ALBA NO 46',                  'TANGER',   'Virement'),

  -- ================= FOURRIERE =================
  ('FOURRIERE', '335', 'EL ALLALY RACHID', 'GN101782', '149687653', date '1976-01-01', date '2023-08-10', 'AGENT DE SECURITE', 'HAY BNI OUARIAGHEL 3 RUE 40 NR', 'TANGER', 'Virement'),
  ('FOURRIERE', '626', 'NIANIA HAMID',     'GK14855',  '169729253', date '1963-01-01', date '2023-08-10', 'AGENT DE SECURITE', 'HAY MGHOUGHA KEBIRA',            'TANGER', 'Espece'),

  -- ================= JOKER ATLAS BERRY =================
  ('JOKER ATLAS BERRY', '1237', 'EL HAMMOUMY MOHAMED', 'LB250464', null,        date '2002-05-14', date '2026-03-15', 'AGENT DE SECURITE', 'COOPERATIVE DAKHLA CR ET',      'LOUKOUS',       'Versement'),
  ('JOKER ATLAS BERRY', '1281', 'BENZAHRA SELLAM',     'GB80311',  null,        date '1979-01-01', date '2026-07-15', 'AGENT DE SECURITE', 'DOUAR OULED RAFAA MOULAY',      'SOUK EL ARBAA', 'Versement'),
  ('JOKER ATLAS BERRY', '1231', 'RHAYA SELLAM',        'GB303667', null,        date '2000-08-02', date '2026-03-07', 'AGENT DE SECURITE', 'DOUAR OULED MOUSSA KRAIMA',     'SOUK EL ARBAA', 'Versement'),
  ('JOKER ATLAS BERRY', '1221', 'EL MENGADI MHAMMED',  'GB62206',  null,        date '1974-01-01', date '2026-02-03', 'AGENT DE SECURITE', 'DOUAR OULED MESBAH SOUIR',      'SOUK EL ARBAA', 'Versement'),
  ('JOKER ATLAS BERRY', '1216', 'EL AABISSI MUSTAPHA', 'LB67174',  '103829861', date '1977-10-13', date '2026-07-09', 'AGENT DE SECURITE', 'DR OULED HAMOU EL GHABA CR ET', 'CLE',           'Versement'),

  -- ================= DRFPO =================
  ('DRFPO', '956',  'KHLIFI OMAR',         'F582769', '152233220', date '1997-10-19', date '2024-07-01', 'AGENT DE SECURITE', 'BD AOUNIA DERB BERROUKECH',      'OUJDA', 'Versement'),
  ('DRFPO', '1229', 'KHLIFI MIMOUN',       'F173337', null,        date '1960-12-26', date '2026-03-03', 'AGENT DE SECURITE', 'BD AOUNIA DERB BERROUKECH',      'OUJDA', 'Virement'),
  ('DRFPO', '1009', 'KHLIFI MOHAMMED',     'F695535', '193995552', date '2003-01-05', date '2025-05-01', 'AGENT DE SECURITE', 'BD AOUNIA DERB BERROUKECH',      'OUJDA', 'Virement'),
  ('DRFPO', '955',  'KACHCHAR ABDELHAKIM', 'F581432', '983005729', date '1991-12-16', date '2024-07-01', 'AGENT DE SECURITE', 'HAY NAJD III NR 547 SIDI YAHYA', 'OUJDA', 'Virement'),

  -- ================= LA COMMUNE GZENAYA =================
  ('LA COMMUNE GZENAYA', '1054', 'DAFLAOUI MOUJIB', 'C686089', '107745154', date '1975-01-01', date '2025-04-09', 'AGENT DE SECURITE', 'HAY TANDRA TAHAR SOUK', 'TAOUNATE', 'Virement')
) as e(site_name, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, qualification, adresse, ville, mode_reglement)
join public.companies c on c.name = 'Groupe Triple A'
join public.sites s on s.company_id = c.id and s.name = e.site_name
-- Ne pas dupliquer si ce fichier est exécuté deux fois :
where not exists (
  select 1 from public.employees x
  where x.company_id = c.id and x.matricule = e.matricule and x.nom_prenom = e.nom_prenom
);
