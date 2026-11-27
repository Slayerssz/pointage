import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Employee, Pointage, Site, SitePrincipal } from './types'

export const SITE_EMPLOYEES_PAGE = 100

/** Sites d'une entreprise. `pointageOnly` : uniquement ceux qui se pointent
 *  (exclut par exemple SUPERVISEUR). */
export function useSites(companyId: string | undefined, opts?: { pointageOnly?: boolean }) {
  const pointageOnly = opts?.pointageOnly ?? false
  return useQuery({
    queryKey: ['sites', companyId, pointageOnly],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<Site[]> => {
      let query = supabase
        .from('sites')
        .select('id, company_id, name, pointage_actif, site_principal_id')
        .eq('company_id', companyId!)
        .order('name')
      if (pointageOnly) query = query.eq('pointage_actif', true)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

/** Les sites principaux d'une entreprise. */
export function useSitesPrincipaux(companyId: string | undefined) {
  return useQuery({
    queryKey: ['sites-principaux', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<SitePrincipal[]> => {
      const { data, error } = await supabase
        .from('sites_principaux')
        .select('id, company_id, name')
        .eq('company_id', companyId!)
        .order('name')
      if (error) throw error
      return data as SitePrincipal[]
    },
  })
}

/** Tous les sites de toutes les sociétés — pour la vue « toutes les
 *  entreprises », où un employé peut venir de n'importe laquelle. */
export function useTousLesSites(enabled: boolean) {
  return useQuery({
    queryKey: ['sites', 'toutes'],
    enabled,
    queryFn: async (): Promise<Site[]> => {
      const { data, error } = await supabase
        .from('sites')
        .select('id, company_id, name, pointage_actif, site_principal_id')
        .order('name')
      if (error) throw error
      return data as Site[]
    },
  })
}

export type SiteEmployee = Pick<
  Employee,
  'id' | 'nom_prenom' | 'matricule' | 'qualification' | 'jour_de_repos'
  // La date de sortie fait partie de la case : au-delà, le jour n'est
  // plus à cette personne, et le menu propose d'annuler sa sortie.
  | 'date_sortie' | 'site_id'
>

/** Employés d'un site, chargés par pages de 100 (à l'ouverture de l'accordéon). */
/**
 * Les employés d'un site, pour le pointage.
 *
 * `depuis` est le premier jour de la période affichée. Quelqu'un qui est
 * parti depuis reste visible sur les semaines qu'il a travaillées : son
 * pointage de l'époque ne doit pas disparaître avec lui. Sans date, on
 * ne montre que ceux qui sont encore là.
 */
export function useSiteEmployees(
  siteId: string,
  enabled: boolean,
  opts?: { depuis?: string },
) {
  const depuis = opts?.depuis ?? null
  return useInfiniteQuery({
    queryKey: ['site-employees', siteId, depuis],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<SiteEmployee[]> => {
      const from = pageParam * SITE_EMPLOYEES_PAGE
      let requete = supabase
        .from('employees')
        .select('id, nom_prenom, matricule, qualification, jour_de_repos, date_sortie, site_id')
        .eq('site_id', siteId)
        .is('archive_le', null)
      requete = depuis
        ? requete.or(`date_sortie.is.null,date_sortie.gte.${depuis}`)
        : requete.eq('actif', true)
      const { data, error } = await requete
        .order('matricule', { ascending: true, nullsFirst: false })
        .range(from, from + SITE_EMPLOYEES_PAGE - 1)
      if (error) throw error
      return data
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === SITE_EMPLOYEES_PAGE ? pages.length : undefined,
  })
}

/**
 * Tous les employés d'un site, d'un coup.
 *
 * La grille du mois ne pagine pas : on voit l'équipe entière, du
 * premier au dernier jour. Un site compte quelques dizaines de
 * personnes — les charger toutes coûte moins qu'un bouton « afficher
 * plus » au milieu d'un tableau qu'on parcourt des yeux.
 *
 * La fiche entière est ramenée, et non trois colonnes : on l'ouvre
 * d'un clic sur le nom, et on la modifie sans aller la chercher.
 */
export function useSiteEmployesTous(
  siteId: string | undefined,
  enabled: boolean,
  opts?: { depuis?: string },
) {
  const depuis = opts?.depuis ?? null
  return useQuery({
    queryKey: ['site-employes-tous', siteId, depuis],
    enabled: enabled && Boolean(siteId),
    queryFn: async (): Promise<Employee[]> => {
      let requete = supabase
        .from('employees')
        .select('*')
        .eq('site_id', siteId!)
        .is('archive_le', null)
      requete = depuis
        ? requete.or(`date_sortie.is.null,date_sortie.gte.${depuis}`)
        : requete.eq('actif', true)
      const { data, error } = await requete
        .order('nom_prenom', { ascending: true })
      if (error) throw error
      return data as Employee[]
    },
  })
}

/**
 * Tous les employés d'un ENSEMBLE d'annexes, d'un coup.
 *
 * La grille s'ouvre désormais sur un site principal, et montre tout
 * son monde — annexes confondues. On passe donc la liste des annexes
 * plutôt qu'une seule : un site principal sans subdivision n'en a
 * qu'une, et cela marche pareil.
 */
export function useEmployesDesAnnexes(
  siteIds: string[],
  enabled: boolean,
  opts?: { depuis?: string },
) {
  const depuis = opts?.depuis ?? null
  const cle = [...siteIds].sort().join(',')
  return useQuery({
    queryKey: ['employes-des-annexes', cle, depuis],
    enabled: enabled && siteIds.length > 0,
    queryFn: async (): Promise<Employee[]> => {
      let requete = supabase
        .from('employees')
        .select('*')
        .in('site_id', siteIds)
        .is('archive_le', null)
      requete = depuis
        ? requete.or(`date_sortie.is.null,date_sortie.gte.${depuis}`)
        : requete.eq('actif', true)
      const { data, error } = await requete.order('nom_prenom', { ascending: true })
      if (error) throw error
      return data as Employee[]
    },
  })
}

/** Les pointages d'un ensemble d'annexes, sur une période. */
export function usePointagesDesAnnexes(
  siteIds: string[],
  debut: string,
  fin: string,
  enabled: boolean,
) {
  const cle = [...siteIds].sort().join(',')
  return useQuery({
    queryKey: ['pointages-des-annexes', cle, debut, fin],
    enabled: enabled && siteIds.length > 0,
    queryFn: async (): Promise<Map<string, Map<string, DayPointage>>> => {
      const { data, error } = await supabase
        .from('pointages')
        .select('id, employee_id, status, photo_path, pointed_at, pointed_on, type_garde, conge_id')
        .in('site_id', siteIds)
        .gte('pointed_on', debut)
        .lte('pointed_on', fin)
        .order('pointed_at', { ascending: false })
      if (error) throw error
      const map = new Map<string, Map<string, DayPointage>>()
      for (const p of data) {
        let days = map.get(p.employee_id)
        if (!days) { days = new Map(); map.set(p.employee_id, days) }
        if (!days.has(p.pointed_on)) days.set(p.pointed_on, p)
      }
      return map
    },
  })
}

/** Les remplaçants du groupe : la même liste depuis n'importe quel compte. */
export function useRemplacants(enabled = true) {
  return useQuery({
    queryKey: ['remplacants'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remplacants')
        .select('id, matricule, nom_prenom, qualification, tarif_journalier, actif')
        .is('archive_le', null)
        .order('nom_prenom')
      if (error) throw error
      return data as {
        id: string; matricule: number | null; nom_prenom: string
        qualification: string | null; tarif_journalier: number | null; actif: boolean
      }[]
    },
  })
}

/**
 * Les journées remplacées du mois, rangées par absent et par jour :
 * la grille y lit quelle case montrer comme couverte, et par qui.
 */
export function useRemplacementsDuMois(debut: string, fin: string, enabled = true) {
  return useQuery({
    queryKey: ['remplacements-du-mois', debut, fin],
    enabled,
    queryFn: async (): Promise<Map<string, Map<string, { nom: string; montant: number }>>> => {
      const { data, error } = await supabase
        .from('remplacant_journees')
        .select('employee_id, date_jour, montant, remplacants(nom_prenom)')
        .gte('date_jour', debut)
        .lte('date_jour', fin)
      if (error) throw error
      const map = new Map<string, Map<string, { nom: string; montant: number }>>()
      for (const j of data as unknown as {
        employee_id: string | null; date_jour: string; montant: number
        remplacants: { nom_prenom: string } | null
      }[]) {
        if (!j.employee_id) continue
        let jours = map.get(j.employee_id)
        if (!jours) { jours = new Map(); map.set(j.employee_id, jours) }
        jours.set(j.date_jour, {
          nom: j.remplacants?.nom_prenom ?? 'Remplaçant',
          montant: Number(j.montant),
        })
      }
      return map
    },
  })
}

export type DayPointage = Pick<
  Pointage,
  | 'id' | 'employee_id' | 'status' | 'photo_path'
  | 'pointed_at' | 'pointed_on' | 'type_garde' | 'conge_id'
>

/** Pointages d'un site pour une date donnée (yyyy-mm-dd). */
export function useSitePointages(siteId: string, date: string, enabled: boolean) {
  return useQuery({
    queryKey: ['site-pointages', siteId, date],
    enabled,
    queryFn: async (): Promise<Map<string, DayPointage>> => {
      const { data, error } = await supabase
        .from('pointages')
        .select('id, employee_id, status, photo_path, pointed_at, pointed_on, type_garde, conge_id')
        .eq('site_id', siteId)
        .eq('pointed_on', date)
        .order('pointed_at', { ascending: false })
      if (error) throw error
      const map = new Map<string, DayPointage>()
      // Trié du plus récent au plus ancien : on garde le plus récent par employé.
      for (const p of data) if (!map.has(p.employee_id)) map.set(p.employee_id, p)
      return map
    },
  })
}

/** Pointages d'un site pour une semaine (lundi → dimanche).
 *  Retour : employee_id → (date iso → pointage). */
export function useSiteWeekPointages(
  siteId: string,
  monday: string,
  sunday: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['site-week-pointages', siteId, monday],
    enabled,
    queryFn: async (): Promise<Map<string, Map<string, DayPointage>>> => {
      const { data, error } = await supabase
        .from('pointages')
        .select('id, employee_id, status, photo_path, pointed_at, pointed_on, type_garde, conge_id')
        .eq('site_id', siteId)
        .gte('pointed_on', monday)
        .lte('pointed_on', sunday)
        .order('pointed_at', { ascending: false })
      if (error) throw error
      const map = new Map<string, Map<string, DayPointage>>()
      for (const p of data) {
        let days = map.get(p.employee_id)
        if (!days) {
          days = new Map()
          map.set(p.employee_id, days)
        }
        // Le plus récent par employé et par jour
        if (!days.has(p.pointed_on)) days.set(p.pointed_on, p)
      }
      return map
    },
  })
}

export interface EmployeFiltres {
  villes: string[]
  qualifications: string[]
  modes_reglement: string[]
}

/** Valeurs distinctes (ville, qualification, mode de règlement) pour les filtres. */
export function useEmployeFiltres(companyId: string | undefined) {
  return useQuery({
    queryKey: ['employe-filtres', companyId],
    enabled: Boolean(companyId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<EmployeFiltres> => {
      const { data, error } = await supabase.rpc('filtres_employes', {
        p_company: companyId!,
      })
      if (error) throw error
      return data as EmployeFiltres
    },
  })
}

/**
 * La société ouverte : id, nom, et son R.I.B.
 *
 * Une seule requête pour tout le monde. Auparavant cinq écrans
 * interrogeaient la table sous la MÊME clé de cache mais avec des
 * colonnes différentes : celui qui répondait le premier remplissait le
 * cache, et la paie lisait un R.I.B. absent — d'où la ligne « RIB
 * ORDINATEUR » vide sur l'ordre de virement, un coup sur deux.
 */
export function useSociete(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, rib_ordinateur')
        .eq('id', companyId!)
        .single()
      if (error) throw error
      return data as { id: string; name: string; rib_ordinateur: string | null }
    },
  })
}

/**
 * Ce compte a-t-il le droit de pointer cette société ?
 *
 * Vrai d'office pour le bureau et l'administrateur. Pour le personnel,
 * cela dépend de ce que l'administrateur lui a confié — c'est la base
 * qui tranche, la même réponse que celle qui gouverne les écritures.
 */
export function usePeutPointer(companyId: string | undefined) {
  return useQuery({
    queryKey: ['peut-pointer', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('peut_pointer', { p_company: companyId })
      if (error) throw error
      return data === true
    },
  })
}
