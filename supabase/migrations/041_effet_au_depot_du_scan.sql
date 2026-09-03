-- ============================================================
-- 041 — Une pièce ne produit son effet qu'une fois signée
-- À exécuter après 040_validation_par_scan.sql
--
-- Le bloc précédent posait une étiquette « validé » sans rien changer
-- au fond : un congé du 5 au 9 s'inscrivait au pointage dès sa
-- création, avant même d'être signé. Ce n'était pas le sens voulu.
--
-- Désormais, créer une pièce ne fait que l'enregistrer. C'est le dépôt
-- du scan signé qui la met en vigueur :
--
--   congé   → les jours s'inscrivent alors au pointage
--   sortie  → l'employé quitte alors les listes actives
--   contrat → il compte alors comme le contrat en cours
--
-- Retirer le scan défait exactement cela : les jours repartent, la
-- personne revient en poste, le contrat redevient en attente.
-- ============================================================

-- ---------- 1. Inscrire un congé au pointage, ou l'en retirer ----------

create or replace function public.appliquer_conge(p_conge uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid; v_company uuid; v_site uuid; v_repos smallint;
  v_type text; v_debut date; v_fin date;
  v_jour date; v_n int := 0; v_valeur numeric;
begin
  select g.employee_id, g.company_id, g.type, g.date_debut, g.date_fin,
         e.site_id, e.jour_de_repos
    into v_employee, v_company, v_type, v_debut, v_fin, v_site, v_repos
    from public.conges g
    join public.employees e on e.id = g.employee_id
   where g.id = p_conge;
  if v_employee is null then
    raise exception 'Congé introuvable.';
  end if;

  -- Déjà inscrit : ne rien faire deux fois.
  if exists (select 1 from public.pointages where conge_id = p_conge) then
    return 0;
  end if;

  v_valeur := public.garde_valeur(v_type);
  perform set_config('app.pointage_manuel', 'on', true);

  for v_jour in select generate_series(v_debut, v_fin, interval '1 day')::date loop
    -- Le jour de repos hebdomadaire ne consomme pas de congé.
    if v_repos is not null and extract(isodow from v_jour)::int = v_repos then
      continue;
    end if;
    -- Un jour déjà pointé n'est pas écrasé.
    if exists (select 1 from public.pointages
                where employee_id = v_employee and pointed_on = v_jour
                  and status <> 'refused') then
      continue;
    end if;

    insert into public.pointages
      (company_id, site_id, employee_id, agent_id, photo_path,
       pointed_at, pointed_on, status, type_garde, validated_by, validated_at, conge_id)
    values
      (v_company, v_site, v_employee, auth.uid(), null,
       now(), v_jour, 'validated', v_type, auth.uid(), now(), p_conge);
    v_n := v_n + 1;
  end loop;

  perform set_config('app.pointage_manuel', 'off', true);

  update public.conges set jours = v_n where id = p_conge;
  if v_valeur > 0 then
    update public.employees
       set jours_travailles = jours_travailles + (v_n * v_valeur)
     where id = v_employee;
  end if;

  return v_n;
end;
$$;

create or replace function public.retirer_conge_du_pointage(p_conge uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid; v_type text; v_n int;
begin
  select employee_id, type into v_employee, v_type
    from public.conges where id = p_conge;
  if v_employee is null then
    return 0;
  end if;

  delete from public.pointages where conge_id = p_conge;
  get diagnostics v_n = row_count;

  update public.employees
     set jours_travailles = greatest(0, jours_travailles - (v_n * public.garde_valeur(v_type)))
   where id = v_employee;

  update public.conges set jours = 0 where id = p_conge;
  return v_n;
end;
$$;

-- ---------- 2. Créer un congé ne l'inscrit plus au pointage ----------

create or replace function public.creer_conge(
  p_employee_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_type text default 'C',
  p_motif text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_conge uuid;
begin
  perform public.exiger_role('validator', 'admin');

  if coalesce(p_type, '') not in ('C', 'M') then
    raise exception 'Type de congé invalide.';
  end if;
  if p_date_fin < p_date_debut then
    raise exception 'La date de fin doit être après la date de début.';
  end if;
  if p_date_fin - p_date_debut > 365 then
    raise exception 'Période trop longue (365 jours maximum).';
  end if;

  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Employé introuvable.';
  end if;

  perform public.assert_mois_ouvert(v_company, p_date_debut);
  perform public.assert_mois_ouvert(v_company, p_date_fin);

  -- Deux congés ne peuvent pas se chevaucher, signés ou non.
  if exists (select 1 from public.conges g
              where g.employee_id = p_employee_id
                and g.date_debut <= p_date_fin
                and g.date_fin  >= p_date_debut) then
    raise exception 'Cette période chevauche un congé déjà enregistré.';
  end if;

  insert into public.conges
    (company_id, employee_id, type, date_debut, date_fin, motif, jours, created_by)
  values (v_company, p_employee_id, p_type, p_date_debut, p_date_fin,
          nullif(trim(coalesce(p_motif, '')), ''), 0, auth.uid())
  returning id into v_conge;

  -- Le congé est enregistré, pas encore en vigueur : les jours ne
  -- s'inscriront au pointage qu'au dépôt de l'engagement signé.
  return v_conge;
end;
$$;

-- ---------- 3. Le dépôt du scan met la pièce en vigueur ----------

create or replace function public.documents_maj_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contrat uuid := coalesce(new.contrat_id, old.contrat_id);
  v_conge   uuid := coalesce(new.conge_id, old.conge_id);
  v_sortie  uuid := coalesce(new.sortie_id, old.sortie_id);
  v_signe   boolean;
  v_employee uuid;
  v_date date;
begin
  -- ── Contrat : il compte comme contrat en cours une fois signé.
  if v_contrat is not null then
    v_signe := exists (select 1 from public.documents d
                        where d.contrat_id = v_contrat and d.type = 'contrat');
    update public.contrats c
       set valide_le = case when v_signe then coalesce(c.valide_le, now()) else null end
     where c.id = v_contrat;
  end if;

  -- ── Congé : ses jours s'inscrivent au pointage, ou en repartent.
  if v_conge is not null then
    v_signe := exists (select 1 from public.documents d
                        where d.conge_id = v_conge and d.type = 'engagement');
    if v_signe then
      update public.conges set valide_le = coalesce(valide_le, now()) where id = v_conge;
      perform public.appliquer_conge(v_conge);
    else
      perform public.retirer_conge_du_pointage(v_conge);
      update public.conges set valide_le = null where id = v_conge;
    end if;
  end if;

  -- ── Sortie : l'employé quitte les listes, ou y revient.
  if v_sortie is not null then
    v_signe := exists (select 1 from public.documents d
                        where d.sortie_id = v_sortie and d.type = 'sortie');
    select employee_id, date_sortie into v_employee, v_date
      from public.sorties where id = v_sortie;

    if v_signe then
      update public.sorties
         set valide = true, valide_le = coalesce(valide_le, now())
       where id = v_sortie;
      update public.employees set date_sortie = v_date where id = v_employee;
    else
      update public.sorties
         set valide = false, valide_le = null, valide_par = null
       where id = v_sortie;
      -- Une fiche déjà archivée en fin de mois ne remonte pas toute seule :
      -- l'administrateur la sortira des archives s'il le faut.
      update public.employees set date_sortie = null
       where id = v_employee and archive_le is null;
    end if;
  end if;

  return null;
end;
$$;

-- ---------- 4. La validation manuelle d'une sortie disparaît ----------

-- Le scan vaut validation : rien à cliquer. La fonction reste, pour ne
-- pas casser un appel resté quelque part, mais elle ne fait que
-- constater ce que le dépôt a déjà fait.
create or replace function public.valider_sortie(p_sortie uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exiger_role('admin', 'validator');

  if not exists (select 1 from public.documents d
                  where d.sortie_id = p_sortie and d.type = 'sortie') then
    raise exception
      'Le reçu signé n''a pas encore été déposé : la sortie n''est pas validée.';
  end if;
  -- Le déclencheur a déjà tout fait au moment du dépôt.
end;
$$;

-- ---------- 5. Un contrat non signé n'est pas le contrat en cours ----------

create or replace view public.contrats_courants as
select distinct on (c.employee_id)
  c.id, c.employee_id, c.company_id, c.numero, c.type_contrat,
  c.date_debut, c.date_fin, c.poste, c.salaire_mensuel,
  public.contrat_statut(c.date_debut, c.date_fin) as statut,
  case when c.date_fin is null then null
       else (c.date_fin - current_date)::int end as jours_restants
from public.contrats c
where not c.archive
  and c.valide_le is not null      -- signé, donc en vigueur
order by c.employee_id, c.date_debut desc;

revoke all on function public.valider_sortie(uuid) from public;
grant execute on function public.valider_sortie(uuid) to authenticated;
