import type { LignePaie } from './types'

/**
 * PAR QUOI SE RANGE CHAQUE MODE DE RÈGLEMENT.
 *
 * Cette règle a déjà changé trois fois, et chaque fois au mauvais
 * endroit : elle vit donc ici, seule, plutôt que recopiée dans la page
 * qui l'affiche et dans celle qui l'imprime.
 *
 *   · Versement → par banque. C'est au guichet qu'on porte l'argent.
 *   · Virement  → par site principal. Un ordre part pour un site et
 *     toutes ses annexes à la fois, jamais annexe par annexe.
 *   · le reste  → par annexe, faute de mieux.
 */
export type ClePaie = (l: LignePaie) => string

export const banqueDe: ClePaie = (l) =>
  (l.banque ?? '').trim().replace(/\s+/g, ' ').toUpperCase() || '(BANQUE NON RENSEIGNÉE)'

export const sitePrincipalDe: ClePaie = (l) =>
  l.site_principal_nom?.trim() || '(sans site principal)'

export const annexeDe: ClePaie = (l) => l.site_nom?.trim() || '(sans site)'

export function cleDuMode(mode: string): ClePaie {
  if (mode === 'Versement') return banqueDe
  if (mode === 'Virement') return sitePrincipalDe
  return annexeDe
}

/** Le nom de ce qu'on demande à choisir, pour l'écrire à l'écran. */
export function libelleDuMode(mode: string): string {
  if (mode === 'Versement') return 'Banque'
  if (mode === 'Virement') return 'Site principal'
  return 'Site'
}
