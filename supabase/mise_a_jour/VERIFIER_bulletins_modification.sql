-- ============================================================================
--  POURQUOI UNE MODIFICATION DE BULLETIN RESTE « DEMANDÉE »
--  ============================================================
--  Supabase → SQL Editor → coller → Run. Ne change rien, regarde.
--
--  Autoriser une modification lève un drapeau sur le bulletin. Si
--  l'écran continue d'afficher « modification demandée », c'est que le
--  drapeau n'a pas été levé — et il n'y a que deux raisons possibles :
--  la fonction installée n'est pas la bonne, ou l'autorisation n'a pas
--  été enregistrée.
--
--  Les deux résultats ci-dessous répondent à l'une et à l'autre.
-- ============================================================================

-- 1. La fonction installée est-elle celle qui lève le drapeau ? -------------

select
  'repondre_modification_bulletin' as fonction,
  case
    when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public'
                        and p.proname = 'repondre_modification_bulletin')
      then '⚠ ABSENTE — relancer le BLOC 37'
    when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public'
                    and p.proname = 'repondre_modification_bulletin'
                    and pg_get_functiondef(p.oid) like '%modification_autorisee = true%')
      then 'à jour'
    else '⚠ ANCIENNE VERSION — relancer le BLOC 37'
  end as etat;

-- 2. Où en est chaque bulletin ? --------------------------------------------
--  · « en attente »   : la paie a demandé, l'administrateur n'a pas répondu
--  · « autorisée »    : le drapeau est levé, la paie peut refaire le bulletin
--  · « rien »         : aucune demande en cours

select
  c.name                                            as societe,
  lpad(b.mois::text, 2, '0') || '/' || b.annee      as mois,
  b.matricule,
  b.nom_prenom,
  b.net_a_payer,
  case
    when b.modification_autorisee            then 'autorisée'
    when b.modification_demandee_le is not null then 'en attente'
    else 'rien'
  end                                               as modification,
  b.modification_motif                              as motif,
  b.modification_demandee_le                        as demandee_le,
  b.cree_le                                         as etabli_le
from public.bulletins_emis b
join public.companies c on c.id = b.company_id
where b.modification_demandee_le is not null
   or b.modification_autorisee
order by b.annee desc, b.mois desc, c.name, b.nom_prenom;
