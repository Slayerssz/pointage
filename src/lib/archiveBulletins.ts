import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Bulletin, SaisieBulletin } from './bulletin'

/**
 * L'ARCHIVE DES BULLETINS.
 *
 * Un bulletin remis à quelqu'un est une pièce : on en garde le document
 * entier, tel qu'il a été édité. Le rouvrir des mois plus tard le montre
 * inchangé, même si les taux, le salaire ou le pointage ont bougé depuis.
 *
 * Établir un bulletin, c'est donc l'archiver : c'est la copie conservée
 * qui s'imprime, jamais un recalcul. Le refaire demande l'accord de
 * l'administrateur ; le supprimer n'appartient qu'à lui.
 */
export interface BulletinEmis {
  id: string
  periode_id: string
  employee_id: string
  annee: number
  mois: number
  nom_prenom: string
  matricule: number | null
  salaire_brut: number
  jours: number
  avance: number
  net_a_payer: number
  document: Bulletin
  cree_le: string
  modification_motif: string | null
  modification_demandee_le: string | null
  modification_autorisee: boolean
}

const CHAMPS =
  'id, periode_id, employee_id, annee, mois, nom_prenom, matricule, salaire_brut, jours,' +
  ' avance, net_a_payer, document, cree_le, modification_motif, modification_demandee_le,' +
  ' modification_autorisee'

export function useBulletinsEmis(companyId: string | undefined) {
  return useQuery({
    queryKey: ['bulletins-emis', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<BulletinEmis[]> => {
      const { data, error } = await supabase
        .from('bulletins_emis')
        .select(CHAMPS)
        .eq('company_id', companyId!)
        .order('annee', { ascending: false })
        .order('mois', { ascending: false })
        .order('nom_prenom')
      if (error) throw error
      return (data ?? []) as unknown as BulletinEmis[]
    },
  })
}

/**
 * Établir un bulletin : la base le calcule, le conserve, et nous rend la
 * copie conservée — c'est elle qu'on imprime, pour que le papier et
 * l'archive ne puissent pas diverger.
 */
export function useEtablirBulletin(companyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      periodeId: string
      employeeId: string
      saisie: SaisieBulletin
    }): Promise<Bulletin> => {
      const { data: id, error } = await supabase.rpc('etablir_bulletin', {
        p_periode: v.periodeId,
        p_employee: v.employeeId,
        p_salaire_brut: v.saisie.salaireBrut,
        p_jours: v.saisie.jours,
        p_avance: v.saisie.avance,
      })
      if (error) throw error
      const { data, error: erreurLecture } = await supabase
        .from('bulletins_emis')
        .select('document')
        .eq('id', id)
        .single()
      if (erreurLecture) throw erreurLecture
      return data.document as Bulletin
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bulletins-emis', companyId] })
    },
  })
}

export function useDemanderModification(companyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; motif: string }) => {
      const { error } = await supabase.rpc('demander_modification_bulletin', {
        p_bulletin: v.id,
        p_motif: v.motif,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bulletins-emis', companyId] }),
  })
}

export function useRepondreModification(companyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; autoriser: boolean }) => {
      const { error } = await supabase.rpc('repondre_modification_bulletin', {
        p_bulletin: v.id,
        p_autoriser: v.autoriser,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bulletins-emis', companyId] }),
  })
}

export function useSupprimerBulletin(companyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('supprimer_bulletin_emis', { p_bulletin: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bulletins-emis', companyId] }),
  })
}
