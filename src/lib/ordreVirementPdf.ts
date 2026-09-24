/**
 * L'ordre de virement, dessiné directement dans le PDF.
 *
 * Pourquoi ne pas photographier la page ? Parce que la capture d'écran
 * (html2canvas) rend mal les tableaux et les aplats : le formulaire
 * ressortait déformé, dans une autre police, et ce n'est pas un document
 * qu'on peut se permettre d'envoyer approximatif — il part à la banque.
 * On le trace donc au millimètre, d'après le modèle papier du groupe.
 */

import { MOIS_FR } from './paie'
import type { LignePaie } from './types'

/** Page A4 et marges, en millimètres. */
// Le haut est laissé libre : un en-tête de société viendra s'y poser.
const P = { l: 210, h: 297, marge: 14, haut: 40 }

/** Les trois colonnes du tableau des bénéficiaires. */
const COL = { nom: 76, rib: 64, montant: 42 }
const LARGEUR = COL.nom + COL.rib + COL.montant

/** Cartouche : la colonne des intitulés, puis celle des valeurs. */
const CARTOUCHE = { label: 74, valeur: LARGEUR - 74, hauteur: 7 }

const LIGNE = 7.5
export const LIGNES_PAR_PAGE = 18

const GRIS: [number, number, number] = [217, 217, 217]

export interface OrdreDeVirement {
  /** Ce qui identifie la feuille : le site, la banque… */
  intitule: string
  lignes: LignePaie[]
}

/**
 * Un montant à la française. Le séparateur de milliers est forcé à
 * l'espace ordinaire : les polices intégrées au PDF ne connaissent pas
 * l'espace fine insécable que rend `toLocaleString`, et l'imprimaient
 * en barre oblique — « 2/970,00 » au lieu de « 2 970,00 ».
 */
const n2 = (v: number | string | null | undefined) =>
  v == null ? '' : Number(v)
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[\u202f\u00a0\s]/g, ' ')

/** Un R.I.B. se lit par groupes de quatre chiffres. */
const formaterRib = (v: string | null | undefined) =>
  v ? v.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim() : ''

/**
 * Dessine les ordres et renvoie le document. Séparé de l'enregistrement
 * pour qu'on puisse le rendre ailleurs qu'un navigateur — et le vérifier.
 */
