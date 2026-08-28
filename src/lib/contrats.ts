/** Statut d'un contrat et couleurs associées.
 *
 *  Règle demandée : un contrat qui se termine dans 10 jours ou moins
 *  s'affiche en BLEU, un contrat déjà terminé s'affiche en JAUNE.
 */

import type { ContratStatut, TypeContrat } from './types'

/** Nombre de jours avant la fin à partir duquel on alerte (bleu). */
export const CONTRAT_ALERTE_JOURS = 10

export const TYPES_CONTRAT: { code: TypeContrat; label: string }[] = [
  { code: 'CDI', label: 'CDI — durée indéterminée' },
  { code: 'CDD', label: 'CDD — durée déterminée' },
  { code: 'ANAPEC', label: 'Contrat ANAPEC' },
  { code: 'STAGE', label: 'Stage' },
  { code: 'INTERIM', label: 'Intérim' },
  { code: 'ESSAI', label: "Période d'essai" },
]

/** Calcule le statut côté client (même règle que `contrat_statut()` en base). */
export function contratStatut(
  dateDebut: string | null,
  dateFin: string | null,
  today: Date = new Date(),
): ContratStatut | null {
  if (!dateDebut) return null
  const jour = (iso: string) => new Date(iso + 'T00:00:00')
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (jour(dateDebut) > t0) return 'a_venir'
  if (!dateFin) return 'actif'

  const restants = Math.round((jour(dateFin).getTime() - t0.getTime()) / 86_400_000)
  if (restants < 0) return 'termine'
  if (restants <= CONTRAT_ALERTE_JOURS) return 'bientot'
  return 'actif'
}

export function joursRestants(dateFin: string | null, today: Date = new Date()): number | null {
  if (!dateFin) return null
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((new Date(dateFin + 'T00:00:00').getTime() - t0.getTime()) / 86_400_000)
}

export interface StatutAffichage {
  label: string
  /** Couleur de la pastille / du fond de ligne. */
  chip: 'blue' | 'amber' | 'green' | 'slate'
  /** Fond de la ligne du tableau (bleu = bientôt, jaune = terminé). */
  ligne: string
}

export function contratAffichage(
  statut: ContratStatut | null,
  restants: number | null,
): StatutAffichage | null {
  switch (statut) {
    case 'termine':
      return { label: 'Contrat terminé', chip: 'amber', ligne: 'bg-yellow-100' }
    case 'bientot':
      return {
        label:
          restants === 0
            ? "Se termine aujourd'hui"
            : `Se termine dans ${restants} jour${(restants ?? 0) > 1 ? 's' : ''}`,
        chip: 'blue',
        ligne: 'bg-blue-100',
      }
    case 'a_venir':
      return { label: 'À venir', chip: 'slate', ligne: '' }
    case 'actif':
      return { label: 'En cours', chip: 'green', ligne: '' }
    default:
      return null
  }
}
