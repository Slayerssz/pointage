"""Fabrique les trois scripts d'import à partir du registre analysé."""
import json, sys

SP, DST = sys.argv[1], sys.argv[2]
d = json.load(open(SP + "/listes/roster.json"))

SOCIETES = {
 'BO NETTOYAGE':                    'BO',
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
societes_sql = ', '.join(q(v) for v in sorted(set(SOCIETES.values())))

SOCLE = f"""create temporary table etat_recu (
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
) on commit drop;

insert into etat_recu
  (societe, site, departement, matricule, nom_prenom, cin, cnss,
   date_naissance, date_embauche, mode_reglement, ville, adresse)
values
{corps};

-- Un rapprochement se fait d'abord sur le C.I.N. — le seul identifiant qui
-- ne bouge pas — puis, à défaut, sur société+matricule, et en dernier
-- recours sur société+nom.
create temporary view rapprochement as
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
from etat_recu r
left join public.companies c on upper(trim(c.name)) = upper(trim(r.societe));
"""

ENTETE = f"""--  {n} employés · {len(d)} sociétés · {ns} sites · états du 02/09/2026
--
--  RATTACHEMENT AUX SOCIÉTÉS (nom de l'état → nom en base)
{chr(10).join(f'--    {k:34} → {v}' for k, v in SOCIETES.items())}
--
--  ⚠ DUO MULTI SERVICE et MEGANTER SERVICE MAROC n'ont pas d'état dans cet
--    envoi : leurs employés ne sont donc PAS concernés, et il ne faut
--    surtout pas les sortir tant que leurs listes ne sont pas arrivées."""

apercu = f"""-- ============================================================================
--  IMPORT DU REGISTRE — 1 sur 3 : APERÇU (ne modifie RIEN)
--  ============================================================
{ENTETE}
--
--  Supabase → SQL Editor → coller → Run. L'éditeur n'affiche que le dernier
--  résultat : pour lire les autres, sélectionnez tout le bloc jusqu'à
--  « FIN DU SOCLE », puis la requête « ▶ » qui vous intéresse, et lancez.
--
--  Rien n'est écrit : le script se termine par un rollback.
-- ============================================================================

begin;

{SOCLE}
-- ─────────────────────────────── FIN DU SOCLE ───────────────────────────────


-- ▶ 1. Une société de l'état sans correspondance en base ? (doit être vide)
select distinct 'société introuvable en base' as alerte, societe
  from rapprochement where company_id is null;

-- ▶ 2. Combien de créations, combien de mises à jour, par société
select societe,
       count(*)                                        as sur_l_etat,
       count(*) filter (where employee_id is null)     as a_creer,
       count(*) filter (where employee_id is not null) as a_mettre_a_jour
  from rapprochement group by societe order by societe;

-- ▶ 3. Les sites qui n'existent pas encore et seront créés
select r.societe, r.site as site_a_creer, count(*) as employes
  from rapprochement r
  left join public.sites s on s.company_id = r.company_id
                          and upper(trim(s.name)) = upper(trim(r.site))
 where s.id is null and r.company_id is not null
 group by r.societe, r.site order by r.societe, r.site;

-- ▶ 4. Les employés qui changent de société ou de site
select e.nom_prenom, e.matricule,
       co.name as societe_actuelle, r.societe as societe_etat,
       s.name  as site_actuel,      r.site    as site_etat
  from rapprochement r
  join public.employees e on e.id = r.employee_id
  join public.companies co on co.id = e.company_id
  left join public.sites s on s.id = e.site_id
 where co.id is distinct from r.company_id
    or upper(trim(coalesce(s.name, ''))) is distinct from upper(trim(r.site))
 order by r.societe, e.nom_prenom;

-- ▶ 5. Les employés EN BASE absents de tous les états reçus.
--     Le script d'application ne les touche pas. À vous de trancher :
--     départ réel, oubli, ou société dont l'état n'est pas encore arrivé.
select co.name as societe, e.matricule, e.nom_prenom, e.cin,
       s.name as site, e.actif
  from public.employees e
  join public.companies co on co.id = e.company_id
  left join public.sites s on s.id = e.site_id
 where not exists (select 1 from rapprochement r where r.employee_id = e.id)
 order by co.name, e.nom_prenom;

rollback;
"""

appliquer = f"""-- ============================================================================
--  IMPORT DU REGISTRE — 2 sur 3 : APPLIQUER
--  ============================================================
{ENTETE}
--
--  Supabase → SQL Editor → coller → Run. À lancer APRÈS avoir lu l'aperçu.
--  Tout est dans une seule transaction : à la moindre erreur, rien ne passe.
--  Le relancer deux fois ne crée pas de doublon.
--
--  CE QUE LE SCRIPT FAIT
--    · crée les sites manquants (il n'en supprime jamais)
--    · crée les employés absents de la base
--    · pour ceux qui existent déjà : corrige société, site, département,
--      C.I.N., C.N.S.S., dates et mode de règlement
--    · remet en poste un employé marqué « sorti » qui reparaît sur l'état
--
--  CE QUE LE SCRIPT NE FAIT PAS
--    · il ne supprime rien et ne sort personne tout seul
--    · il ne touche ni au salaire, ni à la dette, ni aux pointages, ni aux
--      contrats, ni aux congés déjà saisis
--    · il n'écrase pas une qualification, une adresse ou une ville déjà
--      renseignée : dans les PDF ces colonnes sont coupées par la mise en
--      page (« AGENT DE », « ERRACHIDI », « KSAR EL »). Elles ne servent
--      qu'à remplir une fiche encore vide.
-- ============================================================================

begin;

{SOCLE}
-- ─────────────────────────────── FIN DU SOCLE ───────────────────────────────


-- Refus net si une société de l'état n'existe pas en base : mieux vaut
-- s'arrêter que d'importer la moitié du registre.
do $bloc$
declare v_manquantes text;
begin
  select string_agg(distinct societe, ', ') into v_manquantes
    from rapprochement where company_id is null;
  if v_manquantes is not null then
    raise exception 'Sociétés introuvables en base : %. Import interrompu.', v_manquantes;
  end if;
end $bloc$;

-- 1. Les sites manquants
insert into public.sites (company_id, name)
select distinct r.company_id, r.site
  from rapprochement r
 where r.company_id is not null and r.site is not null
   and not exists (select 1 from public.sites s
                    where s.company_id = r.company_id
                      and upper(trim(s.name)) = upper(trim(r.site)));

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
  from rapprochement r
  join public.sites s on s.company_id = r.company_id
                     and upper(trim(s.name)) = upper(trim(r.site))
 where e.id = r.employee_id;

-- 3. Les nouveaux. Si le matricule de l'état est déjà pris dans la société,
--    on laisse le déclencheur en attribuer un libre plutôt que d'échouer.
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
       -- la colonne « Qualification » des PDF est coupée à huit caractères ;
       -- on la reconstruit depuis le département, lui complet
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
  from rapprochement r
  join public.sites s on s.company_id = r.company_id
                     and upper(trim(s.name)) = upper(trim(r.site))
 where r.employee_id is null;

-- 4. Le compteur repart au-dessus du plus grand matricule attribué, pour
--    qu'aucun numéro ne soit redistribué plus tard.
update public.matricule_compteur
   set dernier = greatest(dernier, (select coalesce(max(matricule), 0)
                                      from public.employees));

-- 5. Le bilan, affiché avant de valider
select co.name as societe,
       count(*) filter (where e.date_sortie is null) as en_poste,
       count(*) as total,
       count(distinct e.site_id) as sites
  from public.employees e
  join public.companies co on co.id = e.company_id
 group by co.name order by co.name;

commit;
"""

sortie = f"""-- ============================================================================
--  IMPORT DU REGISTRE — 3 sur 3 : SORTIR CEUX QUI NE FIGURENT PLUS
--  ============================================================
--  ⚠ FACULTATIF. À ne lancer QU'APRÈS avoir lu la liste 5 de l'aperçu, et
--    JAMAIS avant d'avoir reçu les états de DUO MULTI SERVICE et MEGANTER
--    SERVICE MAROC. Ce script ne touche qu'aux huit sociétés fournies ; les
--    deux autres sont épargnées, mais relisez quand même la liste.
--
--  Un employé « sorti » n'est pas supprimé : il reste au registre avec sa
--  date de sortie, ses pointages et son historique de paie.
-- ============================================================================

begin;

{SOCLE}
-- ─────────────────────────────── FIN DU SOCLE ───────────────────────────────


-- Qui va sortir, exactement — lisez avant de valider
select co.name as societe, e.matricule, e.nom_prenom, e.cin, s.name as site
  from public.employees e
  join public.companies co on co.id = e.company_id
  left join public.sites s on s.id = e.site_id
 where e.date_sortie is null
   and co.name in ({societes_sql})
   and not exists (select 1 from rapprochement r where r.employee_id = e.id)
 order by co.name, e.nom_prenom;

update public.employees e
   set date_sortie = current_date
  from public.companies co
 where co.id = e.company_id
   and e.date_sortie is null
   and co.name in ({societes_sql})
   and not exists (select 1 from rapprochement r where r.employee_id = e.id);

commit;
"""

for nom, txt in [('IMPORT_1_apercu.sql', apercu),
                 ('IMPORT_2_appliquer.sql', appliquer),
                 ('IMPORT_3_sorties_facultatif.sql', sortie)]:
    open(f'{DST}/{nom}', 'w').write(txt)
    print(f'{nom:34} {len(txt.splitlines()):5} lignes')
