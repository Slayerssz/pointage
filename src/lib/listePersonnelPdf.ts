import { formatDateFr } from './dates'
import { formatDH } from './montants'

/**
 * Un montant pour le PDF. `toLocaleString` sépare les milliers par une
 * espace fine insécable ; les polices intégrées au PDF ne la
 * connaissent pas et l'impriment en barre oblique — « 3/192,00 ». On la
 * ramène à une espace ordinaire.
 */
const dh = (n: number | null | undefined) =>
  formatDH(n).replace(/[\u202f\u00a0\s]/g, ' ')
import type { Employee } from './types'

/**
 * LA LISTE DU PERSONNEL EN PDF, TRACÉE — PAS PHOTOGRAPHIÉE.
 *
 * « Enregistrer en PDF » passait par une capture de l'écran. Sur un
 * tableau à bordures fusionnées, la capture perd les filets : on
 * recevait des colonnes de texte nu, sans une seule ligne, serrées les
 * unes contre les autres. Rien à voir avec la feuille imprimée.
 *
 * Ici les colonnes sont déclarées et c'est autotable qui place tout :
 * les filets sont de vrais traits, le texte reste du texte — on peut le
 * chercher et le copier — et les en-têtes se répètent en haut de chaque
 * page, comme le fait le papier.
 *
 * La mise en page suit celle de l'impression, dans le même ordre : le
 * titre, puis chaque annexe avec son effectif, ses gens, son total, et
 * le total général pour finir.
 */

/** Les colonnes, dans l'ordre du document imprimé. */
const COLONNES = [
  { titre: 'N°', largeur: 12, aligne: 'right' },
  { titre: 'Nom & Prénom', largeur: 44, aligne: 'left' },
  { titre: 'Qualification', largeur: 38, aligne: 'left' },
  { titre: 'C.I.N.', largeur: 20, aligne: 'left' },
  { titre: 'N° CNSS', largeur: 22, aligne: 'left' },
  { titre: 'Naissance', largeur: 20, aligne: 'left' },
  { titre: 'Embauche', largeur: 20, aligne: 'left' },
  { titre: 'Téléphone', largeur: 24, aligne: 'left' },
  { titre: 'Ville', largeur: 30, aligne: 'left' },
  { titre: 'Règlement', largeur: 20, aligne: 'left' },
  { titre: 'Salaire', largeur: 22, aligne: 'right' },
] as const

export interface GroupeDeSite {
  /** Le nom de l'annexe. */
  site: string
  /** Son site principal de rattachement, s'il en a un. */
  principal?: string | null
  /** La société, rappelée en vue « toutes les entreprises ». */
  societe?: string | null
  employees: Employee[]
}

/** Le salaire d'une personne, en nombre, zéro s'il n'est pas renseigné. */
const salaire = (e: Employee) => Number(e.salaire ?? 0)

/** La somme des salaires d'un groupe. */
export const totalSalaires = (liste: Employee[]) =>
  liste.reduce((t, e) => t + salaire(e), 0)

/**
 * Les rangées du tableau, dans l'ordre, et le repère de celles qui ne
 * sont pas des personnes : titre d'annexe et total. Séparé du tracé
 * pour pouvoir le vérifier sans navigateur.
 */
export function rangeesListePersonnel(groupes: GroupeDeSite[]) {
  const corps: unknown[][] = []
  const titres = new Set<number>()
  const totaux = new Set<number>()

  for (const g of groupes) {
    const intitule = [
      g.societe ? `${g.societe} ·` : null,
      g.site,
      g.principal ? `— ${g.principal}` : null,
    ].filter(Boolean).join(' ')

    titres.add(corps.length)
    corps.push([
      { content: intitule, colSpan: COLONNES.length - 1, styles: { halign: 'left' } },
      { content: `${g.employees.length} employé(s)` },
    ])

    for (const e of g.employees) {
      corps.push([
        e.matricule ?? '—',
        e.actif ? e.nom_prenom : `${e.nom_prenom} (sorti)`,
        e.qualification ?? '—',
        e.cin ?? '—',
        e.cnss ?? '—',
        formatDateFr(e.date_naissance),
        formatDateFr(e.date_embauche),
        e.telephone ?? '—',
        e.ville ?? '—',
        e.mode_reglement ?? '—',
        e.salaire != null ? dh(e.salaire) : '—',
      ])
    }

    totaux.add(corps.length)
    corps.push([
      { content: `Total ${g.site}`, colSpan: COLONNES.length - 1, styles: { halign: 'right' } },
      { content: dh(totalSalaires(g.employees)) },
    ])
  }

  return { corps, titres, totaux }
}

