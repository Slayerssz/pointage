-- ============================================================================
--  REMPLIR SEPTEMBRE 2026 — tout le monde présent
--  ============================================================
--  Supabase → SQL Editor → coller TOUT ce fichier → Run. Rien à sélectionner.
--
--  Inscrit X (une garde) à chaque employé en poste, pour chaque jour de
--  septembre — le mois entier, jours à venir compris. Le bureau ne
--  corrige ensuite que les absences.
--
--  N'est jamais touché :
--     · le jour de repos hebdomadaire            (reste vide, affiché R)
--     · tout jour déjà marqué : F, C, M, X…      (jamais écrasé)
--     · les jours avant l'embauche ou après la sortie
--
--  Relancer ce fichier n'inscrit rien de plus. Pour tout retirer :
--  ANNULER_septembre_present.sql.
-- ============================================================================

do $bloc$
declare
  v_debut  date := '2026-09-01';
  v_fin    date := '2026-09-30';   -- ou current_date pour s'arrêter à aujourd'hui
  -- Horodatage de repère : tous ces pointages le portent, et aucun vrai
  -- pointage ne l'aura jamais. C'est ce qui permet de les retirer.
  v_marque timestamptz := '2026-09-01 00:00:00+01';
  v_admin  uuid;
  v_n      int;
begin
  -- Le mois ne doit être clôturé nulle part.
  if exists (select 1 from public.periodes_paie
              where annee = 2026 and mois = 9 and statut <> 'ouvert') then
    raise exception 'Septembre 2026 est déjà clôturé pour au moins une société.';
  end if;

  -- Ces journées sont saisies au nom de l'administrateur.
  select user_id into v_admin
    from public.profiles
   where role = 'admin' and actif
   order by created_at
   limit 1;
  if v_admin is null then
    raise exception 'Aucun compte administrateur actif.';
  end if;

  perform set_config('app.pointage_manuel', 'on', true);

  -- L'insertion et la mise à jour du compteur dans une seule instruction :
  -- le compteur ne suit que les lignes réellement inscrites à ce passage.
  -- Relancer le script n'inscrit rien, donc ne compte rien.
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

  get diagnostics v_n = row_count;
  perform set_config('app.pointage_manuel', 'off', true);

  raise notice '% employé(s) concerné(s).', v_n;
end $bloc$;
