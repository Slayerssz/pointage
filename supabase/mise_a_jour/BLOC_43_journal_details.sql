-- ============================================================================
--  BLOC 43 sur 43 — Le journal dit ce qui a changé
--  ============================================================
--  Supabase → SQL Editor → coller → Run. À exécuter APRÈS le BLOC 42.
--
--  Chaque ligne du journal garde maintenant le relevé de ce qui a bougé
--  — « salaire : 3 046 → 3 200 » — pour tout ce qu'il suit, et plus
--  seulement un renvoi vers la page.
--
--  Les lignes déjà écrites n'ont pas ce détail : il n'a pas été relevé
--  à l'époque. Celles d'après l'auront.
-- ============================================================================

-- ============================================================
-- 059 — Le journal dit ce qui a changé
-- À exécuter après 058_owner_invisible.sql
--
-- Le journal disait qu'une fiche avait été modifiée, et renvoyait à la
-- page. Il ne disait pas QUOI : c'est pourtant tout ce qu'on lui
-- demande. Chaque ligne garde désormais le relevé des colonnes qui ont
-- bougé, avec leur valeur avant et après — pour tout ce qu'il suit, et
-- non pour les seules fiches.
-- ============================================================

alter table public.journal
  add column if not exists details jsonb not null default '[]'::jsonb;

comment on column public.journal.details is
  'Ce qui a changé : [{champ, avant, apres}]. Vide quand le geste n''a pas de détail.';

create or replace function public.journaliser()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auteur text;
  v_avant jsonb;
  v_apres jsonb;
  v_details jsonb;
  v_action text;
  v_resume text;
  v_objet_id uuid;
  v_company uuid;
  v_lien text;
  v_nom text;
