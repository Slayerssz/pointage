"""Fabrique les trois scripts d'import à partir du registre analysé.

L'éditeur SQL de Supabase exécute les instructions une par une : une table
« temporary ... on commit drop » disparaît donc aussitôt créée, et le
begin/commit ne protège rien. D'où deux partis pris :

  · la table de travail est une VRAIE table (public.import_etat), qui
    survit d'une instruction à l'autre et se supprime explicitement ;
  · toutes les écritures tiennent dans un seul bloc « do », donc une seule
    instruction, donc atomique quoi qu'il arrive.
"""
import json, sys

SP, DST = sys.argv[1], sys.argv[2]
d = json.load(open(SP + "/listes/roster.json"))

SOCIETES = {
 'BO NETTOYAGE':                    'BO',
 'DUO':                             'DUO MULTI SERVICE',
 'MEGA':                            'MEGANTER SERVICE MAROC',
 'COOPERATIVE AL SAFAE EL MAGHRIB': 'AL SAFAE EL MAGHREB',
 'COOPERATIVE EDEN VERT SERVICE':   'EDEN VERT SERVICE',
 'GTA':                             'GROUPE TRIPLE A',
 'NORD PLANET NEGOCE':              'NORD PLANET',
 'SERCLEAN NEGOCE':                 'SERCLEAN NEGOCE',
 'TRIMAX':                          'TRIMAX',
 'VIGILMA GARD MAROC':              'VIGILMA GARD MAROC',
}

def q(v):
    if v is None or v == '':
        return 'null'
    return "'" + str(v).replace("'", "''") + "'"

lignes = []
for pdf, emps in d.items():
    co = SOCIETES[pdf]
    for e in emps:
        lignes.append('  (' + ', '.join([
            q(co), q(e['site']), q(e['departement']), str(e['matricule']),
            q(e['nom_prenom']), q(e['cin']), q(e['cnss']),
            q(e['date_naissance']), q(e['date_embauche']), q(e['mode_reglement']),
            q(e['ville']), q(e['adresse'])]) + ')')

corps = ',\n'.join(lignes)
n = len(lignes)
ns = len({(SOCIETES[p], e['site']) for p, v in d.items() for e in v})
# Les noms sont comparés en majuscules : « Groupe Triple A » en base doit
# retrouver « GROUPE TRIPLE A » de l'état.
societes_sql = ', '.join(q(v.upper()) for v in sorted(set(SOCIETES.values())))

SOCLE = f"""drop view  if exists public.import_rapprochement;
drop table if exists public.import_etat;

create table public.import_etat (
  societe        text,
  site           text,
  departement    text,
  matricule      integer,
  nom_prenom     text,
  cin            text,
  cnss           text,
  date_naissance date,
  date_embauche  date,
  mode_reglement text,
  ville          text,
  adresse        text
);

-- Table de travail : personne d'autre que l'éditeur SQL n'y accède.
alter table public.import_etat enable row level security;

insert into public.import_etat
  (societe, site, departement, matricule, nom_prenom, cin, cnss,
   date_naissance, date_embauche, mode_reglement, ville, adresse)
values
{corps};

-- Le rapprochement se fait d'abord sur le C.I.N. — le seul identifiant qui
-- ne bouge pas — puis, à défaut, sur société+matricule, et en dernier
-- recours sur société+nom.
create view public.import_rapprochement as
select
  r.*,
  c.id as company_id,
  coalesce(
    (select e.id from public.employees e
      where e.cin is not null and r.cin is not null
        and upper(trim(e.cin)) = upper(trim(r.cin)) limit 1),
    (select e.id from public.employees e
      where e.company_id = c.id and e.matricule = r.matricule limit 1),
    (select e.id from public.employees e
      where e.company_id = c.id
        and upper(trim(e.nom_prenom)) = upper(trim(r.nom_prenom)) limit 1)
  ) as employee_id
from public.import_etat r
left join public.companies c on upper(trim(c.name)) = upper(trim(r.societe));
"""

NETTOYAGE = """-- ═══════════════════════════════════════════════════════════════════════════
--  MÉNAGE — à lancer quand vous avez fini avec les trois scripts.
--  Tant que ces deux objets existent, vous pouvez relancer n'importe
--  quelle requête « ▶ » sans recoller les 544 lignes.
-- ═══════════════════════════════════════════════════════════════════════════
-- drop view  if exists public.import_rapprochement;
-- drop table if exists public.import_etat;
"""

