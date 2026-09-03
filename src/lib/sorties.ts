import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Un départ en préparation, ou déjà validé. */
export interface Sortie {
  id: string
  company_id: string
  employee_id: string
  date_sortie: string
  motif: string | null
  montant: number
  mode_reglement: string | null
  champs_document: Record<string, string> | null
  valide: boolean
  valide_le: string | null
  created_at: string
}

export function useSorties(companyId: string | undefined) {
  return useQuery({
    queryKey: ['sorties', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<Sortie[]> => {
      const { data, error } = await supabase
        .from('sorties')
        .select('*')
        .eq('company_id', companyId!)
        .order('date_sortie', { ascending: false })
      if (error) throw error
      return (data ?? []) as Sortie[]
    },
  })
}

function rafraichir(qc: ReturnType<typeof useQueryClient>, companyId?: string) {
  qc.invalidateQueries({ queryKey: ['sorties', companyId] })
  qc.invalidateQueries({ queryKey: ['employees'] })
  qc.invalidateQueries({ queryKey: ['employees-list'] })
}

export function useEnregistrerSortie(companyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      employeeId: string
      dateSortie: string
      montant: number
      mode: string
      motif: string
      champs: Record<string, string>
    }) => {
      const { error } = await supabase.rpc('enregistrer_sortie', {
        p_employee: v.employeeId,
        p_date_sortie: v.dateSortie,
        p_montant: v.montant,
        p_mode: v.mode || null,
        p_motif: v.motif || null,
        p_champs: v.champs,
      })
      if (error) throw error
    },
    onSuccess: () => rafraichir(qc, companyId),
  })
}

/** Valider : l'employé quitte les listes actives, sa fiche reste au registre. */
export function useValiderSortie(companyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('valider_sortie', { p_sortie: id })
      if (error) throw error
    },
    onSuccess: () => rafraichir(qc, companyId),
  })
}

/** Ce que la clôture du mois retirerait de la liste des employés. */
export interface ADossier {
  employee_id: string
  matricule: number | null
  nom_prenom: string
  date_sortie: string
  montant: number
  motif: string | null
}

export function useApercuArchivage(
  companyId: string | undefined, annee: number, mois: number,
) {
  return useQuery({
    queryKey: ['apercu-archivage', companyId, annee, mois],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<ADossier[]> => {
      const { data, error } = await supabase.rpc('apercu_archivage', {
        p_company: companyId, p_annee: annee, p_mois: mois,
      })
      if (error) throw error
      return (data ?? []) as ADossier[]
    },
  })
}

/**
 * La clôture du mois : les départs validés de ce mois quittent la liste
 * des employés. Réservé à l'administrateur — c'est lui qui arrête le mois.
 */
export function useArchiverSorties(companyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { annee: number; mois: number }) => {
      const { data, error } = await supabase.rpc('archiver_sorties', {
        p_company: companyId, p_annee: v.annee, p_mois: v.mois,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: () => {
      rafraichir(qc, companyId)
      qc.invalidateQueries({ queryKey: ['apercu-archivage'] })
    },
  })
}

export function useAnnulerSortie(companyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('annuler_sortie', { p_sortie: id })
      if (error) throw error
    },
    onSuccess: () => rafraichir(qc, companyId),
  })
}
