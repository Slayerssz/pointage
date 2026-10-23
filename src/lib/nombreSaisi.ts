/**
 * LIRE UN NOMBRE TAPÉ À LA MAIN.
 *
 * Au Maroc comme en France, on sépare les décimales par une virgule :
 * « 3000,50 ». Or un `<input type="number">` ne l'accepte pas — et il
 * ne se contente pas de la refuser, il l'escamote : taper « 3000,50 »
 * laisse dans le champ la valeur « 300050 ». Un bulletin de trois mille
 * dirhams devenait un bulletin de trois cent mille, sans un mot.
 *
 * D'où des champs en texte, et cette lecture-ci : la virgule vaut le
 * point, les espaces de groupement tombent, et ce qui n'est pas un
 * nombre est refusé franchement au lieu de valoir zéro.
 *
 * Le fichier ne dépend de rien : les essais le chargent seul.
 */

/** Ce que l'utilisateur a le droit de taper au fil de la frappe. */
const FRAPPE = /^-?[\d    ]*[.,]?\d*$/

/**
 * Le nombre saisi, ou `null` si le texte n'en est pas un. Un champ vide
 * vaut `null` lui aussi : c'est à l'appelant de décider si l'absence
 * est permise.
 */
export function lireNombre(texte: string): number | null {
  const net = texte.replace(/[    ]/g, '').replace(',', '.')
  if (net === '' || net === '-' || net === '.' || net === '-.') return null
  if (!/^-?\d*\.?\d+$/.test(net)) return null
  const n = Number(net)
  return Number.isFinite(n) ? n : null
}

/** Le nombre saisi, ou `defaut` quand le champ est vide ou illisible. */
export const lireNombreOu = (texte: string, defaut = 0): number =>
  lireNombre(texte) ?? defaut

/**
 * Vrai si l'on peut laisser taper cela — y compris les états de
 * passage : « 3 », « 3, », « -». Refuser au caractère près évite de
 * voir apparaître une lettre au milieu d'un montant.
 */
export const frappeAcceptable = (texte: string): boolean =>
  texte === '' || FRAPPE.test(texte)

/** Écrit un nombre comme on le tape : virgule décimale, sans séparateur. */
export const ecrireNombre = (n: number | null | undefined): string =>
  n == null ? '' : String(n).replace('.', ',')
