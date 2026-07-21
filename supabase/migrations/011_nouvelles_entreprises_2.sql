-- ============================================================
-- 011 — Nouvelles entreprises (2e lot, import Excel)
-- MEGANTER SERVICE MAROC, NORD PLANET, SERCLEAN NEGOCE, TRIMAX, VIGILMA GARD MAROC
-- Généré automatiquement depuis les fichiers Excel fournis.
-- À exécuter après 010_maj_triple_a.sql. Ré-exécutable sans doublon.
-- ============================================================


-- ===== MEGANTER SERVICE MAROC : 4 employés, 1 sites =====
insert into public.companies (name) values ('MEGANTER SERVICE MAROC') on conflict (name) do nothing;

insert into public.sites (company_id, name, pointage_actif)
select c.id, v.name, v.actif from public.companies c, (values
  ('ADMINISTRATIVE', true)
) as v(name, actif)
where c.name = 'MEGANTER SERVICE MAROC'
on conflict (company_id, name) do nothing;

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss, e.date_naissance, e.date_embauche, e.date_sortie, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  (9, 'SARIE YOUSRA', 'K578299', '166981358', null::date, date '2024-09-01', null::date, 'AGENT ADMINISTRATIVE', null, 'TANGER', 'Virement', 'ADMINISTRATIVE'),
  (10, 'HAIDA NADA', 'K557693', '172948116', date '1998-04-19', date '2024-07-01', null::date, 'AGENT ADMINISTRATIVE', 'RUE SAID BEN JOUBAIR NO 2', 'TANGER', 'Virement', 'ADMINISTRATIVE'),
  (11, 'BENICHOU HICHAM', 'D991612', '159664648', date '1987-12-07', date '2024-09-01', null::date, 'AGENT ADMINISTRATIVE', 'COOP EL AYOUN AIT OUALLAL AIN ORMA MEKNES', 'meknes', 'Virement', 'ADMINISTRATIVE'),
  (12, 'EL KHADIRI ANAS', 'K428173', '114660478', date '1987-08-11', date '2024-09-01', null::date, 'AGENT ADMINISTRATIVE', 'ROUTE DE LA MONTAGNE HAOUMAT EL OUED', 'TANGER', 'Virement', 'ADMINISTRATIVE')
) as e(matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement, site_name)
join public.companies c on c.name = 'MEGANTER SERVICE MAROC'
join public.sites s on s.company_id = c.id and s.name = e.site_name
where not exists (select 1 from public.employees x where x.company_id = c.id and x.matricule = e.matricule);


-- ===== NORD PLANET : 41 employés, 14 sites =====
insert into public.companies (name) values ('NORD PLANET') on conflict (name) do nothing;

