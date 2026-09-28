import type { LignePaie } from './types'

/**
 * L'ÉTAT DES SALAIRES — la liste de paie du mois, telle que le groupe
 * l'établit sur papier : les salariés rangés par site, chaque site
 * précédé de son effectif et suivi de ses totaux, puis le total de la
 * société.
 *
 * C'est la liste de travail du bureau : qui, combien brut, combien net
 * — et le R.I.B. quand l'argent part en banque. Les pièces qui sortent
 * de la maison (ordre de virement, liste des versements, reçus
 * d'espèces) ont chacune leur propre modèle, ailleurs.
 *
 * Les colonnes sont décrites ici, et nulle part ailleurs : l'aperçu à
 * l'écran et le PDF s'en servent tous deux, et ne peuvent donc pas
 * diverger sur ce qu'ils montrent ni sur ce qu'ils additionnent.
 */
export interface ColonneEtat {
  cle: string
  titre: string
  /** Le texte de la cellule. */
  texte: (l: LignePaie) => string
  /** Présente sur les colonnes d'argent : ce qui s'additionne. */
  montant?: (l: LignePaie) => number
  /** Largeur indicative, en millimètres. */
  largeur: number
  aligne: 'left' | 'right'
  /** Les chiffres d'un R.I.B. se lisent mieux en chasse fixe. */
  mono?: boolean
}

/** Un montant à la française, sans devise : la colonne la porte déjà. */
export const n2 = (v: number | null | undefined) =>
  v == null ? '' : Number(v).toLocaleString('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).replace(/[  \s]/g, ' ')

const argent = (
  cle: string, titre: string, lire: (l: LignePaie) => number, largeur = 22,
): ColonneEtat => ({
  cle, titre, largeur, aligne: 'right',
  texte: (l) => n2(lire(l)),
  montant: lire,
})

export function colonnesEtat(o: { avecRib: boolean }): ColonneEtat[] {
  const colonnes: ColonneEtat[] = [
    { cle: 'mat', titre: 'Mat.', largeur: 14, aligne: 'left',
      texte: (l) => (l.matricule != null ? String(l.matricule) : '') },
    { cle: 'nom', titre: 'Nom & Prénom', largeur: 56, aligne: 'left',
      texte: (l) => l.nom_prenom.toUpperCase() },
  ]
  if (o.avecRib) {
    colonnes.push({
      cle: 'rib', titre: 'R.I.B.', largeur: 46, aligne: 'left', mono: true,
      texte: (l) => (l.rib ?? '').replace(/\s/g, ''),
    })
  }
  colonnes.push(
    argent('brut', 'Salaire', (l) => Number(l.salaire_brut), 26),
    argent('net', 'Salaire Net', (l) => Number(l.net_a_payer), 26),
  )
  return colonnes
}

export interface GroupeEtat {
  site: string
  lignes: LignePaie[]
}

/**
 * Les salariés par site, dans l'ordre alphabétique — celui du papier.
 * Qui n'a pas de site se retrouve à la fin, sous un intitulé qui le dit :
 * une affectation manquante doit se voir, pas se fondre dans le tas.
 */
export function grouperParSite(lignes: LignePaie[]): GroupeEtat[] {
  const SANS = '(SANS SITE)'
  const par = new Map<string, LignePaie[]>()
  for (const l of lignes) {
    const site = (l.site_nom ?? '').trim().toUpperCase() || SANS
    par.set(site, [...(par.get(site) ?? []), l])
  }
  return [...par.entries()]
    .sort(([a], [b]) =>
      a === SANS ? 1 : b === SANS ? -1 : a.localeCompare(b, 'fr'))
    .map(([site, l]) => ({
      site,
      lignes: [...l].sort((x, y) => x.nom_prenom.localeCompare(y.nom_prenom, 'fr')),
    }))
}

/** La somme d'une colonne d'argent sur un ensemble de lignes. */
export const totalDe = (colonne: ColonneEtat, lignes: LignePaie[]) =>
  colonne.montant ? lignes.reduce((s, l) => s + colonne.montant!(l), 0) : null
