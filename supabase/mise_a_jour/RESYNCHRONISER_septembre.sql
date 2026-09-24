-- ============================================================================
--  REMETTRE SEPTEMBRE D'APLOMB
--  ============================================================
--  Supabase → SQL Editor. Lisez le 1 avant de lancer le 2.
--
--  Le problème : certains affichent 30 jours travaillés alors qu'ils en
--  ont 26 et quatre jours de repos. Le repos est payé, mais il ne se
--  compte pas comme un jour travaillé.
--
--  La cause : le remplissage de septembre a posé un X à tout le monde,
--  tous les jours. Le script RETIRER_X_jours_de_repos a nettoyé ceux qui
--  avaient un jour de repos sur leur fiche — mais ceux qui n'en ont
--  toujours pas gardent leurs 30 X, faute de savoir quel jour retirer.
--
--  Ce script fait trois choses, dans cet ordre :
--     · il complète les journées manquantes (nouveaux employés, etc.) ;
--     · il retire les X tombant sur un jour de repos ;
--     · il RECALCULE le compteur « jours travaillés » d'après les
--       pointages réels — ce qui répare aussi les écarts anciens.
--
--  Le repos ne devient jamais une ligne : il n'y a rien à cette date, et
--  la grille l'affiche R.
--
--  Ne touche pas : congés, maladies, fériés, ni rien de saisi à la main.
--
--  Une fiche sans jour de repos est remplie comme les autres, tous les
--  jours du mois : faute de repos déclaré, rien ne dit quel jour retirer.
--  Le bureau corrige ces cas-là à la main.
-- ============================================================================


-- ▶ 1. QUI N'A PAS DE JOUR DE REPOS ? Rien n'est écrit.
--    Tant qu'une fiche n'en a pas, ses dimanches resteront comptés.
--    Sélectionnez ces lignes seules, puis Run.

select c.name as societe,
       count(*) filter (where e.jour_de_repos is null) as sans_jour_de_repos,
       count(*)                                        as employes
  from public.employees e
  join public.companies c on c.id = e.company_id
 where e.archive_le is null and e.date_sortie is null
 group by c.name
 having count(*) filter (where e.jour_de_repos is null) > 0
 order by 2 desc;


-- ▶ 2. LA REMISE D'APLOMB — sélectionnez de « do $bloc$ » à « end $bloc$; ».

do $bloc$
declare
  v_debut date := '2026-09-01';
  v_fin   date := '2026-09-30';
  v_marque timestamptz := '2026-09-01 00:00:00+01';
  v_admin uuid;
  v_n int;
begin
  if exists (select 1 from public.periodes_paie
              where annee = 2026 and mois = 9 and statut = 'paie_validee') then
    raise exception 'Septembre est déjà validé pour au moins une société : rien ne doit plus y bouger.';
  end if;

  select user_id into v_admin from public.profiles
   where role = 'admin' and actif order by created_at limit 1;
  if v_admin is null then
    raise exception 'Aucun compte administrateur actif.';
  end if;

  perform set_config('app.pointage_manuel', 'on', true);

  -- a) Les jours de repos ne se pointent pas.
  delete from public.pointages p
   using public.employees e
   where e.id = p.employee_id
     and p.pointed_at = v_marque
     and p.type_garde = 'X'
     and e.jour_de_repos is not null
     and extract(isodow from p.pointed_on)::int = e.jour_de_repos;
  get diagnostics v_n = row_count;
  raise notice '% journée(s) de repos retirée(s).', v_n;

  -- b) Les journées manquantes sont posées — sans écraser quoi que ce soit.
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
     and not (e.jour_de_repos is not null
              and extract(isodow from d)::int = e.jour_de_repos)
     and not exists (select 1 from public.pointages p
                      where p.employee_id = e.id and p.pointed_on = d::date
                        and p.status <> 'refused');
  get diagnostics v_n = row_count;
  raise notice '% journée(s) ajoutée(s).', v_n;

  perform set_config('app.pointage_manuel', 'off', true);

  -- c) Le compteur se recalcule d'après les pointages, sans exception :
  --    c'est lui la source des écarts, et il vaut mieux le refaire que
  --    le corriger par petites touches.
  update public.employees e
     set jours_travailles = coalesce((
           select sum(public.garde_valeur(p.type_garde))
             from public.pointages p
            where p.employee_id = e.id and p.status = 'validated'), 0);
  get diagnostics v_n = row_count;
  raise notice 'Compteur recalculé pour % fiche(s).', v_n;
end $bloc$;


-- ▶ 3. CONTRÔLE — le compte de septembre, société par société.
--    « travailles » ne doit plus jamais dépasser 30 moins les repos.

-- select c.name as societe,
--        round(avg(x.jours), 1) as moyenne_jours_travailles,
--        min(x.jours) as mini, max(x.jours) as maxi
--   from public.employees e
--   join public.companies c on c.id = e.company_id
--   join lateral (select count(*) as jours from public.pointages p
--                  where p.employee_id = e.id and p.type_garde = 'X'
--                    and p.pointed_on between '2026-09-01' and '2026-09-30') x on true
--  where e.archive_le is null and e.date_sortie is null
--  group by c.name order by c.name;
