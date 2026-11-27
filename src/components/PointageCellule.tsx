import type { DayPointage, SiteEmployee } from '../lib/queries'
import type { Site } from '../lib/types'
import { gardeCouleur, gardeLabel, gardeSymbole } from '../lib/gardes'

/**
 * UNE CASE DU POINTAGE.
 *
 * Elle se lit d'un coup d'œil : sa lettre et sa couleur disent ce qu'a
 * été la journée. Une case vide ne dit rien d'autre que « pas encore
 * saisi » — elle ne vaut pas absence. Un liseré ambre dit qu'un remplaçant l'a tenue, et
 * son nom paraît au survol. Au-delà d'une date de sortie, la case est
 * barrée : ce jour-là n'est plus à cette personne.
 *
 * Ce qu'on en fait est ailleurs, dans le menu qui s'ouvre au clic.
 */

/** Cellule sélectionnée dans la grille (pour le détail / les actions). */
export interface CellSelection {
  employee: SiteEmployee
  site: Site
  date: string
  pointage: DayPointage | null
}

export function DayCell({
  pointage,
  isFuture,
  remplacant,
  sorti,
  onClick,
  large = false,
}: {
  pointage: DayPointage | null
  isFuture: boolean
  /** Le remplaçant posé sur cette case, s'il y en a un. */
  remplacant?: { nom: string; montant: number } | null
  /** La personne avait déjà quitté ce jour-là. */
  sorti?: boolean
  onClick: () => void
  /** Dans une carte de téléphone, la case prend toute sa colonne. */
  large?: boolean
}) {
  // UNE CASE VIDE N'EST PAS UNE ABSENCE : elle dit que la journée n'est
  // pas encore saisie. L'absence a sa lettre, « A », et c'est la seule
  // qui compte comme telle — ici comme à la paie.
  let cls = 'bg-slate-100 text-slate-400'
  let label = '·'
  let title = 'Pas encore pointé — cliquer pour saisir la journée'

  // Parti : le reste du mois n'est pas à lui. Rien n'est écrit dans ces
  // cases, c'est la date de sortie qui parle.
  if (sorti) {
    return (
      <span
        title="Sorti — il ne travaille plus à cette date"
        className={`inline-flex items-center justify-center rounded-lg bg-slate-200 text-[9px] font-bold text-slate-500 ${
          large ? 'h-10 w-full' : 'h-7 w-8'
        }`}
      >
        ⊘
      </span>
    )
  }

  if (pointage?.status === 'validated') {
    cls = gardeCouleur(pointage.type_garde)
    label = gardeSymbole(pointage.type_garde)
    title = `${gardeLabel(pointage.type_garde)} — cliquer pour modifier`
  } else if (pointage?.status === 'pending') {
    cls = 'bg-amber-400 text-white animate-pulse'
    label = '!'
    title = 'Photo en attente de validation'
  } else if (pointage?.status === 'refused') {
    cls = 'bg-red-500 text-white'
    label = '✕'
    title = 'Refusé'
  } else if (isFuture) {
    // On ne pointe pas l'avenir : la case est là, mais éteinte.
    return (
      <span
        title="Jour à venir"
        className={`inline-block rounded-lg bg-slate-50 ${large ? 'h-10 w-full' : 'h-7 w-8'}`}
      />
    )
  }

  // Couverte par un remplaçant : un liseré ambre et son nom au survol.
  // La lettre reste celle de l'absence — c'est toujours un repos ou un
  // congé ; on sait seulement que quelqu'un a tenu le poste.
  if (remplacant) {
    title = `${title.split(' — ')[0]} — remplacé par ${remplacant.nom}`
  }

  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center rounded-lg font-bold transition hover:scale-110 ${
        large ? 'h-10 w-full text-sm' : 'h-7 w-8 text-xs'
      } ${cls} ${remplacant ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
    >
      {label}
    </button>
  )
}
