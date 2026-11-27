-- ============================================================
-- BLOC 58 — Un employé déjà enregistré devient remplaçant en deux clics
-- À exécuter après le BLOC 57. Une instruction à la fois.
--
-- Le plus souvent, le remplaçant n'est pas un inconnu : c'est un agent
-- du groupe qui va tenir un autre poste. Tout est déjà saisi — son nom,
-- sa C.I.N., sa C.N.S.S., son R.I.B. — et on le retapait à la main dans
-- la fiche de remplaçant, avec les fautes que cela suppose.
--
-- On le reprend donc tel quel. Il RESTE dans son site : il n'est pas
-- déplacé, pas retiré, pas dédoublé. Sa fiche de remplaçant est une
-- seconde casquette, pas un transfert — et c'est elle qui portera les
-- journées qu'il couvre ailleurs.
--
-- Les notes quittent la fiche de remplaçant : un champ libre que
-- personne ne relit n'a pas sa place sur un papier qu'on imprime. La
-- provenance des fiches reprises des anciens sites « REMPLACEMENT »
-- reste lisible dans la table de sauvegarde du transfert.
-- ============================================================

-- 1. Les notes s'en vont -------------------------------------------------------

alter table public.remplacants drop column if exists notes;

create or replace function public.enregistrer_remplacant(
  p_id uuid,
  p_fiche jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nom text := trim(coalesce(p_fiche ->> 'nom_prenom', ''));
begin
  perform public.exiger_role('validator', 'admin', 'rh');
  if v_nom = '' then
    raise exception 'Le nom est obligatoire.';
  end if;

  if p_id is null then
    insert into public.remplacants (
      nom_prenom, cin, cnss, date_naissance, telephone, adresse, ville,
      qualification, departement, mode_reglement, banque, rib,
      tarif_journalier, cree_par)
    values (
      v_nom,
      nullif(p_fiche ->> 'cin', ''),
      nullif(p_fiche ->> 'cnss', ''),
      (nullif(p_fiche ->> 'date_naissance', ''))::date,
      nullif(p_fiche ->> 'telephone', ''),
      nullif(p_fiche ->> 'adresse', ''),
      nullif(p_fiche ->> 'ville', ''),
      nullif(p_fiche ->> 'qualification', ''),
      nullif(p_fiche ->> 'departement', ''),
      nullif(p_fiche ->> 'mode_reglement', ''),
      nullif(p_fiche ->> 'banque', ''),
      nullif(p_fiche ->> 'rib', ''),
      (nullif(p_fiche ->> 'tarif_journalier', ''))::numeric,
      auth.uid())
    returning id into v_id;
  else
    update public.remplacants set
      nom_prenom = v_nom,
      cin = nullif(p_fiche ->> 'cin', ''),
      cnss = nullif(p_fiche ->> 'cnss', ''),
      date_naissance = (nullif(p_fiche ->> 'date_naissance', ''))::date,
      telephone = nullif(p_fiche ->> 'telephone', ''),
      adresse = nullif(p_fiche ->> 'adresse', ''),
      ville = nullif(p_fiche ->> 'ville', ''),
      qualification = nullif(p_fiche ->> 'qualification', ''),
      departement = nullif(p_fiche ->> 'departement', ''),
      mode_reglement = nullif(p_fiche ->> 'mode_reglement', ''),
      banque = nullif(p_fiche ->> 'banque', ''),
      rib = nullif(p_fiche ->> 'rib', ''),
      tarif_journalier = (nullif(p_fiche ->> 'tarif_journalier', ''))::numeric,
      actif = coalesce((p_fiche ->> 'actif')::boolean, actif)
     where id = p_id
     returning id into v_id;
    if v_id is null then
      raise exception 'Remplaçant introuvable.';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.enregistrer_remplacant(uuid, jsonb) from public;
grant execute on function public.enregistrer_remplacant(uuid, jsonb) to authenticated;

-- 2. Chercher parmi TOUS les employés du groupe -------------------------------
--  Les règles de lecture cloisonnent les employés par société, et c'est
--  bien ainsi. Mais choisir un remplaçant, c'est regarder le groupe
--  entier : cette fonction-là voit tout le monde, en lecture seule, et
--  ne rend que le nécessaire — de quoi reconnaître quelqu'un.

create or replace function public.employes_pour_remplacant(
  p_recherche text default null,
  p_limite integer default 50
)
returns table (
  employee_id uuid,
  nom_prenom text,
  matricule integer,
  qualification text,
  societe text,
  site text,
  deja_remplacant boolean
)
language sql
security definer
set search_path = public
as $$
  select e.id,
         e.nom_prenom,
         e.matricule,
         e.qualification,
         c.name,
         s.name,
         exists (select 1 from public.remplacants r
                  where r.archive_le is null
                    and (upper(trim(r.nom_prenom)) = upper(trim(e.nom_prenom))
                      or (r.cin is not null and e.cin is not null
                          and upper(trim(r.cin)) = upper(trim(e.cin)))))
    from public.employees e
    join public.companies c on c.id = e.company_id
    left join public.sites s on s.id = e.site_id
   where public.peut_gerer_employes()
     and e.archive_le is null
     and e.actif
     and (coalesce(trim(p_recherche), '') = ''
       or e.nom_prenom ilike '%' || trim(p_recherche) || '%'
       or coalesce(e.matricule::text, '') like trim(p_recherche) || '%'
       or coalesce(upper(e.cin), '') like upper(trim(p_recherche)) || '%')
   order by e.nom_prenom
   limit greatest(1, least(coalesce(p_limite, 50), 200));
$$;

revoke all on function public.employes_pour_remplacant(text, integer) from public;
grant execute on function public.employes_pour_remplacant(text, integer) to authenticated;

-- 3. Le reprendre comme remplaçant --------------------------------------------
--  On en passe plusieurs d'un coup : la réponse dit, pour chacun, ce qui
--  a été fait. Un doublon n'est pas une erreur qui arrête tout — c'est
--  une ligne qui dit « déjà remplaçant ».

create or replace function public.remplacant_depuis_employe(p_employees uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resultat jsonb := '[]'::jsonb;
  v_emp record;
  v_existant uuid;
  v_id uuid;
begin
  perform public.exiger_role('validator', 'admin', 'rh');
  if p_employees is null or array_length(p_employees, 1) is null then
    raise exception 'Choisissez au moins une personne.';
  end if;

  for v_emp in
    select e.*, c.name as societe
      from public.employees e
      join public.companies c on c.id = e.company_id
     where e.id = any (p_employees)
     order by e.nom_prenom
  loop
    -- Déjà remplaçant ? Même nom, ou même C.I.N. : on ne crée pas une
    -- seconde fiche pour la même personne.
    select r.id into v_existant
      from public.remplacants r
     where r.archive_le is null
       and (upper(trim(r.nom_prenom)) = upper(trim(v_emp.nom_prenom))
         or (r.cin is not null and v_emp.cin is not null
             and upper(trim(r.cin)) = upper(trim(v_emp.cin))))
     limit 1;

    if v_existant is not null then
      v_resultat := v_resultat || jsonb_build_object(
        'employee_id', v_emp.id, 'nom', v_emp.nom_prenom,
        'remplacant_id', v_existant, 'etat', 'deja');
      continue;
    end if;

    insert into public.remplacants (
      nom_prenom, cin, cnss, date_naissance, telephone, adresse, ville,
      qualification, departement, mode_reglement, banque, rib, cree_par)
    values (
      trim(v_emp.nom_prenom), v_emp.cin, v_emp.cnss, v_emp.date_naissance,
      v_emp.telephone, v_emp.adresse, v_emp.ville, v_emp.qualification,
      v_emp.departement, v_emp.mode_reglement, v_emp.banque, v_emp.rib,
      auth.uid())
    returning id into v_id;

    v_resultat := v_resultat || jsonb_build_object(
      'employee_id', v_emp.id, 'nom', v_emp.nom_prenom,
      'remplacant_id', v_id, 'etat', 'cree');
  end loop;

  return v_resultat;
end;
$$;

revoke all on function public.remplacant_depuis_employe(uuid[]) from public;
grant execute on function public.remplacant_depuis_employe(uuid[]) to authenticated;
