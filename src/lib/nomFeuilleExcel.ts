/**
 * Le nom d'un onglet de classeur.
 *
 * Excel refuse « : \ / ? * [ ] » et s'arrête à trente et un caractères.
 * Un seul nom fautif, et c'est le classeur entier qu'il refuse d'ouvrir
 * — sans dire lequel. Deux intitulés qui se confondent une fois
 * tronqués sont donc numérotés plutôt que dupliqués.
 */
export function nomDeFeuille(intitule: string, deja: Set<string>): string {
  let base = intitule.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31)
  if (!base) base = 'Virements'
  let nom = base
  let n = 2
  while (deja.has(nom)) {
    const suffixe = ` (${n++})`
    nom = base.slice(0, 31 - suffixe.length) + suffixe
  }
  deja.add(nom)
  return nom
}
