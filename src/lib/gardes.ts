/** Types de garde et d'absence choisis par le validateur. */

export type TypeGarde = 'X05' | 'X' | 'X15' | 'XX' | 'RT' | 'M' | 'C' | 'F' | 'XF'

export interface GardeInfo {
  code: TypeGarde
  symbole: string
  label: string
  /** Valeur en gardes : sert au prorata du salaire et au calcul des heures. */
  valeur: number
  /** Absence approuvée (≠ travail effectif) : malade, congé… */
  absence: boolean
  /** Où la lettre s'affiche dans le choix du validateur. */
  groupe: 'travail' | 'ferie' | 'absence'
  /** Classe de couleur de la case dans la grille de pointage. */
  couleur: string
}

export const TYPES_GARDE: GardeInfo[] = [
  { code: 'X05', symbole: '½', label: 'Demi-garde', valeur: 0.5, absence: false, couleur: 'bg-emerald-400 text-white', groupe: 'travail' },
  { code: 'X', symbole: 'X', label: 'Travaillé une garde', valeur: 1, absence: false, couleur: 'bg-emerald-500 text-white', groupe: 'travail' },
  { code: 'X15', symbole: 'X̸', label: 'Travaillé une garde et demi', valeur: 1.5, absence: false, couleur: 'bg-emerald-600 text-white', groupe: 'travail' },
  { code: 'XX', symbole: 'XX', label: 'Travaillé deux gardes', valeur: 2, absence: false, couleur: 'bg-emerald-700 text-white', groupe: 'travail' },
  { code: 'RT', symbole: 'RT', label: 'Repos travaillé', valeur: 1, absence: false, couleur: 'bg-teal-600 text-white', groupe: 'travail' },
  { code: 'XF', symbole: 'XF', label: 'Férié travaillé (compte double)', valeur: 2, absence: false, couleur: 'bg-orange-600 text-white', groupe: 'ferie' },
  { code: 'F', symbole: 'F', label: 'Férié chômé (payé)', valeur: 1, absence: true, couleur: 'bg-orange-400 text-white', groupe: 'ferie' },
  { code: 'M', symbole: 'M', label: 'Malade (absence approuvée)', valeur: 1, absence: true, couleur: 'bg-violet-500 text-white', groupe: 'absence' },
  { code: 'C', symbole: 'C', label: 'Congé payé', valeur: 1, absence: true, couleur: 'bg-sky-500 text-white', groupe: 'absence' },
]

/** Les types que le validateur propose pour un jour travaillé. */
export const TYPES_TRAVAIL = TYPES_GARDE.filter((t) => t.groupe === 'travail')
/** Le jour férié : chômé et payé, ou travaillé et compté double. */
export const TYPES_FERIE = TYPES_GARDE.filter((t) => t.groupe === 'ferie')
/** Les types d'absence approuvée. */
export const TYPES_ABSENCE = TYPES_GARDE.filter((t) => t.groupe === 'absence')

const BY_CODE = new Map(TYPES_GARDE.map((t) => [t.code, t]))

export function gardeInfo(code: string | null | undefined): GardeInfo | null {
  return code ? (BY_CODE.get(code as TypeGarde) ?? null) : null
}

export function gardeSymbole(code: string | null | undefined): string {
  return gardeInfo(code)?.symbole ?? 'X'
}

export function gardeLabel(code: string | null | undefined): string {
  return gardeInfo(code)?.label ?? '—'
}

export function gardeCouleur(code: string | null | undefined): string {
  return gardeInfo(code)?.couleur ?? 'bg-emerald-500 text-white'
}

/** Formatte un nombre de gardes (1, 1,5, 2…) à la française. */
export function formatGardes(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

/** Heures d'un jour : valeur de la garde × durée d'une garde normale. */
export function heuresDuJour(code: string | null | undefined, heuresParJour: number | null): number | null {
  if (heuresParJour == null) return null
  const info = gardeInfo(code)
  if (!info) return null
  return info.valeur * heuresParJour
}
