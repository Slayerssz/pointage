/**
 * Un montant écrit en toutes lettres, en français.
 *
 * L'ordre de virement porte la somme en chiffres ET en lettres : c'est
 * la mention en lettres qui fait foi si les deux divergent. Elle doit
 * donc être juste — d'où les règles d'accord, souvent mal appliquées :
 *
 *   · « vingt » et « cent » prennent un s quand ils sont multipliés et
 *     que rien d'autre ne suit : quatre-vingts, deux cents — mais
 *     quatre-vingt-deux, deux cent trois, et surtout quatre-vingt mille,
 *     deux cent mille, car « mille » est lui aussi un adjectif numéral.
 *     Devant « millions », qui est un nom, l's revient : deux cents
 *     millions ;
 *   · « mille » est invariable : deux mille ;
 *   · « million » et « milliard » sont des noms, donc accordés :
 *     deux millions ;
 *   · « et un » se dit de vingt et un à soixante et onze, jamais
 *     au-delà : quatre-vingt-un.
 */

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
]
const DIZAINES = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
  'soixante', 'quatre-vingt', 'quatre-vingt',
]

/**
 * De 0 à 99. `pluriel` dit si « quatre-vingts » peut prendre son s :
 * il le perd dès qu'un adjectif numéral suit, « quatre-vingt mille ».
 */
function souscent(n: number, pluriel = true): string {
  if (n < 20) return UNITES[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  // Soixante-dix et quatre-vingt-dix comptent par seize : 71 = soixante et onze.
  if (d === 7 || d === 9) {
    const reste = 10 + u
    const liaison = d === 7 && u === 1 ? ' et ' : '-'
    return DIZAINES[d] + liaison + UNITES[reste]
  }
  if (u === 0) return d === 8 && pluriel ? 'quatre-vingts' : DIZAINES[d]
  // « et un » jusqu'à soixante et un ; quatre-vingt-un s'en passe.
  if (u === 1 && d !== 8) return DIZAINES[d] + ' et ' + UNITES[1]
  return DIZAINES[d] + '-' + UNITES[u]
}

/**
 * De 0 à 999. `pluriel` vaut faux quand un adjectif numéral suit —
 * « deux cent mille » et non « deux cents mille ».
 */
function souscmille(n: number, pluriel = true): string {
  if (n < 100) return souscent(n, pluriel)
  const c = Math.floor(n / 100)
  const reste = n % 100
  // « cent » s'accorde quand il est multiplié et que rien ne suit.
  const tete = c === 1 ? 'cent' : UNITES[c] + (reste === 0 && pluriel ? ' cents' : ' cent')
  return reste === 0 ? tete : `${tete} ${souscent(reste)}`
}

const ECHELLES: [number, string, string][] = [
  [1_000_000_000, 'milliard', 'milliards'],
  [1_000_000, 'million', 'millions'],
]

/** La partie entière, en lettres. */
function entierEnLettres(n: number): string {
  if (n === 0) return 'zéro'
  const morceaux: string[] = []
  let reste = n

  for (const [valeur, singulier, pluriel] of ECHELLES) {
    const q = Math.floor(reste / valeur)
    if (q > 0) {
      // Million et milliard sont des noms, pas des adjectifs numéraux :
      // « cent » et « vingt » gardent leur s devant eux.
      morceaux.push(`${souscmille(q)} ${q > 1 ? pluriel : singulier}`)
      reste %= valeur
    }
  }

  const milliers = Math.floor(reste / 1000)
  if (milliers > 0) {
    // « mille » ne prend jamais d's, et « un mille » ne se dit pas.
    // « mille » est un adjectif numéral : ce qui le précède perd son s.
    morceaux.push(milliers === 1 ? 'mille' : `${souscmille(milliers, false)} mille`)
    reste %= 1000
  }
  if (reste > 0) morceaux.push(souscmille(reste))

  return morceaux.join(' ')
}

/**
 * « 48 542,50 » → « quarante-huit mille cinq cent quarante-deux dirhams
 * et cinquante centimes ».
 */
export function montantEnLettres(
  montant: number,
  devise = 'dirham',
  subdivision = 'centime',
): string {
  const negatif = montant < 0
  const arrondi = Math.round(Math.abs(montant) * 100)
  const entier = Math.floor(arrondi / 100)
  const cents = arrondi % 100

  const parties = [
    `${entierEnLettres(entier)} ${entier > 1 ? devise + 's' : devise}`,
  ]
  if (cents > 0) {
    parties.push(`${entierEnLettres(cents)} ${cents > 1 ? subdivision + 's' : subdivision}`)
  }

  const texte = parties.join(' et ')
  return negatif ? `moins ${texte}` : texte
}
