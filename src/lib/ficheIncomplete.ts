/**
 * CE QUI MANQUE SUR UNE FICHE.
 *
 * Pour inscrire quelqu'un, son nom suffit : on ne va pas bloquer une
 * embauche parce que la C.N.S.S. n'est pas encore revenue. Mais une
 * fiche à trous finit par coûter cher — on ne déclare pas quelqu'un
 * sans C.I.N., et on ne vire pas un salaire sans R.I.B.
 *
 * D'où le rouge : il ne refuse rien, il rappelle ce qu'il reste à
 * remplir. La liste est ici, et nulle part ailleurs, pour que l'écran,
 * le filtre et le compte disent tous la même chose.
 *
 * Le fichier ne dépend de rien : les essais le chargent seul.
 */

/** Ce qu'on attend d'une fiche, et le nom qu'on lui donne à l'écran. */
export const CHAMPS_ATTENDUS = [
  { champ: 'cin', label: 'C.I.N.' },
  { champ: 'cnss', label: 'N° C.N.S.S.' },
  { champ: 'date_naissance', label: 'Date de naissance' },
  { champ: 'date_embauche', label: 'Date d’embauche' },
  { champ: 'telephone', label: 'Téléphone' },
  { champ: 'salaire', label: 'Salaire' },
  { champ: 'mode_reglement', label: 'Mode de règlement' },
] as const

/** Ce qu'il faut savoir d'une fiche pour la juger : les champs attendus. */
export interface FicheLisible {
  cin?: string | null
  cnss?: string | null
  date_naissance?: string | null
  date_embauche?: string | null
  telephone?: string | null
  salaire?: number | string | null
  mode_reglement?: string | null
  rib?: string | null
}

/** Une valeur absente : null, vide, ou des espaces. */
const vide = (v: unknown): boolean =>
  v == null || (typeof v === 'string' && v.trim() === '')

/**
 * Les champs qui manquent, nommés comme à l'écran. Liste vide : la
 * fiche est complète.
 *
 * Le R.I.B. n'est exigé que de ceux qu'on paie par virement : le
 * réclamer à quelqu'un payé en espèces mettrait du rouge sur une fiche
 * qui n'a rien à se reprocher.
 */
export function champsManquants(
  employe: FicheLisible | null | undefined,
): string[] {
  if (!employe) return []
  const lu = employe as Record<string, unknown>
  const manquants: string[] = CHAMPS_ATTENDUS
    .filter(({ champ }) => vide(lu[champ]))
    .map(({ label }) => label)

  const mode = String(lu.mode_reglement ?? '').toLowerCase()
  if (mode.includes('virement') && vide(lu.rib)) manquants.push('R.I.B.')

  return manquants
}

/** Vrai dès qu'il manque quelque chose. */
export const ficheIncomplete = (employe: FicheLisible | null | undefined): boolean =>
  champsManquants(employe).length > 0
