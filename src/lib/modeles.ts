/**
 * Modèles de documents — un par entreprise.
 *
 * Le groupe compte plusieurs sociétés : leurs contrats et leurs
 * engagements de congé ne doivent pas se ressembler. Deux documents
 * identiques au nom près se repèrent immédiatement.
 *
 * On combine donc deux axes :
 *   — cinq MISES EN PAGE réellement différentes (articles en prose,
 *     tableau de conditions, titres en marge, bandeau, cadre) ;
 *   — deux TYPOGRAPHIES (labeur à empattements, ou linéale).
 *
 * Soit dix combinaisons, une par société : aucune n'est partagée.
 * Tout est en noir et blanc.
 */

export type Mise = 'prose' | 'tableau' | 'marge' | 'bandeau' | 'cadre'
export type Typo = 'serif' | 'sans'

export interface Modele {
  mise: Mise
  typo: Typo
  /** Pile de polices, adaptée à l'impression. */
  police: string
  /** Style de numérotation des articles. */
  numerotation: 'article' | 'romain' | 'decimal' | 'paragraphe' | 'lettre'
}

const POLICES: Record<Typo, string> = {
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  sans: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif',
}

/** Attribution figée : chaque société garde toujours le même modèle. */
const ATTRIBUTION: Record<string, [Mise, Typo, Modele['numerotation']]> = {
  'GROUPE TRIPLE A':        ['prose',   'serif', 'article'],
  'EDEN VERT SERVICE':      ['tableau', 'sans',  'decimal'],
  'AL SAFAE EL MAGHREB':    ['marge',   'serif', 'romain'],
  'BO':                     ['bandeau', 'sans',  'article'],
  'TRIMAX':                 ['cadre',   'serif', 'romain'],
  'VIGILMA GARD MAROC':     ['prose',   'sans',  'paragraphe'],
  'MEGANTER SERVICE MAROC': ['tableau', 'serif', 'lettre'],
  'NORD PLANET':            ['marge',   'sans',  'decimal'],
  'SERCLEAN NEGOCE':        ['bandeau', 'serif', 'paragraphe'],
  'DUO MULTI SERVICE':      ['cadre',   'sans',  'lettre'],
}

const MISES: Mise[] = ['prose', 'tableau', 'marge', 'bandeau', 'cadre']
const NUMS: Modele['numerotation'][] = ['article', 'romain', 'decimal', 'paragraphe', 'lettre']

function cle(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}

const PAR_CLE = new Map(Object.entries(ATTRIBUTION).map(([k, v]) => [cle(k), v]))

/** Le modèle d'une entreprise. Une société inconnue en reçoit un stable. */
export function modeleDe(entreprise: string | undefined | null): Modele {
  const trouve = entreprise ? PAR_CLE.get(cle(entreprise)) : undefined
  if (trouve) {
    return { mise: trouve[0], typo: trouve[1], police: POLICES[trouve[1]], numerotation: trouve[2] }
  }
  // Répartition déterministe pour une société pas encore répertoriée
  let h = 0
  for (const c of cle(entreprise ?? '')) h = (h * 31 + c.charCodeAt(0)) % 9973
  const typo: Typo = h % 2 === 0 ? 'serif' : 'sans'
  return {
    mise: MISES[h % MISES.length],
    typo,
    police: POLICES[typo],
    numerotation: NUMS[h % NUMS.length],
  }
}

const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

/** L'intitulé d'un article selon le style du modèle. */
export function numero(n: number, style: Modele['numerotation']): string {
  switch (style) {
    case 'romain':     return `${ROMAINS[n - 1] ?? n}.`
    case 'decimal':    return `${n}.`
    case 'paragraphe': return `§ ${n}`
    case 'lettre':     return `${String.fromCharCode(64 + n)}.`
    default:           return `Article ${n}`
  }
}