ENTETE = f"""--  {n} employés · {len(d)} sociétés · {ns} sites · états du 02/09/2026
--
--  RATTACHEMENT AUX SOCIÉTÉS (nom de l'état → nom en base)
{chr(10).join(f'--    {k:34} → {v}' for k, v in SOCIETES.items())}
--
--  Les dix sociétés du groupe sont couvertes : après ces scripts, le
--  registre correspond exactement aux états, sans exception."""

apercu = f"""-- ============================================================================
--  IMPORT DU REGISTRE — 1 sur 3 : APERÇU (ne modifie aucun employé)
--  ============================================================
{ENTETE}
--
--  MODE D'EMPLOI
--    1. Collez tout le fichier dans Supabase → SQL Editor et faites Run.
--       Vous verrez le résultat de la DERNIÈRE requête (la n° 5).
--    2. Pour lire les autres : sélectionnez à la souris la requête « ▶ »
--       qui vous intéresse, et faites Run. La table de travail reste en
--       place, inutile de recoller les 544 lignes.
--    3. Quand vous avez fini, lancez le MÉNAGE en bas de fichier.
--
--  Aucun employé, site ou pointage n'est touché : ce script ne fait que lire.
-- ============================================================================

{SOCLE}
-- ─────────────────────────────── FIN DU SOCLE ───────────────────────────────


-- ▶ 1. Une société de l'état sans correspondance en base ? (doit être vide)
select distinct 'société introuvable en base' as alerte, societe
  from public.import_rapprochement where company_id is null;

-- ▶ 2. Combien de créations, combien de mises à jour, par société
select societe,
       count(*)                                        as sur_l_etat,
       count(*) filter (where employee_id is null)     as a_creer,
       count(*) filter (where employee_id is not null) as a_mettre_a_jour
  from public.import_rapprochement group by societe order by societe;

-- ▶ 3. Les sites qui n'existent pas encore et seront créés
select r.societe, r.site as site_a_creer, count(*) as employes
  from public.import_rapprochement r
  left join public.sites s on s.company_id = r.company_id
                          and upper(trim(s.name)) = upper(trim(r.site))
 where s.id is null and r.company_id is not null
 group by r.societe, r.site order by r.societe, r.site;

-- ▶ 4. Les employés qui changent de société ou de site
select e.nom_prenom, e.matricule,
       co.name as societe_actuelle, r.societe as societe_etat,
       s.name  as site_actuel,      r.site    as site_etat
  from public.import_rapprochement r
  join public.employees e on e.id = r.employee_id
  join public.companies co on co.id = e.company_id
  left join public.sites s on s.id = e.site_id
 where co.id is distinct from r.company_id
    or upper(trim(coalesce(s.name, ''))) is distinct from upper(trim(r.site))
 order by r.societe, e.nom_prenom;

-- ▶ 5. Les employés EN BASE absents de tous les états reçus.
--     Ce sont eux, et eux seuls, que le script 3 supprimera.
select co.name as societe, e.matricule, e.nom_prenom, e.cin,
       s.name as site, e.actif
  from public.employees e
  join public.companies co on co.id = e.company_id
  left join public.sites s on s.id = e.site_id
 where not exists (select 1 from public.import_rapprochement r
                    where r.employee_id = e.id)
 order by co.name, e.nom_prenom;


{NETTOYAGE}"""

