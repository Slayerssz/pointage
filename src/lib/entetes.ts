/**
 * En-têtes des entreprises : logo et couleur, repris du modèle officiel
 * « Fiche d'informations personnelles ».
 *
 * Les logos sont dans `public/entetes/` — ils ne pèsent donc pas sur
 * l'application, le navigateur les met en cache.
 *
 * Les dix sociétés du groupe y figurent. Pour en ajouter une : déposez
 * son logo dans `public/entetes/` et ajoutez une ligne ci-dessous. Une
 * société absente de cette liste s'imprime avec son nom en toutes lettres
 * et un gris neutre — la fiche reste correcte, sans logo.
 */

/**
 * Le papier à en-tête de la société : une page A4 entière, avec son
 * bandeau en haut, son filigrane au milieu et ses mentions légales en
 * bas. Le document s'imprime par-dessus.
 *
 * `haut` et `bas` bornent la bande de papier libre, mesurée sur l'image
 * même, puis reculée de quelques millimètres : au-dessus de `haut` il y
 * a le bandeau, au-dessous de `bas` le pied. Le filigrane, lui, est fait
 * pour qu'on écrive dessus.
 */
export interface PapierEntete {
  /** Chemin de l'image, servie depuis /lettres */
  image: string
  /** Premier millimètre libre sous le bandeau */
  haut: number
  /** Dernier millimètre libre avant le pied */
  bas: number
}

export interface Entete {
  /** Chemin du logo, servi depuis /entetes */
  logo: string | null
  /** Couleur du bandeau et des libellés, prélevée sur le modèle */
  accent: string
  /** Ligne sous le nom, si le logo ne la contient pas déjà */
  sousTitre?: string
  /** Les mentions légales du bas de page. Absentes tant que la société
   *  ne nous les a pas communiquées : le document se passe alors de pied. */
  pied?: PiedDePage
  /** Son papier à en-tête, quand la société nous l'a fourni. */
  papier?: PapierEntete
}

/** Le bloc d'identification légale imprimé en bas des documents officiels. */
export interface PiedDePage {
  siegeSocial: string
  if?: string
  rc?: string
  patente?: string
  cnss?: string
  ice?: string
  banque?: string
  rib?: string
  tel?: string
  mail?: string
}

const ENTETES: Record<string, Entete> = {
  'EDEN VERT SERVICE': { logo: '/entetes/eden-vert-service.png', accent: '#366d81' },
  'AL SAFAE EL MAGHREB': { logo: '/entetes/al-safae-el-maghreb.png', accent: '#0f2155' },
  'GROUPE TRIPLE A': {
    papier: { image: '/lettres/groupe-triple-a.jpg', haut: 44, bas: 268 },
    logo: '/entetes/groupe-triple-a.png',
    accent: '#94040d',
  },
  BO: {
    papier: { image: '/lettres/bo.jpg', haut: 39, bas: 269 },
    logo: '/entetes/bo.png',
    accent: '#0c6aa4',
  },
  TRIMAX: {
    papier: { image: '/lettres/trimax.jpg', haut: 49, bas: 265 },
    logo: '/entetes/trimax.png',
    accent: '#171b32',
  },
  'VIGILMA GARD MAROC': {
    logo: '/entetes/vigilma-gard-maroc.png',
    accent: '#63656a',
    pied: {
      siegeSocial: 'DRADEB 1 RUE 2 N°35 2EME ETAGE TANGER',
      if: '53692100',
      rc: '135975',
      patente: '50211305',
      cnss: '4710553',
      ice: '003258325000054',
      banque: 'ATTIJARIWAFA BANK',
      rib: '007640000601200000078590',
      tel: '+212 6 66 29 65 33',
      mail: 'vigilmagardmaroc@gmail.com',
    },
  },
  'DUO MULTI SERVICE': {
    papier: { image: '/lettres/duo-multi-service.jpg', haut: 35, bas: 261 },
    logo: '/entetes/duo-multi-service.png',
    accent: '#a8070c',
  },
  'NORD PLANET': {
    papier: { image: '/lettres/nord-planet.jpg', haut: 45, bas: 269 },
    logo: '/entetes/nord-planet.png',
    accent: '#006f9d',
  },
  'SERCLEAN NEGOCE': {
    papier: { image: '/lettres/serclean-negoce.jpg', haut: 48, bas: 239 },
    logo: '/entetes/serclean-negoce.png',
    accent: '#2c2667',
  },
  // Le logo porte « MEGAINTER », la base « MEGANTER » : c'est bien la même société.
  'MEGAINTER SERVICE MAROC': {
    papier: { image: '/lettres/meganter-service-maroc.jpg', haut: 59, bas: 274 },
    logo: '/entetes/meganter-service-maroc.png',
    accent: '#616364',
  },
}

