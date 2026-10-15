-- ============================================================================
--  REMPLIR LE MOIS EN COURS — tout le monde présent
--  ============================================================
--  Supabase → SQL Editor → coller TOUT ce fichier → Run. Rien à régler.
--
--  Le fichier trouve lui-même le mois courant (heure de Casablanca) : il
--  n'y a pas de date à changer, et il reste bon le mois prochain.
--
--  Inscrit X (une garde) à chaque employé en poste, pour chaque jour du
--  mois — jours à venir compris. Le bureau ne corrige ensuite que les
--  absences.
--
--  N'est jamais touché :
--     · le jour de repos hebdomadaire            (reste vide, affiché R)
--     · tout jour déjà marqué : F, C, M, X…      (jamais écrasé)
--     · les jours avant l'embauche ou après la sortie
--     · les sociétés dont le mois est déjà clôturé (elles sont nommées
--       à la fin, et le reste du groupe passe quand même)
--
--  Relancer ce fichier n'inscrit rien de plus : il ne comble que les
--  trous. C'est ainsi qu'on rattrape les arrivées de la semaine.
--
--  Pour tout retirer : ANNULER_octobre_present.sql (même repère).
-- ============================================================================

do $bloc$
declare
  v_today  date := (now() at time zone 'Africa/Casablanca')::date;
  v_debut  date := date_trunc('month', v_today)::date;
  v_fin    date := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  -- Mettre v_today à la place de v_fin pour s'arrêter à aujourd'hui :
  -- v_fin := v_today;
  --
  -- Horodatage de repère : tous ces pointages le portent, et aucun vrai
  -- pointage ne l'aura jamais. C'est ce qui permet de les retirer.
  v_marque timestamptz := (v_debut::timestamp at time zone 'Africa/Casablanca');
  v_admin  uuid;
  v_closes text;
  v_emp    int;
  v_jours  int;
begin
  -- Les journées sont saisies au nom d'un compte d'administration.
  select user_id into v_admin
    from public.profiles
   where actif and role::text in ('admin', 'dev', 'owner')
   order by (role::text <> 'admin'), created_at
   limit 1;
  if v_admin is null then
    raise exception 'Aucun compte administrateur actif.';
  end if;

  -- Les sociétés dont le mois est clos sont écartées, pas bloquantes.
  select string_agg(c.name, ', ' order by c.name) into v_closes
    from public.periodes_paie pp
    join public.companies c on c.id = pp.company_id
   where pp.annee = extract(year from v_debut)::int
     and pp.mois  = extract(month from v_debut)::int
     and pp.statut <> 'ouvert';

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
     and (e.date_embauche is null or e.date_embauche <= d::date)
     and (e.date_sortie   is null or e.date_sortie   >= d::date)
     and not (e.jour_de_repos is not null and extract(isodow from d)::int = e.jour_de_repos)
     and not exists (select 1 from public.periodes_paie pp
                      where pp.company_id = e.company_id
                        and pp.annee = extract(year from d)::int
                        and pp.mois  = extract(month from d)::int
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

  raise notice 'Mois rempli : % → %.', v_debut, v_fin;
  raise notice '% employé(s) complété(s) à ce passage.', v_emp;
  raise notice '% journée(s) posées au total pour ce mois.', v_jours;
  if v_closes is not null then
    raise notice 'Écartées, mois déjà clôturé : %.', v_closes;
  end if;
end $bloc$;
