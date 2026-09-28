import { MOIS_FR } from './dates'
import { colonnesEtat, grouperParSite, n2, totalDe, type ColonneEtat } from './etatSalaires'
import type { LignePaie } from './types'

/**
 * L'état des salaires en PDF, tracé par autotable.
 *
 * Pas de capture d'écran : un tableau photographié ressort flou et se
 * coupe mal entre deux pages. Ici les colonnes sont déclarées, et c'est
 * la bibliothèque qui répartit les lignes — les en-têtes se répètent en
 * haut de chaque page, ce que le papier fait aussi.
 */
export async function dessinerEtatSalaires(opts: {
  lignes: LignePaie[]
  entreprise: string
  annee: number
  mois: number
  avecRib: boolean
  /** Le mode de règlement affiché, rappelé en sous-titre. */
  mode?: string | null
}) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ])
  const autoTable = autoTableMod.default
  const { lignes, entreprise, annee, mois, avecRib } = opts

  const colonnes = colonnesEtat({ avecRib })
  const groupes = grouperParSite(lignes)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const largeur = doc.internal.pageSize.getWidth()

  doc.setFontSize(14).setFont('helvetica', 'bold')
  doc.text(`${entreprise.toUpperCase()} — ${MOIS_FR[mois - 1]} ${annee}`, largeur / 2, 14,
           { align: 'center' })
  doc.setFontSize(10).setFont('helvetica', 'normal')
  doc.text(`Salariés ${opts.mode ? opts.mode.toLowerCase() : 'tous'}`, largeur / 2, 20,
           { align: 'center' })

  // Une rangée de sous-total : l'effectif à gauche, le site, puis les
  // sommes sous leurs colonnes.
  const rangeeGroupe = (intitule: string, nombre: number | null, ensemble: LignePaie[]) =>
    colonnes.map((c, i) => {
      if (i === 0) return nombre == null ? '' : `Nb= ${nombre}`
      if (i === 1) return intitule
      const t = totalDe(c, ensemble)
      return t == null ? '' : n2(t)
    })

  const corps: (string | { content: string })[][] = []
  const lignesGrasses = new Set<number>()
  for (const g of groupes) {
    lignesGrasses.add(corps.length)
    corps.push(rangeeGroupe(g.site, g.lignes.length, g.lignes))
    for (const l of g.lignes) corps.push(colonnes.map((c) => c.texte(l)))
  }
  lignesGrasses.add(corps.length)
  corps.push(rangeeGroupe(`TOTAL ${entreprise.toUpperCase()}`, lignes.length, lignes))

  // Les largeurs sont déclarées en millimètres « idéaux ». Selon le
  // nombre de colonnes et l'orientation, leur somme tombe au-dessus ou
  // en dessous de la page : on les ramène toutes à l'échelle, pour que
  // le tableau occupe exactement la largeur disponible. La marge
  // intérieure des cellules n'entre pas dans `cellWidth` : elle se
  // retranche d'abord.
  const MARGE = 10
  const PADDING = 1.4
  const dispo = largeur - 2 * MARGE - colonnes.length * 2 * PADDING
  const somme = colonnes.reduce((t, c) => t + c.largeur, 0)
  const echelle = dispo / somme

  const styleColonne: Record<number, object> = {}
  colonnes.forEach((c, i) => {
    styleColonne[i] = {
      halign: c.aligne, cellWidth: c.largeur * echelle,
      ...(c.mono ? { font: 'courier', fontSize: 7.5 } : {}),
    }
  })

  autoTable(doc, {
    startY: 26,
    head: [colonnes.map((c) => c.titre)],
    body: corps,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: PADDING, lineColor: [120, 120, 120], lineWidth: 0.1 },
    headStyles: {
      fillColor: [217, 217, 217], textColor: 20, fontStyle: 'bold', halign: 'center',
    },
    columnStyles: styleColonne,
    // Les rangées de sous-total se distinguent du reste : c'est ce qu'on
    // cherche des yeux en parcourant la liste.
    didParseCell: (donnees) => {
      if (donnees.section === 'body' && lignesGrasses.has(donnees.row.index)) {
        donnees.cell.styles.fontStyle = 'bold'
        donnees.cell.styles.fillColor = [235, 235, 235]
      }
    },
    margin: { left: MARGE, right: MARGE },
  })

  return doc
}

/** Trace, puis enregistre le fichier. */
export async function enregistrerEtatSalairesPdf(opts: {
  lignes: LignePaie[]
  entreprise: string
  annee: number
  mois: number
  avecRib: boolean
  mode?: string | null
  nomFichier: string
}): Promise<void> {
  const doc = await dessinerEtatSalaires(opts)
  doc.save(opts.nomFichier.endsWith('.pdf') ? opts.nomFichier : `${opts.nomFichier}.pdf`)
}

export type { ColonneEtat }