export async function dessinerOrdreVirement(opts: {
  ordres: OrdreDeVirement[]
  entreprise: string
  ribOrdinateur: string | null
  annee: number
  mois: number
  /** Injectable pour les essais hors navigateur. */
  jsPDFModule?: { jsPDF: new (o: object) => unknown }
}) {
  const { jsPDF } = opts.jsPDFModule ?? (await import('jspdf'))
  const { ordres, entreprise, ribOrdinateur, annee, mois } = opts

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setLineWidth(0.4)

  const aujourdhui = new Date().toLocaleDateString('fr-FR')
  const libelle = `Virement Salaire mois ${MOIS_FR[mois - 1]} ${annee}`

  /** Une case : cadre, fond éventuel, puis le texte à l'intérieur. */
  const case_ = (
    x: number, y: number, l: number, h: number, texte: string,
    o: { gras?: boolean; fond?: boolean; aligne?: 'left' | 'right' | 'center'; taille?: number
         mono?: boolean; cadre?: boolean } = {},
  ) => {
    if (o.fond) {
      doc.setFillColor(...GRIS)
      doc.rect(x, y, l, h, o.cadre === false ? 'F' : 'FD')
    } else if (o.cadre !== false) {
      doc.rect(x, y, l, h)
    }
    if (!texte) return
    doc.setFont(o.mono ? 'courier' : 'times', o.gras ? 'bold' : 'normal')
    doc.setFontSize(o.taille ?? 10)
    const pad = 2
    const yTexte = y + h / 2 + (o.taille ?? 10) * 0.35 / 2.83
    if (o.aligne === 'right') doc.text(texte, x + l - pad, yTexte, { align: 'right' })
    else if (o.aligne === 'center') doc.text(texte, x + l / 2, yTexte, { align: 'center' })
    else doc.text(texte, x + pad, yTexte)
  }

  let premiere = true

  for (const ordre of ordres) {
    const total = ordre.lignes.reduce((s, l) => s + Number(l.net_a_payer), 0)
    const pages: LignePaie[][] = []
    for (let i = 0; i < ordre.lignes.length; i += LIGNES_PAR_PAGE) {
      pages.push(ordre.lignes.slice(i, i + LIGNES_PAR_PAGE))
    }
    if (pages.length === 0) pages.push([])

    pages.forEach((page, p) => {
      if (!premiere) doc.addPage('a4', 'portrait')
      premiere = false

      const x = P.marge
      let y = P.haut

      // ── Le cartouche ──────────────────────────────────────────────
      const ligneCartouche = (label: string, valeur: string, o: {
        valeurGrasse?: boolean; mono?: boolean; valeurCadre?: boolean
      } = {}) => {
        case_(x, y, CARTOUCHE.label, CARTOUCHE.hauteur, label, { gras: true })
        case_(x + CARTOUCHE.label, y, CARTOUCHE.valeur, CARTOUCHE.hauteur, valeur, {
          gras: o.valeurGrasse, mono: o.mono, cadre: o.valeurCadre,
        })
        y += CARTOUCHE.hauteur
      }

      // La première ligne ne porte pas de cadre à droite, comme le modèle.
      ligneCartouche(`Date        :   ${aujourdhui}`, '', { valeurCadre: false })
      ligneCartouche('RAISON SOCIAL', entreprise.toUpperCase())
      ligneCartouche('RIB ORDINATEUR', formaterRib(ribOrdinateur), { mono: true })
      ligneCartouche("NOMBRE TOTAL D'OPERATIONS", String(ordre.lignes.length))
      ligneCartouche("MONTANT TOTAL D'OPERATIONS", n2(total), { valeurGrasse: true })
      ligneCartouche('LIBELLE OPERATIONS', libelle, { valeurGrasse: true })

      y += 3

      // ── Les bénéficiaires ─────────────────────────────────────────
      const hEntete = 9
      case_(x, y, COL.nom, hEntete, 'Nom Bénéficiare', { gras: true, fond: true, aligne: 'center' })
      case_(x + COL.nom, y, COL.rib, hEntete, 'RIB Bénéficiare', { gras: true, fond: true, aligne: 'center' })
      case_(x + COL.nom + COL.rib, y, COL.montant, hEntete, 'Montant Virement', {
        gras: true, fond: true, aligne: 'center',
      })
      y += hEntete

      // Le tableau s'arrête aux bénéficiaires : trois virements font trois
      // lignes, pas dix-huit cases vides à barrer.
      for (let i = 0; i < page.length; i++) {
        const l = page[i]
        case_(x, y, COL.nom, LIGNE, l.nom_prenom.toUpperCase(), { taille: 9 })
        const rib = formaterRib(l.rib)
        if (!rib) {
          doc.setTextColor(180, 0, 0)
          case_(x + COL.nom, y, COL.rib, LIGNE, 'R.I.B. MANQUANT', { taille: 8, gras: true })
          doc.setTextColor(0, 0, 0)
        } else {
          case_(x + COL.nom, y, COL.rib, LIGNE, rib, { mono: true, taille: 8 })
        }
        case_(x + COL.nom + COL.rib, y, COL.montant, LIGNE, n2(l.net_a_payer), {
          aligne: 'right', taille: 9,
        })
        y += LIGNE
      }

      if (pages.length > 1) {
        doc.setFont('times', 'normal').setFontSize(8)
        doc.text(`${ordre.intitule} — page ${p + 1} / ${pages.length}`,
                 x + LARGEUR, y + 4, { align: 'right' })
      }

      // ── Les signatures, sur la dernière page de l'ordre ───────────
      if (p === pages.length - 1) {
        y += 6
        case_(x, y, LARGEUR, 7,
              'Partie réservée aux personnes habilitées à transmettre les ordres de virements',
              { gras: true, fond: true, taille: 9 })
        y += 7
        doc.rect(x, y, LARGEUR, 40)
        doc.setFont('times', 'bold').setFontSize(9.5)
        doc.text('Signatures  autorisées :', x + 2, y + 6)
        doc.text('Autentification Signatures "Cachet Agence":', x + LARGEUR - 2, y + 6, { align: 'right' })
      }
    })
  }

  return doc
}

/** Dessine, puis enregistre le fichier. */
export async function enregistrerOrdreVirementPdf(opts: {
  ordres: OrdreDeVirement[]
  entreprise: string
  ribOrdinateur: string | null
  annee: number
  mois: number
  nomFichier: string
}): Promise<void> {
  const doc = await dessinerOrdreVirement(opts)
  doc.save(opts.nomFichier.endsWith('.pdf') ? opts.nomFichier : `${opts.nomFichier}.pdf`)
}
