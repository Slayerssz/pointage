import { chargerImage } from './chargerImage'
import { formatDateFr } from './dates'
import { enteteDe } from './entetes'
import { papierDe } from './ordreVirementPdf'
import {
  H_BANDEAU, H_MARCHE, H_TITRE, decouperListeSimplifiee, titreSurUneLigne,
  type MesuresPage,
} from './listeSimplifieeMiseEnPage'
import type { Employee } from './types'

/**
 * LA LISTE SIMPLIFIÉE EN PDF, TRACÉE — PAS PHOTOGRAPHIÉE.
 *
 * C'est la liste qui sort de l'entreprise : le client la reçoit. Elle
 * passait par une capture d'écran, qui perd les filets d'un tableau à
 * bordures fusionnées et rendait une colonne de texte nu.
 *
 * Elle est posée sur le papier à en-tête de la société, comme l'ordre de
 * virement : le logo et les mentions légales viennent du papier, et on
 * n'écrit que dans la bande qu'il laisse libre. Le découpage en pages
 * est celui de l'aperçu — la même fonction les sert tous les deux.
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
  papierCharge?: (url: string) => Promise<string | null>
}) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ])
  const autoTable = autoTableMod.default
  const { employees, entreprise, marche, intitule, etablissement } = opts

  const entete = enteteDe(entreprise, opts.modeleDocument)
  const { papier, haut, bas } = papierDe(entreprise, opts.modeleDocument)
  const image = papier
    ? await (opts.papierCharge ?? chargerImage)(papier.image)
    : null
  // Sans papier, le logo seul tient lieu d'en-tête.
  const logo = !image && entete.logo
    ? await (opts.papierCharge ?? chargerImage)(entete.logo)
    : null
  const teinte = eclaircir(entete.accent, 0.22)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const largeur = doc.internal.pageSize.getWidth()
  const MARGE = 12
  const DISPO = largeur - 2 * MARGE

  const surUneLigne = titreSurUneLigne(intitule, etablissement)
  const mesures: MesuresPage = {
    haut, bas,
    avecMarche: Boolean(marche.trim()),
    lignesDeTitre: surUneLigne ? 1 : 2,
  }
  const pages = decouperListeSimplifiee(employees, mesures)

  /**
   * Pose le papier sur la feuille courante, sous tout le reste.
   *
   * `preparee` retient la feuille qu'on vient de préparer soi-même. Sans
   * elle, le crochet d'autotable reposait le papier sur la première page
   * APRÈS qu'on y eut écrit le titre : l'image est opaque, et le titre
   * disparaissait dessous.
   */
  let preparee = 0
  const poserLePapier = () => {
    if (image) doc.addImage(image, 'JPEG', 0, 0, 210, 297)
    preparee = doc.getNumberOfPages()
  }

  const colonnes = [0.12, 0.46, 0.21, 0.21]
  const styleColonne: Record<number, object> = {}
  colonnes.forEach((p, i) => {
    styleColonne[i] = {
      cellWidth: DISPO * p,
      halign: i === 1 ? 'left' : 'center',
      ...(i === 1 ? { fontStyle: 'italic' } : {}),
    }
  })

  let numero = 0
  pages.forEach((liste, p) => {
    if (p > 0) doc.addPage('a4', 'portrait')
    poserLePapier()
    let y = haut

    if (p === 0) {
      if (logo) {
        const prop = doc.getImageProperties(logo)
        const h = 24
        doc.addImage(logo, (largeur - (prop.width / prop.height) * h) / 2, y,
                     (prop.width / prop.height) * h, h)
        y += h + 4
      }

      if (marche.trim()) {
        doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(0)
        doc.text(`MARCHE N°: ${marche}`, MARGE, y + 5)
        y += H_MARCHE
      }

      // Les titres, centrés et soulignés comme sur le modèle. Un
      // établissement court rejoint le titre ; un nom long passe dessous.
      const souligne = (texte: string, taille: number) => {
        doc.setFontSize(taille).setFont('helvetica', 'bold').setTextColor(0)
        doc.text(texte, largeur / 2, y + taille * 0.42, { align: 'center' })
        const l = Math.min(doc.getTextWidth(texte), DISPO)
        doc.setLineWidth(0.3)
        doc.line((largeur - l) / 2, y + taille * 0.42 + 1.1,
                 (largeur + l) / 2, y + taille * 0.42 + 1.1)
        y += H_TITRE
      }
      souligne(
        surUneLigne && etablissement.trim() ? `${intitule} — ${etablissement}` : intitule,
        13,
      )
      if (!surUneLigne && etablissement.trim()) souligne(etablissement, 12)
      y += 4

      // Le bandeau de période, à la largeur du tableau.
      doc.setFillColor(...teinte).setDrawColor(0).setLineWidth(0.2)
      doc.rect(MARGE, y, DISPO, H_BANDEAU, 'FD')
      doc.setFontSize(11).setFont('helvetica', 'bolditalic')
      doc.text(
        `Période Du ${formatDateFr(opts.du)} Au ${formatDateFr(opts.au)}`,
        largeur / 2, y + H_BANDEAU / 2 + 1.5, { align: 'center' },
      )
      y += H_BANDEAU
    }

    autoTable(doc, {
      startY: y,
      head: [['N°', 'NOM ET PRENOM', 'N°CIN', 'N° DE CNSS']],
      body: liste.map((e) => {
        numero += 1
        return [String(numero), e.nom_prenom, e.cin || '—', e.cnss || '—']
      }),
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 1.1, lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: {
        fillColor: teinte, textColor: 0, fontStyle: 'bolditalic', halign: 'center', fontSize: 10,
      },
      columnStyles: styleColonne,
      margin: { left: MARGE, right: MARGE, top: haut, bottom: 297 - bas },
      // Si une page devait tout de même déborder, elle reposerait quand
      // même sur le papier : une feuille blanche au milieu se verrait.
      // Celle qu'on vient de préparer, en revanche, a déjà le sien.
      willDrawPage: () => {
        if (doc.getNumberOfPages() !== preparee) poserLePapier()
      },
    })
  })

  // Les mentions légales ne sont imprimées que faute de papier : c'est
  // lui qui les porte, et les répéter ferait doublon.
  const pied = image ? null : entete.pied
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

    const yPied = Math.max(fin + 8, 297 - 14 - (lignes.length * 3.4 + 4))
    doc.setFillColor(...versRvb(entete.accent))
    doc.rect(MARGE, yPied, DISPO, 2.5, 'F')
    doc.setFontSize(7).setTextColor(0)
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