appliquer = f"""-- ============================================================================
--  IMPORT DU REGISTRE — 2 sur 3 : APPLIQUER
--  ============================================================
{ENTETE}
--
--  Collez tout le fichier dans Supabase → SQL Editor et faites Run.
--  À lancer APRÈS avoir lu l'aperçu. Le relancer ne crée pas de doublon.
--
--  Toutes les écritures tiennent dans un seul bloc « do » : elles passent
--  ensemble, ou pas du tout.
--
--  CE QUE LE SCRIPT FAIT
--    · crée les sites manquants (il n'en supprime jamais)
--    · crée les employés absents de la base
--    · pour ceux qui existent déjà : corrige société, site, département,
--      C.I.N., C.N.S.S., dates et mode de règlement
--    · remet en poste un employé marqué « sorti » qui reparaît sur l'état
--
--  CE QUE LE SCRIPT NE FAIT PAS
--    · il ne supprime rien et ne sort personne (c'est le script 3)
--    · il ne touche ni au salaire, ni à la dette, ni aux pointages, ni aux
--      contrats, ni aux congés déjà saisis
--    · il n'écrase pas une qualification, une adresse ou une ville déjà
--      renseignée : dans les PDF ces colonnes sont coupées par la mise en
--      page (« AGENT DE », « ERRACHIDI », « KSAR EL »). Elles ne servent
--      qu'à remplir une fiche encore vide.
-- ============================================================================

{SOCLE}
-- ─────────────────────────────── FIN DU SOCLE ───────────────────────────────


do $bloc$
declare
  v_manquantes text;
  v_sites int;
  v_maj   int;
  v_neufs int;
begin
  -- Refus net si une société de l'état n'existe pas en base : mieux vaut
  -- s'arrêter que d'importer la moitié du registre.
  select string_agg(distinct societe, ', ') into v_manquantes
    from public.import_rapprochement where company_id is null;
  if v_manquantes is not null then
    raise exception 'Sociétés introuvables en base : %. Import interrompu.', v_manquantes;
  end if;

  -- 1. Les sites manquants
  insert into public.sites (company_id, name)
  select distinct r.company_id, r.site
    from public.import_rapprochement r
   where r.company_id is not null and r.site is not null
     and not exists (select 1 from public.sites s
                      where s.company_id = r.company_id
                        and upper(trim(s.name)) = upper(trim(r.site)));
  get diagnostics v_sites = row_count;

  -- 2. Les employés déjà connus.
  --    « actif » est calculé par un déclencheur à partir de date_sortie :
  --    pour remettre quelqu'un en poste, il faut vider date_sortie.
  --    Le matricule n'est repris que s'il est libre dans la société —
  --    un doublon ferait échouer tout le script.
  update public.employees e
     set company_id     = r.company_id,
         site_id        = s.id,
         departement    = r.departement,
         nom_prenom     = r.nom_prenom,
         cin            = coalesce(nullif(r.cin, ''), e.cin),
         cnss           = coalesce(nullif(r.cnss, ''), e.cnss),
         date_naissance = coalesce(r.date_naissance, e.date_naissance),
         date_embauche  = coalesce(r.date_embauche, e.date_embauche),
         mode_reglement = coalesce(nullif(r.mode_reglement, ''), e.mode_reglement),
         ville          = coalesce(nullif(e.ville, ''), nullif(r.ville, '')),
         adresse        = coalesce(nullif(e.adresse, ''), nullif(r.adresse, '')),
         date_sortie    = null,
         matricule      = case
                            when e.matricule = r.matricule then e.matricule
                            when not exists (select 1 from public.employees x
                                              where x.company_id = r.company_id
                                                and x.matricule  = r.matricule
                                                and x.id <> e.id)
                              then r.matricule
                            else e.matricule
                          end
    from public.import_rapprochement r
    join public.sites s on s.company_id = r.company_id
                       and upper(trim(s.name)) = upper(trim(r.site))
   where e.id = r.employee_id;
  get diagnostics v_maj = row_count;

  -- 3. Les nouveaux. Si le matricule de l'état est déjà pris dans la
  --    société, on laisse le déclencheur en attribuer un libre.
  insert into public.employees
    (company_id, site_id, matricule, nom_prenom, cin, cnss,
     date_naissance, date_embauche, mode_reglement, ville, adresse,
     departement, qualification)
  select r.company_id, s.id,
         case when exists (select 1 from public.employees x
                            where x.company_id = r.company_id
                              and x.matricule  = r.matricule)
              then null else r.matricule end,
         r.nom_prenom, nullif(r.cin, ''), nullif(r.cnss, ''),
         r.date_naissance, r.date_embauche, nullif(r.mode_reglement, ''),
         nullif(r.ville, ''), nullif(r.adresse, ''),
         r.departement,
         -- la colonne « Qualification » des PDF est coupée à huit
         -- caractères ; on la reconstruit depuis le département, complet
         case r.departement
           when 'NETTOYAGE'      then 'AGENT DE NETTOYAGE'
           when 'SECURITE'       then 'AGENT DE SECURITE'
           when 'GARDIENNAGE'    then 'GARDIEN'
           when 'JARDINAGE'      then 'JARDINIER'
           when 'JARDINIER'      then 'JARDINIER'
           when 'ACCUEIL'        then 'AGENT D''ACCUEIL'
           when 'ADMINISTRATIF'  then 'ADMINISTRATIF'
           when 'ADMINISTRATIVE' then 'ADMINISTRATIF'
           else r.departement
         end
    from public.import_rapprochement r
    join public.sites s on s.company_id = r.company_id
                       and upper(trim(s.name)) = upper(trim(r.site))
   where r.employee_id is null;
  get diagnostics v_neufs = row_count;

  -- 4. Le compteur repart au-dessus du plus grand matricule attribué,
  --    pour qu'aucun numéro ne soit redistribué plus tard.
  update public.matricule_compteur
     set dernier = greatest(dernier, (select coalesce(max(matricule), 0)
                                        from public.employees));

  raise notice 'Import : % site(s) créé(s), % employé(s) mis à jour, % créé(s).',
    v_sites, v_maj, v_neufs;
end $bloc$;


-- ▶ Le bilan
select co.name as societe,
       count(*) filter (where e.date_sortie is null) as en_poste,
       count(*) filter (where e.date_sortie is not null) as sortis,
       count(*) as total,
       count(distinct e.site_id) as sites
  from public.employees e
  join public.companies co on co.id = e.company_id
 group by co.name order by co.name;


{NETTOYAGE}"""

