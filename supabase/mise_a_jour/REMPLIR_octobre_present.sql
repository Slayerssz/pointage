-- ============================================================================
--  REMPLIR OCTOBRE 2026 — tout le monde présent
--  ============================================================
--  Supabase → SQL Editor → coller TOUT ce fichier → Run. Rien à régler.
--
--  Octobre 2026, et rien d'autre : du 1er au 31, jours à venir compris.
--  Le bureau ne corrige ensuite que les absences.
--
--  Inscrit X (une garde) à chaque employé en poste. N'est JAMAIS touché :
--
--     · le jour de repos hebdomadaire            (reste vide, affiché R)
--     · tout jour déjà marqué : F, C, M, X…      (jamais écrasé)
--     · les jours avant l'embauche ou après la sortie
--     · les employés dont le jour de repos n'est pas renseigné — sans
--       lui, on ne sait pas quel jour épargner, et on leur poserait les
--       31 jours. Ils sont nommés à la fin : renseigner leur repos sur
--       la fiche, puis relancer ce fichier.
--     · les sociétés dont octobre est déjà clôturé — elles sont nommées
--       à la fin, et le reste du groupe passe quand même.
--
--  Relancer ce fichier n'inscrit rien de plus : il ne comble que les
--  trous. C'est ainsi qu'on rattrape les arrivées de la semaine.
--
--  Pour tout retirer : ANNULER_octobre_present.sql.
-- ============================================================================

do $bloc$
declare
  v_debut  date := '2026-10-01';
  v_fin    date := '2026-10-31';   -- ou current_date pour s'arrêter à aujourd'hui
  -- Horodatage de repère : tous ces pointages le portent, et aucun vrai
  -- pointage ne l'aura jamais. C'est ce qui permet de les retirer.
  v_marque timestamptz := '2026-10-01 00:00:00+01';
  v_admin  uuid;
  v_sans   text;
  v_closes text;
  v_emp    int;
  v_jours  int;
begin
  -- Ces journées sont saisies au nom d'un compte d'administration.
  select user_id into v_admin
    from public.profiles
   where actif and role::text in ('admin', 'dev', 'owner')
   order by (role::text <> 'admin'), created_at
   limit 1;
  if v_admin is null then
    raise exception 'Aucun compte administrateur actif.';
  end if;

  -- Ceux dont on ignore le jour de repos : écartés, et nommés.
  select string_agg(nom_prenom, ', ' order by nom_prenom) into v_sans
    from public.employees
   where archive_le is null
     and jour_de_repos is null
     and (date_sortie is null or date_sortie >= v_debut)
     and (date_embauche is null or date_embauche <= v_fin);

  -- Les sociétés dont le mois est clos : écartées, pas bloquantes.
  select string_agg(c.name, ', ' order by c.name) into v_closes
    from public.periodes_paie pp
    join public.companies c on c.id = pp.company_id
   where pp.annee = 2026 and pp.mois = 10 and pp.statut <> 'ouvert';

  perform set_config('app.pointage_manuel', 'on', true);

  -- L'insertion et la mise à jour du compteur dans une seule instruction :
  -- le compteur ne suit que les lignes réellement inscrites à ce passage.
  with inscrits as (
  insert into public.pointages
    (company_id, site_id, employee_id, agent_id, photo_path,
     pointed_at, pointed_on, status, type_garde, validated_by, validated_at)
  select e.company_id, e.site_id, e.id, v_admin, null,
         v_marque, d::date, 'validated', 'X', v_admin, v_marque
    from public.employees e
    cross join generate_series(v_debut, v_fin, interval '1 day') d
   where e.archive_le is null
     -- Sans jour de repos connu, on ne pointe pas : voir l'en-tête.
     and e.jour_de_repos is not null
     and extract(isodow from d)::int <> e.jour_de_repos
     and (e.date_embauche is null or e.date_embauche <= d::date)
     and (e.date_sortie   is null or e.date_sortie   >= d::date)
     and not exists (select 1 from public.periodes_paie pp
                      where pp.company_id = e.company_id
                        and pp.annee = 2026 and pp.mois = 10
                        and pp.statut <> 'ouvert')
     and not exists (select 1 from public.pointages p
                      where p.employee_id = e.id and p.pointed_on = d::date
                        and p.status <> 'refused')
  returning employee_id
  ),
  par_employe as (
    select employee_id, count(*) as n from inscrits group by employee_id
  )
  update public.employees e
     set jours_travailles = jours_travailles + par_employe.n
    from par_employe
   where par_employe.employee_id = e.id;

  get diagnostics v_emp = row_count;
  perform set_config('app.pointage_manuel', 'off', true);

  select count(*) into v_jours
    from public.pointages
   where pointed_at = v_marque and type_garde = 'X';

  raise notice 'Octobre 2026 : % → %.', v_debut, v_fin;
  raise notice '% employé(s) complété(s) à ce passage.', v_emp;
  raise notice '% journée(s) posées au total pour le mois.', v_jours;
  if v_closes is not null then
    raise notice 'Sociétés écartées, octobre déjà clôturé : %.', v_closes;
  end if;
  if v_sans is not null then
    raise notice 'Écartés, jour de repos non renseigné : %.', v_sans;
  end if;
end $bloc$;
