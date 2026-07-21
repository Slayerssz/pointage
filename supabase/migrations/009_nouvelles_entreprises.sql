-- ============================================================
-- 009 — Nouvelles entreprises (import Excel)
-- AL SAFAE EL MAGHREB, BO, DUO MULTI SERVICE, EDEN VERT SERVICE
-- Généré automatiquement depuis les fichiers Excel fournis.
-- À exécuter après 008_details_paie.sql. Ré-exécutable sans doublon.
-- ============================================================


-- ===== AL SAFAE EL MAGHREB : 52 employés, 9 sites =====
insert into public.companies (name) values ('AL SAFAE EL MAGHREB') on conflict (name) do nothing;

insert into public.sites (company_id, name, pointage_actif)
select c.id, v.name, v.actif from public.companies c, (values
  ('LA COMMUNE GUEZNAIA', true),
  ('LA FORET DIPLOMATIQUE', true),
  ('CHAMBRE D''ARTISANAT', true),
  ('DRANEFO', true),
  ('LA SALLE OMNISPORT DRIOUCH', true),
  ('FST/AL HOCEIMA', true),
  ('FACULTE DES SCIENCES ET TECH', true),
  ('OFPPT', true),
  ('ADMINISTRATION', true)
) as v(name, actif)
where c.name = 'AL SAFAE EL MAGHREB'
on conflict (company_id, name) do nothing;

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss, e.date_naissance, e.date_embauche, e.date_sortie, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  (1, 'AOUFI SOUMAYA', 'K492684', '124434753', date '1992-08-07', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'HAY FRAIHIENNE OULIA GZENAYA', 'TANGER', 'Virement', 'LA COMMUNE GUEZNAIA'),
  (2, 'AOUFI MERIEM', 'K438798', '137882620', date '1988-02-25', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'HAY FRIHIYIEN EL AOULIA AGUEZNIA', 'TANGER', 'Virement', 'LA COMMUNE GUEZNAIA'),
  (3, 'EL BOUCHTI SALIMA', 'K474861', '188308278', date '1992-01-01', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'COMPLEXE RAHA IMM 17 NO 25 CR ET PACHALIK GZENAYA', 'TANGER', 'Virement', 'LA COMMUNE GUEZNAIA'),
  (4, 'ESSARYATI HAYAT', 'W326450', '197428588', date '1985-01-01', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'HAY SMARA GEZENAYA', 'TANGER', 'Virement', 'LA COMMUNE GUEZNAIA'),
  (22, 'ERRAHMANI AZIZA', 'DC26236', null, date '1990-09-19', date '2025-08-01', null::date, 'AGENT DE NETTOYAGE', 'DOUAR DAIDAAT COMMUNE HJAR NHAL', 'TANGER', 'Virement', 'LA FORET DIPLOMATIQUE'),
  (6, 'EL ATEKI FAWZIA', 'LC312524', '144568534', date '1986-01-01', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'EL MERS ACHENNAD 5B RUE 107', 'TANGER', 'Virement', 'LA FORET DIPLOMATIQUE'),
  (5, 'BENKHIYE BOUAZZA ZOHRA', 'K329722', '134034618', date '1973-09-10', date '2025-01-01', null::date, 'AGENT DE NETTOYAGE', 'MD HAOUARA GZENAYA', 'TANGER', 'Virement', 'LA FORET DIPLOMATIQUE'),
  (23, 'M''AICHOU IBTISSAM', 'KB166244', '174701457', date '1996-12-30', date '2025-08-05', null::date, 'AGENT DE NETTOYAGE', 'HAY BOUHOUT RUE 21 NO 19', 'TANGER', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (52, 'LAGHRIBI NAJIA', 'K408670', null, date '1976-02-12', date '2026-05-07', null::date, 'AGENT DE NETTOYAGE', '19 RUE IBN ZOHR RESD MARINAA 1 ETG 5 APPT 21', 'TANGER', 'Espece', 'CHAMBRE D''ARTISANAT'),
  (62, 'AL-LUCH ASMA-E', 'L291712', null, date '1972-06-02', date '2026-06-08', null::date, 'AGENT DE NETTOYAGE', 'AV ZARKTOUNI IMM 8 REZ DE CHAUSSEE', 'TETOUAN', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (16, 'DEHIZA LATIFA', 'LA58960', '139435145', date '1978-09-23', date '2025-05-12', null::date, 'AGENT DE NETTOYAGE', 'LOT ENNASR NR 372', 'LARACHE', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (12, 'EL KOUCHE SOUMAYA', 'LB60156', '152044003', date '1975-11-30', date '2025-05-05', null::date, 'AGENT DE NETTOYAGE', 'HAY ANDALOUS GR/A RUE 20 NO 3', 'KSAR EL KEBIR', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (11, 'BENOUTMAN HANAN', 'LC131564', '193952451', date '1979-11-28', date '2025-05-05', null::date, 'AGENT DE NETTOYAGE', 'AV HASSAN 1 DERB AHMED AL AROUSSI QUA SOUK', 'CHEFCHAOUEN', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (9, 'EL MOUSSAOUI HAFIDA', 'S786725', '193956257', date '1979-09-17', date '2025-05-05', null::date, 'AGENT DE NETTOYAGE', '13 RUE TAHA HUSSEIN HAY SIDI ABID', 'AL HOCEIMA', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (14, 'ROUAIN BOUCHRA', 'K287959', '170711679', date '1977-01-01', date '2025-05-05', null::date, 'AGENT DE NETTOYAGE', 'RUE EL OUAD ROUTE DE LA MONTAGNE HAOUMAT TETOUANI', 'TANGER', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (15, 'EL MESBAHI ZOHRA', 'GM52773', '989946604', date '1975-01-01', date '2025-05-12', null::date, 'AGENT DE NETTOYAGE', 'QU BOUKECHRAD DERB RIFI NR 63', 'OUAZZANE', 'Virement', 'CHAMBRE D''ARTISANAT'),
  (26, 'EL MESELLEK MINA', 'S639090', null, date '1975-01-01', date '2025-11-14', null::date, 'AGENT DE NETTOYAGE', 'HAY RAQ AZIRAR MIDAR', 'DRIOUCH', 'Virement', 'DRANEFO'),
  (29, 'SAIDI HANANE', 'S778806', null, date '1993-02-14', date '2026-03-02', null::date, 'AGENT DE NETTOYAGE', 'HAY AL AMAL CHARKI', 'DRIOUCH', 'Virement', 'LA SALLE OMNISPORT DRIOUCH'),
  (30, 'CHARKI OUAFAE', 'S754035', null, date '1995-09-07', date '2026-03-16', null::date, 'AGENT DE NETTOYAGE', 'HAY EL AMAL EL CHARKI', 'DRIOUCH', 'Virement', 'LA SALLE OMNISPORT DRIOUCH'),
  (54, 'KALKOUL SAMIRA', 'Z404603', null, date '1982-10-02', date '2026-06-01', null::date, 'AGENT DE NETTOYAGE', 'AIT MHAND OU YAHYA AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (56, 'ECHAIBI SALOUA', 'RB1514', null, date '1983-06-24', date '2026-06-01', null::date, 'AGENT DE NETTOYAGE', 'DR TALABOUDA AJDIR', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (55, 'AOUASSAR RABIA', 'R275306', null, date '1980-09-08', date '2026-06-01', null::date, 'AGENT DE NETTOYAGE', 'BOULAMAIZ IMZOUREN', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (53, 'EL HADDOUCHI CHAFIA', 'R261241', null, date '1982-02-28', date '2026-06-01', null::date, 'AGENT DE NETTOYAGE', 'HAY BARGAM 01 IMZOUREN', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (57, 'OUAZZA NAJIA', 'R332647', null, date '1980-07-11', date '2026-06-01', null::date, 'AGENT DE NETTOYAGE', 'DOUAR BOULAMAIZ AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (58, 'ANDALOUSSI FADOUA', 'R277011', null, date '1983-02-04', date '2026-06-01', null::date, 'AGENT DE NETTOYAGE', 'AZGHAR AIT YOUSSEF OUALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (59, 'MAHJOUBI NOURIA', 'R122909', null, date '1972-12-27', date '2026-06-01', null::date, 'AGENT DE NETTOYAGE', 'CENTRE SIDI BOUAFIF AIT YOUSSEF OUALI', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (64, 'AJANNAY KARIMA', 'S600879', null, date '1984-09-07', date '2026-06-18', null::date, 'AGENT DE NETTOYAGE', '74 RUE RACHIDIYA HAY SIDI ABID', 'AL HOCEIMA', 'Virement', 'FST/AL HOCEIMA'),
  (61, 'ABDELMOUMEN ABDERRAHMAN', 'LC60338', null, date '1972-12-01', date '2026-06-05', null::date, 'AGENT DE JARDINAGE', 'HAY KHANDAK EDDIR AOUAMA', 'TANGER', 'Espece', 'FACULTE DES SCIENCES ET TECH'),
  (66, 'EL FAZAZI MOHAMED', 'R256260', null, date '1983-01-01', date '2026-07-08', null::date, 'AGENT DE JARDINAGE', 'HAY AHARRARINE NR LOT 624', 'TANGER', 'Espece', 'FACULTE DES SCIENCES ET TECH'),
  (17, 'HAMDANE MUSTAPHA', 'LB8186', null, date '1960-01-01', date '2025-06-01', null::date, 'AGENT DE JARDINAGE', 'AL IRFAN 2 TRC 5 IMB 141 ETG 4 N 41', 'TANGER', 'Espece', 'FACULTE DES SCIENCES ET TECH'),
  (18, 'AKHROUF MOHAMMED', 'L373342', '165557435', date '1970-01-01', date '2025-06-01', null::date, 'AGENT DE JARDINAGE', 'DR HMIMDECH SOUK KDIM AIN LAHCEN', 'TETOUAN', 'Virement', 'FACULTE DES SCIENCES ET TECH'),
  (19, 'GHAYOUT KHALID', 'C700728', '113676450', date '1974-01-01', date '2025-06-01', null::date, 'AGENT DE JARDINAGE', 'HAY BNI MAKADA LAKDIMA RUE 35 NR 07', 'TANGER', 'Virement', 'FACULTE DES SCIENCES ET TECH'),
  (33, 'TAMIM MOUSSA', 'LB179150', null, date '1993-03-02', date '2026-03-03', null::date, 'AGENT DE JARDINAGE', 'LOTS KHAIR 1 N 206', 'TANGER', 'Virement', 'OFPPT'),
  (34, 'EL CHAREF ABDELMALEK', 'L250444', null, date '1962-01-01', date '2026-03-03', null::date, 'AGENT DE JARDINAGE', 'AOUAMA KOUDIAT LAHCEN', 'TANGER', 'Espece', 'OFPPT'),
  (31, 'KRIDA SAID', 'C781739', null, date '1978-07-13', date '2026-03-02', null::date, 'AGENT DE JARDINAGE', 'DR AIN GDAH AIN LEGDAH TISSA', 'TAOUNAT', 'Virement', 'OFPPT'),
  (32, 'ASLI MOHAMMED', 'K181541', null, date '1962-01-01', date '2026-03-04', null::date, 'AGENT DE JARDINAGE', 'RUE ZAITOUNA NO 50', 'TANGER', 'Espece', 'OFPPT'),
  (39, 'ZITAN MOHAMED', 'LC387265', null, date '2004-10-22', date '2026-03-16', null::date, 'AGENT DE JARDINAGE', 'QUA DHAR BEN AYAD', 'CHEFCHAOUEN', 'Virement', 'OFPPT'),
  (63, 'DAHDOUH HICHAM', 'K194514', null, date '1972-08-30', date '2026-06-11', null::date, 'AGENT DE JARDINAGE', 'NIARINE JAMAA MESANDI N 04', 'TETOUAN', 'Versement', 'OFPPT'),
  (35, 'HARRAK ABDELHAFID', 'LA32781', null, date '1973-01-01', date '2026-03-03', null::date, 'AGENT DE JARDINAGE', 'LOTS AL KHAIR 1 NO 287', 'TANGER', 'Virement', 'OFPPT'),
  (37, 'KHLIFI AMINE', 'L377561', '125991250', date '1979-07-26', date '2026-03-13', null::date, 'AGENT DE JARDINAGE', 'MAISON BIENFAISSANCE ROUTE BEGGARA', 'LARACHE', 'Virement', 'OFPPT'),
  (38, 'ROUKHAMI AYOUB', 'LB239861', '161012728', date '1993-11-17', date '2026-03-12', null::date, 'AGENT DE JARDINAGE', 'DR SNADLA CR ZOUADA CT SIDI SLAMA', 'KSAR EL KEBIR', 'Virement', 'OFPPT'),
  (40, 'AROUDAM RACHID', 'L413103', null, date '1980-04-09', date '2026-03-17', null::date, 'AGENT DE JARDINAGE', 'AV MIDAR NR 868 PRES EL KANTARA MOKLATA KOUILMA', 'TETOUAN', 'Virement', 'OFPPT'),
  (41, 'EL MAIN KERRICH RIDA', 'LG31678', null, date '1991-06-09', date '2026-03-17', null::date, 'AGENT DE JARDINAGE', 'HAY KALAA AV IMM MALIK NR 34', 'MDIQ', 'Virement', 'OFPPT'),
  (42, 'EL AISSAOUI AHMIDOU', 'R69395', null, date '1958-01-01', date '2026-03-17', null::date, 'AGENT DE JARDINAGE', 'HAY AFAZAR', 'AL HOCEIMA', 'Versement', 'OFPPT'),
  (43, 'AKRICH ABDELKARIM', 'R252077', null, date '1981-06-07', date '2026-03-05', null::date, 'AGENT DE JARDINAGE', 'HAY AIT FARESS BENI BOUAYACH', 'AL HOCEIMA', 'Virement', 'OFPPT'),
  (36, 'EL -KLAIE ZAKARIAE', 'GM168173', null, date '1992-12-15', date '2026-03-13', null::date, 'AGENT DE JARDINAGE', 'QU DERAOUIYENE DERB KACEM HACHHOUCH N14', 'OUEZZANE', 'Virement', 'OFPPT'),
  (44, 'EL BASTRIOUI OMAR', 'R127999', null, date '1972-07-01', date '2026-03-02', null::date, 'AGENT DE JARDINAGE', 'DR IDSOULIEN IZEMMOUREN', 'AL HOCEIMA', 'Virement', 'OFPPT'),
  (45, 'SABIRI HASSAN', 'XA46112', null, date '1977-07-30', date '2026-03-19', null::date, 'AGENT DE JARDINAGE', 'HAY EL JADID AV IBN ROCHD RUE RISSANI N 7', 'FNIDEQ', 'Versement', 'OFPPT'),
  (46, 'EL KOBI MOHAMED', 'L387681', null, date '1970-01-01', date '2026-03-17', null::date, 'AGENT DE JARDINAGE', 'AV MIDAR NR 71 PRES AHMED ASAID KOUILMA MOUKLATA', 'TETOUAN', 'Virement', 'OFPPT'),
  (47, 'EL HADI ZGHIBA', 'Z278538', null, date '1973-01-01', date '2026-03-02', null::date, 'AGENT DE JARDINAGE', 'HAY SANIA RUE 06 NO 16', 'TANGER', 'Virement', 'OFPPT'),
  (48, 'HAMMOUD ABDESLAM', 'LC177787', null, date '1966-02-03', date '2026-03-05', null::date, 'AGENT DE JARDINAGE', 'SANIA RUE 23 NR 47 BIR CHIFA', 'TANGER', 'Virement', 'OFPPT'),
  (25, 'MANSOURI SALMAN', 'K578497', null, null::date, date '2025-11-01', null::date, 'AGENT', 'TANJA BALIA RUE 55 N°10', 'TANGER', 'Virement', 'ADMINISTRATION')
) as e(matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement, site_name)
join public.companies c on c.name = 'AL SAFAE EL MAGHREB'
join public.sites s on s.company_id = c.id and s.name = e.site_name
where not exists (select 1 from public.employees x where x.company_id = c.id and x.matricule = e.matricule);


-- ===== BO : 84 employés, 13 sites =====
insert into public.companies (name) values ('BO') on conflict (name) do nothing;

insert into public.sites (company_id, name, pointage_actif)
select c.id, v.name, v.actif from public.companies c, (values
  ('ARR MGHOGHA', true),
  ('ECONOMAT', true),
  ('REGROUPEMENT COMMUNE BOUGHAZE', true),
  ('DRISCOLL''S/2', true),
  ('REMPLACEMENT', true),
  ('ONDA AL HOCEIMA', true),
  ('SPA', true),
  ('OFPPT', true),
  ('LOYER', true),
  ('BUREAU', true),
  ('STAGAIRE', true),
  ('CMC', true),
  ('SUPERVISEUR', false)
) as v(name, actif)
where c.name = 'BO'
on conflict (company_id, name) do nothing;

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss, e.date_naissance, e.date_embauche, e.date_sortie, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  (616, 'EC-CHARKI NAOUAL', 'CD676321', '189133043', date '1986-06-07', date '2023-10-09', null::date, 'AGENT DE NETTOYAGE', '20 RUE 4 HAFRAT BENSLIMANE DHAR LAKHMISS', 'FES', 'Virement', 'ARR MGHOGHA'),
  (795, 'SAFRITE ZINEB', 'LC169430', '145937259', date '1983-01-01', date '2023-09-01', null::date, 'AGENT DE NETTOYAGE', 'LOTS LAHMAM RUE C NO 12', 'TANGER', 'Virement', 'ARR MGHOGHA'),
  (785, 'SAFRITE NADIA', 'GB149089', '129077486', date '1987-01-01', date '2023-08-03', null::date, 'AGENT DE NETTOYAGE', 'HAY BENKIRANE RUE 152 N 500', 'TANGER', 'Virement', 'ARR MGHOGHA'),
  (824, 'EL ABBASI NAZIHA', 'K515115', '115396952', date '1987-01-02', date '2023-10-09', null::date, 'AGENT DE NETTOYAGE', 'HAY BEN KIRANE RUE 180 NO 23', 'TANGER', 'Virement', 'ARR MGHOGHA'),
  (1051, 'AMAL DAHRAOUI', 'HH54558', null, date '1985-05-23', date '2025-10-20', null::date, 'AGENT DE NETTOYAGE', 'AV HAROUN RACHID RUE 5A NR 11', 'TANGER', 'Espece', 'ECONOMAT'),
  (1012, 'HASSOUKI SAMIRA', 'KB102342', null, date '1985-01-01', date '2025-02-19', null::date, 'AGENT DE NETTOYAGE', 'HAY BEN KIRAN AV PRINCIPALE NO 107', 'TANGER', 'Espece', 'REGROUPEMENT COMMUNE BOUGHAZE'),
  (822, 'TAHIRI ZOHAIR', 'GB196891', '138499755', date '1991-04-05', date '2025-08-27', null::date, 'AGENT DE NETTOYAGE', 'DOUAR BOUHZITATE TIRESS KARIAT BENAOUDA', 'SOUK ARBAA DU GHARB', 'Virement', 'DRISCOLL''S/2'),
  (833, 'LAHLOU ABDELHAK', 'GB161485', '108053250', date '1988-03-30', date '2025-09-12', null::date, 'AGENT DE NETTOYAGE', 'DOUAR DLALHA LKAID CAIDAT MOULAY BOUSSELHAM', 'SOUK EL ARBAA DU GHARB', 'Virement', 'DRISCOLL''S/2'),
  (823, 'ERRAKEB M''HAMED', 'GB93208', '120694784', date '1981-01-01', date '2025-08-27', null::date, 'AGENT DE NETTOYAGE', 'DOUAR LAAMIRIENNE BHARA OULED AYAD', 'SOUK ARBAA DU GHARB', 'Virement', 'DRISCOLL''S/2'),
  (1082, 'EL HAIMER CHAIMAE', 'LB197949', null, date '1994-07-10', date '2026-07-01', null::date, 'AGENT DE NETTOYAGE', 'MADCHAR BOUSAFI COMMUNE ET CAIDAT SAHEL', 'LARACHE', 'Versement', 'REMPLACEMENT'),
  (905, 'DARBOUCHI FARID', 'R288573', '113750041', date '1984-12-05', date '2024-03-21', null::date, 'AGENT DE NETTOYAGE', 'DR IABOUTEN OLD AMGHAR DRIOUCH', 'DRIOUCH', 'Virement', 'ONDA AL HOCEIMA'),
  (869, 'AKOUH FADILA', 'R196715', '197323503', date '1979-04-06', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'AIT MHAND OU YAHYA AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (868, 'EL BAZ NAJAT', 'RB2912', '126656616', date '1980-05-06', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'CENTRE SIDI BOUAFIFI AIT YOUSSEF OUALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (880, 'EL GHALBZOURI ANASS', 'R367091', '160471349', date '1999-08-10', date '2023-11-06', null::date, 'AGENT D''ACCEUIL', '100 RUE OMAR BNO EL KHATTAB HAY BARIO HADDOU', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (879, 'EL GHALBZOURI ABDELHAK', 'R69209', null, date '1961-08-12', date '2023-11-06', null::date, 'AGENT D''ACCEUIL', '60 RUE SAHEL EL AAJ HAY BARIO HADDOU', 'AL HOCEIMA', 'Versement', 'ONDA AL HOCEIMA'),
  (1065, 'BOUHRIBA NADIA', 'ZT39387', null, date '1980-01-01', date '2026-06-02', null::date, 'AGENT DE NETTOYAGE', '10 RUE OUED SBOU IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (1053, 'AHBOUCH BADRE', 'RB20200', '180634515', date '1996-06-24', date '2026-01-13', null::date, 'AGENT DE NETTOYAGE', 'CENTRE SIDI BOUAFIF AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (866, 'EL BATTAOUI NAIMA', 'R204395', '113525400', date '1978-01-01', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'SOUANI AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (1027, 'AOULAD MOUHAND NAJAT', 'AE259226', '104925712', date '1997-01-09', date '2025-06-01', null::date, 'AGENT DE NETTOYAGE', 'HAY SOUK IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (1026, 'MAHTOUR MOHAMED ACHRAF', 'SR385', '197438354', date '2005-02-10', date '2025-06-01', null::date, 'AGENT DE NETTOYAGE', 'DOUAR OULED AMGHAR OULED AMGHAR', 'DRIOUCH', 'Virement', 'ONDA AL HOCEIMA'),
  (1023, 'ADDA MOHAMED', 'R293157', '155405370', date '1981-01-05', date '2025-05-01', null::date, 'AGENT DE NETTOYAGE', 'DOUAR IFASSIEN LOUTA', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (1022, 'AROUSS AYMAN', 'RB23374', '194274757', date '2003-03-03', date '2025-05-01', null::date, 'AGENT DE NETTOYAGE', 'CENTRE SIDI BOUAFIF AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (867, 'BOUTKABOUT FATIHA', 'R170752', '164679487', date '1966-01-01', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'HAY TANAOUI 02 IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (925, 'ASSAIDI IMAD', 'R291825', '162387769', date '1984-11-29', date '2024-06-01', null::date, 'AGENT DE NETTOYAGE', 'DR IFASSIYEN LOUTA AIT YOUSSEF OUALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (842, 'EL GHAZI NAZIHA', 'R202397', '162437085', date '1969-11-18', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'HAY LAAZIB IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (841, 'EABDELLATIN JAMILA', 'R314808', '145641190', date '1969-03-10', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'HAY LAAZIB IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (848, 'AKKOUH HAMMADI', 'R265939', '103487883', date '1984-04-07', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'RUE CASABLANCA IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (865, 'AHAMJIK BAKR', 'RB7574', '141723091', date '1992-08-15', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'IMAJJOUDEN AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (851, 'ACHAHBAR FATIMA', 'R202335', '129054393', date '1973-01-01', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'HAY BOUSLAMA BENI BOUAYACH', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (847, 'SATHIOUI MOHAMMED', 'RB17001', '147039118', date '1996-10-17', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'DR IMAJJOUDEN AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (845, 'BELLALI ISMAIL', 'R288664', '183552698', date '1984-11-27', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'HAY IHANKOUREN IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (844, 'TIGUNIT CHAHIDA', 'R357945', '920696107', date '1987-07-08', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'HAY BOUSLAMA BENI BOUAYACH', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (849, 'EL BAZ FATIHA', 'RB2042', '129054096', date '1981-10-01', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'CENTRE SIDI BOUAFIF AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (850, 'JANAH SIHAM', 'C537455', '156024054', date '1978-12-13', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'HAY AIT MOUSSA OU AMAR IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (855, 'KOUBIAA SAID', 'R126479', '132195200', date '1972-10-02', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'DR SOUANI AIT YOUSSEF OU ALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (864, 'TIGNIT BOUCHRA', 'R266139', '100741201', date '1981-09-08', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'HAY BARGUAM 01 IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (862, 'AZOUZ NOUREDDINE', 'R138709', '132195301', date '1969-01-01', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', '15 RUE SELOUANE IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (861, 'REBAJ NAIMA', 'KB269663', '180593976', date '1975-01-01', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'IMAJJOUDEN AIT YOUSSEF OUALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (858, 'EZZAHOUANI FOUAD', 'KB77840', '159081697', date '1988-09-28', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', '15 RUE ASSILA IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (857, 'BULLIF NAJIHA', 'R168692', '129054294', date '1973-10-15', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', '01 RUE JABEL SEAGHROU IMZOUREN', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (854, 'AVALLI MOHAMED', 'RB13467', '147048802', date '1989-01-25', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'DR IMAJJOUDEN AIT YOUSSEF OUALI', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (856, 'ELBOUKRI KARIMA', 'R139243', '115102305', date '1974-07-15', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', '03 RUE OUGHANDA', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (843, 'ACHAHBAR SAADIA', 'R202334', '129053791', date '1977-05-20', date '2023-11-06', null::date, 'AGENT DE NETTOYAGE', 'HAY BOUSLAMA BENI BOUAYACH', 'AL HOCEIMA', 'Virement', 'ONDA AL HOCEIMA'),
  (1045, 'BENYOUSSEF NAJIA', null, null, null::date, date '2025-09-01', null::date, 'AGENT DE NETTOYAGE', null, null, 'Espece', 'SPA'),
  (981, 'AJBAR KHADDOUJ', 'K392971', '188833046', date '1975-01-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'HAY ATTADAMOUN SECTEUR AL FADILA RUE 54', 'TANGER', 'Virement', 'OFPPT'),
  (980, 'AKHAZZAN RHIMOU', 'K364385', '117707551', date '1966-01-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'BENI OURIAGHEL 3 RUE 55 NO 4', 'TANGER', 'Virement', 'OFPPT'),
  (1019, 'BOUJEMAA MARIAM', 'K435537', '127300227', date '1977-01-10', date '2025-04-08', null::date, 'AGENT DE NETTOYAGE', 'ROUTE DE LA MONTAGNE PATIO BEN ABBOU NO 184', 'TANGER', 'Virement', 'OFPPT'),
  (986, 'EL-KIOUI KHAOULA', 'Y509142', '171831245', date '2002-11-12', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'AL IRFAN 1 GH 15 IMB 3 ETG 3 NR 13', 'TANGER', 'Virement', 'OFPPT'),
  (979, 'GRINE FATIMA', 'C923189', '155845352', date '1982-01-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'HAY TADAMON SECTEUR EL FADILA RUE 44', 'TANGER', 'Virement', 'OFPPT'),
  (976, 'FAKIHI EL BAJGA RAHMA', 'L357481', '955808020', date '1973-04-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'DR EL HAOUD CR ET CAIDAT JOUAMAA PCE', 'FAHS ANJRA', 'Virement', 'OFPPT'),
  (978, 'EC-CHEKH  ZAHRA', 'C543189', '180680120', date '1978-09-07', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'HAY SANIA RUE 162 N 16 BIR CHIFA', 'TANGER', 'Virement', 'OFPPT'),
  (984, 'FADILI FATIMA', 'IB43841', '184887581', date '1972-01-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'HAY TADAMON SECTEUR AL FADILA RUE 30 AV ZAHRAOUI', 'TANGER', 'Virement', 'OFPPT'),
  (1078, 'HADDAD FAKIH FATIMA ZOHRA', 'KB67711', null, date '1989-03-26', date '2026-07-01', null::date, 'AGENT DE NETTOYAGE', 'DOUAR KHMIS ANJRA', 'FAHS ANJRA', 'Virement', 'OFPPT'),
  (977, 'FQUIHI RAHMA', 'L362352', '170650353', date '1971-01-12', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'DR HAOUD CR ET CAIDAT JOUAMAA', 'FAHS ANJRA', 'Virement', 'OFPPT'),
  (985, 'LAKHLIFI SOUKAINA', 'D968860', '136805742', date '1994-12-10', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'HAY BRANES GZENAYA', 'TANGER', 'Virement', 'OFPPT'),
  (990, 'HAMDAOUI KARIMA', 'DA29104', '107113559', date '1974-12-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'RESIDENCE NOUR IMM B ETAGE 05 NO 53', 'TANGER', 'Virement', 'OFPPT'),
  (999, 'TOUZI L''YAKOUTE', 'K338619', '131636048', date '1964-01-22', date '2024-11-19', null::date, 'AGENT DE NETTOYAGE', 'HAY BEROUAKA RUE 05 NO 13', 'TANGER', 'Espece', 'OFPPT'),
  (1049, 'SOUILAH LOUBNA', 'Z414135', '112056365', date '1982-01-01', date '2025-10-22', null::date, 'AGENT DE NETTOYAGE', 'DOUAR BOUJRID OULED CHRIF BNI LENT', 'TAZA', 'Virement', 'OFPPT'),
  (983, 'AIT EL MEKKI RQIA', 'C651317', '146400991', date '1962-01-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'HAY MRABET 02 RUE 03 AOUAMA', 'TANGER', 'Virement', 'OFPPT'),
  (1063, 'ESSAOUD MINA', 'K502926', null, date '1992-05-04', date '2026-05-01', null::date, 'AGENT DE NETTOYAGE', 'DOUAR EL HAOUD JOUAMAA', 'FAHS ANJRA', 'Virement', 'OFPPT'),
  (1007, 'NADIA CHINI', 'L363289', '114917796', date '1978-02-05', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'CENTRE KHMIS ANJRA CR ET CAIDAT ANJRA PCE', 'FAHS ANJRA', 'Versement', 'OFPPT'),
  (982, 'BELAOUJA ZOHRA', 'GB107519', '134245855', date '1980-01-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'HAY ATTADAMOUN SECTEUR AL FADILA RUE 54', 'TANGER', 'Virement', 'OFPPT'),
  (993, 'ELFAKIHI FATIMA', 'L364894', '904749340', date '1978-10-02', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'DR EL HAOUD CR ET CAIDAT JOUAMAA PCE', 'FAHS ANJRA', 'Virement', 'OFPPT'),
  (987, 'EL JOUNAINI RADIA', 'GM75784', '111919290', date '1979-01-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'HAOUMAT FATIMA OUAMA', 'TANGER', 'Virement', 'OFPPT'),
  (988, 'FETOUAKI AICHA', 'X165759', '150628258', date '1973-01-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'RES BADER B LOTS AOUATIF 1 LOT 40 ETG 2 N 10', 'TANGER', 'Virement', 'OFPPT'),
  (989, 'BOUHOUSSE AMINA', 'CD302970', '155538593', date '1969-01-01', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'HAY MESNANA DIYAR TANJA GH 9 IMB 10 ETG 2 NO 11', 'TANGER', 'Virement', 'OFPPT'),
  (991, 'BAATOUT BAHIJA', 'GK131822', '197048028', date '1979-03-12', date '2024-11-11', null::date, 'AGENT DE NETTOYAGE', 'COOPERATIVE EL ISLAHIA ZIRARA', 'SIDI KECEM', 'Virement', 'OFPPT'),
  (1009, 'NOUINOU MOHAMED', null, null, null::date, date '2024-06-01', null::date, 'AGENT DE NETTOYAGE', null, 'TANGER', 'Virement', 'LOYER'),
  (92, 'AL JEYAT RAHMAH', 'L262545', null, date '1958-01-01', date '2024-12-06', null::date, 'AGENT DE NETTOYAGE', 'CHRECHAR NO 8 TETOUAN', 'TETOUAN', 'Espece', 'BUREAU'),
  (1077, 'AKDI HAJAR', 'KB234886', null, date '2002-02-01', date '2026-06-18', null::date, 'AGENT DE NETTOYAGE', 'HAY FLOREAL RUE ABDELALI BEN CHAKROUN NR 02', 'TANGER', 'Espece', 'STAGAIRE'),
  (1070, 'OUJAKANE KHADIJA', 'CN11916', null, date '1993-11-22', date '2026-06-12', null::date, 'AGENT DE NETTOYAGE', 'HAY TAAJLITE ZAIDA', 'MIDELT', 'Espece', 'CMC'),
  (1072, 'FACHLAK KHADIJA', 'LA163144', null, date '1984-05-10', date '2026-06-12', null::date, 'AGENT DE NETTOYAGE', 'AL IRFAN 2 GH 18 IMB 13 ETG 3 NR 227', 'TANGER', 'Espece', 'CMC'),
  (1066, 'EL ABBASSI FAOUZIA', 'R271391', null, date '1982-10-30', date '2026-06-12', null::date, 'AGENT DE NETTOYAGE', 'DR TIGRAOU BNI BOUNSSAR TARGUIST', 'AL HOCEIMA', 'Espece', 'CMC'),
  (1067, 'EL FILALI HAFIDA', 'K292988', null, date '1974-01-01', date '2026-06-12', null::date, 'AGENT DE NETTOYAGE', 'HAY BOUKHALEF', 'TANGER', 'Espece', 'CMC'),
  (1069, 'LACHHAB MALIKA', 'G500150', null, date '1976-12-27', date '2026-06-12', null::date, 'AGENT DE NETTOYAGE', 'HAY AL OUAHDA 01 GROUPE 15 BLOC C NR 06', 'SIDI YAHYA DU GHARB', 'Espece', 'CMC'),
  (1071, 'BOUDARAT RACHIDA', 'Z286901', null, date '1974-11-06', date '2026-06-12', null::date, 'AGENT DE NETTOYAGE', 'HAY EL MORABITINE BLOC 4 IMM JAOUHARA NR 04', 'TAZA', 'Espece', 'CMC'),
  (1073, 'AKACHHIT AYYADA', 'R195055', null, date '1976-01-01', date '2026-06-12', null::date, 'AGENT DE NETTOYAGE', 'AL IRFANE 2 GH 18 IMM 7 ETG 3 NR 134', 'TANGER', 'Espece', 'CMC'),
  (1074, 'DHAISSA KHADIJA', 'G398530', null, date '1970-02-27', date '2026-06-12', null::date, 'AGENT DE NETTOYAGE', 'AL IRFANE 2 GH A IMM 184 ETG 1 NR 7', 'TANGER', 'Espece', 'CMC'),
  (1075, 'AFILAL ABDELTIF', 'L418467', null, date '1981-01-01', date '2026-06-12', null::date, 'AGENT DE NETTOYAGE', 'HAY BENI OURIAGHAL 3 RUE 66 NO 45', 'TANGER', 'Espece', 'CMC'),
  (1068, 'EL BADRAOUI HANANE', 'V258035', null, date '1985-01-01', date '2026-06-12', null::date, 'AGENT DE NETTOYAGE', 'HAY BOUKHALEF LOT 165', 'TANGER', 'Espece', 'CMC'),
  (1076, 'DAHMOUNI HOUCINE', 'ZT143061', null, date '1991-03-07', date '2026-06-10', null::date, 'AGENT DE NETTOYAGE', 'HAY FLORENCIA RUE MBAREK BEN BOUBKER NO 6', 'TANGER', 'Espece', 'SUPERVISEUR'),
  (1081, 'KHAYI MOHAMED', 'K115484', null, date '1951-01-01', date '2026-07-04', null::date, 'AGENT DE JARDINAGE', 'HAY IBN BATOUTA RUE 142 NO 14', 'TANGER', 'Espece', 'CMC'),
  (1079, 'LAITI MOHAMMED', 'K88774', null, date '1956-01-01', date '2026-07-04', null::date, 'AGENT DE JARDINAGE', 'HAY ROUDANI RUE 109 NO 24', 'TANGER', 'Espece', 'CMC'),
  (1080, 'OTHMANE NOURDDINE', 'K74961', null, date '1957-04-05', date '2026-07-04', null::date, 'AGENT DE JARDINAGE', 'HAY CHAT RUE 131 NO 5', 'TANGER', 'Espece', 'CMC')
) as e(matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement, site_name)
join public.companies c on c.name = 'BO'
join public.sites s on s.company_id = c.id and s.name = e.site_name
where not exists (select 1 from public.employees x where x.company_id = c.id and x.matricule = e.matricule);


-- ===== DUO MULTI SERVICE : 7 employés, 1 sites =====
insert into public.companies (name) values ('DUO MULTI SERVICE') on conflict (name) do nothing;

insert into public.sites (company_id, name, pointage_actif)
select c.id, v.name, v.actif from public.companies c, (values
  ('AGENCE URBAINE TANGER', true)
) as v(name, actif)
where c.name = 'DUO MULTI SERVICE'
on conflict (company_id, name) do nothing;

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss, e.date_naissance, e.date_embauche, e.date_sortie, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  (1, 'ADDAROUSSI KHADIJA', 'GA170638', null, date '1989-07-25', date '2026-04-01', null::date, 'AGENT DE NETTOYAGE', 'DR LAHMAMCHA OULED HCINE', 'SIDI SLIMANE', 'Virement', 'AGENCE URBAINE TANGER'),
  (2, 'EL ARROUD ZOHRA', 'KB15342', null, date '1972-01-01', date '2026-04-01', null::date, 'AGENT DE NETTOYAGE', 'HAY SANIA RUE 28 NO 21 BIR CHIFA', 'TANGER', 'Virement', 'AGENCE URBAINE TANGER'),
  (3, 'ZEKRI FATIMA', 'K173253', null, date '1965-12-15', date '2026-04-01', null::date, 'AGENT DE NETTOYAGE', 'RUE OHM NO 10 ETAGE 1 APPT 1', 'TANGER', 'Espece', 'AGENCE URBAINE TANGER'),
  (4, 'EL AOUFI FATIMA', 'K128608', null, date '1961-01-01', date '2026-04-01', null::date, 'AGENT DE NETTOYAGE', 'HAY MESTERKHOUCHE', 'TANGER', 'Espece', 'AGENCE URBAINE TANGER'),
  (6, 'LAKHLIFI SAIDA', 'K257303', null, date '1969-11-11', date '2026-04-01', null::date, 'AGENT DE NETTOYAGE', 'HAY DHAR LAHMAME RUE 3 NO 7', 'TANGER', 'Virement', 'AGENCE URBAINE TANGER'),
  (7, 'LAGHRIBI NAJIA', 'K408670', null, date '1976-02-12', date '2026-04-01', null::date, 'AGENT DE NETTOYAGE', '19 RUE IBN ZOHR RESD MARINA A 1 ETG 5 APPT 21', 'TANGER', 'Virement', 'AGENCE URBAINE TANGER'),
  (8, 'BAKKALI KHADIJA', 'L491900', null, date '1982-01-01', date '2026-04-28', null::date, 'AGENT DE NETTOYAGE', 'DR BENI OUASSINE AOULIA  AL BAHRAOUYINE', 'FAHS ANJRA', 'Virement', 'AGENCE URBAINE TANGER')
) as e(matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement, site_name)
join public.companies c on c.name = 'DUO MULTI SERVICE'
join public.sites s on s.company_id = c.id and s.name = e.site_name
where not exists (select 1 from public.employees x where x.company_id = c.id and x.matricule = e.matricule);


-- ===== EDEN VERT SERVICE : 39 employés, 5 sites =====
insert into public.companies (name) values ('EDEN VERT SERVICE') on conflict (name) do nothing;

insert into public.sites (company_id, name, pointage_actif)
select c.id, v.name, v.actif from public.companies c, (values
  ('ARR BNI MAKADA', true),
  ('LA REGION', true),
  ('Président de l''Université Tt', true),
  ('SERVICE DE LA FORMATION PRO', true),
  ('MEDECINE', true)
) as v(name, actif)
where c.name = 'EDEN VERT SERVICE'
on conflict (company_id, name) do nothing;

insert into public.employees
  (company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement)
select c.id, s.id, e.matricule, e.nom_prenom, e.cin, e.cnss, e.date_naissance, e.date_embauche, e.date_sortie, e.qualification, e.adresse, e.ville, e.mode_reglement
from (values
  (21, 'MARHOUNI AMAL', 'KB32385', '136072172', date '1985-07-08', date '2025-04-07', null::date, 'AGENT DE NETTOYAGE', 'HAY BNI OUARIAGHEL 3 RUE 39 NR 34', 'TANGER', 'Virement', 'ARR BNI MAKADA'),
  (46, 'DRAKLI MALIKA', 'KB125451', null, date '1978-01-01', date '2025-11-20', null::date, 'AGENT DE NETTOYAGE', 'EL MERS ACHENNAD 2 A RUE 51', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (26, 'EL HAJI LAILA', 'KB66930', '199444392', date '1986-04-28', date '2025-05-06', null::date, 'AGENT DE NETTOYAGE', 'EL MERS DHARI', 'TANGER', 'Virement', 'ARR BNI MAKADA'),
  (25, 'AJNAN NAJAT', 'LC270593', null, date '1981-04-15', date '2025-04-08', null::date, 'AGENT DE NETTOYAGE', 'DR TALANTALAB BENI SMIH BENI RZINE', 'CHEFCHAOUEN', 'Espece', 'ARR BNI MAKADA'),
  (24, 'EL BRAK NAIMA', 'LB67024', null, date '1975-07-01', date '2025-04-07', null::date, 'AGENT DE NETTOYAGE', 'HAY BNI SAID BAHRAINE', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (23, 'MOKADEM RABIA', 'KB9282', null, date '1968-09-27', date '2025-04-07', null::date, 'AGENT DE NETTOYAGE', 'HAY AIN MAZNOUD OUAMA', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (20, 'EZ-ZEROUALY HAYAT', 'C997718', null, date '1977-01-01', date '2025-04-07', null::date, 'AGENT DE NETTOYAGE', 'HAY BNI MAKADA LAKDIMA RUE HIND NO 76', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (19, 'AKBIB HOUDA', 'KB45059', '145487747', date '1987-03-13', date '2025-04-07', null::date, 'AGENT DE NETTOYAGE', 'HAY GOURZIYANA RUE 03 NR 47', 'TANGER', 'Virement', 'ARR BNI MAKADA'),
  (56, 'LBLALY IJJA', 'JA91447', null, date '1981-01-19', date '2026-02-02', null::date, 'AGENT DE NETTOYAGE', 'HAY RAJA FILLAH BLOC C RUE 03 N 137', 'GUELMIM', 'Virement', 'ARR BNI MAKADA'),
  (58, 'JBILI KARIMA', 'CD240755', null, date '1984-06-01', date '2026-07-14', null::date, 'AGENT DE NETTOYAGE', 'HAY GOURZIANA RUE 4 N 48', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (29, 'AZELMAD ZHOUR', 'XA30517', null, date '1970-09-17', date '2025-07-11', null::date, 'AGENT DE NETTOYAGE', 'HAY BNI OURIAGHEL 3 RUE 46 N 09', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (15, 'MERIOULI BAHIA', 'ZT13350', null, date '1982-01-01', date '2025-04-07', null::date, 'AGENT DE NETTOYAGE', 'HAY BIR AHARCHOUNE RUE 06 NO 19 AOUAMA', 'TANGER', 'Espece', 'ARR BNI MAKADA'),
  (16, 'BOUAZZA ASMAE', 'KB75117', '101233189', date '1990-10-21', date '2025-04-07', null::date, 'AGENT DE NETTOYAGE', 'HAY ZAHRAE RUE MOUKDICHOU NO 12', 'TANGER', 'Virement', 'ARR BNI MAKADA'),
  (17, 'AQBIB YAMNA', 'L423153', '136119747', date '1971-01-01', date '2025-04-07', null::date, 'AGENT DE NETTOYAGE', 'HAY SIDI BOUHAJA RUE 64 N 14', 'TANGER', 'Virement', 'ARR BNI MAKADA'),
  (1, 'EL FKIHI LAMIAE', 'K356559', '109528350', date '1982-05-20', date '2025-03-06', null::date, 'AGENT DE NETTOYAGE', 'SOUANI RUE 18 NO 10', 'TANGER', 'Virement', 'LA REGION'),
  (51, 'BELHACHMI ASMAE', 'KA45283', null, date '1986-08-20', date '2025-12-15', null::date, 'AGENT DE NETTOYAGE', 'RUE IMAM CHAFAII NO 65', 'TANGER', 'Virement', 'LA REGION'),
  (59, 'SOUHAILA BEN ABDELAH', null, null, null::date, date '2026-07-01', null::date, 'AGENT DE NETTOYAGE', null, null, 'Espece', 'LA REGION'),
  (4, 'EL MALKI ALAOUI FATIMA ZOHRA', 'K358571', '187525675', date '1976-01-20', date '2025-03-06', null::date, 'AGENT DE NETTOYAGE', 'RUE BRISSIA NO 22', 'TANGER', 'Espece', 'LA REGION'),
  (2, 'OULD HAMRA BOUCHRA', 'K378548', '134611547', date '1978-06-25', date '2025-03-06', null::date, 'AGENT DE NETTOYAGE', 'AIN HAYANI RUE SANAOUBAR NO 56', 'TANGER', 'Virement', 'LA REGION'),
  (31, 'AHOULI NAIMA', 'K95307', null, date '1955-05-05', date '2025-07-09', null::date, 'AGENT DE NETTOYAGE', 'RUE IBIZA 5 NO 28', 'TANGER', 'Espece', 'LA REGION'),
  (3, 'BEN ABDELLAH SOUHAILA', 'K481884', '145276682', date '1994-05-31', date '2025-03-06', null::date, 'AGENT DE NETTOYAGE', 'RUE BRISSIA NO 22', 'TANGER', 'Virement', 'LA REGION'),
  (27, 'BOUCHOUAF LOUBNA', 'R365535', '101212960', date '1998-06-14', date '2025-05-19', null::date, 'AGENT DE NETTOYAGE', 'PASSE OUED TAGADDART HAU MIRADOR HAUT', 'AL HOCEIMA', 'Virement', 'LA REGION'),
  (55, 'EL HAJJAMI EZZOUHRA', 'R219721', null, date '1978-01-01', date '2025-12-01', null::date, 'AGENT DE NETTOYAGE', 'ROUTE DE TANGER LOUZIYEN', 'TETOUAN', 'Virement', 'Président de l''Université Tt'),
  (52, 'EL JAFRY HAYAT', 'H466213', null, date '1987-03-28', date '2025-12-01', null::date, 'AGENT DE NETTOYAGE', 'AV BNI YEDER RUE 10 DB B NR 9 KOUILMA', 'TETOUAN', 'Virement', 'Président de l''Université Tt'),
  (53, 'ECHATTIBI CHADIA', 'R135958', null, date '1970-12-05', date '2025-12-01', null::date, 'AGENT DE NETTOYAGE', '38 HAY DIZA  AV ZENATA', 'MARTIL', 'Virement', 'Président de l''Université Tt'),
  (32, 'CHARIF NAJAT', 'L306546', '957947103', date '1974-04-12', date '2025-07-01', null::date, 'AGENT DE NETTOYAGE', 'AV OTMANE BNO AFFANE RUE 01 NR 41', 'TETOUAN', 'Virement', 'Président de l''Université Tt'),
  (34, 'AAIDAN MARIAM', 'L294513', '193329160', date '1969-02-16', date '2025-07-01', null::date, 'AGENT DE NETTOYAGE', 'AV MOUKADICHOU RUE TALAA NR 16 ETG 02', 'TETOUAN', 'Virement', 'Président de l''Université Tt'),
  (44, 'EL MESBAHI KHADYJA', 'LB156873', '940166247', date '1990-01-01', date '2025-07-01', null::date, 'AGENT DE NETTOYAGE', 'HAY MNAKIB DB TAHRA NR 45', 'KSAR EL KEBIR', 'Virement', 'Président de l''Université Tt'),
  (33, 'EL ABOUDI BOUCHRA', 'L611704', '139354558', date '1996-03-16', date '2025-07-01', null::date, 'AGENT DE NETTOYAGE', 'AV AHMED BAKAL ZKT 34 N 16', 'TETOUAN', 'Virement', 'Président de l''Université Tt'),
  (36, 'CHTIOUI RAHMA', 'LB42783', '120390598', date '1968-01-01', date '2025-07-01', null::date, 'AGENT DE NETTOYAGE', 'HAY ENNASSIM NR 204', 'TETOUAN', 'Virement', 'Président de l''Université Tt'),
  (37, 'ZEKRI FATIMA', 'L480224', '125307598', date '1975-01-01', date '2025-07-01', null::date, 'AGENT DE NETTOYAGE', 'KHANDAK ZERBOUH AV BNI HDIFA ZKT 02 DERB 02 NR 05', 'ETG 2 TETOUAN', 'Virement', 'Président de l''Université Tt'),
  (38, 'EL KANFAOUI FATIMA', 'L635487', '178621603', date '1998-12-30', date '2025-07-01', null::date, 'AGENT DE NETTOYAGE', 'HAY ENNASSIM NR 204', 'TETOUAN', 'Virement', 'Président de l''Université Tt'),
  (39, 'DOGOUN SAIDA', 'LC118385', '125307994', date '1980-01-01', date '2025-07-01', null::date, 'AGENT DE NETTOYAGE', '03 HAY DIZA AV REGRAGA ZKT 01', 'MARTIL', 'Virement', 'Président de l''Université Tt'),
  (42, 'EL MADHOUN TOURIA', 'L515862', '128026492', date '1989-12-15', date '2025-07-01', null::date, 'AGENT DE NETTOYAGE', 'AV KOUFA RUE G NR 21', 'TETOUAN', 'Virement', 'Président de l''Université Tt'),
  (43, 'AMAICH HOUDA', 'L333764', '101204761', date '1975-10-12', date '2025-07-01', null::date, 'AGENT DE NETTOYAGE', 'RABD ASFAL FANDAK NEJJAR N 04', 'TETOUAN', 'Virement', 'Président de l''Université Tt'),
  (54, 'CHERAIAH RACHIDA', 'KB67265', '138335495', date '1982-10-15', date '2025-12-15', null::date, 'AGENT DE NETTOYAGE', 'AIN RMEL KSAR SEGHIR', 'TANGER', 'Virement', 'SERVICE DE LA FORMATION PRO'),
  (50, 'BOUNAJMA  MOSTAFA', 'DC17506', '149837274', date '1982-01-01', date '2025-11-03', null::date, 'AGENT DE JARDINNAGE', 'DAIDAAT CR HJAR NHAL', 'TANGER', 'Virement', 'MEDECINE'),
  (49, 'BARCHIN MOHAMED', 'LC162647', '101407824', date '1986-04-01', date '2025-11-03', null::date, 'AGENT DE JARDINNAGE', 'DR TARIA EL OULIA BENI SELMANE ASSIFANE', 'CHEFCHAOUEN', 'Virement', 'MEDECINE'),
  (48, 'AMAZIANE ABDESLAM', 'GN129122', '943566325', date '1982-01-01', date '2025-11-03', null::date, 'AGENT DE JARDINNAGE', 'CHRAKA CR HJAR NHAL', 'TANGER', 'Virement', 'MEDECINE')
) as e(matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, date_sortie, qualification, adresse, ville, mode_reglement, site_name)
join public.companies c on c.name = 'EDEN VERT SERVICE'
join public.sites s on s.company_id = c.id and s.name = e.site_name
where not exists (select 1 from public.employees x where x.company_id = c.id and x.matricule = e.matricule);

