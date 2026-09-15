/**
 * Les jours fériés.
 *
 * L'administrateur déclare un férié ; la base inscrit aussitôt F à tous
 * les employés concernés. Le validateur passe ensuite en XF ceux qui ont
 * tenu le poste — leur journée compte alors double.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export interface Ferie {
  id: string
  company_id: string | null
  nom: string
  date_debut: string
  date_fin: string
  created_at: string
}

/** Rapport rendu par la base au moment où l'on pose un férié. */
export interface PoseFerie {
  ferie_id: string
  jours_ecrits: number
  deja_pointes: number
  mois_clos: number
}

/**
 * Les fériés qui touchent une société : les siens et ceux du groupe.
 * Sans société, tout le calendrier (écran d'administration).
 */
export function useFeries(companyId?: string | null, annee?: number) {
  return useQuery({
    queryKey: ['feries', companyId ?? 'tous', annee ?? 'tout'],
    queryFn: async (): Promise<Ferie[]> => {
      let q = supabase
        .from('jours_feries')
        .select('id, company_id, nom, date_debut, date_fin, created_at')
        .order('date_debut', { ascending: false })
      if (companyId) q = q.or(`company_id.is.null,company_id.eq.${companyId}`)
      if (annee) q = q.gte('date_debut', `${annee}-01-01`).lte('date_debut', `${annee}-12-31`)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Ferie[]
    },
  })
}

const rafraichir = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['feries'] })
  qc.invalidateQueries({ queryKey: ['pointages'] })
  qc.invalidateQueries({ queryKey: ['employees'] })
  qc.invalidateQueries({ queryKey: ['jours-du-mois'] })
}

export function useCreerFerie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      companyId: string | null
      nom: string
      debut: string
      fin: string
    }): Promise<PoseFerie> => {
      const { data, error } = await supabase.rpc('admin_creer_ferie', {
        p_company: v.companyId,
        p_nom: v.nom,
        p_debut: v.debut,
        p_fin: v.fin,
      })
      if (error) throw error
      return data as PoseFerie
    },
    onSuccess: () => rafraichir(qc),
  })
}

export function useSupprimerFerie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('admin_supprimer_ferie', { p_ferie: id })
      if (error) throw error
      return data as number
    },
    onSuccess: () => rafraichir(qc),
  })
}

/**
 * Passe en XF les gardes déjà saisies sur le férié — le cas du férié
 * déclaré après coup. Jamais automatique : cela change la paie.
 */
export function useConvertirTravailFerie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('convertir_travail_ferie', { p_ferie: id })
      if (error) throw error
      return data as number
    },
    onSuccess: () => rafraichir(qc),
  })
}

/** Les jours fériés d'un mois, en dates ISO, pour marquer la grille. */
export function joursFeriesDuMois(feries: Ferie[] | undefined, annee: number, mois: number) {
  const dans = new Map<string, string>()
  for (const f of feries ?? []) {
    const d = new Date(`${f.date_debut}T00:00:00`)
    const fin = new Date(`${f.date_fin}T00:00:00`)
    while (d <= fin) {
      if (d.getFullYear() === annee && d.getMonth() + 1 === mois) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate(),
        ).padStart(2, '0')}`
        dans.set(iso, f.nom)
      }
      d.setDate(d.getDate() + 1)
    }
  }
  return dans
}
