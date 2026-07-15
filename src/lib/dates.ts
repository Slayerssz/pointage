/** Aide au calcul d'âge, de retraite et de jour de repos. */

export const RETIREMENT_AGE = 65
export const RETIREMENT_WARNING_DAYS = 30

export const JOURS_SEMAINE = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const

/** Jour ISO (1=lundi … 7=dimanche) du jour courant. */
export function isoDayOfWeek(d: Date = new Date()): number {
  const day = d.getDay() // 0=dimanche
  return day === 0 ? 7 : day
}

export function jourDeReposLabel(jour: number | null): string {
  if (jour == null || jour < 1 || jour > 7) return '—'
  return JOURS_SEMAINE[jour - 1]
}

export function computeAge(dateNaissance: string, today: Date = new Date()): number {
  const dob = new Date(dateNaissance + 'T00:00:00')
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export type RetirementStatus =
  | { kind: 'ok'; age: number }
  | { kind: 'approaching'; age: number; daysLeft: number }
  | { kind: 'retired'; age: number }

/**
 * Statut retraite :
 * - `retired`     : 65 ans atteints → ligne rouge « Âge de retraite atteint »
 * - `approaching` : 65e anniversaire dans ≤ 30 jours → badge « X jours avant la retraite »
 * - `ok`          : rien à signaler
 */
export function retirementStatus(
  dateNaissance: string | null,
  today: Date = new Date(),
): RetirementStatus | null {
  if (!dateNaissance) return null
  const age = computeAge(dateNaissance, today)
  if (age >= RETIREMENT_AGE) return { kind: 'retired', age }

  const dob = new Date(dateNaissance + 'T00:00:00')
  const birthday65 = new Date(dob.getFullYear() + RETIREMENT_AGE, dob.getMonth(), dob.getDate())
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const daysLeft = Math.ceil((birthday65.getTime() - startOfToday.getTime()) / 86_400_000)
  if (daysLeft >= 0 && daysLeft <= RETIREMENT_WARNING_DAYS) {
    return { kind: 'approaching', age, daysLeft }
  }
  return { kind: 'ok', age }
}

export function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatTimeFr(timestamptz: string): string {
  return new Date(timestamptz).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Date locale (yyyy-mm-dd) du jour, fuseau du navigateur. */
export function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
