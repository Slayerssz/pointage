/** Types de garde choisis par le validateur à l'acceptation. */

export type TypeGarde = 'X' | 'X15' | 'XX' | 'RT'

export interface GardeInfo {
  code: TypeGarde
  symbole: string
  label: string
  valeur: number
}

export const TYPES_GARDE: GardeInfo[] = [
  { code: 'X', symbole: 'X', label: 'Travaillé une garde', valeur: 1 },
  { code: 'X15', symbole: 'X̸', label: 'Travaillé une garde et demi', valeur: 1.5 },
  { code: 'XX', symbole: 'XX', label: 'Travaillé deux gardes', valeur: 2 },
  { code: 'RT', symbole: 'RT', label: 'Repos travaillé', valeur: 1 },
]

const BY_CODE = new Map(TYPES_GARDE.map((t) => [t.code, t]))

export function gardeInfo(code: string | null | undefined): GardeInfo | null {
  return code ? (BY_CODE.get(code as TypeGarde) ?? null) : null
}

export function gardeSymbole(code: string | null | undefined): string {
  return gardeInfo(code)?.symbole ?? 'X'
}

/** Formatte un nombre de gardes (1, 1,5, 2…) à la française. */
export function formatGardes(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}