begin
  -- Les grands remplissages passent par l'éditeur SQL, sans session. Ils
  -- inscriraient des milliers de lignes qui n'apprennent rien : on ne
  -- journalise que les gestes faits depuis l'application.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  select coalesce(full_name, username) into v_auteur
    from public.profiles where user_id = auth.uid();

  v_action := case tg_op when 'INSERT' then 'ajout'
                         when 'UPDATE' then 'modification'
                         else 'suppression' end;

  if tg_table_name = 'employees' then
    v_objet_id := coalesce(new.id, old.id);
    v_company := coalesce(new.company_id, old.company_id);
    v_nom := coalesce(new.nom_prenom, old.nom_prenom);
    v_lien := 'employes';
    if tg_op = 'INSERT' then
      v_resume := 'a ajouté ' || v_nom || ' au registre';
    elsif tg_op = 'DELETE' then
      v_resume := 'a supprimé la fiche de ' || v_nom;
    elsif old.date_sortie is null and new.date_sortie is not null then
      v_action := 'sortie';
      v_resume := 'a sorti ' || v_nom || ' le ' || to_char(new.date_sortie, 'DD/MM/YYYY');
    elsif old.date_sortie is not null and new.date_sortie is null then
      v_action := 'retour';
      v_resume := 'a réintégré ' || v_nom;
    elsif to_jsonb(old) - 'jours_travailles' - 'actif'
          = to_jsonb(new) - 'jours_travailles' - 'actif' then
      -- Pointer quelqu'un met à jour son compteur de journées. Ce n'est
      -- pas un geste : sans cela, chaque pointage écrirait deux lignes
      -- au journal, dont une qui n'apprend rien.
      return coalesce(new, old);
    else
      v_resume := 'a modifié la fiche de ' || v_nom;
    end if;

  elsif tg_table_name = 'pointages' then
    v_objet_id := coalesce(new.employee_id, old.employee_id);
    v_company := coalesce(new.company_id, old.company_id);
    v_lien := 'validation';
    select nom_prenom into v_nom from public.employees where id = v_objet_id;
    if tg_op = 'INSERT' then
      v_resume := 'a pointé ' || coalesce(v_nom, '?') || ' le '
                  || to_char(new.pointed_on, 'DD/MM/YYYY')
                  || ' (' || coalesce(new.type_garde, '?') || ')';
    elsif tg_op = 'DELETE' then
      v_resume := 'a retiré le pointage de ' || coalesce(v_nom, '?')
                  || ' du ' || to_char(old.pointed_on, 'DD/MM/YYYY');
    elsif coalesce(old.type_garde, '') <> coalesce(new.type_garde, '') then
      v_resume := 'a changé le pointage de ' || coalesce(v_nom, '?')
                  || ' du ' || to_char(new.pointed_on, 'DD/MM/YYYY')
                  || ' : ' || coalesce(old.type_garde, '?') || ' → '
                  || coalesce(new.type_garde, '?');
    else
      return coalesce(new, old);   -- un détail sans intérêt pour le journal
    end if;

  elsif tg_table_name = 'conges' then
    v_objet_id := coalesce(new.employee_id, old.employee_id);
    v_company := coalesce(new.company_id, old.company_id);
    v_lien := 'employes';
    select nom_prenom into v_nom from public.employees where id = v_objet_id;
    v_resume := case tg_op
      when 'INSERT' then 'a posé un congé pour ' || coalesce(v_nom, '?')
                         || ' du ' || to_char(new.date_debut, 'DD/MM')
                         || ' au ' || to_char(new.date_fin, 'DD/MM')
      when 'DELETE' then 'a supprimé le congé de ' || coalesce(v_nom, '?')
      else 'a modifié le congé de ' || coalesce(v_nom, '?') end;

  elsif tg_table_name = 'contrats' then
    v_objet_id := coalesce(new.employee_id, old.employee_id);
    v_company := coalesce(new.company_id, old.company_id);
    v_lien := 'employes';
    select nom_prenom into v_nom from public.employees where id = v_objet_id;
    v_resume := case tg_op
      when 'INSERT' then 'a établi un contrat pour ' || coalesce(v_nom, '?')
      when 'DELETE' then 'a supprimé un contrat de ' || coalesce(v_nom, '?')
      else 'a modifié le contrat de ' || coalesce(v_nom, '?') end;

  elsif tg_table_name = 'periodes_paie' then
    v_objet_id := coalesce(new.id, old.id);
    v_company := coalesce(new.company_id, old.company_id);
    v_lien := 'paie';
    if tg_op = 'UPDATE' and old.statut <> new.statut then
      v_action := 'paie';
      v_resume := 'a fait passer la paie de '
                  || to_char(make_date(new.annee, new.mois, 1), 'MM/YYYY')
                  || ' en « ' || new.statut::text || ' »';
    else
      return coalesce(new, old);
    end if;

  elsif tg_table_name = 'profiles' then
    v_objet_id := coalesce(new.user_id, old.user_id);
    v_lien := 'utilisateurs';
    if tg_op = 'INSERT' then
      v_resume := 'a créé le compte ' || new.username
                  || ' (' || new.role::text || ')';
    elsif tg_op = 'DELETE' then
      v_resume := 'a supprimé le compte ' || old.username;
    elsif old.role <> new.role then
      v_resume := 'a changé le rôle de ' || new.username
                  || ' : ' || old.role::text || ' → ' || new.role::text;
    elsif old.actif <> new.actif then
      v_resume := case when new.actif then 'a réactivé le compte '
                       else 'a désactivé le compte ' end || new.username;
    else
      return coalesce(new, old);
    end if;

  elsif tg_table_name = 'companies' then
    v_objet_id := coalesce(new.id, old.id);
    v_company := coalesce(new.id, old.id);
    v_lien := 'entreprises';
    v_resume := case tg_op
      when 'INSERT' then 'a ajouté la société ' || new.name
      when 'DELETE' then 'a supprimé la société ' || old.name
      else 'a modifié la société ' || new.name end;

  elsif tg_table_name = 'sites' then
    v_objet_id := coalesce(new.id, old.id);
    v_company := coalesce(new.company_id, old.company_id);
    v_lien := 'sites';
    v_resume := case tg_op
      when 'INSERT' then 'a ajouté le site ' || new.name
      when 'DELETE' then 'a supprimé le site ' || old.name
      else 'a modifié le site ' || new.name end;

  else
    return coalesce(new, old);
  end if;

  -- Le détail de ce qui a bougé : une ligne par colonne, avec sa valeur
  -- avant et après. C'est ce que le propriétaire veut lire — « salaire :
  -- 3 046 → 3 200 » — et non le seul fait qu'une fiche a été modifiée.
  --
  -- Un ajout n'a pas d'avant, une suppression pas d'après : on compare
  -- alors à l'objet vide, et la liste dit ce qui est entré ou disparu.
  v_avant := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_apres := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;

  select jsonb_agg(jsonb_build_object('champ', k,
                                      'avant', v_avant -> k,
                                      'apres', v_apres -> k)
                   order by k)
    into v_details
    from jsonb_object_keys(v_avant || v_apres) as t(k)
   where (v_avant -> k) is distinct from (v_apres -> k)
     -- Ni les clés techniques, ni ce que la base tient à jour toute
     -- seule : cela n'apprendrait rien à personne.
     and k <> all (array['id', 'created_at', 'updated_at',
                         'jours_travailles', 'actif'])
     and not (coalesce(v_avant -> k, 'null'::jsonb) = 'null'::jsonb
              and coalesce(v_apres -> k, 'null'::jsonb) = 'null'::jsonb);

  insert into public.journal
    (user_id, auteur, action, objet, objet_id, company_id, resume, lien, details)
  values
    (auth.uid(), coalesce(v_auteur, 'inconnu'), v_action, tg_table_name,
     v_objet_id, v_company, v_resume, v_lien, coalesce(v_details, '[]'::jsonb));

  return coalesce(new, old);
end;
$$;
