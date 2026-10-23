/**
 * Écrire une somme. Rien d'autre.
 *
 * Ces trois fonctions vivaient au milieu de `paie.ts`, qui ouvre la
 * connexion à la base et monte les hooks de requête. Un document qui ne
 * voulait qu'afficher « 3 046,00 DH » embarquait tout cela avec lui — et
 * ne pouvait plus être tracé ni vérifié hors du navigateur.
 */

/** Formatte un montant : « 5 200,00 DH ». */
export function formatDH(n: number | null | undefined, devise = 'DH'): string {
  if (n == null) return '—'
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`
}

/**
 * Le même montant sans sa devise, pour les endroits où la colonne est
 * étroite et où l'unité est déjà dite — sur un téléphone, « 3 046,00 DH »
 * se coupe en deux lignes.
 */
export function formatMontant(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatNombre(n: number | null | undefined, max = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { maximumFractionDigits: max })
}
