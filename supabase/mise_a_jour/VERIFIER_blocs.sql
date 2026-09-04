-- ============================================================================
--  QUELS BLOCS SONT DÉJÀ PASSÉS ?
--  ============================================================
--  Supabase → SQL Editor → coller → Run. Ne modifie rien.
--
--  Chaque bloc laisse une trace en base : une table, une colonne, une
--  fonction. On les cherche. Ce qui manque est à lancer, dans l'ordre.
-- ============================================================================

with attendu (numero, bloc, objet, present) as (
  values
  (1,  'Paie et contrats',            'table contrats',
       to_regclass('public.contrats') is not null),
  (2,  'Rôle paie',                   'rôle « paie »',
       exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                where t.typname = 'user_role' and e.enumlabel = 'paie')),
  (3,  'Droits et verrouillage',      'fonction assert_mois_ouvert',
       to_regproc('public.assert_mois_ouvert') is not null),
  (4,  'Sécurité (urgent)',           'fonction exiger_role',
       to_regproc('public.exiger_role') is not null),
  (5,  'Gestion des comptes',         'colonne profiles.actif',
       exists (select 1 from information_schema.columns
                where table_name = 'profiles' and column_name = 'actif')),
  (6,  'Supprimer un employé',        'fonction supprimer_employe',
       to_regproc('public.supprimer_employe') is not null),
  (7,  'Sites principaux',            'table sites_principaux',
       to_regclass('public.sites_principaux') is not null),
  (8,  'Dossier employé',             'table documents',
       to_regclass('public.documents') is not null),
  (9,  'Dette simplifiée',            'colonne employees.dette',
       exists (select 1 from information_schema.columns
                where table_name = 'employees' and column_name = 'dette')),
  (10, 'Rôle personnel (RH)',         'rôle « rh »',
       exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                where t.typname = 'user_role' and e.enumlabel = 'rh')),
  (11, 'Département',                 'colonne employees.departement',
       exists (select 1 from information_schema.columns
                where table_name = 'employees' and column_name = 'departement')),
  (12, 'Matricule croissant',         'table matricule_compteur',
       to_regclass('public.matricule_compteur') is not null),
  (13, 'Verrou Analytics',            'fonction verifier_mon_mot_de_passe',
       to_regproc('public.verifier_mon_mot_de_passe') is not null),
  (14, 'Analytics de la paie',        'fonction analytics_paie',
       to_regproc('public.analytics_paie') is not null),
  (15, 'Bulletin de paie',            'table bareme_igr',
       to_regclass('public.bareme_igr') is not null),
  (16, 'Champs des documents',        'colonne contrats.champs_document',
       exists (select 1 from information_schema.columns
                where table_name = 'contrats' and column_name = 'champs_document')),
  (17, 'Sorties',                     'table sorties',
       to_regclass('public.sorties') is not null),
  (18, 'Archivage des sorties',       'colonne employees.archive_le',
       exists (select 1 from information_schema.columns
                where table_name = 'employees' and column_name = 'archive_le')),
  (19, 'Jours par mois',              'fonction jours_du_mois',
       to_regproc('public.jours_du_mois') is not null),
  (20, 'Le bureau fait la paie',      'exiger_role connaît le bureau',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'exiger_role'
                  and p.prosrc like '%validator%')),
  (21, 'Deux types de contrat',       'contrainte CONTRAT / STAGE',
       exists (select 1 from pg_constraint
                where conname = 'contrats_type_contrat_check'
                  and pg_get_constraintdef(oid) like '%CONTRAT%')),
  (22, 'Date de fin obligatoire',     'contrats.date_fin non nulle',
       exists (select 1 from information_schema.columns
                where table_name = 'contrats' and column_name = 'date_fin'
                  and is_nullable = 'NO')),
  (23, 'Validation par le scan',      'colonne conges.valide_le',
       exists (select 1 from information_schema.columns
                where table_name = 'conges' and column_name = 'valide_le')),
  (24, 'Effet au dépôt du scan',      'fonction appliquer_conge',
       to_regproc('public.appliquer_conge') is not null),
  (25, 'Modèle par société',          'colonne companies.modele_document',
       exists (select 1 from information_schema.columns
                where table_name = 'companies' and column_name = 'modele_document')),
  (26, 'Net jamais négatif',          'contrainte lignes_paie_net_positif',
       exists (select 1 from pg_constraint where conname = 'lignes_paie_net_positif')),
  (27, 'Horaire matin / nuit',        'colonne employees.horaire',
       exists (select 1 from information_schema.columns
                where table_name = 'employees' and column_name = 'horaire'))
)
select numero,
       bloc,
       objet as ce_qu_on_cherche,
       case when present then 'PASSÉ' else '⚠ À LANCER' end as etat
  from attendu
 order by numero;


-- ▶ Le résumé, en une ligne
-- select count(*) filter (where present) as passes,
--        count(*) filter (where not present) as a_lancer from attendu;


-- ▶ Et si le BLOC 25 est passé : quelles sociétés n'ont pas de clé de modèle ?
--   Une société sans clé n'affichera pas son contrat.
select name as societe, coalesce(modele_document, '⚠ AUCUNE CLÉ') as cle_de_modele
  from public.companies
 order by (modele_document is null) desc, name;
