-- ============================================================================
--  POURQUOI GROUPE TRIPLE A EST À ZÉRO
--  ============================================================
--  Le contrôle annonce 0 employé ET 0 site pour GROUPE TRIPLE A. Zéro site
--  est le signe qui compte : l'import crée toujours les sites d'une société
--  qu'il trouve. Zéro veut donc dire qu'aucune société ne porte ce nom-là
--  en base — le rapprochement se fait sur le nom exact.
--
--  Lancez cette requête : elle liste les sociétés telles qu'elles sont
--  réellement écrites, avec leur effectif.
-- ============================================================================

-- Chaque compte se fait dans sa propre sous-requête : joindre employés et
-- sites dans la même ligne les multiplierait l'un par l'autre.
select co.name                              as nom_en_base,
       '[' || co.name || ']'                as avec_les_espaces,
       length(co.name)                      as longueur,
       (select count(*) from public.employees e
         where e.company_id = co.id and e.date_sortie is null) as en_poste,
       (select count(*) from public.employees e
         where e.company_id = co.id)                           as employes_total,
       (select count(*) from public.sites s
         where s.company_id = co.id)                           as sites
  from public.companies co
 order by co.name;

-- ─────────────────────────────────────────────────────────────────────────
--  CE QUE VOUS ALLEZ VOIR, ET QUOI FAIRE
--
--  · Une société nommée « GTA », « GROUPE TRIPLE AAA », « Groupe Triple A »
--    ou avec un espace en trop : c'est elle. Renommez-la exactement
--    « GROUPE TRIPLE A », puis relancez IMPORT_2 (il ne fait pas de
--    doublon) et IMPORT_3.
--
--        update public.companies
--           set name = 'GROUPE TRIPLE A'
--         where name = 'LE NOM QUE VOUS VOYEZ';
--
--  · Aucune ligne qui ressemble à Groupe Triple A : la société n'existe
--    pas. Créez-la depuis l'application (Entreprises → Créer), ou :
--
--        insert into public.companies (name) values ('GROUPE TRIPLE A');
--
--    puis relancez IMPORT_2 et IMPORT_3.
--
--  Dans les deux cas, relancez VERIFIER_import.sql pour confirmer.
-- ─────────────────────────────────────────────────────────────────────────
