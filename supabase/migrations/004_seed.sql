-- ============================================================
-- 004 — Données initiales : Groupe Triple A (sites + employés)
-- Transcrit depuis les pages 1, 2, 3 et 5 du registre « Total Salariers ».
-- ⚠️  Données saisies à partir de photos : merci de vérifier les
--     CIN / CNSS / dates et de corriger directement dans Supabase
--     (Table Editor → employees) si besoin.
-- Les pages restantes seront ajoutées dans 005_seed_2.sql.
-- ============================================================

insert into public.companies (name)
values ('Groupe Triple A')
on conflict (name) do nothing;

insert into public.sites (company_id, name)
select c.id, s.name
from public.companies c,
  (values
    ('ARONDIST MGHOGHA'),
    ('ART PAN/SEC'),
    ('ECONOMAT'),
    ('ABATTOIRS/SEC'),
    ('HOTEL DE VILLE'),
    ('COUVERTE ZIATEN'),
    ('CENTRE MEDICO RAHRAH'),
    ('CENTRE BOUKMAKH'),
    ('AHMED LOUKILI'),
    ('ATLAS BERRY'),
    ('INSTITUT POUR ENFANT AUTISTES'),
    ('JOKER'),
    ('PERCEPTION LA COMMUNE'),
    ('DRISCOLL''S'),
    ('COMPLEXE LA PERLA'),
    ('LA COMMUNE (SOLAMTA)'),
    ('LA FRANCAISE'),
    ('PARKING LA COMMUNE'),
    ('DPM LARACHE'),
    ('LOYER'),
    ('ATLAS BERRY AGADIR')
  ) as s(name)
where c.name = 'Groupe Triple A'
on conflict (company_id, name) do nothing;

