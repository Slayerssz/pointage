/**
 * Les pièces administratives que réclame la fiche d'informations
 * personnelles.
 *
 * On n'en demande pas toujours les trois : le choix se fait au moment
 * d'imprimer. La liste vit ici, et non dans la fiche, parce que
 * l'aperçu à l'écran et le générateur de PDF s'en servent tous deux —
 * et qu'aucun des deux n'a à dépendre de l'autre.
 */
export const PIECES = [
  'COPIE DE LA CIN',
  'CERTIFICAT DE BONNE CONDUITE',
  'CERTIFICAT MÉDICAL D’APTITUDE AU TRAVAIL',
] as const

export type Piece = (typeof PIECES)[number]