insert into public.sites (company_id, name, pointage_actif)
select c.id, v.name, v.actif from public.companies c, (values
  ('CRMEFTTH/JARDINIER/TANGER', true),
  ('CRMEFTTH/JARDINIER/TETOUAN', true),
  ('CRMEFTTH/JARDINIER/LARACHE', true),
  ('CENTRE MEDICO RAHRAH', true),
  ('HOTEL DE VILLE', true),
  ('CENTRE BOUKMAKH', true),
  ('INSTITUT LALA MERIEM', true),
  ('AHMED LOUKILI', true),
  ('REMPLACEMENT', true),
  ('CRI-Tanger', true),
  ('CRI-Tetouan', true),
  ('CRI-Al Hoceima', true),
  ('BLOC SANITAIRE PLAYA', true),
  ('CRI-Larache', true)
) as v(name, actif)
where c.name = 'NORD PLANET'
on conflict (company_id, name) do nothing;

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss, e.date_naissance, e.date_embauche, e.date_sortie, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  (57, 'GHAOUAL HICHAM', 'GM118187', '118663611', date '1982-01-01', date '2023-08-01', null::date, 'AGENT DE JARDINIER', 'HAOUMAT FATIMA OUAMA', 'TANGER', 'Virement', 'CRMEFTTH/JARDINIER/TANGER'),
  (56, 'LAGDAL MOHAMED', 'KA16956', '118230121', date '1966-11-17', date '2023-08-01', null::date, 'AGENT DE JARDINIER', 'MDR DAIDIA CAIDAT HAD GHARBIA CERCLE ASILAH', 'TANGER', 'Virement', 'CRMEFTTH/JARDINIER/TANGER'),
  (58, 'ETTAYEBI MOHAMMED', 'L259735', null, date '1967-10-20', date '2023-08-01', null::date, 'AGENT DE JARDINIER', 'AV MOHAMED BENNOUNA RUE ZAHRA NO 49', 'TETOUAN', 'Virement', 'CRMEFTTH/JARDINIER/TETOUAN'),
  (133, 'EL AOUAD AZDDINE', 'LA199433', null, date '2003-11-13', date '2026-02-12', null::date, 'AGENT DE JARDINIER', 'HAY ZOUADA NR 18', 'LARACHE', 'Virement', 'CRMEFTTH/JARDINIER/LARACHE'),
  (120, 'OQAYL NAZHA', 'ZT12154', '903597637', date '1984-10-30', date '2025-08-19', null::date, 'AGENT DE NETTOYAGE', 'DR EL MCHAE OUDKA GHAFASI TAOUNATE', 'TANGER', 'Virement', 'CENTRE MEDICO RAHRAH'),
  (132, 'FATHI OUAFAE', 'CD612014', null, date '2000-10-26', date '2026-02-11', null::date, 'AGENT DE NETTOYAGE', 'BLOC 20 N23 HAY QODES 2 ERAC FES', 'TANGER', 'Espece', 'HOTEL DE VILLE'),
  (61, 'BENYOUSSEF NAJIA', 'KB47025', null, date '1986-01-01', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'HAY MESNANA SECTEUR ALINARA RUE 42', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (113, 'MOUMEN HAMMOUCHA', 'G293723', '152687442', date '1967-01-01', date '2025-04-09', null::date, 'AGENT DE NETTOYAGE', 'COMPLEXE HASSANI ANNOUR GH 5 N 90', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (34, 'SOUSSAN ZOHRA', 'KB111605', '134138596', date '1994-01-01', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'HAY AIN MEZNOUD OUAMA', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (129, 'ERRAFIQI NADIA', 'Q311812', null, date '1994-07-06', date '2025-10-23', null::date, 'AGENT DE NETTOYAGE', '333 LOT SALAM 1 HAY DAKHLA BOUJNIBA', 'KHOURIBGA', 'Espece', 'HOTEL DE VILLE'),
  (42, 'EL ALOUFI OUSSAMA', 'KB193938', '134583128', date '1999-05-08', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'HAY HABIBA RUE 139 N 6', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (35, 'SAKHRI KHADIJA', 'C628873', '102751172', date '1964-03-14', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'DER BLONGER COOP IZDIHAR RAS AL MAE AIN CHHEF FES', 'FES', 'Virement', 'HOTEL DE VILLE'),
  (39, 'ASSEM NAIMA', 'V179370', '162072279', date '1977-10-03', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'RES IBN BATOUTA BLOC B ETAGE 5 NO 92', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (40, 'MEZARI FATIHA', 'K230810', '183494098', date '1973-02-01', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'HAY JAMAE RUE 191 N 04', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (41, 'EL MOUEDENE BOUAZZAOUIA', 'AB160418', '120563476', date '1967-01-01', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'RES IKHLAS BLOC 11 IMM 65 REZ DE CHAUSSE NO 01', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (37, 'EL-FATEHY MARYEM', 'AE279534', '173432811', date '2001-07-27', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'ST HAMMANI DERB DOUMIAT N 182', 'SALE', 'Virement', 'HOTEL DE VILLE'),
  (43, 'AL KHAMAR RACHID', 'L330522', '163803772', date '1975-01-01', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'HAY IBOUR RUE AJMAN NO 54', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (44, 'ECH-CHAFFANI SAKINA', 'RC4512', '193703091', date '1991-05-12', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'COMPLEXE BARAKA 1 IMM 112 NR 9', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (47, 'KHARBOUCH NAIMA', 'Z341257', '121877328', date '1978-01-01', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'HAY SANIA HAOUMAT EL OUAD', 'TANGER', 'Virement', 'CENTRE BOUKMAKH'),
  (45, 'ESSALHI NADIA', 'VA67222', '109174055', date '1977-07-24', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'COMPLEXE MILITAIRE HAY EL JADID IMB 13 NO 15', 'TANGER', 'Espece', 'CENTRE BOUKMAKH'),
  (46, 'MAKHLOUFI JEMAA', 'D181689', '121215753', date '1964-01-01', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'HAY HAMRIA GUERCIF', 'GUERCIF', 'Virement', 'INSTITUT LALA MERIEM'),
  (51, 'BEN HALIMA ZOHRA', 'L369585', '193064218', date '1976-01-01', date '2023-07-29', null::date, 'AGENT DE NETTOYAGE', 'HAY MESNANA SECTEUR AL FOROUSSIYA LOTS EL MOUHIT N', 'TANGER', 'Virement', 'INSTITUT LALA MERIEM'),
  (136, 'LONJALI NAZIHA', 'K281378', '145938554', date '1974-01-01', date '2026-03-17', null::date, 'AGENT DE NETTOYAGE', 'DOUAR ZAHARA KSAR EL SGHIR', 'FAHS ANJRA', 'Espece', 'AHMED LOUKILI'),
  (52, 'EL BOUHZRATI EL MOFADDALA', 'K369431', '140108637', date '1975-01-01', date '2023-08-01', null::date, 'AGENT DE NETTOYAGE', 'HAY BENKIRANE RUE 68 NO 60', 'TANGER', 'Virement', 'AHMED LOUKILI'),
  (149, 'EL MANIRA ZHOR', 'CD175765', null, date '1985-01-01', date '2026-07-20', null::date, 'AGENT DE NETTOYAGE', null, null, 'Espece', 'REMPLACEMENT'),
  (147, 'EDAHANI CHAIMAE', 'GB244343', null, date '1996-07-01', date '2026-07-14', null::date, 'AGENT DE NETTOYAGE', 'DOUAR MERJA CAIDAT KARIAT BENAOUDA SOUK', 'EL ARBAA DU GHARB', 'Espece', 'REMPLACEMENT'),
  (146, 'LBAKKARI MARIYEM', 'DO49494', null, date '1996-04-16', date '2026-07-02', null::date, 'AGENT DE NETTOYAGE', null, null, 'Espece', 'REMPLACEMENT'),
  (148, 'ECH-CHARKI NAOUAL', null, null, null::date, date '2026-07-14', null::date, 'AGENT DE NETTOYAGE', null, null, 'Espece', 'REMPLACEMENT'),
  (144, 'SOULAIMANE YOUSSEF', 'K659496', null, date '2009-03-04', date '2026-06-23', null::date, 'AGENT DE NETTOYAGE', 'HAY MESNANA SECTEUR AL INARA RUE 42', 'TANGER', 'Espece', 'REMPLACEMENT'),
  (142, 'KAMEL FATIMA', 'C701984', null, date '1975-01-01', date '2026-06-09', null::date, 'AGENT DE NETTOYAGE', 'HAY AOUDA RUE 13 NO 17', 'TANGER', 'Espece', 'REMPLACEMENT'),
  (140, 'HASNA STITOU', 'R294078', null, null::date, date '2026-06-01', null::date, 'AGENT DE NETTOYAGE', null, 'TANGER', 'Espece', 'REMPLACEMENT'),
  (137, 'SAFRITE ZINEB', null, null, null::date, date '2026-04-22', null::date, 'AGENT DE NETTOYAGE', null, 'TANGER', 'Espece', 'REMPLACEMENT'),
  (102, 'ZAYOU RAHMA', 'LA73095', '170057263', date '1983-01-01', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'HAY MGHOUGHA SEGHIRA RUE 68', 'TANGER', 'Virement', 'CRI-Tanger'),
  (103, 'BOU AJAJ SOUKAINA', 'K574061', '142720916', date '2000-01-19', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'MESNANA SECTEUR ETTAYEF RUE 31', 'TANGER', 'Virement', 'CRI-Tanger'),
  (101, 'ABBAS LAAZIZA', 'LB115407', '108965708', date '1984-04-26', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'MGHOUGHA SGHIRA', 'TANGER', 'Virement', 'CRI-Tanger'),
  (104, 'AMALAL AZIZA', 'L478612', '999752528', date '1986-02-28', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'AV AHMED BAKKAL ZKT MIMI NR 10', 'TETOUAN', 'Virement', 'CRI-Tetouan'),
  (106, 'EL KHATTABI SOUAD', 'R288443', '169078288', date '1980-05-06', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', '04 RUE ABOU HANIFA', 'AL HOCEIMA', 'Virement', 'CRI-Al Hoceima'),
  (105, 'EL AISSATI JAMILA', 'R313977', '133708689', date '1969-01-01', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'APP 08 IMM 56 LOT EL HOUDA IMZOUREN', 'AL HOCEIMA', 'Virement', 'CRI-Al Hoceima'),
  (138, 'HADIN ABDELLATIF', 'K386343', null, date '1975-03-10', date '2026-05-01', null::date, 'AGENT DE NETTOYAGE', 'HAY EL JADID RUE 9 NR 13', 'TANGER', 'Espece', 'BLOC SANITAIRE PLAYA'),
  (130, 'AZAKRI IMRAN', 'L744168', null, date '2002-12-02', date '2025-11-15', null::date, 'AGENT DE NETTOYAGE', 'AV AMINA BINT OUAHEB NR 184 B', 'TETOUAN', 'Espece', 'BLOC SANITAIRE PLAYA'),
  (145, 'EL BRAG SOUAD', 'LB157550', null, date '1989-12-28', date '2026-07-01', null::date, 'AGENT DE NETTOYAGE', 'LOT EL OUAHDA IMMTIDAD NR 20', 'LARACHE', 'Virement', 'CRI-Larache')
) as e(matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement, site_name)
join public.companies c on c.name = 'NORD PLANET'
join public.sites s on s.company_id = c.id and s.name = e.site_name
where not exists (select 1 from public.employees x where x.company_id = c.id and x.matricule = e.matricule);


-- ===== SERCLEAN NEGOCE : 5 employés, 2 sites =====
insert into public.companies (name) values ('SERCLEAN NEGOCE') on conflict (name) do nothing;

insert into public.sites (company_id, name, pointage_actif)
select c.id, v.name, v.actif from public.companies c, (values
  ('MAISON DE LA PRESSE', true),
  ('AL OMRANE Draa-Tafilalet', true)
) as v(name, actif)
where c.name = 'SERCLEAN NEGOCE'
on conflict (company_id, name) do nothing;

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss, e.date_naissance, e.date_embauche, e.date_sortie, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  (1, 'EL GHAZI FATIMA', 'LB166680', '137638306', date '1979-01-01', date '2023-06-01', null::date, 'AGENT NETTOYAGE', 'MR DAR LOUZARI CR ET CT TATOFT CLE LOUKOUS', 'KSAR EL KEBIR', 'Virement', 'MAISON DE LA PRESSE'),
  (2, 'H''RIFA ABDERRAHMAN', 'LA13420', null, date '1959-01-01', date '2023-06-01', null::date, 'AGENT JARDINIER', 'HAY ZIATEN SECTEUR BRANES LAKDIMA RUE 98', 'TANGER', 'Espece', 'MAISON DE LA PRESSE'),
  (28, 'AIT BEN HADDOU HANANE', 'U200632', null, date '1999-12-26', date '2025-07-01', null::date, 'AGENT D''ACCUEIL', 'RUE ATLAS  NR 60 HAY EL MOHAMMADI BOUDENIB', 'ERRACHIDIA', 'Virement', 'AL OMRANE Draa-Tafilalet'),
  (29, 'EL AMRAOUI YOUSSEF', 'UB104345', null, date '2002-10-18', date '2025-07-01', null::date, 'AGENT D''ACCUEIL', 'HAY LAHROUCH LKADIM GOURRAMA RICH', 'MIDELT', 'Virement', 'AL OMRANE Draa-Tafilalet'),
  (30, 'JEBBOR LOUBNA', 'U209841', null, date '2004-11-01', date '2025-07-01', null::date, 'AGENT D''ACCUEIL', 'KSAR AIT IGHEF OULAD CHAKER AOUFOUS', 'ERRACHIDIA', 'Virement', 'AL OMRANE Draa-Tafilalet')
) as e(matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement, site_name)
join public.companies c on c.name = 'SERCLEAN NEGOCE'
join public.sites s on s.company_id = c.id and s.name = e.site_name
where not exists (select 1 from public.employees x where x.company_id = c.id and x.matricule = e.matricule);


-- ===== TRIMAX : 19 employés, 4 sites =====
insert into public.companies (name) values ('TRIMAX') on conflict (name) do nothing;

insert into public.sites (company_id, name, pointage_actif)
select c.id, v.name, v.actif from public.companies c, (values
  ('ENCG', true),
  ('CARTTH', true),
  ('ENVITA MAROC', true),
  ('AGENT REMPLACEMENT', true)
) as v(name, actif)
where c.name = 'TRIMAX'
on conflict (company_id, name) do nothing;

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss, e.date_naissance, e.date_embauche, e.date_sortie, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  (9, 'REHOUNI AHMED', 'K221400', '934429033', date '1972-02-25', date '2026-02-02', null::date, 'AGENT SECURITE', 'RUE ABI HANIFA NO 5', 'TANGER', 'Virement', 'ENCG'),
  (2, 'ALOUAT ABDELMALIK', 'LA59421', null, date '1960-01-01', date '2026-01-01', null::date, 'AGENT SECURITE', 'HAY MESNANA HAOUMAT EL INARA', 'TANGER', 'Espece', 'ENCG'),
  (13, 'KOUIRI ABDELLAH', 'LB185936', null, date '1993-02-04', date '2026-03-04', null::date, 'AGENT SECURITE', 'HAY SIDI RAISS RUE 07 NR 70', 'KSAR EL KEBIR', 'Virement', 'ENCG'),
  (11, 'OUCHRIF YOUNES', 'I366773', '183310799', date '1972-02-28', date '2026-02-08', null::date, 'AGENT SECURITE', 'AL IRFAN 2 GH 27 IMB 16 ETG 3 NR 317', 'TANGER', 'Virement', 'ENCG'),
  (12, 'KHELIFI ADNANE', 'D890121', '153980440', date '1997-01-31', date '2026-02-17', null::date, 'AGENT SECURITE', 'CENTRE KSAR EL MAJAZ KSAR EL MAJAZ', 'FAHS ANJRA', 'Virement', 'ENCG'),
  (4, 'DAHBI MORAD', 'F465145', '181330029', date '1983-11-12', date '2026-01-01', null::date, 'AGENT SECURITE', 'HAY MABROUKA RUE 11 NR 04', 'TANGER', 'Virement', 'ENCG'),
  (3, 'EL AHMADI ABDERRAHMANE', 'T109995', null, date '1955-01-01', date '2026-01-01', null::date, 'AGENT SECURITE', 'HAY SALAM GR Z RUE 15 NO 45', 'KSAR EL KEBIR', 'Espece', 'ENCG'),
  (19, 'STITOU AHMED', 'K45789', null, date '1958-01-01', date '2026-05-01', null::date, 'AGENT SECURITE', 'HAY AIN MEZNOUD OUAMA', 'TANGER', 'Versement', 'CARTTH'),
  (22, 'LAHSSINI ABDELADIM', 'LB114234', '160283985', date '1988-03-03', date '2026-05-01', null::date, 'AGENT SECURITE', 'HAY CHORAFAE GR/B RUE 5 NR 15', 'KSAR EL KEBIR', 'Virement', 'CARTTH'),
  (21, 'LAHSSINI MOHAMMED', 'LB4296', '160727991', date '1960-01-01', date '2026-05-01', null::date, 'AGENT SECURITE', 'HAY CHORAFAE GR/B RUE 05 NO 15', 'KSAR EL KEBIR', 'Virement', 'CARTTH'),
  (20, 'ZIOUAN AHMED', 'L581974', '199710948', date '1994-05-01', date '2026-05-01', null::date, 'AGENT SECURITE', 'AV HOMMAN FETOUAKI RUE 08 NR 04', 'TETOUAN', 'Virement', 'CARTTH'),
  (16, 'KHIL YOUNESS', 'LC225789', '920743829', date '1990-01-18', date '2026-05-01', null::date, 'AGENT SECURITE', 'DR AMHARCHIN DARDARA', 'CHEFCHAOUEN', 'Virement', 'CARTTH'),
  (17, 'AZGHAY IBRAHIM', 'R170973', '145281491', date '1974-01-01', date '2026-05-01', null::date, 'AGENT SECURITE', '37 RUE 08 HAY MIRADOR HAUT', 'AL HOCEIMA', 'Virement', 'CARTTH'),
  (18, 'BELHAJ ABDELKARIM', 'R95856', '196731073', date '1964-12-04', date '2026-05-01', null::date, 'AGENT SECURITE', '04 RUE NIGER HAY AL MARSSA', 'AL HOCEIMA', 'Virement', 'CARTTH'),
  (14, 'ZAIDI MOHAMED', 'KB1355', null, date '1981-01-07', date '2026-05-04', null::date, 'AGENT SECURITE', 'DR ROUMAN MELLOUSSA', 'FAHS ANJRA', 'Espece', 'ENVITA MAROC'),
  (15, 'BENYERMAK MOHAMMED', 'K335953', null, date '1978-12-29', date '2026-05-04', null::date, 'AGENT SECURITE', 'RUE MALTA NO 17 DERADEB', 'TANGER', 'Espece', 'ENVITA MAROC'),
  (23, 'AMAACHOU BILAL', 'LA89763', null, date '1985-07-05', date '2026-07-01', null::date, 'AGENT SECURITE', 'LOT OULAD SKHAR NR 239', 'LARACHE', 'Versement', 'AGENT REMPLACEMENT'),
  (6, 'EL HADDAN RIHAB', 'K539846', '188197109', date '1996-09-19', date '2026-01-01', null::date, 'AGENT D''ACCUEIL', 'SIDI BOUKHARI DAR AKETNI NO 18', 'TANGER', 'Virement', 'ENCG'),
  (5, 'EL BERDI SALMA', 'KB248276', '156754949', date '2003-06-16', date '2026-01-01', null::date, 'AGENT D''ACCUEIL', 'HAY EL QODS SECTEUR IBN TAOUIT RUE 56', 'TANGER', 'Virement', 'ENCG')
) as e(matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement, site_name)
join public.companies c on c.name = 'TRIMAX'
join public.sites s on s.company_id = c.id and s.name = e.site_name
where not exists (select 1 from public.employees x where x.company_id = c.id and x.matricule = e.matricule);


-- ===== VIGILMA GARD MAROC : 97 employés, 21 sites =====
insert into public.companies (name) values ('VIGILMA GARD MAROC') on conflict (name) do nothing;

insert into public.sites (company_id, name, pointage_actif)
select c.id, v.name, v.actif from public.companies c, (values
  ('MAISON DE LA PRESSE', true),
  ('MAISON D''AVOCAT', true),
  ('AGENT DE REMPLACEMENT', true),
  ('CRI/TANGER', true),
  ('CRI/TETOUAN', true),
  ('CRI/AL HOCEIMA', true),
  ('MARCHE GROS NOUVEAUX', true),
  ('CIMETIERE BOUBANA', true),
  ('FOURIERE ANCIEN', true),
  ('HOTEL DE VILLE', true),
  ('AHMED LOUKILI', true),
  ('FOURIERE', true),
  ('REGROUPEMENT COMMUNE BOUGHAZ', true),
  ('ARR BNI MAKADA', true),
  ('CHAMBRE D''ARTISANAT', true),
  ('CENTRE AREFQ', true),
  ('extra', true),
  ('BLOC SANITAIRE', true),
  ('FST/AL HOCEIMA', true),
  ('SUPERVISEUR', false),
  ('ASSISTANTE ADMINISTRATIF', true)
) as v(name, actif)
where c.name = 'VIGILMA GARD MAROC'
on conflict (company_id, name) do nothing;

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss, e.date_naissance, e.date_embauche, e.date_sortie, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  (247, 'EL OMARI MOHAMED', 'U130618', null, date '1978-08-01', date '2026-07-04', null::date, 'AGENT SECURITE', 'KSAR ZAOUIAT AMELKIS AOUFOUS ERRACHIDIA', 'ERRACHIDIA', 'Espece', 'MAISON DE LA PRESSE'),
  (248, 'EL TOUNANY ADIL', 'K564647', null, date '1996-10-15', date '2026-07-17', null::date, 'AGENT SECURITE', 'MD AOULAD ISSA COMMUNE ET CAIDAT AYACHA', 'LARACHE', 'Espece', 'MAISON DE LA PRESSE'),
  (142, 'EL OUARTI NOUREDDIN', 'LC216763', null, date '1990-10-12', date '2025-03-20', null::date, 'AGENT SECURITE', 'HAY MABROUKA RUE 14 N 16', 'TANGER', 'Espece', 'MAISON DE LA PRESSE'),
  (1, 'BOUGTIB ABDELALI', 'GN9048', '106318192', date '1960-12-16', date '2023-06-01', null::date, 'AGENT SECURITE', 'MESNANA RESD HAKIMA B 18 ETG 1 NO 65', 'TANGER', 'Espece', 'MAISON DE LA PRESSE'),
  (2, 'EL JBARI ABDENNOUR', 'LC58156', '180883088', date '1972-01-01', date '2023-06-01', null::date, 'AGENT SECURITE', 'SIAGHINE DB BEN MOFTI NR 38', 'TETOUAN', 'Virement', 'MAISON DE LA PRESSE'),
  (4, 'CHHABANE RACHID', 'CD59118', '183968663', date '1977-11-01', date '2023-06-01', null::date, 'AGENT SECURITE', 'HAY MGHOGHA SGHIRA RUE 96', 'TANGER', 'Virement', 'MAISON D''AVOCAT'),
  (203, 'ATTOUTI MOHAMED', 'K201719', null, date '1971-12-03', date '2025-12-07', null::date, 'AGENT SECURITE', 'TANJA BALIA HAOUMAT BOCHAIB RUE 131 NO 17', 'TANGER', 'Espece', 'MAISON D''AVOCAT'),
  (43, 'RAHMOUNI MOHAMED', 'R243004', null, date '1937-01-01', date '2024-07-01', null::date, 'AGENT SECURITE', 'HAY MIRADOR BAS PASSAGE OUAD OUARGHA', 'AL HOCEIMA', 'Versement', 'AGENT DE REMPLACEMENT'),
  (188, 'EL AABED IMAD', 'L571673', null, date '1993-12-09', date '2025-08-01', null::date, 'AGENT SECURITE', 'AV BILAL BEN RABAH ZKT 7 NR 3', 'TETOUAN', 'Versement', 'AGENT DE REMPLACEMENT'),
  (140, 'DRIBEL ADIL', 'D991028', '163578401', date '1982-06-18', date '2025-03-07', null::date, 'AGENT SECURITE', 'HAY MERS ACHENAD 5B RUE 96', 'TANGER', 'Virement', 'CRI/TANGER'),
  (219, 'RIFFI NOUR EDDIN', 'LC139205', '195244515', date '1980-01-01', date '2026-04-30', null::date, 'AGENT SECURITE', 'AL MERS DHAR AHAJJAM RUE 18 NR 17', 'TANGER', 'Virement', 'CRI/TANGER'),
  (99, 'EL BENNOURI ISSAM', 'K373326', '193601287', date '1980-08-16', date '2024-10-01', null::date, 'AGENT SECURITE', 'HAY GOURZIANA RUE 07 NR 01', 'TANGER', 'Virement', 'CRI/TANGER'),
  (44, 'EL KHATTABI HICHAM', 'L340347', '142344728', date '1979-06-09', date '2024-10-01', null::date, 'AGENT SECURITE', 'AV OUAZZANE RES HICHAM N 32 ET 2 AP 6', 'TETOUAN', 'Virement', 'CRI/TETOUAN'),
  (100, 'ABCHIR JIHAD', 'L522873', '197552306', date '1992-02-07', date '2024-10-01', null::date, 'AGENT SECURITE', 'AV MOHAMED 5 PASSAGE AJDIR IMM 2 NO 1', 'TETOUAN', 'Virement', 'CRI/TETOUAN'),
  (41, 'BENHADI NOUR EDDINE', 'R331121', '108631287', date '1986-09-16', date '2024-10-01', null::date, 'AGENT SECURITE', '16 RUE SIDI ALI HAY MIRADOR BAS', 'AL HOCEIMA', 'Virement', 'CRI/AL HOCEIMA'),
  (42, 'BEN ALI NOUR EDDINE', 'R279915', '196466670', date '1984-01-25', date '2024-10-01', null::date, 'AGENT SECURITE', 'IMM 54 APPT 07 POLE URBAIN HAY SIDI ABID', 'AL HOCEIMA', 'Virement', 'CRI/AL HOCEIMA'),
  (67, 'AOURIAGHEL HANAN', 'LC197621', '109109452', date '1985-01-01', date '2024-08-12', null::date, 'AGENT SECURITE', 'DOUAR BOUSSALAM MTIOUA JEBHA', 'CHEFCHAOUEN', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (74, 'EL ANZOUL WALID', 'GA228708', '174689550', date '2001-05-12', date '2024-08-12', null::date, 'AGENT SECURITE', 'DR COOPERATIVE SHAIMIA OULED', 'SIDI SLIMAN', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (71, 'NEHIRA KACEM', 'GA58054', '109108157', date '1972-11-18', date '2024-08-12', null::date, 'AGENT SECURITE', 'LOTIS EL BASATINE AV TOUTE NO 29', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (73, 'ED-DAHBY NOUR EDDINE', 'GA69741', '995530512', date '1976-11-10', date '2024-08-12', null::date, 'AGENT SECURITE', 'LOT EL HARRATI BLOC 05', 'SIDI SLIMANE', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (240, 'CHRIF MOHAMED AMINE', 'K652343', null, date '2007-03-20', date '2026-06-09', null::date, 'AGENT SECURITE', 'COMPLEXE HASSANI ENNOUR GH 4TR 5 IMM 7 ET 4 NO 274', 'TANGER', 'Espece', 'MARCHE GROS NOUVEAUX'),
  (77, 'ZAYER MOHAMMED', 'F179672', null, date '1962-08-12', date '2024-08-12', null::date, 'AGENT SECURITE', 'HOUMAT ZAYDI', 'TANGER', 'Espece', 'MARCHE GROS NOUVEAUX'),
  (60, 'BEN AYAD AYOUB', 'LC334430', '109108753', date '1999-10-20', date '2024-08-12', null::date, 'AGENT SECURITE', 'HAY SIDI BOUHAJA RUE 80 NR 23 BNI MAKADA', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (64, 'BELHACHMI MOHAMED', 'C717948', '138995752', date '1976-01-01', date '2024-08-12', null::date, 'AGENT SECURITE', 'HAY MESNANA SECTEUR ASSOUTOUE RUE 112', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (61, 'FANIR HOUSNI', 'DN14227', '185301770', date '1991-09-11', date '2024-08-12', null::date, 'AGENT SECURITE', 'LISSASFA 3 BLOC C NR 64 CASA', 'CASA', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (59, 'MECHNINE HAMZA', 'KB197870', '109099257', date '2001-05-19', date '2024-08-12', null::date, 'AGENT SECURITE', 'HAY MRABET CHARKIA  AOUAMA', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (65, 'M''RABET SOUFYAN', 'LC316493', '109105858', date '1996-07-25', date '2024-08-12', null::date, 'AGENT SECURITE', 'HAY EL MERS ACHENNAD 03 RUE 49', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (58, 'CHOUKRI BILAL', 'KB109116', '143110098', date '1992-03-27', date '2024-08-12', null::date, 'AGENT SECURITE', 'MABROUKA RUE 11 N°15', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (57, 'AOURIAGHEL HAMZA', 'LC271287', '109104856', date '1994-01-01', date '2024-08-12', null::date, 'AGENT SECURITE', 'HAY BNI MAKADA  LAKDIMA RUE 07', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (70, 'BEN AMARI LOUIZ AYOUB', 'KB227411', '109097455', date '1999-08-27', date '2024-08-12', null::date, 'AGENT SECURITE', 'HAY EL MAJED AV QODS NO 215 ET 3 NO 7', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (56, 'BAKHADDA ABDELILAH', 'SH98704', '189768976', date '1976-08-05', date '2024-08-12', null::date, 'AGENT SECURITE', 'HAY LINBIAT RUE BIR AKNI NO 529', 'SALE', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (106, 'EL HARCHNI  AYOUB', 'KB276744', '174688356', date '2005-10-15', date '2024-10-01', null::date, 'AGENT SECURITE', 'HAY HADDAD RUE 17 NR 03', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (76, 'BOU CHOUF MOHAMED RABIE', 'K538092', '166615719', date '1997-04-17', date '2024-08-19', null::date, 'AGENT SECURITE', 'HAY HABIBA RUE 155 NO 03', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (223, 'EL GHARBI AKRAM', 'KB332166', null, date '2008-08-26', date '2026-06-01', null::date, 'AGENT SECURITE', 'HAY EL HADDAD RUE 17 NO 2', 'TANGER', 'Espece', 'MARCHE GROS NOUVEAUX'),
  (215, 'BENAISSA MALKI MOHAMED', 'KB218726', null, date '2000-10-13', date '2026-04-01', null::date, 'AGENT SECURITE', 'TANJA BALIA RUE 136', 'TANGER', 'Espece', 'MARCHE GROS NOUVEAUX'),
  (224, 'EL GHOUATI ABDELILLAH', 'K500837', null, date '1989-08-03', date '2026-06-01', null::date, 'AGENT SECURITE', 'COMPLEXE EL FAJER D IMM 13 ETG 01 NO 25', 'TANGER', 'Espece', 'MARCHE GROS NOUVEAUX'),
  (222, 'JOKER CONGE 3', null, null, null::date, date '2026-05-01', null::date, 'AGENT SECURITE', null, null, 'Espece', 'MARCHE GROS NOUVEAUX'),
  (218, 'EAMIMAR ABDESLAM', 'SH46347', null, date '1958-01-01', date '2026-04-01', null::date, 'AGENT SECURITE', 'HAY MGHOUGHA LAKBIRA', 'TANGER', 'Espece', 'MARCHE GROS NOUVEAUX'),
  (200, 'DAMIRE OUSSAMA', 'KB209183', null, date '1999-07-15', date '2025-12-01', null::date, 'AGENT SECURITE', 'LOTS EL AMAL 2 IMM 109 ETG 1 NO 2', 'TANGER', 'Espece', 'MARCHE GROS NOUVEAUX'),
  (221, 'JOKER CONGE 2', null, null, null::date, date '2026-05-01', null::date, 'AGENT SECURITE', null, null, 'Espece', 'MARCHE GROS NOUVEAUX'),
  (220, 'JOKER CONGE 1', null, null, null::date, date '2026-05-01', null::date, 'AGENT SECURITE', null, null, 'Espece', 'MARCHE GROS NOUVEAUX'),
  (235, 'FARISI MOHAMMED', 'K633981', null, date '2007-12-12', date '2026-06-01', null::date, 'AGENT SECURITE', 'BRANES 1 LOTS FADILA RUE ACHAH EL KHARRAZ', 'NO84 TANGER', 'Espece', 'MARCHE GROS NOUVEAUX'),
  (217, 'LABIB YAHYA', 'KB188986', null, date '1999-10-02', date '2026-04-01', null::date, 'AGENT SECURITE', null, 'FES', 'Espece', 'MARCHE GROS NOUVEAUX'),
  (108, 'EL KACHTOUL ABDESLAM', 'LC70512', '199454805', date '1978-01-01', date '2024-11-01', null::date, 'AGENT SECURITE', 'AVENUE RAWACHID 10 QUARTIER SEBBANINE', 'CHEFCHAOUEN', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (75, 'RIFI MORCHID', 'LC110462', '164991196', date '1981-01-01', date '2024-08-12', null::date, 'AGENT SECURITE', 'HAY BNI MAKADA LAKDIMA RUE 07 N01', 'TANGER', 'Virement', 'MARCHE GROS NOUVEAUX'),
  (91, 'DAHROUCH ABDELTIF', 'K127719', null, date '1964-06-29', date '2024-09-01', null::date, 'AGENT SECURITE', 'RUE MALTE DAR DAHROUCH', 'TANGER', 'Espece', 'CIMETIERE BOUBANA'),
  (93, 'SAMADI SAID', 'K246375', null, date '1972-01-01', date '2024-09-08', null::date, 'AGENT SECURITE', 'HAY ATTADAMOUN SECTEUR ASSAFAE RUE 4', 'TANGER', 'Espece', 'CIMETIERE BOUBANA'),
  (192, 'LAZRAK OUSSAMA', 'KB222666', '113680028', date '2001-07-07', date '2025-09-17', null::date, 'AGENT SECURITE', 'HAY MABROUKA RUE 10 NO 32', 'TANGER', 'Virement', 'FOURIERE ANCIEN'),
  (86, 'OUACHIKH FOUAD', 'RC37962', '919482606', date '1999-01-01', date '2024-08-13', null::date, 'AGENT SECURITE', 'DR TALAROUAK ISSAGUEN KETAMA', 'AL HOCEIMA', 'Virement', 'FOURIERE ANCIEN'),
  (193, 'MAROUAN RABIH', 'KB242927', '120363760', date '2006-09-14', date '2025-10-14', null::date, 'AGENT SECURITE', 'HAY BOUHOUT RUE 17 NR 02', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (147, 'LACHKAR HAMZA', 'K474945', '133125012', date '1991-07-22', date '2025-03-25', null::date, 'AGENT SECURITE', 'HAY BEN KIRANE RUE 96 NO 23', 'TANGER', 'Virement', 'HOTEL DE VILLE'),
  (111, 'HAMICH TARIK', 'CD108086', '160503177', date '1980-01-26', date '2024-12-03', null::date, 'AGENT SECURITE', 'TANJA BALIA COMPLEXE DUODET 2 IMM 10 NR 226', 'TANGER', 'Virement', 'AHMED LOUKILI'),
  (153, 'OUACHIKH AHMED', 'RC41376', '100872462', date '1999-04-13', date '2025-04-04', null::date, 'AGENT SECURITE', 'DR TAKARKOURT ISSAGUEN KETAMA', 'AL HOCEIMA', 'Virement', 'AHMED LOUKILI'),
  (95, 'MESBAH ABDESLAM', 'K197477', '163429734', date '1971-04-10', date '2024-10-01', null::date, 'AGENT SECURITE', 'DR KHANDAK ZARARAA BOUKHALEF', 'TANGER', 'Virement', 'FOURIERE'),
  (96, 'MESBAH MHAMED REDA', 'K464848', '109158152', date '1991-05-15', date '2024-10-01', null::date, 'AGENT SECURITE', 'DOUAR KHANDAK ZARZOUR COMMUNE', 'TANGER', 'Virement', 'FOURIERE'),
  (117, 'EL JAYIDI ABDELATIF', 'KB41813', null, date '1971-04-19', date '2025-01-01', null::date, 'AGENT SECURITE', 'HAY JAMAA RUE 111 NO 13', 'TANGER', 'Virement', 'REGROUPEMENT COMMUNE BOUGHAZ'),
  (202, 'MDIDECHE NOURIDDIN', 'K147465', null, date '1965-01-01', date '2025-12-09', null::date, 'AGENT SECURITE', 'HAY BOUHOUT 2 RUE 40 NO 6 OUAMA', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (151, 'EL GUEDDARI AZEDDINE', 'KB23468', '138882389', date '1978-01-03', date '2025-04-07', null::date, 'AGENT SECURITE', 'HAY MZOUAK RUE 1 NO 10', 'TANGER', 'Virement', 'ARR BNI MAKADA'),
  (150, 'ECHAIRI LAGHCHIM ABDELILAH', 'K364136', '177172056', date '1981-10-18', date '2025-04-07', null::date, 'AGENT SECURITE', 'HAY SANIA RUE 8 NO 1 BIR CHIFA', 'TANGER', 'Virement', 'ARR BNI MAKADA'),
  (154, 'EL MEKRI MUSTAPHA', 'K154379', '138347036', date '1967-09-29', date '2025-04-07', null::date, 'AGENT SECURITE', 'HAY IBOUR AVENUE IRAQ NO 41', 'TANGER', 'Virement', 'ARR BNI MAKADA'),
  (213, 'EL MAIMOUNI MOHAMED', 'K197695', null, date '1962-01-01', date '2026-03-17', null::date, 'AGENT SECURITE', 'HAY DHAR EL KANFOUD RUE 56 AOUAMA', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (152, 'EL YAMLAHI BILAL', 'KB52337', '125871433', date '1988-03-02', date '2025-04-07', null::date, 'AGENT SECURITE', 'HAY EL QODS 56 NR 7 BIR CHIFA', 'TANGER', 'Virement', 'ARR BNI MAKADA'),
  (157, 'BOUETIA CHFIKI MOHAMMED', 'KA5549', null, date '1958-04-01', date '2025-04-07', null::date, 'AGENT SECURITE', 'HAY BOUHOUT RUE 70 NO 45', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (164, 'HADDOU YOUSFI', 'SH37057', null, date '1955-01-01', date '2025-04-24', null::date, 'AGENT SECURITE', 'BIR CHAIRI RUE 18 NO 4', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (185, 'EL AABED IMAD', 'L571673', null, date '1993-12-09', date '2025-08-01', null::date, 'AGENT SECURITE', 'AV BILAL BEN RABAH ZKT 7 NR 3', 'TETOUAN', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (132, 'BOUHSAINA RACHID', 'LB27892', '151747776', date '1970-11-10', date '2025-05-07', null::date, 'AGENT SECURITE', 'DOUAR REHIEN COMMUNE ET CAIDAT SAHEL', 'LARACHE', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (134, 'EL BAKKALI EL GHALI', 'ZT15442', null, date '1965-01-01', date '2025-05-07', null::date, 'AGENT SECURITE', 'HAY MESNANA SECTEUR ATTAYF RUE 64', 'TANGER', 'Espece', 'CHAMBRE D''ARTISANAT'),
  (168, 'EL MANSOURY MOHAMED', 'GM117935', '169462093', date '1986-11-02', date '2025-05-12', null::date, 'AGENT SECURITE', 'QU PALESTINE RUE 02 JNANE ZAIDANI NO 02', 'OUAZZANE', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (169, 'AOULAD BOLAICH NAOUFALE', 'LC320427', '193919653', date '1996-04-22', date '2025-05-13', null::date, 'AGENT SECURITE', 'RUE EMTILAA QUA ANDALOUSSE', 'CHEFCHAOUEN', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (135, 'BOUGHABA ESMAIL', 'L432136', '181132674', date '1984-09-22', date '2025-05-07', null::date, 'AGENT SECURITE', 'DR MENAZIL CR BANI HARCHEN', 'TETOUAN', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (133, 'BENHADHOUM ABDELMORAD', 'R304212', '142068809', date '1986-05-26', date '2025-05-07', null::date, 'AGENT SECURITE', 'HAY EL MERS GHARSAT JAMAE RUE 36', 'TANGER', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (173, 'AFSANE ASSAD', 'LB208619', '157764357', date '1996-11-16', date '2025-06-04', null::date, 'AGENT SECURITE', 'HAY CHRAFAE GR/B RUE 19 NR 18', 'KSAR EL KEBIR', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (198, 'GHAILAN OTMANE', 'K636554', null, date '2002-09-05', date '2025-11-17', null::date, 'AGENT SECURITE', 'MDR AIT ZITOUN CRC HJAR NHAL', 'TANGER', 'Espece', 'CENTRE AREFQ'),
  (195, 'AMAZU ABDELHAK', 'K570148', null, date '1998-02-14', date '2025-11-12', null::date, 'AGENT SECURITE', 'DR AIN ZAYTOUN HJAR NHAL', 'TANGER', 'Espece', 'CENTRE AREFQ'),
  (246, 'BILAL CHOUKRI', null, null, null::date, date '2026-06-12', null::date, 'AGENT SECURITE', null, null, 'Espece', 'extra'),
  (245, 'TOUITI ISSAM', 'CD465366', null, date '2009-05-06', date '2026-06-13', null::date, 'AGENT SECURITE', 'DOUAR EL HAMMAL OULED TAYEB', 'FES', 'Espece', 'BLOC SANITAIRE'),
  (207, 'MOUNCIF MOHAMED', 'ZT319285', null, date '1999-09-26', date '2026-02-01', null::date, 'AGENT SECURITE', 'DR OLD BOUAAZA OLD ALIANE TISSA', 'TAOUNATE', 'Espece', 'BLOC SANITAIRE'),
  (204, 'BAHAMOU LHOUSSAINE', 'FL9155', null, date '1965-01-08', date '2026-06-09', null::date, 'AGENT SECURITE', 'HAY BEN KIRANE RUE 38 NO 41', 'TANGER', 'Espece', 'BLOC SANITAIRE'),
  (237, 'ES-SIH OMAR', 'K429976', null, date '1987-04-01', date '2026-06-10', null::date, 'AGENT SECURITE', 'HAY MOUJAHIDINE NO 12', 'TANGER', 'Espece', 'BLOC SANITAIRE'),
  (244, 'RAQAS YOUNES', 'D635022', null, date '1984-04-21', date '2026-06-15', null::date, 'AGENT SECURITE', 'HAY EL AIN NR 16 BMO', 'MEKNES', 'Espece', 'BLOC SANITAIRE'),
  (242, 'MALKI EL HOUSSEINE', 'GA66657', null, date '1976-08-19', date '2026-06-15', null::date, 'AGENT SECURITE', 'EL IRFANE 02 GH 08 IMM 98 NO 111', 'TANGER', 'Espece', 'BLOC SANITAIRE'),
  (241, 'ALOUAT MOSTAFA', 'K181441', null, date '1999-10-01', date '2026-06-15', null::date, 'AGENT SECURITE', 'RUE JNANE KABTANE NO 58', 'TANGER', 'Espece', 'BLOC SANITAIRE'),
  (239, 'BOUCHATEB ABDELKADER', 'LC207776', null, date '1986-10-03', date '2026-06-09', null::date, 'AGENT SECURITE', 'DOUAR ASSELI TAMOROT', 'CHEFCHAOUEN', 'Espece', 'BLOC SANITAIRE'),
  (236, 'FDAIL ABDELLAZIZ', 'U54632', null, date '1962-01-01', date '2026-06-09', null::date, 'AGENT SECURITE', 'RUE SAHEL NR 55 ALMASSIRA TINEJDAD', 'TANGER', 'Espece', 'BLOC SANITAIRE'),
  (229, 'ACHALHI ABID', 'R241916', '166469092', date '1976-08-13', date '2026-06-01', null::date, 'AGENT SECURITE', 'DR SOUANI AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (234, 'EL JEMLI OUSSAMA', 'RB25881', '165290655', date '2004-03-16', date '2026-06-01', null::date, 'AGENT SECURITE', 'TAFRAST AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (233, 'SOULIMANI OMAR', 'R351174', '168780811', date '1992-07-02', date '2026-06-01', null::date, 'AGENT SECURITE', 'CENTRE SIDI BOUAFIF AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (231, 'EL MOURABIT MOHAMMED', 'R290477', '149022418', date '1983-12-24', date '2026-06-01', null::date, 'AGENT SECURITE', 'CENTRE BENI HADIFA', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (230, 'LAACHIR SALMA', 'RB16374', null, date '1998-02-13', date '2026-06-01', null::date, 'AGENT SECURITE', 'DR TAFRAST AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (225, 'FIKRI NAJOUA', 'R298459', '190169229', date '1987-02-04', date '2026-06-01', null::date, 'AGENT SECURITE', 'HAY OUED EL MALEH IMZOUREN', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (226, 'EL IDRISSI CHAHID', 'R329769', '141526317', date '1985-10-11', date '2026-06-01', null::date, 'AGENT SECURITE', 'DR SOUANI AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (227, 'CHELTOUN MOHAMED', 'R111408', '157099387', date '1970-05-01', date '2026-06-01', null::date, 'AGENT SECURITE', 'CENTRE SIDI BOUAFIF AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (228, 'EL JEMLI ABDERRAHMANE', 'C272266', '188086189', date '1968-01-29', date '2026-06-01', null::date, 'AGENT SECURITE', 'CENTRE SIDI BOUAFIF AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (232, 'AMGHAR ABDELKRIM', 'K211726', '183177506', date '1969-01-01', date '2026-06-01', null::date, 'AGENT SECURITE', 'DR IZGHAYEN LOUTA AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (107, 'AHDOUT ABDELILAH', 'K349983', '197473757', date '1980-05-31', date '2024-10-01', null::date, 'AGENT ADMINISTRATIF', 'HAY ZAOUDIA  AV CHOUHADAE NO 25', 'TANGER', 'Virement', 'SUPERVISEUR'),
  (5, 'MHAMDI REDA', 'F416891', '163244606', date '1992-06-12', date '2023-09-01', null::date, 'AGENT ADMINISTRATIF', 'RTE EL AOUNIA LOT TAZAGHINE IMM S 7 NR 1', 'OUJDA', 'Virement', 'SUPERVISEUR'),
  (38, 'BAKKOUR FATIMA', 'K565271', '106679658', date '1999-07-01', date '2024-06-01', null::date, 'AGENT ADMINISTRATIF', 'HAY RAHRAH HAOUMAT EL BARAKA', 'TANGER', 'Virement', 'ASSISTANTE ADMINISTRATIF')
) as e(matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement, site_name)
join public.companies c on c.name = 'VIGILMA GARD MAROC'
join public.sites s on s.company_id = c.id and s.name = e.site_name
where not exists (select 1 from public.employees x where x.company_id = c.id and x.matricule = e.matricule);

