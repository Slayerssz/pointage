import { chargerImage } from './chargerImage'
import { formatDateFr } from './dates'
import { enteteDe } from './entetes'
import type { Employee } from './types'

/**
 * LA LISTE SIMPLIFIÉE EN PDF, TRACÉE — PAS PHOTOGRAPHIÉE.
 *
 * C'est la liste qui sort de l'entreprise : le client la reçoit. Elle
 * passait par une capture d'écran, qui perd les filets d'un tableau à
 * bordures fusionnées et rendait une colonne de texte nu.
 *
 * Le dessin suit le modèle papier, dans le même ordre : le logo, le
 * numéro de marché, les deux titres soulignés, le bandeau de période,
 * le tableau à quatre colonnes, et les mentions légales en pied — une
 * seule fois, à la fin, comme à l'impression.
 */

/** « #0f2155 » → [15, 33, 85]. Noir si la couleur n'est pas lisible. */
export function versRvb(couleur: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(couleur.trim())
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** La couleur éclaircie du bandeau : `part` d'accent, le reste de blanc. */
export function eclaircir(couleur: string, part: number): [number, number, number] {
  const [r, v, b] = versRvb(couleur)
  const melange = (c: number) => Math.round(c * part + 255 * (1 - part))
  return [melange(r), melange(v), melange(b)]
}

export async function dessinerListeSimplifiee(opts: {
  employees: Employee[]
  entreprise: string
  modeleDocument?: string | null
  marche: string
  intitule: string
  etablissement: string
  du: string
  au: string
  /** Injectable pour les essais hors navigateur. */
  logoCharge?: (url: string) => Promise<string | null>
}) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ])
  const autoTable = autoTableMod.default
  const { employees, entreprise, marche, intitule, etablissement } = opts

  const entete = enteteDe(entreprise, opts.modeleDocument)
  const logo = entete.logo
    ? await (opts.logoCharge ?? chargerImage)(entete.logo)
    : null
  const teinte = eclaircir(entete.accent, 0.22)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const largeur = doc.internal.pageSize.getWidth()
  const hauteur = doc.internal.pageSize.getHeight()
  const MARGE = 14
  let y = 14

  // Le logo, centré, sur 28 mm de haut au plus — ses proportions sont
  // gardées : un logo étiré se remarque tout de suite.
  if (logo) {
    const p = doc.getImageProperties(logo)
    const h = 26
    const l = (p.width / p.height) * h
    doc.addImage(logo, (largeur - l) / 2, y, l, h)
    y += h + 6
  } else {
    doc.setFontSize(15).setFont('helvetica', 'bold').setTextColor(...versRvb(entete.accent))
    doc.text(entreprise.toUpperCase(), largeur / 2, y + 7, { align: 'center' })
    doc.setTextColor(0)
    y += 14
  }

  if (marche.trim()) {
    doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(0)
    doc.text(`MARCHE N°: ${marche}`, MARGE, y)
    y += 8
  }

  // Les deux titres, centrés et soulignés comme sur le modèle.
  const titreSouligne = (texte: string, taille: number) => {
    doc.setFontSize(taille).setFont('helvetica', 'bold')
    doc.text(texte, largeur / 2, y, { align: 'center' })
    const l = doc.getTextWidth(texte)
    doc.setLineWidth(0.3)
    doc.line((largeur - l) / 2, y + 1.1, (largeur + l) / 2, y + 1.1)
    y += taille * 0.52 + 3
  }
  titreSouligne(intitule, 13)
  titreSouligne(etablissement, 11)
  y += 4

  // Le bandeau de période, à la largeur du tableau.
  const LARGEUR_TABLE = largeur - 2 * MARGE
  const HAUT_BANDEAU = 8
  doc.setFillColor(...teinte)
  doc.setDrawColor(0)
  doc.setLineWidth(0.2)
  doc.rect(MARGE, y, LARGEUR_TABLE, HAUT_BANDEAU, 'FD')
  doc.setFontSize(11).setFont('helvetica', 'bolditalic')
  doc.text(
    `Période Du ${formatDateFr(opts.du)} Au ${formatDateFr(opts.au)}`,
    largeur / 2, y + HAUT_BANDEAU / 2 + 1.5, { align: 'center' },
  )
  y += HAUT_BANDEAU

  const parts = [0.12, 0.46, 0.21, 0.21]
  const styleColonne: Record<number, object> = {}
  parts.forEach((p, i) => {
    styleColonne[i] = {
      cellWidth: LARGEUR_TABLE * p,
      halign: i === 1 ? 'left' : 'center',
      ...(i === 1 ? { fontStyle: 'italic' } : {}),
    }
  })

  autoTable(doc, {
    startY: y,
    head: [['N°', 'NOM ET PRENOM', 'N°CIN', 'N° DE CNSS']],
    body: employees.map((e, i) => [
      String(i + 1), e.nom_prenom, e.cin || '—', e.cnss || '—',
    ]),
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: {
      fillColor: teinte, textColor: 0, fontStyle: 'bolditalic', halign: 'center', fontSize: 10,
    },
    columnStyles: styleColonne,
    margin: { left: MARGE, right: MARGE, top: 14 },
  })

  // Les mentions légales, une seule fois, en bas de la dernière page.
  // Toutes les sociétés n'en impriment pas : sans elles, la page se
  // termine simplement après le tableau.
  const pied = entete.pied
  if (pied) {
    const fin = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    const lignes = [
      `Siège Social : ${pied.siegeSocial}`,
      [pied.if && `IF : ${pied.if}`, pied.rc && `RC : ${pied.rc}`,
       pied.patente && `PATENTE : ${pied.patente}`, pied.cnss && `CNSS : ${pied.cnss}`,
       pied.ice && `ICE : ${pied.ice}`].filter(Boolean).join('   '),
      [pied.rib && `${pied.banque ?? 'RIB'} : ${pied.rib}`,
       pied.tel && `TEL : ${pied.tel}`,
       pied.mail && `MAIL : ${pied.mail}`].filter(Boolean).join('   '),
    ].filter((l) => l.trim())

    // En bas de page si la place le permet, juste sous le tableau sinon.
    const hautPied = lignes.length * 3.4 + 4
    const yPied = Math.max(fin + 8, hauteur - MARGE - hautPied)

    doc.setFillColor(...versRvb(entete.accent))
    doc.rect(MARGE, yPied, LARGEUR_TABLE, 2.5, 'F')
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(0)
    lignes.forEach((l, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
      doc.text(l, largeur / 2, yPied + 6 + i * 3.4, { align: 'center' })
    })
  }

  return doc
}

/** Trace, puis enregistre le fichier. */
export async function enregistrerListeSimplifieePdf(
  opts: Parameters<typeof dessinerListeSimplifiee>[0] & { nomFichier: string },
): Promise<void> {
  const doc = await dessinerListeSimplifiee(opts)
  doc.save(opts.nomFichier.endsWith('.pdf') ? opts.nomFichier : `${opts.nomFichier}.pdf`)
}
