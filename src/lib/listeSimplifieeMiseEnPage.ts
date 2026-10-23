/**
 * LA MISE EN PAGE DE LA LISTE SIMPLIFIÉE.
 *
 * La liste s'imprime désormais sur le papier à en-tête de la société,
 * comme l'ordre de virement. Le papier impose sa bande libre : celui de
 * Serclean s'arrête à 245 mm — son losange décoratif — quand celui de
 * Megainter descend jusqu'à 274. L'un tient donc plusieurs lignes de
 * moins que l'autre.
 *
 * La première page porte en plus le numéro de marché, les deux titres et
 * le bandeau de période ; les suivantes ne reprennent que l'en-tête des
 * colonnes, et tiennent donc davantage de monde.
 *
 * Le PDF et l'aperçu à l'écran appellent tous deux ces fonctions : sans
 * cela, ils finiraient par paginer différemment, et le document à
 * l'écran cesserait de ressembler à celui qui sort de l'imprimante.
 *
 * Le fichier ne dépend de rien : les essais le chargent seul.
 */

/** Hauteur d'une ligne du tableau, en millimètres. */
export const LIGNE = 6.6
/** L'en-tête des colonnes, répété en haut de chaque page. */
export const H_ENTETE = 7.5
/** Le bandeau « Période Du … Au … ». */
export const H_BANDEAU = 8
/** La ligne « MARCHE N°: … », quand il y en a un. */
export const H_MARCHE = 8
/** Un titre souligné. */
export const H_TITRE = 7

/**
 * L'établissement tient-il sur la ligne du titre ?
 *
 * Mesurer le texte donnerait deux réponses — le navigateur et jsPDF ne
 * mesurent pas pareil — et les deux documents se mettraient à paginer
 * différemment. On s'en tient donc au nombre de caractères : à 13 pt,
 * cinquante-huit lettres capitales tiennent dans les 186 mm utiles,
 * avec de la marge.
 */
export const MAX_TITRE = 58

export function titreSurUneLigne(intitule: string, etablissement: string): boolean {
  if (!etablissement.trim()) return true
  return `${intitule} — ${etablissement}`.length <= MAX_TITRE
}

export interface MesuresPage {
  /** Premier millimètre libre sous le bandeau du papier. */
  haut: number
  /** Dernier millimètre libre avant le pied du papier. */
  bas: number
  avecMarche: boolean
  /** 1 si l'établissement rejoint le titre, 2 s'il passe en dessous. */
  lignesDeTitre: number
}

/** Ce que la première page réserve avant la première personne. */
export function hauteurEnTete(m: MesuresPage): number {
  return (m.avecMarche ? H_MARCHE : 0) + m.lignesDeTitre * H_TITRE + 4 + H_BANDEAU + H_ENTETE
}

/**
 * Combien de personnes par page. La première en tient moins : elle
 * porte le titre.
 */
export function paginerListeSimplifiee(nbLignes: number, m: MesuresPage): number[] {
  const utile = m.bas - m.haut
  const premiere = Math.max(1, Math.floor((utile - hauteurEnTete(m)) / LIGNE))
  const suivantes = Math.max(1, Math.floor((utile - H_ENTETE) / LIGNE))

  if (nbLignes <= 0) return [0]

  const pages: number[] = []
  let reste = nbLignes
  pages.push(Math.min(reste, premiere))
  reste -= pages[0]
  while (reste > 0) {
    const t = Math.min(reste, suivantes)
    pages.push(t)
    reste -= t
  }
  return pages
}

/** Découpe la liste d'après la pagination calculée. */
export function decouperListeSimplifiee<T>(lignes: T[], m: MesuresPage): T[][] {
  const tailles = paginerListeSimplifiee(lignes.length, m)
  const pages: T[][] = []
  let i = 0
  for (const t of tailles) {
    pages.push(lignes.slice(i, i + t))
    i += t
  }
  return pages
}
