import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type {
  BulletinSite,
  Conge,
  Contrat,
  ContratCourant,
  LignePaie,
  ParametresPaie,
  PeriodePaie,
  PeriodeStatut,
  TotauxPeriode,
} from './types'

export const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
] as const

export function moisLabel(annee: number, mois: number): string {
  return `${MOIS_FR[mois - 1]} ${annee}`
}

/** Formatte un montant : « 5 200,00 DH ». */
export function formatDH(n: number | null | undefined, devise = 'DH'): string {
  if (n == null) return '—'
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`
}

export function formatNombre(n: number | null | undefined, max = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { maximumFractionDigits: max })
}

export const STATUT_PERIODE: Record<PeriodeStatut, { label: string; tone: 'slate' | 'amber' | 'green' | 'blue' | 'red' }> = {
  ouvert: { label: 'Ouvert — pointage en cours', tone: 'slate' },
  pointage_valide: { label: 'Pointage validé — paie à préparer', tone: 'blue' },
  paie_validee: { label: 'Paie validée — verrouillée', tone: 'green' },
  reouverture_demandee: { label: 'Réouverture demandée', tone: 'amber' },
}

/** Le mode de règlement est-il un virement bancaire ? */
export function estVirement(mode: string | null | undefined): boolean {
  return (mode ?? '').toLowerCase().startsWith('vir')
}

// --- Paramètres de paie ------------------------------------------------------

export function useParametresPaie(companyId: string | undefined) {
  return useQuery({
    queryKey: ['parametres-paie', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<ParametresPaie | null> => {
      const { data, error } = await supabase
        .from('parametres_paie')
        .select('*')
        .eq('company_id', companyId!)
        .maybeSingle()
      if (error) throw error
      return data as ParametresPaie | null
    },
  })
}

// --- Périodes ----------------------------------------------------------------

export function usePeriodes(companyId: string | undefined) {
  return useQuery({
    queryKey: ['periodes-paie', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<PeriodePaie[]> => {
      const { data, error } = await supabase
        .from('periodes_paie')
        .select('*')
        .eq('company_id', companyId!)
        .order('annee', { ascending: false })
        .order('mois', { ascending: false })
      if (error) throw error
      return data as PeriodePaie[]
    },
  })
}

export interface ApercuMois {
  annee: number
  mois: number
  debut: string
  fin: string
  statut: PeriodeStatut
  employes_actifs: number
  en_attente: number
  valides: number
  sans_salaire: number
}

export function useApercuMois(companyId: string | undefined, annee: number, mois: number) {
  return useQuery({
    queryKey: ['apercu-mois', companyId, annee, mois],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<ApercuMois> => {
      const { data, error } = await supabase.rpc('apercu_mois', {
        p_company: companyId!,
        p_annee: annee,
        p_mois: mois,
      })
      if (error) throw error
      return data as ApercuMois
    },
  })
}

export function useLignesPaie(periodeId: string | undefined) {
  return useQuery({
    queryKey: ['lignes-paie', periodeId],
    enabled: Boolean(periodeId),
    queryFn: async (): Promise<LignePaie[]> => {
      const { data, error } = await supabase
        .from('lignes_paie')
        .select('*')
        .eq('periode_id', periodeId!)
        .order('site_nom')
        .order('matricule', { nullsFirst: false })
      if (error) throw error
      return data as LignePaie[]
    },
  })
}

export function useTotauxPeriode(periodeId: string | undefined) {
  return useQuery({
    queryKey: ['totaux-periode', periodeId],
    enabled: Boolean(periodeId),
    queryFn: async (): Promise<TotauxPeriode> => {
      const { data, error } = await supabase.rpc('totaux_periode', { p_periode: periodeId! })
      if (error) throw error
      return data as TotauxPeriode
    },
  })
}

/** Invalide tout ce qui dépend d'une période de paie. */
export function usePaieInvalidation(companyId: string | undefined, periodeId?: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['periodes-paie', companyId] })
    qc.invalidateQueries({ queryKey: ['apercu-mois', companyId] })
    qc.invalidateQueries({ queryKey: ['lignes-paie', periodeId] })
    qc.invalidateQueries({ queryKey: ['totaux-periode', periodeId] })
    qc.invalidateQueries({ queryKey: ['dettes'] })
  }
}

// --- Contrats ----------------------------------------------------------------

/** Contrats courants de l'entreprise, indexés par employé. */
export function useContratsCourants(companyId: string | undefined) {
  return useQuery({
    queryKey: ['contrats-courants', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<Map<string, ContratCourant>> => {
      const { data, error } = await supabase
        .from('contrats_courants')
        .select('*')
        .eq('company_id', companyId!)
      if (error) throw error
      return new Map((data as ContratCourant[]).map((c) => [c.employee_id, c]))
    },
  })
}

export function useContratsEmploye(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['contrats', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<Contrat[]> => {
      const { data, error } = await supabase
        .from('contrats')
        .select('*')
        .eq('employee_id', employeeId!)
        .order('date_debut', { ascending: false })
      if (error) throw error
      return data as Contrat[]
    },
  })
}

// --- Congés ------------------------------------------------------------------

export function useCongesEmploye(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['conges', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<Conge[]> => {
      const { data, error } = await supabase
        .from('conges')
        .select('*')
        .eq('employee_id', employeeId!)
        .order('date_debut', { ascending: false })
      if (error) throw error
      return data as Conge[]
    },
  })
}

export function useCreerConge(employeeId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { debut: string; fin: string; type: string; motif: string }) => {
      const { error } = await supabase.rpc('creer_conge', {
        p_employee_id: employeeId!,
        p_date_debut: v.debut,
        p_date_fin: v.fin,
        p_type: v.type,
        p_motif: v.motif || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conges', employeeId] })
      qc.invalidateQueries({ queryKey: ['site-week-pointages'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useSupprimerConge(employeeId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (congeId: string) => {
      const { error } = await supabase.rpc('supprimer_conge', { p_conge_id: congeId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conges', employeeId] })
      qc.invalidateQueries({ queryKey: ['site-week-pointages'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

// --- Dettes ------------------------------------------------------------------

/** Ce que chaque employé doit encore (pour l'écran Paie). */
export function useDettesOuvertes(companyId: string | undefined) {
  return useQuery({
    queryKey: ['dettes', 'ouvertes', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, dette')
        .eq('company_id', companyId!)
        .gt('dette', 0)
      if (error) throw error
      const map = new Map<string, number>()
      for (const e of data as { id: string; dette: number }[]) {
        map.set(e.id, Number(e.dette))
      }
      return map
    },
  })
}

// --- Bulletin journalier ------------------------------------------------------

export function useBulletinJournalier(companyId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['bulletin-journalier', companyId, date],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<BulletinSite[]> => {
      const { data, error } = await supabase.rpc('bulletin_journalier', {
        p_company: companyId!,
        p_date: date,
      })
      if (error) throw error
      return (data ?? []) as BulletinSite[]
    },
  })
}
