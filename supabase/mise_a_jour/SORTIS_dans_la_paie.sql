-- ============================================================================
--  QUI EST SORTI, ET QUE FAIT-IL ENCORE DANS LA PAIE ?
--  ============================================================
--  Supabase → SQL Editor → coller → Run. Ne modifie rien : il regarde.
--
--  Après la correction, quelqu'un reste dans la paie d'un mois s'il y a
--  travaillé — c'est normal, il faut bien le payer pour ces jours-là.
--  Ce qui ne l'est pas, c'est une date de sortie fausse : ceux qu'on a
--  marqués avant la mise à jour portent la date du jour, et non celle de
--  leur vrai départ. Ils paraissent donc dans le mois en cours alors
--  qu'ils sont partis depuis longtemps.
--
--  La colonne « à corriger ? » les désigne : une sortie posée
--  aujourd'hui, ou hier, pour quelqu'un qui n'a plus rien fait depuis
--  des semaines. Corrigez la date dans l'onglet Sorties, bouton
--  « Modifier la date » : la paie se refait toute seule ensuite.
-- ============================================================================

select
  c.name                                   as societe,
  e.matricule,
  e.nom_prenom,
  e.date_sortie,
  -- Le dernier jour réellement pointé : si l'écart avec la date de
  -- sortie est grand, la date est à revoir.
  (select max(p.pointed_on) from public.pointages p
    where p.employee_id = e.id and p.status = 'validated') as dernier_pointage,
  case
    when e.date_sortie is null then ''
    when e.date_sortie - (select coalesce(max(p.pointed_on), e.date_sortie)
                            from public.pointages p
                           where p.employee_id = e.id and p.status = 'validated'
                             and p.pointed_on <= e.date_sortie) > 7
      then '⚠ à corriger'
    else ''
  end                                      as a_corriger,
  -- Les mois où il figure encore, et ce qu'on lui y paie.
  coalesce(string_agg(
    lpad(pp.mois::text, 2, '0') || '/' || pp.annee
      || ' : ' || lp.jours_payes || ' j, ' || lp.net_a_payer || ' DH'
      || case when pp.statut::text = 'paie_validee' then ' (validée)' else '' end,
    '  ·  ' order by pp.annee, pp.mois), '—') as dans_la_paie
from public.employees e
join public.companies c on c.id = e.company_id
left join public.lignes_paie lp on lp.employee_id = e.id
left join public.periodes_paie pp on pp.id = lp.periode_id
where e.date_sortie is not null
  and e.archive_le is null
group by c.name, e.id, e.matricule, e.nom_prenom, e.date_sortie
order by c.name, e.date_sortie desc, e.nom_prenom;