sortie = f"""-- ============================================================================
--  IMPORT DU REGISTRE — 3 sur 3 : SUPPRIMER CEUX QUI NE FIGURENT PLUS
--  ============================================================
--  Après ce script, le registre contient exactement les {n} personnes de
--  vos états, et personne d'autre.
--
--  ⚠ IRRÉVERSIBLE, et sans exception : une fiche supprimée emporte avec
--    elle ses pointages, ses contrats, ses congés, ses documents et ses
--    lignes de paie. C'est voulu — le contenu actuel de la base est du
--    jeu d'essai. Le jour où la base portera de vraies paies, il faudra
--    revoir ce script : effacer un bulletin déjà édité fausserait un mois
--    validé, et c'est une pièce que la C.N.S.S. peut réclamer.
--
--  MODE D'EMPLOI
--    1. Lancez d'abord IMPORT_1 (aperçu) puis IMPORT_2 (application).
--    2. Collez ce fichier et faites Run : il commence par créer la table
--       de travail, PUIS supprime, PUIS affiche le bilan.
--    3. Pour voir qui va partir AVANT de supprimer, lancez d'abord le
--       socle seul (jusqu'à « FIN DU SOCLE »), puis la requête « ▶ » ;
--       lancez le bloc « do » ensuite.
-- ============================================================================

{SOCLE}
-- ─────────────────────────────── FIN DU SOCLE ───────────────────────────────


-- ▶ Qui va disparaître, et ce qui part avec (à lancer seul, avant le bloc do)
select co.name as societe, e.matricule, e.nom_prenom, e.cin, s.name as site,
       (select count(*) from public.pointages p   where p.employee_id = e.id) as pointages,
       (select count(*) from public.lignes_paie l where l.employee_id = e.id) as lignes_de_paie,
       (select count(*) from public.contrats c    where c.employee_id = e.id) as contrats,
       (select count(*) from public.conges g      where g.employee_id = e.id) as conges
  from public.employees e
  join public.companies co on co.id = e.company_id
  left join public.sites s on s.id = e.site_id
 where upper(trim(co.name)) in ({societes_sql})
   and not exists (select 1 from public.import_rapprochement r
                    where r.employee_id = e.id)
 order by co.name, e.nom_prenom;


do $bloc$
declare v_n int;
begin
  delete from public.employees e
   using public.companies co
   where co.id = e.company_id
     and upper(trim(co.name)) in ({societes_sql})
     and not exists (select 1 from public.import_rapprochement r
                      where r.employee_id = e.id);
  get diagnostics v_n = row_count;
  raise notice '% employé(s) supprimé(s).', v_n;
end $bloc$;


-- ▶ Le bilan : « en_poste » doit retomber exactement sur vos états
select co.name as societe,
       count(*) filter (where e.date_sortie is null) as en_poste,
       count(*) as total
  from public.employees e
  join public.companies co on co.id = e.company_id
 group by co.name order by co.name;


{NETTOYAGE}
-- ═══════════════════════════════════════════════════════════════════════════
--  FACULTATIF — les annexes devenues vides. Le script n'y touche pas :
--  un site vide aujourd'hui peut resservir demain.
-- ═══════════════════════════════════════════════════════════════════════════
-- select co.name as societe, s.name as site_vide
--   from public.sites s
--   join public.companies co on co.id = s.company_id
--  where not exists (select 1 from public.employees e where e.site_id = s.id)
--  order by co.name, s.name;
"""

for nom, txt in [('IMPORT_1_apercu.sql', apercu),
                 ('IMPORT_2_appliquer.sql', appliquer),
                 ('IMPORT_3_supprimer_absents.sql', sortie)]:
    open(f'{DST}/{nom}', 'w').write(txt)
    print(f'{nom:34} {len(txt.splitlines()):5} lignes')
