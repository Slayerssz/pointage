-- ============================================================================
--  RELEVÉ — CE QUI CLOCHE DANS LE POINTAGE (lecture seule)
--  ============================================================
--  Ce fichier NE MODIFIE RIEN. Il ne fait que regarder.
--
--  À lancer section par section (Supabase n'affiche que le dernier
--  résultat) : sélectionnez une requête, Run, et envoyez-moi le tableau.
--  Le nettoyage s'écrira ensuite, à partir de ce que vous aurez vu —
--  on ne supprime pas des journées de pointage à l'aveugle.
-- ============================================================================


-- ▶ 1. DEUX JOURNÉES LE MÊME JOUR POUR LA MÊME PERSONNE
--   L'index n'en autorise qu'une seule non refusée ; une seconde ne peut
--   donc être qu'un ancien refus. Si cette requête renvoie des lignes
--   avec deux fois 'validated', c'est l'index qui manque.
select e.nom_prenom,
       c.name  as societe,
       s.name  as site,
       p.pointed_on as jour,
       count(*) as combien,
       string_agg(p.status::text || ':' || coalesce(p.type_garde, '∅'), ' + '
                  order by p.pointed_at) as ce_qu_il_y_a
  from public.pointages p
  join public.employees e on e.id = p.employee_id
  join public.companies c on c.id = p.company_id
  left join public.sites s on s.id = p.site_id
 group by e.nom_prenom, c.name, s.name, p.pointed_on
having count(*) > 1
 order by combien desc, e.nom_prenom
 limit 200;


-- ▶ 2. JOURNÉES QUI N'ONT NI LETTRE, NI LETTRE CONNUE
--   Une case sans lettre s'affiche « ? » depuis la correction ; avant,
--   elle s'affichait en vert comme une présence.
select c.name as societe,
       e.nom_prenom,
       p.pointed_on as jour,
       coalesce(p.type_garde, '∅ VIDE') as lettre,
       p.status::text as etat
  from public.pointages p
  join public.employees e on e.id = p.employee_id
  join public.companies c on c.id = p.company_id
 where p.type_garde is null
    or p.type_garde not in ('X05','X','X15','XX','RT','R','M','C','CS','AJ','F','XF')
 order by c.name, e.nom_prenom, p.pointed_on
 limit 200;


-- ▶ 3. PHOTOS JAMAIS TRANCHÉES
--   Une journée « en attente » existe en base mais ne se lit pas comme
--   une journée pointée : elle ne compte pas dans la paie, et elle
--   occupait la case. Combien, et depuis quand ?
select c.name as societe,
       s.name as site,
       count(*) as en_attente,
       min(p.pointed_on) as la_plus_ancienne,
       max(p.pointed_on) as la_plus_recente
  from public.pointages p
  join public.companies c on c.id = p.company_id
  left join public.sites s on s.id = p.site_id
 where p.status = 'pending'
 group by c.name, s.name
 order by en_attente desc
 limit 100;


-- ▶ 4. JOURNÉES HORS CONTRAT
--   Pointées avant l'embauche ou après la sortie : elles s'affichent
--   dans la grille mais la paie les écarte. C'est exactement le genre
--   d'écart qui se voit en fin de mois.
select c.name as societe,
       e.nom_prenom,
       e.date_embauche,
       e.date_sortie,
       count(*) as journees_hors_contrat,
       min(p.pointed_on) as de,
       max(p.pointed_on) as a
  from public.pointages p
  join public.employees e on e.id = p.employee_id
  join public.companies c on c.id = p.company_id
 where p.status = 'validated'
   and ((e.date_embauche is not null and p.pointed_on < e.date_embauche)
     or (e.date_sortie  is not null and p.pointed_on > e.date_sortie))
 group by c.name, e.nom_prenom, e.date_embauche, e.date_sortie
 order by journees_hors_contrat desc
 limit 200;


-- ▶ 5. FICHES MAL RATTACHÉES
--   Un employé dont le site appartient à une autre société : il paraît
--   dans une grille et se paie dans l'autre.
select c.name as societe_de_la_fiche,
       e.nom_prenom,
       s.name as site,
       c2.name as societe_du_site
  from public.employees e
  join public.companies c on c.id = e.company_id
  left join public.sites s on s.id = e.site_id
  left join public.companies c2 on c2.id = s.company_id
 where s.id is null or s.company_id <> e.company_id
 order by c.name, e.nom_prenom
 limit 200;


-- ▶ 6. LE SITE DU MINISTÈRE, CHEZ EDEN VERT SERVICE
--   Le mois en cours, agent par agent : ce qui est saisi, et ce qui ne
--   l'est pas. Les colonnes doivent s'additionner au nombre de jours
--   écoulés ; « jamais_saisi » est ce qui reste à pointer — ce n'est pas
--   de l'absence.
select e.nom_prenom,
       s.name as annexe,
       count(*) filter (where p.type_garde in ('X','XX','RT','X05','X15')) as travaille,
       count(*) filter (where p.type_garde = 'R')  as repos,
       count(*) filter (where p.type_garde = 'AJ') as absent_A,
       count(*) filter (where p.type_garde = 'C')  as conge,
       count(*) filter (where p.type_garde = 'M')  as malade,
       count(*) filter (where p.status = 'pending') as photos_en_attente,
       (least(current_date, date_trunc('month', current_date)::date
              + interval '1 month - 1 day')::date
        - date_trunc('month', current_date)::date + 1)
         - count(*) filter (where p.status = 'validated') as jamais_saisi
  from public.employees e
  join public.sites s on s.id = e.site_id
  join public.companies c on c.id = e.company_id
  left join public.pointages p
    on p.employee_id = e.id
   and p.pointed_on >= date_trunc('month', current_date)::date
   and p.pointed_on <= current_date
   and p.status <> 'refused'
 where upper(c.name) like '%EDEN%'
   and (upper(s.name) like '%MINIST%' or upper(s.name) like '%ENSEIGNEMENT%'
     or upper(s.name) like '%RECHERCHE%')
 group by e.nom_prenom, s.name
 order by s.name, e.nom_prenom
 limit 300;


-- ▶ 7. LES ANNEXES DE CE SITE, ET QUI LES PORTE
--   Deux annexes de même nom, ou une annexe détachée de son site
--   principal, suffisent à faire apparaître quelqu'un deux fois.
select c.name as societe,
       sp.name as site_principal,
       s.name as annexe,
       s.pointage_actif,
       count(e.id) filter (where e.actif) as agents_en_poste,
       count(e.id) filter (where not e.actif) as agents_sortis
  from public.sites s
  join public.companies c on c.id = s.company_id
  left join public.sites_principaux sp on sp.id = s.site_principal_id
  left join public.employees e on e.site_id = s.id
 where upper(c.name) like '%EDEN%'
 group by c.name, sp.name, s.name, s.pointage_actif
 order by sp.name nulls last, s.name;
