-- ============================================================================
--  BLOC 22 sur 24 — La date de fin d'un contrat devient obligatoire
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 21.
--
--  Sans date de fin, un contrat n'entre dans aucune alerte : ni bleu à dix
--  jours du terme, ni jaune une fois échu. Il sort du suivi sans le dire.
--
--  Le bloc traite lui-même les contrats incomplets : il leur pose une fin
--  à un an de leur début, puis vous les montre pour que vous corrigiez ce
--  qui doit l'être.
-- ============================================================================

begin;

  -- Ce qu'on va compléter, avant de le faire
  select id, employee_id, date_debut,
         (date_debut + interval '1 year')::date as fin_proposee
    from public.contrats
   where date_fin is null;

  update public.contrats
     set date_fin = (date_debut + interval '1 year')::date
   where date_fin is null;

  alter table public.contrats
    alter column date_fin set not null;

  comment on column public.contrats.date_fin is
    'Obligatoire : c''est elle qui déclenche les alertes de fin de contrat.';

commit;


-- ▶ Les contrats complétés d'office : vérifiez leur date de fin
select c.id, e.nom_prenom, c.date_debut, c.date_fin
  from public.contrats c
  join public.employees e on e.id = c.employee_id
 order by c.created_at desc
 limit 20;