-- Employés -----------------------------------------------------------
-- Qualification « AGENT DE » du registre = AGENT DE SECURITE.

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss,
   date_naissance, date_embauche, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss,
       e.date_naissance, e.date_embauche, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  -- ================= ARONDIST MGHOGHA (SECURITE) =================
  ('ARONDIST MGHOGHA', '252',  'BELMADANI ADIL',           'A492149',  '116528682', date '1971-01-01', date '2023-10-18', 'AGENT DE SECURITE', 'MGHOGHA EL KEBIRA TANGER',            'TANGER',     'Virement'),
  ('ARONDIST MGHOGHA', '26',   'DAHDOUH ABDESSELAM',       'K267198',  '132431041', date '1975-04-16', date '2023-10-18', 'AGENT DE SECURITE', 'TANJA BALIA RUE 72 N 13',             'TANGER',     'Virement'),
  ('ARONDIST MGHOGHA', '213',  'BEN AHMED MUSTAPHA',       'K341239',  '125245946', date '1975-01-01', date '2023-10-18', 'AGENT DE SECURITE', 'MGHOGHA SGHIRA TANGER',               'TANGER',     'Virement'),
  ('ARONDIST MGHOGHA', '1092', 'HOUMIYA MEHDI',            'K566593',  null,        date '2003-01-19', date '2025-07-03', 'AGENT DE SECURITE', 'DR EL ZAHARA CR ET CAIDAT KSAR',      'FAHS ANJRA', 'Espece'),
  ('ARONDIST MGHOGHA', '20',   'CHAIRI ABDESELAM',         'K408486',  '126229926', date '1985-12-02', date '2023-10-18', 'AGENT DE SECURITE', 'HAY EL JADID RUE 47 N°31 TANGER',     'TANGER',     'Virement'),
  ('ARONDIST MGHOGHA', '412',  'FOUNOUNOU MOHAMED',        'Z220815',  '101231314', date '1977-01-01', date '2023-10-18', 'AGENT DE SECURITE', 'DR AL AAMAL TAINESTE TAZA',           'TAZA',       'Virement'),
  ('ARONDIST MGHOGHA', '382',  'EL AZAMI EL HASSANI AZIZ', 'C963694',  '181330559', date '1981-01-01', date '2021-07-01', 'AGENT DE SECURITE', 'COMP RESD DOUHA OUAFAE 6 ETG',        'TANGER',     'Espece'),
  ('ARONDIST MGHOGHA', '1213', 'EL HASSAN LECHKAR',        'R70484',   null,        date '1961-01-01', date '2026-02-01', 'AGENT DE SECURITE', 'LOT MERIEM AV AL QODS LT 06 ET',      'TANGER',     'Espece'),
  ('ARONDIST MGHOGHA', '1112', 'ABDELAZIZ FEROUS',         'K294726',  null,        date '1973-05-08', date '2025-08-22', 'AGENT DE SECURITE', 'HAY EL INAACH RUE 61 NO 30',          'TANGER',     'Espece'),
  ('ARONDIST MGHOGHA', '247',  'HACHIM ABDELFATAH',        'Y406923',  '921774407', date '1993-04-19', date '2023-10-18', 'AGENT DE SECURITE', 'DR NZALET EL MOUDEN MAYAT EL',        'EL KELAA',   'Virement'),
  ('ARONDIST MGHOGHA', '19',   'AGHRAIDA ABDESLAM',        'KA31965',  '164981296', date '1980-01-01', date '2023-10-18', 'AGENT DE SECURITE', 'MDR EL HOUAOUIYENNE CAIDAT',          'ASILAH',     'Virement'),

  -- ================= ART PAN/SEC =================
  ('ART PAN/SEC', '1196', 'HMAIDI NOUREDINE', 'K255057', null, date '1975-05-17', date '2025-12-14', 'AGENT DE SECURITE', null, 'TANGER', 'Espece'),

  -- ================= ECONOMAT =================
  ('ECONOMAT', '193', 'MERAOUCH SAID', 'K118693', null, date '1964-06-20', date '2020-07-13', 'AGENT DE SECURITE', 'RUE LA FAYETTE N°16 3EME ETAGE', 'TANGER', 'Espece'),

  -- ================= ABATTOIRS/SEC =================
  ('ABATTOIRS/SEC', '828', 'EL ALLAM RACHID', 'K330588', null, date '1977-01-13', date '2023-09-13', 'AGENT DE SECURITE', 'HAY SANIA RUE 150 NO 141 BIR', 'TANGER', 'Espece'),

  -- ================= HOTEL DE VILLE =================
  ('HOTEL DE VILLE', '1223', 'ECHCHARKI SAID',    'C408695',  '916088722', date '1978-12-15', date '2026-02-18', 'AGENT DE SECURITE', 'HAY BEN KIRANE RUE 479',            'TANGER', 'Virement'),
  ('HOTEL DE VILLE', '1274', 'BENMMA MOHAMMED',   'D433720',  null,        date '1980-11-26', date '2026-06-23', 'AGENT DE SECURITE', 'AV MLY RACHID COMPLEXE AIDA NR 27', 'TANGER', 'Espece'),
  ('HOTEL DE VILLE', '200',  'CHAKOUR ABDELALI',  'K258777',  '167418155', date '1975-10-01', date '2023-08-10', 'AGENT DE SECURITE', 'DIOUR WIDAD BLOC 6 NO 1 TANGER',    'TANGER', 'Virement'),
  ('HOTEL DE VILLE', '925',  'EN-NAHID AZIZ',     'IB153790', '186498749', date '1981-03-17', date '2024-05-13', 'AGENT DE SECURITE', 'HAY SANIA RUE 25 NR 32 BIR CHIFA',  'TANGER', 'Virement'),

  -- ================= COUVERTE ZIATEN =================
  ('COUVERTE ZIATEN', '195', 'ABERDAA YOUSSEF', 'Z440904', '102911776', date '1988-06-15', date '2023-08-10', 'AGENT DE SECURITE', 'LOT 24 HEC SEC 2 N°10 TEMARA', 'TEMARA', 'Virement'),

  -- ================= CENTRE MEDICO RAHRAH =================
  ('CENTRE MEDICO RAHRAH', '202', 'HARRANDOU JAMAL',     'K539869', '134252026', date '1990-07-11', date '2023-08-10', 'AGENT DE SECURITE', 'HAY BRANES LAKDIMA TANGER',  'TANGER', 'Virement'),
  ('CENTRE MEDICO RAHRAH', '274', 'MEJDOUBI ABDELILAH',  'K154286', '101737215', date '1965-10-27', date '2023-08-10', 'AGENT DE SECURITE', 'HAY MESNANA BRANES TANGER',  'TANGER', 'Virement'),

  -- ================= CENTRE BOUKMAKH =================
  ('CENTRE BOUKMAKH', '201',  'ABOUBAKR ABDELLATIF',   'K367778',  '187200954', date '1981-10-21', date '2023-08-10', 'AGENT DE SECURITE', 'HAY RAHRAH HAOUMAT SAD',          'TANGER', 'Virement'),
  ('CENTRE BOUKMAKH', '403',  'ZAMANI NOUREDDIN',      'K450929',  '109071855', date '1990-05-25', date '2023-08-10', 'AGENT DE SECURITE', 'HAY MESNANA SECTEUR ATTAYF',      'TANGER', 'Virement'),
  ('CENTRE BOUKMAKH', '757',  'EL BOUZRATI OTMANE',    'KB105557', '115271542', date '1990-01-01', date '2023-08-10', 'AGENT DE SECURITE', 'HAY SANIA RUE 150 NO 90 BIR',     'TANGER', 'Virement'),
  ('CENTRE BOUKMAKH', '1108', 'NOUREDDIN EL AZZOUZI',  'R218415',  null,        date '1978-01-01', date '2025-08-08', 'AGENT DE SECURITE', 'HAY ZAOUDIA AVENUE',              'TANGER', 'Espece'),
  ('CENTRE BOUKMAKH', '1125', 'RAMZI AHMED',           'LC99155',  null,        date '1972-01-01', date '2025-09-16', 'AGENT DE SECURITE', 'HAY BNI OURIAGHEL 3 RUE 41 N 11', 'TANGER', 'Espece'),

  -- ================= AHMED LOUKILI =================
  ('AHMED LOUKILI', '1133', 'BENZINA AL MAHDI', 'GB166094', null,        date '1988-01-19', date '2025-10-03', 'AGENT DE SECURITE', 'CITE NOUVELLE N 75 SK ELARBAA',  'KENITRA',   'Espece'),
  ('AHMED LOUKILI', '938',  'MOHAMMADI YAHYA',  'S275067',  '115302626', date '1966-01-01', date '2025-01-07', 'AGENT DE SECURITE', 'DOUAR TINOUANE BENI RZINE',      'CHEFCHAOUEN', 'Espece'),
  ('AHMED LOUKILI', '878',  'TOUZNI MOURAD',    'K458675',  '102664007', date '1991-06-18', date '2024-01-03', 'AGENT DE SECURITE', 'HAY IBN KHALDOUN RUE 161 NO 37', 'TANGER',    'Virement'),

  -- ================= ATLAS BERRY =================
  ('ATLAS BERRY', '1201', 'OUINAS BOUSSELHAM',    'GB140956', '157041875', date '1985-01-01', date '2026-01-01', 'AGENT DE SECURITE', 'DOUAR OLD MESBAH SOUIR CAIDAT',   'SOUK EL ARBAA', 'Virement'),
  ('ATLAS BERRY', '5',    'BENGHANEM BOUSSELHAM', 'GB81470',  '193077001', date '1980-01-01', date '2017-10-09', 'AGENT DE SECURITE', 'DR TADANA SIDI BOUBKER HAJ SK',   'SOUK EL ARBAA', 'Virement'),
  ('ATLAS BERRY', '1030', 'LAHOUIRI ISMAEL',      'GB209020', '184443581', date '1988-01-01', date '2025-09-01', 'AGENT DE SECURITE', 'DOUAR OULED RAFAE MOULAY',        'SOUK EL ARBAA', 'Virement'),
  ('ATLAS BERRY', '934',  'SARGHINI RADIF',       'GB224024', '196156495', date '1984-01-01', date '2024-06-01', 'AGENT DE SECURITE', 'DOUAR OULED RAFAE CAIDAT',        'SOUK EL ARBAA', 'Virement'),
  ('ATLAS BERRY', '1187', 'EL-KACH JAOUAD',       'GB232984', '149230791', date '1995-01-01', date '2025-12-02', 'AGENT DE SECURITE', 'DOUAR LAMHAMID BOUJIB CAIDAT',    'SOUK EL ARBAA', 'Virement'),
  ('ATLAS BERRY', '1242', 'EL BAIDA MOHAMED',     'LB73982',  '190193451', date '1980-01-01', date '2026-03-18', 'AGENT DE SECURITE', 'DR OULED LAGHMARI RMEL CR ET',    'KSAR EL KEBIR', 'Virement'),
  ('ATLAS BERRY', '1266', 'MIRA YOUNOUS',         'LB141961', null,        date '1987-06-18', date '2026-06-05', 'AGENT DE SECURITE', 'DR MJAHDINE CR ZOUADA CDT SIDI',  'KSAR EL KEBIR', 'Versement'),
  ('ATLAS BERRY', '1204', 'EL HYADI ABDELLAH',    'GB125887', '121335064', date '1985-01-01', date '2026-01-07', 'AGENT DE SECURITE', 'DOUAR LALLA GHANOU CAIDAT',       'SOUK EL ARBAA', 'Virement'),
  ('ATLAS BERRY', '1207', 'ENNAUALY MOHAMMED',    'LB61707',  '157966747', date '1978-03-16', date '2026-01-09', 'AGENT DE SECURITE', 'COOPERATIVE OUARKZIZ CR ET',      'KSAR EL KEBIR', 'Virement'),
  ('ATLAS BERRY', '1135', 'EL HROUZ MOHAMED',     'LB58555',  '190220551', date '1975-04-07', date '2025-10-03', 'AGENT DE SECURITE', 'DOUAR MJAHDINE CR ZOUADA CDT',    'KSAR EL KEBIR', 'Virement'),
  ('ATLAS BERRY', '1250', 'OUINAS M''HAMMED',     'GB76038',  '184427585', date '1978-01-01', date '2026-04-09', 'AGENT DE SECURITE', 'DOUAR OULED MESBAH SOUIR',        'SOUK EL ARBAA', 'Virement'),
  ('ATLAS BERRY', '1217', 'EL HAMMOUMY ISSAM',    'LB258050', '153439354', date '2004-12-23', date '2026-02-03', 'AGENT DE SECURITE', 'COOPERATIVE DAKHLA CR ET CT',     'KSAR EL KEBIR', 'Virement'),

  -- ================= INSTITUT POUR ENFANT AUTISTES =================
  ('INSTITUT POUR ENFANT AUTISTES', '1091', 'EL OUACHANI ABDELKHALAK', 'R284271', '168157442', date '1982-01-01', date '2025-06-23', 'AGENT DE SECURITE', 'HAY BEN DIBANE RUE 03 N 10', 'FNIDEQ', 'Virement'),

  -- ================= JOKER =================
  ('JOKER', '1089', 'EL HOSSEIN TAHIRI',  'GM24383', null, date '1971-01-01', date '2025-06-19', 'AGENT DE SECURITE', 'QU PALASTINE RUE 09 LAKCHILAN',   'OUEZZANE', 'Espece'),
  ('JOKER', '1253', 'MUSTAPHA AZIANI',    'K103687', null, date '1963-01-01', date '2026-04-14', 'AGENT DE SECURITE', 'BOUHSSAINE RUE 11 NO 6 TANGER',   'TANGER',   'Espece'),
  ('JOKER', '1262', 'EL HABTI YASSINE',   null,      null, null,              date '2026-07-06', 'AGENT DE SECURITE', 'HAY RIAD BOUHSSAIN RUE 08 NO 07', 'TANGER',   'Espece'),
  ('JOKER', '1255', 'EL GUEDDARI JAFAR',  'KA8825',  null, date '1995-01-01', date '2026-04-28', 'AGENT DE SECURITE', 'MESNANA SECTEUR ASSOUTOUAE',      'TANGER',   'Espece'),

  -- ================= PERCEPTION LA COMMUNE =================
  ('PERCEPTION LA COMMUNE', '198',  'MEZROUA MOSTAFA',      'K193844',  '178862523', date '1961-04-13', date '2023-08-10', 'AGENT DE SECURITE', 'HAY BOUHOUT RUE 1 NO 17',        'TANGER',     'Espece'),
  ('PERCEPTION LA COMMUNE', '821',  'MESKAOUI ABDESLAM',    'GN118731', '197644844', date '1982-01-13', date '2023-09-02', 'AGENT DE SECURITE', 'CITE ORANGERS B NR 93 BEL KSIRI','SIDI KACEM', 'Virement'),
  ('PERCEPTION LA COMMUNE', '1093', 'AIT OUCHRA SAID',      'JC75312',  null,        date '1966-01-01', date '2025-07-02', 'AGENT DE SECURITE', 'DR EL KASBA TIOUT TAROUDANT',    'TANGER',     'Espece'),
  ('PERCEPTION LA COMMUNE', '1260', 'GHAILAN MOHAMED ANAS', 'K576066',  null,        date '2000-12-29', date '2025-12-07', 'AGENT DE SECURITE', 'AIN ZITOUN COMMUNE HAJR NHAL',   'TANGER',     'Espece'),
  ('PERCEPTION LA COMMUNE', '1257', 'SBAAI ABDELKADER',     'K183357',  null,        date '1964-01-01', date '2026-05-01', 'AGENT DE SECURITE', null,                             'TANGER',     'Espece'),
  ('PERCEPTION LA COMMUNE', '1256', 'RIAHI FARID',          'K296791',  null,        date '1979-01-01', date '2026-05-01', 'AGENT DE SECURITE', 'HAY BOUHOUT RUE 68 NO 9',        'TANGER',     'Espece'),
  ('PERCEPTION LA COMMUNE', '1109', 'ANOUAR BALLAH',        'K432606',  null,        date '1987-05-25', date '2025-08-07', 'AGENT DE SECURITE', 'RUE RAOUDIA NO 19 TANGER',       'TANGER',     'Espece'),
  ('PERCEPTION LA COMMUNE', '728',  'ZAMANI JALAL',         'K442133',  null,        date '1987-01-01', date '2023-03-11', 'AGENT DE SECURITE', 'HAY BRANES EL KADIMA LOT 8594',  'TANGER',     'Espece'),
  ('PERCEPTION LA COMMUNE', '1212', 'DRAOUI ALLAL',         null,       null,        null,              date '2026-06-19', 'AGENT DE SECURITE', null,                             'TANGER',     'Espece'),

  -- ================= DRISCOLL'S =================
  ('DRISCOLL''S', '1129', 'HABCHI MOHAMMED',      'GB68721',  '139406592', date '1973-01-01', date '2025-09-20', 'AGENT DE SECURITE', 'DOUAR SIBARA MOULAY',            'EL ARBAA',      'Virement'),
  ('DRISCOLL''S', '1283', 'BENCHRIF MOHAMED',     'GB32576',  null,        date '1973-01-01', date '2026-07-13', 'AGENT DE SECURITE', 'DOUAR OULED HAMDANE KARIAT',     'SOUK EL ARBAA', 'Virement'),
  ('DRISCOLL''S', '1282', 'ECHCHOUATERY YASSINE', 'GB184911', null,        date '1987-01-01', date '2026-07-13', 'AGENT DE SECURITE', 'DOUAR DOKKALA CAIDAT SIDI',      'SOUK EL ARBAA', 'Virement'),
  ('DRISCOLL''S', '1240', 'HANA KARIM',           'LA98787',  '978438111', date '1983-09-19', date '2026-03-12', 'AGENT DE SECURITE', 'CENTRE LAOUAMRA CR ET CT',       'KSAR EL KEBIR', 'Virement'),
  ('DRISCOLL''S', '1101', 'GUROUACH KHALID',      'GB267421', '133894607', date '1995-12-01', date '2025-07-25', 'AGENT DE SECURITE', 'DOUAR OULED HAMDANE CAIDAT',     'SOUK EL ARBAA', 'Virement'),
  ('DRISCOLL''S', '1188', 'EL BAKRI NABIL',       'GB259298', '162666926', date '1998-09-13', date '2025-12-03', 'AGENT DE SECURITE', 'DOUAR DLALHA HIMIRI CAIDAT',     'SOUK EL ARBAA', 'Virement'),
  ('DRISCOLL''S', '1124', 'BADDI MOUSSA',         'GB271040', '195631415', date '2000-04-29', date '2025-09-16', 'AGENT DE SECURITE', 'DOUAR SIBARA CAIDAT MOULAY',     'SOUK EL ARBAA', 'Virement'),
  ('DRISCOLL''S', '1052', 'EL GHAZI YOUNESS',     'GB315146', '113951551', date '2002-02-18', date '2025-04-08', 'AGENT DE SECURITE', 'DOUAR DLALHA AHMIRI CAIDAT',     'SOUK EL ARBAA', 'Virement'),
  ('DRISCOLL''S', '1239', 'AL MADI MOHAMED',      'LB238303', '149406816', date '1999-10-07', date '2026-03-12', 'AGENT DE SECURITE', 'DR OLD EL MAMOUNE CR ZOUADA',    'KSAR EL KEBIR', 'Virement'),
  ('DRISCOLL''S', '655',  'BENCHRIF RACHID',      'GB88050',  '121384566', date '1981-01-01', date '2022-10-10', 'AGENT DE SECURITE', '20 ANG YAACOUB EL MANSOUR ET',   'KENITRA',       'Virement'),

  -- ================= COMPLEXE LA PERLA =================
  ('COMPLEXE LA PERLA', '576', 'BELLACH NOUREDDINE', 'K280128', null, date '1978-08-17', date '2022-07-19', 'AGENT DE SECURITE', 'AV HASSAN 1 GHARSAT KTIOUET N°', 'TANGER', 'Espece'),
  ('COMPLEXE LA PERLA', '730', 'EL HAGOCH LAYACHI',  'K63460',  null, date '1951-01-01', date '2023-03-07', 'AGENT DE SECURITE', 'RUE SAAD IBN JOUBAIR NO 14',     'TANGER', 'Espece'),

  -- ================= LA COMMUNE (SOLAMTA) =================
  ('LA COMMUNE (SOLAMTA)', '204', 'ZEBAIRI SIDI EL HABIB', 'K193982', '165377569', date '1969-10-26', date '2023-08-10', 'AGENT DE SECURITE', 'COMPLEXE HASSANI RESD ENNOUR', 'TANGER', 'Virement'),

  -- ================= LA FRANCAISE =================
  ('LA FRANCAISE', '1261', 'GHAZZOUF MOHAMED', 'LC155365', null, date '1984-01-10', date '2026-05-11', 'AGENT DE SECURITE', 'HAY BOUHOUT RUE 48 N 05', 'TANGER', 'Espece'),

  -- ================= PARKING LA COMMUNE =================
  ('PARKING LA COMMUNE', '777', 'CHEFRAOU HICHAM', 'K274975', '108075154', date '1977-05-25', date '2023-08-10', 'AGENT DE SECURITE', 'HAY AOUDA RUE 2 NO 23 TANGER', 'TANGER', 'Virement'),

  -- ================= DPM LARACHE =================
  ('DPM LARACHE', '1017', 'EL KLAI ABDELHAK',     'KA44559',  '113093589', date '1987-02-05', date '2025-02-06', 'AGENT DE SECURITE', 'HAY EL BRANES GZENAYA',          'TANGER',    'Virement'),
  ('DPM LARACHE', '1018', 'EL GHRIBI MJIDOU',     'K252882',  '139075983', date '1973-01-01', date '2025-02-06', 'AGENT DE SECURITE', 'MADCHAR KANNOUA CR HJAR',        'TANGER',    'Espece'),
  ('DPM LARACHE', '1038', 'MAO RACHID',           'LA9044',   '185539991', date '1968-03-28', date '2025-03-26', 'AGENT DE SECURITE', 'DOUR AL ISPANE HAY EL MANZAH',   'LARACHE',   'Virement'),
  ('DPM LARACHE', '1199', 'ELKDIL BRAHIM',        'SJ16730',  '110271206', date '1981-10-15', date '2026-01-01', 'AGENT DE SECURITE', 'CENTRE TIOUGHZA',                'SIDI IFNI', 'Virement'),
  ('DPM LARACHE', '1043', 'AGOUAL OTHMAN',        'LA132302', '120577220', date '1986-02-13', date '2025-03-26', 'AGENT DE SECURITE', 'JENANE CASTIEL',                 'LARACHE',   'Virement'),
  ('DPM LARACHE', '1042', 'OULAD M''HIROU ANASS', 'LA161171', '192068595', date '1994-10-05', date '2025-03-26', 'AGENT DE SECURITE', 'NR 158 AV ABDELMOUMEN BEN ALI',  'LARACHE',   'Virement'),
  ('DPM LARACHE', '1040', 'ROUAS SAID',           'LA75462',  '153967992', date '1981-07-27', date '2025-03-26', 'AGENT DE SECURITE', 'LOT EL OUAFAE NR 1316',          'LARACHE',   'Versement'),
  ('DPM LARACHE', '1041', 'EL BAKKALI MOHAMED',   'J155568',  null,        date '1957-01-01', date '2025-03-26', 'AGENT DE SECURITE', 'NR 270 HAY NADOR',               'LARACHE',   'Virement'),

  -- ================= LOYER =================
  ('LOYER', '1131', 'NOUINOU MOHAMED', null, null, null, date '2025-10-01', 'AGENT', null, null, 'Virement'),

  -- ================= ATLAS BERRY AGADIR =================
  ('ATLAS BERRY AGADIR', '1220', 'TEKHLIS SAID',           'JH43349',  '116375911', date '1998-07-24', date '2026-02-09', 'AGENT DE SECURITE', 'DOUAR IKHREDIDEN AIT AMROU',   'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1156', 'EL BAZ ATMANE',          'JB340573', '198783622', date '1986-05-26', date '2025-10-01', 'AGENT DE SECURITE', 'DOUAR TIN TALEB SALEM AIT',    'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1157', 'ELMAMOUNE REDOUAN',      'JB378484', '118715071', date '1987-11-04', date '2025-10-01', 'AGENT DE SECURITE', 'DOUAR ANOU N''ADDI AIT AMROU', 'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1160', 'EL FAQIR AHMED',         'JH24422',  '197353102', date '1995-01-31', date '2025-10-01', 'AGENT DE SECURITE', 'DOUAR TIN TALEB SALEM AIT',    'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1140', 'ROUCHDI EL HASSAN',      'JB113201', '177092957', date '1973-01-01', date '2025-10-01', 'AGENT DE SECURITE', 'DOUAR OUKHRIB BELFAA',         'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1228', 'RAGRAGUI ABDELWAHAD',    'JB349832', '110497974', date '1985-10-04', date '2026-03-02', 'AGENT DE SECURITE', 'DOUAR OUKHRIB BELFAA',         'AIT BAHA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1151', 'LOTFI SABER',            'TS801396', '118033159', date '1992-09-08', date '2025-10-01', 'AGENT DE SECURITE', 'DOUAR TIN TALEB AIT AMIRA',    'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1150', 'EL MAMOUNE ABDALLAH',    'JB164633', '177118951', date '1975-10-15', date '2025-10-01', 'AGENT DE SECURITE', 'DOUAR TOUSSOUS BELFAA',        'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1149', 'ELMOUDDEN JAMAL',        'JB446525', '169177472', date '1991-05-15', date '2026-06-22', 'AGENT DE SECURITE', 'DOUAR IKHERDIDEN BELFAA',      'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1280', 'TEKHLIS ABDALLAH',       'JB315190', null,        date '1983-04-22', date '2026-07-10', 'AGENT DE SECURITE', 'DOUAR TIN CHEIKH BRAHIM',      'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1235', 'GADIR LARBI',            'EB42294',  '106306882', date '1987-02-25', date '2025-12-08', 'AGENT DE SECURITE', 'DOUAR IMKHLAF BELFAA CHTOUKA', 'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1169', 'EL FACHAT AHMED',        'JB376737', '161416142', date '1997-07-01', date '2026-06-15', 'AGENT DE SECURITE', 'DOUAR ECHOUK AIT AMIRA',       'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1272', 'BENKHAOUTI ABDELHAQ',    'JH35096',  '152877085', date '1980-01-01', date '2026-02-19', 'AGENT DE SECURITE', 'DOUAR OUKHRIB BELFAA',         'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1222', 'EL MADKOURY ABDERRAHIM', 'I492465',  null,        date '2004-07-13', date '2026-06-17', 'AGENT DE SECURITE', 'DOUAR GHZALA AIT AMIRA',       'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1273', 'KRIMCH HAMZA',           'JH89592',  '162743276', date '1984-03-30', date '2026-04-09', 'AGENT DE SECURITE', 'DOUAR OUKHRIB BELFAA',         'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1249', 'FATIHI MUSTAPHA',        'JB307619', null,        date '1994-01-02', date '2025-10-01', 'AGENT DE SECURITE', 'DOUAR TIN TALEB SALEM AIT',    'CHTOUKA', 'Virement'),
  ('ATLAS BERRY AGADIR', '1141', 'EL BAZ HICHAM',          'JH14172',  '179554989', date '1994-01-02', date '2025-10-01', 'AGENT DE SECURITE', 'DOUAR TIN TALEB SALEM AIT',    'CHTOUKA', 'Virement')
) as e(site_name, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, qualification, adresse, ville, mode_reglement)
join public.companies c on c.name = 'Groupe Triple A'
join public.sites s on s.company_id = c.id and s.name = e.site_name;