/** En-tête neutre, pour une entreprise dont le logo n'a pas encore été fourni. */
const NEUTRE: Entete = { logo: null, accent: '#3f4a55' }

/**
 * Les formes juridiques et les préfixes d'usage : ils changent d'un
 * document à l'autre sans changer la société. « B.O NETTOYAGE S.A.R.L »
 * et « BO » sont la même maison.
 */
const FORMES = ['SARL AU', 'SARLAU', 'SARL', 'S A R L', 'SNC', 'SAS', 'SA',
                'NV', 'EURL', 'COOPERATIVE', 'SOCIETE', 'STE']

/**
 * Comparaison insensible à la casse, aux accents et à la ponctuation.
 *
 * Deux précautions de plus, apprises à nos dépens : les initiales
 * pointées se recollent — « B.O » devient « BO », sinon le nom ne
 * ressemble plus à rien — et la forme juridique tombe, où qu'elle soit
 * dans le nom. Sans cela, une société enregistrée sous sa raison sociale
 * complète perdait silencieusement son papier à en-tête.
 */
function cle(nom: string): string {
  let n = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
  // Les lettres isolées se recollent : « B O » → « BO », « S A R L » → « SARL ».
  n = n.replace(/\b(?:[A-Z] )+[A-Z]\b/g, (m) => m.replace(/ /g, ''))
  for (const forme of FORMES) {
    const f = forme.replace(/ /g, '')
    n = n.replace(new RegExp(`(^|\\s)${f}(\\s|$)`, 'g'), ' ')
  }
  return n.replace(/\s+/g, ' ').trim()
}

/** Les autres façons dont une société s'écrit selon la pièce qu'on lit. */
const ALIAS: Record<string, string> = {
  'GROUPE TRIPLE AAA': 'GROUPE TRIPLE A',
  GTA: 'GROUPE TRIPLE A',
  'MEGANTER SERVICE MAROC': 'MEGAINTER SERVICE MAROC',
  'BO NETTOYAGE': 'BO',
  'NORD PLANET NEGOCE': 'NORD PLANET',
  SERCLEAN: 'SERCLEAN NEGOCE',
  'AL SAFAE EL MAGHRIB': 'AL SAFAE EL MAGHREB',
  'COOPERATIVE AL SAFAE EL MAGHRIB': 'AL SAFAE EL MAGHREB',
  'COOPERATIVE EDEN VERT SERVICE': 'EDEN VERT SERVICE',
  'TRIMAX SURVEILLANCE': 'TRIMAX',
  'VIGILMA GARD': 'VIGILMA GARD MAROC',
}

const PAR_CLE = new Map(Object.entries(ENTETES).map(([k, v]) => [cle(k), v]))
for (const [autre, officiel] of Object.entries(ALIAS)) {
  const e = ENTETES[officiel]
  if (e) PAR_CLE.set(cle(autre), e)
}

/**
 * L'en-tête d'une entreprise. La clé de modèle prime sur le nom : une
 * société renommée garde son en-tête.
 */
/**
 * Le plus long nom connu que celui-ci contient. Dernier recours, quand
 * ni le nom ni ses variantes ne tombent juste : « BO NETTOYAGE TANGER »
 * reste du BO. On prend le plus long pour éviter qu'un nom court
 * n'attrape à tort une société dont il n'est qu'un morceau.
 */
function parRessemblance(k: string): Entete | undefined {
  let meilleur: { taille: number; entete: Entete } | undefined
  for (const [connu, entete] of PAR_CLE) {
    if (connu.length < 3) continue
    const contenu = k === connu
      || k.startsWith(connu + ' ') || k.endsWith(' ' + connu)
      || k.includes(' ' + connu + ' ')
    if (contenu && (!meilleur || connu.length > meilleur.taille)) {
      meilleur = { taille: connu.length, entete }
    }
  }
  return meilleur?.entete
}

export function enteteDe(
  nomEntreprise: string | undefined | null,
  modeleDocument?: string | null,
): Entete {
  for (const candidat of [modeleDocument, nomEntreprise]) {
    if (!candidat) continue
    const k = cle(candidat)
    const e = PAR_CLE.get(k) ?? parRessemblance(k)
    if (e) return e
  }
  return NEUTRE
}

/** Les entreprises qui disposent d'un en-tête officiel. */
export function entreprisesAvecEntete(): string[] {
  return Object.keys(ENTETES)
}
