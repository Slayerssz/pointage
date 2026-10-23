/**
 * L'ORDRE DE VIREMENT NE CONNAÎT PAS LES CENTIMES.
 *
 * La banque reçoit des dirhams entiers : 2 000, jamais 2 000,50. On
 * arrondit au plus proche plutôt que de tronquer — tronquer retiendrait
 * un centime à l'employé à chaque ligne, toujours dans le même sens.
 *
 * Une règle, un seul endroit : le PDF, la somme en toutes lettres et le
 * tableur s'en servent tous les trois. Sans cela, le total écrit en
 * lettres finirait par ne plus égaler la colonne qu'il résume.
 *
 * Le fichier ne dépend de rien, exprès : les essais le chargent seul.
 */

export const dirhams = (v: number | string | null | undefined) =>
  Math.round(Number(v ?? 0)) || 0

/**
 * Le total d'une liste. Chaque ligne est arrondie AVANT la somme, et
 * non l'inverse : c'est la colonne imprimée qui doit s'additionner, pas
 * les centimes qu'on vient d'effacer.
 */
export const totalDirhams = (lignes: { net_a_payer: number | string }[]) =>
  lignes.reduce((s, l) => s + dirhams(l.net_a_payer), 0)

/**
 * Le montant tel qu'il s'imprime sur l'ordre : arrondi au dirham, puis
 * écrit avec ses deux décimales — qui sont donc toujours « 00 ».
 * « 3 115,00 », jamais « 3 115,38 ». La banque lit une colonne de
 * montants à deux décimales ; ce sont les centimes qu'on ne veut pas,
 * pas la virgule.
 *
 * L'espace de groupement est ramenée à l'espace ordinaire : les polices
 * intégrées au PDF ne connaissent pas l'espace fine insécable et
 * l'impriment en barre oblique — « 3/115,00 ».
 */
export const ecrireDirhams = (v: number | string | null | undefined) =>
  v == null ? '' : dirhams(v)
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[\u202f\u00a0\s]/g, ' ')
