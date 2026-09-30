import type { LignePaie } from './types'

/**
 * PAR QUOI SE RANGE CHAQUE MODE DE RÈGLEMENT.
 *
 * Cette règle a déjà changé trois fois, et chaque fois au mauvais
 * endroit : elle vit donc ici, seule, plutôt que recopiée dans la page
 * qui l'affiche et dans celle qui l'imprime.
 *
 *   · Versement → par banque. C'est au guichet qu'on porte l'argent.
 *   · Virement  → par rattachement : le site principal, qui emporte
 *     toutes ses annexes d'un coup. Une annexe qui n'est rattachée à
 *     rien ne disparaît pas pour autant — elle paraît sous son propre
 *     nom, à côté des sites principaux.
 *   · le reste  → par annexe, faute de mieux.
 */
export type ClePaie = (l: LignePaie) => string

export const banqueDe: ClePaie = (l) =>
  (l.banque ?? '').trim().replace(/\s+/g, ' ').toUpperCase() || '(BANQUE NON RENSEIGNÉE)'

/**
 * Le site principal d'une ligne — ou, à défaut, son annexe. Une annexe
 * sans rattachement doit rester visible et payable : la ranger sous un
 * « (sans site principal) » commun l'aurait mêlée à toutes les autres.
 */
export const rattachementDe: ClePaie = (l) =>
  l.site_principal_nom?.trim() || l.site_nom?.trim() || '(sans site)'

export const annexeDe: ClePaie = (l) => l.site_nom?.trim() || '(sans site)'

export function cleDuMode(mode: string): ClePaie {
  if (mode === 'Versement') return banqueDe
  if (mode === 'Virement') return rattachementDe
  return annexeDe
}

/** Le nom de ce qu'on demande à choisir, pour l'écrire à l'écran. */
export function libelleDuMode(mode: string): string {
  if (mode === 'Versement') return 'Banque'
  if (mode === 'Virement') return 'Site principal'
  return 'Site'
}