export async function dessinerListePersonnel(opts: {
  groupes: GroupeDeSite[]
  /** Le nom imprimé en tête : la société, ou « toutes les entreprises ». */
  titre: string
  /** Ce qui a été filtré, rappelé sous le titre. */
  intitule?: string
  effectif: number
  total: number
}) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ])
  const autoTable = autoTableMod.default

  // Paysage : onze colonnes ne tiennent pas en portrait.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const largeur = doc.internal.pageSize.getWidth()

  const MARGE = 8
  const DISPO = largeur - 2 * MARGE

  doc.setFontSize(13).setFont('helvetica', 'bold')
  doc.text(opts.titre.toUpperCase(), largeur / 2, 12, { align: 'center' })

  // Le filtre — le plus souvent l'annexe — tient sur la ligne du titre :
  // sur sa propre ligne, il coûtait une rangée du tableau. Un nom long
  // passe en dessous plutôt que de déborder de la page.
  doc.setFontSize(11)
  const titre = 'LISTE DU PERSONNEL'
  const suite = opts.intitule ? ` — ${opts.intitule}` : ''
  let y = 17.5
  if (suite && doc.getTextWidth(titre + suite) <= DISPO) {
    doc.text(titre + suite, largeur / 2, y, { align: 'center' })
    y += 5
  } else {
    doc.text(titre, largeur / 2, y, { align: 'center' })
    y += 5
    if (suite) {
      doc.setFontSize(9.5)
      for (const l of doc.splitTextToSize(opts.intitule!, DISPO) as string[]) {
        doc.text(l, largeur / 2, y, { align: 'center' })
        y += 4.4
      }
    }
  }

  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(90)
  doc.text(
    `${opts.effectif} employé(s) · éditée le ${new Date().toLocaleDateString('fr-FR')}`,
    largeur / 2, y, { align: 'center' },
  )
  doc.setTextColor(0)

  const { corps, titres, totaux } = rangeesListePersonnel(opts.groupes)

  // Les largeurs sont déclarées en millimètres « idéaux » ; on les
  // ramène à l'échelle pour occuper exactement la largeur disponible.
  // `cellWidth` compte la marge intérieure : la retrancher débordait de
  // la page d'autant de millimètres qu'il y a de colonnes.
  const PADDING = 0.7
  const somme = COLONNES.reduce((t, c) => t + c.largeur, 0)
  const echelle = DISPO / somme

  const styleColonne: Record<number, object> = {}
  COLONNES.forEach((c, i) => {
    styleColonne[i] = { halign: c.aligne, cellWidth: c.largeur * echelle }
  })

  autoTable(doc, {
    startY: y + 2.5,
    head: [COLONNES.map((c) => c.titre)],
    body: corps as never,
    theme: 'grid',
    styles: {
      fontSize: 7.5, cellPadding: { top: PADDING, bottom: PADDING, left: 1.1, right: 1.1 }, lineColor: [120, 120, 120], lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold', halign: 'center',
      fontSize: 7,
    },
    columnStyles: styleColonne,
    // Le titre d'annexe et son total se cherchent des yeux : ils sont
    // les deux repères quand on parcourt une liste de deux cents noms.
    didParseCell: (donnees) => {
      if (donnees.section !== 'body') return
      if (titres.has(donnees.row.index)) {
        donnees.cell.styles.fontStyle = 'bold'
        donnees.cell.styles.fillColor = [226, 232, 240]
        donnees.cell.styles.fontSize = 8
      } else if (totaux.has(donnees.row.index)) {
        donnees.cell.styles.fontStyle = 'bold'
        donnees.cell.styles.fillColor = [241, 245, 249]
      }
    },
    margin: { left: MARGE, right: MARGE, top: 10 },
  })

  // Le total général, sous le tableau, sur la dernière page.
  const fin = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFontSize(9).setFont('helvetica', 'bold')
  doc.text(
    `TOTAL GÉNÉRAL : ${opts.effectif} employé(s) — ${dh(opts.total)}`,
    largeur - MARGE, fin + 6, { align: 'right' },
  )

  return doc
}

/** Trace, puis enregistre le fichier. */
export async function enregistrerListePersonnelPdf(
  opts: Parameters<typeof dessinerListePersonnel>[0] & { nomFichier: string },
): Promise<void> {
  const doc = await dessinerListePersonnel(opts)
  doc.save(opts.nomFichier.endsWith('.pdf') ? opts.nomFichier : `${opts.nomFichier}.pdf`)
}
