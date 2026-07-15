import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Employee, Pointage, Site } from './types'

export const SITE_EMPLOYEES_PAGE = 100

export function useSites(companyId: string | undefined) {
  return useQuery({
    queryKey: ['sites', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<Site[]> => {
      const { data, error } = await supabase
        .from('sites')
        .select('id, company_id, name')
        .eq('company_id', companyId!)
        .order('name')
      if (error) throw error
      return data
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
        .order('nom_prenom')
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
  'id' | 'employee_id' | 'status' | 'photo_path' | 'pointed_at'
>

/** Pointages d'un site pour une date donnée (yyyy-mm-dd). */
export function useSitePointages(siteId: string, date: string, enabled: boolean) {
  return useQuery({
    queryKey: ['site-pointages', siteId, date],
    enabled,
    queryFn: async (): Promise<Map<string, DayPointage>> => {
      const { data, error } = await supabase
        .from('pointages')
        .select('id, employee_id, status, photo_path, pointed_at')
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
