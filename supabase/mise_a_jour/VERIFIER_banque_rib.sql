-- ============================================================================
--  QUI EST PAYÉ PAR VIREMENT OU VERSEMENT SANS BANQUE OU SANS R.I.B. ?
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--
--  L'ordre de virement et la liste des versements ont besoin des deux :
--  la banque pour regrouper, le R.I.B. pour payer. Voici chaque personne
--  à qui il manque l'un ou l'autre — ou dont le R.I.B. n'a pas la bonne
--  longueur (24 chiffres au Maroc).
-- ============================================================================

select c.name           as societe,
       e.matricule,
       e.nom_prenom,
       s.name           as site,
       e.mode_reglement as mode,
       coalesce(e.banque, '—') as banque,
       coalesce(e.rib, '—')    as rib,
       concat_ws(' + ',
         case when nullif(trim(e.banque), '') is null then 'BANQUE MANQUANTE' end,
         case when nullif(trim(e.rib), '') is null then 'R.I.B. MANQUANT'
              when regexp_replace(e.rib, '\s', '', 'g') !~ '^[0-9]{24}$'
                then 'R.I.B. INVALIDE (' || length(regexp_replace(e.rib, '\s', '', 'g')) || ' caractères)'
         end
       ) as probleme
  from public.employees e
  join public.companies c on c.id = e.company_id
  left join public.sites s on s.id = e.site_id
 where e.archive_le is null
   and e.date_sortie is null
   and (lower(coalesce(e.mode_reglement, '')) like 'vir%'
        or lower(coalesce(e.mode_reglement, '')) like 'vers%')
   and (nullif(trim(e.banque), '') is null
        or nullif(trim(e.rib), '') is null
        or regexp_replace(e.rib, '\s', '', 'g') !~ '^[0-9]{24}$')
 order by c.name, e.mode_reglement, e.nom_prenom;
