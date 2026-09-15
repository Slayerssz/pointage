-- ============================================================================
--  VIREMENT SANS BANQUE OU SANS R.I.B.
--  ============================================================
--  Supabase → SQL Editor → coller TOUT → Run.
--  Les personnes payées par virement à qui la banque ne pourra rien
--  envoyer : pas de banque, pas de R.I.B., ou un R.I.B. qui n'a pas
--  ses 24 chiffres. Les versements (Wafacash, etc.) ne sont pas ici.
-- ============================================================================

select c.name           as societe,
       e.matricule,
       e.nom_prenom,
       s.name           as site,
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
   and lower(coalesce(e.mode_reglement, '')) like 'vir%'
   and (nullif(trim(e.banque), '') is null
        or nullif(trim(e.rib), '') is null
        or regexp_replace(e.rib, '\s', '', 'g') !~ '^[0-9]{24}$')
 order by c.name, e.nom_prenom;
