import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Une ligne du corps du bulletin : CODE / LIBELLE / BASE / TAUX / GAIN / RETENUE. */
export interface LigneBulletin {
  code: string
  libelle: string
  base: number | null
  taux: number | null
  gain: number | null
  retenue: number | null
}

export interface Bulletin {
  ligne_id: string
  employe: {
    id: string
    matricule: number | null
    nom_prenom: string
    cin: string | null
    cnss: string | null
    qualification: string | null
    adresse: string | null
    date_embauche: string | null
    situation_familiale: string | null
    nombre_enfants: number | null
    banque: string | null
    rib: string | null
    site_nom: string | null
    site_principal_nom: string | null
  }
  entreprise: { nom: string }
  periode: { annee: number; mois: number; statut: string; devise: string }
  lignes: LigneBulletin[]
  pied: {
    jours_travailles: number
    cumul_igr: number
    cumul_cnss: number
    heures_salariales: number
    net_a_payer: number
  }
  /** Ce qui part réellement en banque : le net fiscal, corrigé des
   *  primes et retenues internes décidées par le service paie. */
  net_verse: number
  prime: number
  retenues_internes: number
  /** Vrai quand le brut dépasse le seuil mais qu'aucun barème n'est saisi. */
  bareme_igr_absent: boolean
}

/** Une tranche du barème de l'I.G.R. */
export interface TrancheIgr {
  id?: string
  salaire_min: number
  salaire_max: number | null
  taux: number
  somme_a_deduire: number
}

/**
 * Les bulletins d'une période. Seuls les employés payés par virement
 * en ont un : ce sont les seuls déclarés à la C.N.S.S.
 */
export function useBulletins(periodeId: string | null, employeeId?: string | null) {
  return useQuery({
    queryKey: ['bulletins', periodeId, employeeId ?? null],
    enabled: !!periodeId,
    queryFn: async (): Promise<Bulletin[]> => {
      const { data, error } = await supabase.rpc('bulletin_paie', {
        p_periode: periodeId,
        p_employee: employeeId ?? null,
      })
      if (error) throw error
      return (data ?? []) as Bulletin[]
    },
  })
}

export function useBaremeIgr() {
  return useQuery({
    queryKey: ['bareme-igr'],
    queryFn: async (): Promise<TrancheIgr[]> => {
      const { data, error } = await supabase
        .from('bareme_igr')
        .select('id, salaire_min, salaire_max, taux, somme_a_deduire')
        .order('salaire_min')
      if (error) throw error
      return (data ?? []) as TrancheIgr[]
    },
  })
}
