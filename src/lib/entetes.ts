/**
 * En-têtes des entreprises : logo et couleur, repris du modèle officiel
 * « Fiche d'informations personnelles ».
 *
 * Les logos sont dans `public/entetes/` — ils ne pèsent donc pas sur
 * l'application, le navigateur les met en cache.
 *
 * Pour ajouter une entreprise : déposez son logo dans `public/entetes/`
 * et ajoutez une ligne ci-dessous. Une entreprise absente de cette liste
 * s'imprime avec son nom en toutes lettres et un gris neutre — la fiche
 * reste correcte, elle n'a simplement pas encore son logo.
 */

export interface Entete {
  /** Chemin du logo, servi depuis /entetes */
  logo: string | null
  /** Couleur du bandeau et des libellés, prélevée sur le modèle */
  accent: string
  /** Ligne sous le nom, si le logo ne la contient pas déjà */
  sousTitre?: string
}

const ENTETES: Record<string, Entete> = {
  'EDEN VERT SERVICE':    { logo: '/entetes/eden-vert-service.png',   accent: '#366d81' },
  'AL SAFAE EL MAGHREB':  { logo: '/entetes/al-safae-el-maghreb.png', accent: '#0f2155' },
  'GROUPE TRIPLE A':      { logo: '/entetes/groupe-triple-a.png',     accent: '#94040d' },
  'BO':                   { logo: '/entetes/bo.png',                  accent: '#0c6aa4' },
  'TRIMAX':               { logo: '/entetes/trimax.png',              accent: '#171b32' },
  'VIGILMA GARD MAROC':   { logo: '/entetes/vigilma-gard-maroc.png',  accent: '#63656a' },
}

/** En-tête neutre, pour une entreprise dont le logo n'a pas encore été fourni. */
const NEUTRE: Entete = { logo: null, accent: '#3f4a55' }

/** Comparaison insensible à la casse, aux accents et à la ponctuation. */
function cle(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

const PAR_CLE = new Map(Object.entries(ENTETES).map(([k, v]) => [cle(k), v]))

/** L'en-tête d'une entreprise, ou un en-tête neutre si elle n'en a pas encore. */
export function enteteDe(nomEntreprise: string | undefined | null): Entete {
  if (!nomEntreprise) return NEUTRE
  return PAR_CLE.get(cle(nomEntreprise)) ?? NEUTRE
}

/** Les entreprises qui disposent d'un en-tête officiel. */
export function entreprisesAvecEntete(): string[] {
  return Object.keys(ENTETES)
}
