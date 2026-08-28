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

export type SiteEmployee = Pick<
  Employee,
  'id' | 'nom_prenom' | 'matricule' | 'qualification' | 'jour_de_repos'
>

/** Employés d'un site, chargés par pages de 100 (à l'ouverture de l'accordéon). */
export function useSiteEmployees(siteId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['site-employees', siteId],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<SiteEmployee[]> => {
      const from = pageParam * SITE_EMPLOYEES_PAGE
      const { data, error } = await supabase
        .from('employees')
        .select('id, nom_prenom, matricule, qualification, jour_de_repos')
        .eq('site_id', siteId)
        .eq('actif', true)
        .order('matricule', { ascending: true, nullsFirst: false })
        .range(from, from + SITE_EMPLOYEES_PAGE - 1)
      if (error) throw error
      return data
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === SITE_EMPLOYEES_PAGE ? pages.length : undefined,
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
