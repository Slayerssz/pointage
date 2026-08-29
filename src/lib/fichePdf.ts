/**
 * La fiche d'informations personnelles, dessinée directement dans le PDF.
 *
 * Pourquoi ne pas photographier la page ? Parce que la capture d'écran
 * (html2canvas) ne sait pas rendre les mises en page en flexbox : le
 * document ressortait désaligné, dans une autre police, méconnaissable.
 * On trace donc le document au millimètre — texte vectoriel, net à
 * n'importe quel zoom, fichier léger, et identique à ce qu'on voit.
 */

import { formatDateFr } from './dates'
import { enteteDe } from './entetes'
import type { Employee } from './types'

const PIECES = [
  'COPIE DE LA CIN',
  'CERTIFICAT DE BONNE CONDUITE',
  "CERTIFICAT MÉDICAL D'APTITUDE AU TRAVAIL",
]

/** Page A4 et marges, en millimètres. */
const P = { l: 210, h: 297, marge: 18 }

function hexVersRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Le département : saisi, sinon déduit de la qualification. */
function departementDe(e: Employee): string {
  if (e.departement) return e.departement
  if (!e.qualification) return ''
  return e.qualification.toUpperCase().replace(/^AGENT(\s+D['’]|\s+DE\s+|\s+)?/i, '').trim()
}

/** Charge une image en données locales (nécessaire pour jsPDF). */
async function versDataUrl(url: string): Promise<{ data: string; l: number; h: number } | null> {
  try {
    const rep = await fetch(url)
    if (!rep.ok) return null
    const blob = await rep.blob()
    const data = await new Promise<string>((r) => {
      const fr = new FileReader()
      fr.onload = () => r(String(fr.result))
      fr.readAsDataURL(blob)
    })
    const dim = await new Promise<{ l: number; h: number }>((r) => {
      const img = new Image()
      img.onload = () => r({ l: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => r({ l: 1, h: 1 })
      img.src = data
    })
    return { data, ...dim }
  } catch {
    return null
  }
}

export async function genererFichePdf(opts: {
  employees: Employee[]
  entreprise: string
  sites: { id: string; name: string }[]
  /** chemin de stockage → image en données locales */
  photos?: Map<string, string>
  nomFichier: string
}): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { employees, entreprise, sites, photos, nomFichier } = opts
  const entete = enteteDe(entreprise)
  const accent = hexVersRgb(entete.accent)

  const logo = entete.logo ? await versDataUrl(entete.logo) : null

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const nomSite = (id: string) => sites.find((s) => s.id === id)?.name ?? ''

  employees.forEach((e, index) => {
    if (index > 0) doc.addPage('a4', 'portrait')
    let y = P.marge

    // ── En-tête : logo centré, ou nom de la société ────────────────────
    if (logo) {
      const hMax = 24
      const l = Math.min(72, (logo.l / logo.h) * hMax)
      const h = l * (logo.h / logo.l)
      doc.addImage(logo.data, 'PNG', (P.l - l) / 2, y, l, h)
      y += h + 8
    } else {
      doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...accent)
      doc.text(entreprise.toUpperCase(), P.l / 2, y + 6, { align: 'center' })
      y += 16
    }

    // ── Bandeau du titre, encadré de deux filets ──────────────────────
    const titre = 'FICHE D’INFORMATIONS PERSONNELLES'
    doc.setFont('helvetica', 'bold').setFontSize(13)
    const lTitre = doc.getTextWidth(titre) + 14
    const xTitre = (P.l - lTitre) / 2
    const hBandeau = 9

    doc.setDrawColor(...accent).setLineWidth(0.4)
    doc.line(P.marge, y + hBandeau / 2, xTitre - 4, y + hBandeau / 2)
    doc.line(xTitre + lTitre + 4, y + hBandeau / 2, P.l - P.marge, y + hBandeau / 2)

    doc.setFillColor(...accent)
    doc.rect(xTitre, y, lTitre, hBandeau, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(titre, P.l / 2, y + hBandeau / 2 + 1.6, { align: 'center' })
    y += hBandeau + 10

    // ── Photo à gauche, matricule au centre ───────────────────────────
    const photoL = 32
    const photoH = 40
    const yPhoto = y
    const chemin = e.photo_path ? photos?.get(e.photo_path) : undefined

    if (chemin) {
      doc.addImage(chemin, 'JPEG', P.marge, yPhoto, photoL, photoH)
      doc.setDrawColor(210).setLineWidth(0.3)
      doc.roundedRect(P.marge, yPhoto, photoL, photoH, 2, 2, 'S')
    } else {
      doc.setDrawColor(205).setLineWidth(0.3)
      doc.roundedRect(P.marge, yPhoto, photoL, photoH, 2, 2, 'S')
      doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...accent)
      doc.text('PHOTO', P.marge + photoL / 2, yPhoto + photoH / 2 + 1, { align: 'center' })
    }

    // Matricule, centré dans la place restante à droite de la photo
    const centreDroite = P.marge + photoL + (P.l - P.marge - (P.marge + photoL)) / 2
    const mat = e.matricule != null ? String(e.matricule).padStart(3, '0') : '—'
    doc.setFont('helvetica', 'bold').setFontSize(13)

    // On mesure les deux morceaux pour centrer l'ensemble, sans trou au milieu
    const lLibelle = doc.getTextWidth('MATRICULE N° ')
    const lNumero = doc.getTextWidth(mat)
    const xDepart = centreDroite - (lLibelle + lNumero) / 2
    const yTexte = yPhoto + 12

    // Libellé et numéro dans la même couleur que l'en-tête de la société
    doc.setTextColor(...accent)
    doc.text('MATRICULE N° ', xDepart, yTexte)
    doc.text(mat, xDepart + lLibelle, yTexte)

    // Filet centré sur le même axe que le texte
    const lFilet = Math.max(52, lLibelle + lNumero + 14)
    doc.setDrawColor(...accent).setLineWidth(0.7)
    doc.line(centreDroite - lFilet / 2, yTexte + 3, centreDroite + lFilet / 2, yTexte + 3)

    y = yPhoto + photoH + 14

    // ── Les neuf champs ───────────────────────────────────────────────
    const champs: [string, string][] = [
      ['Nom et Prénom', e.nom_prenom],
      ['N° Carte Nationale', e.cin ?? ''],
      ['Adresse', e.adresse ?? ''],
      ['Ville', e.ville ?? ''],
      ['Date de Naissance', e.date_naissance ? formatDateFr(e.date_naissance) : ''],
      ['Département', departementDe(e)],
      ['Qualification', e.qualification ?? ''],
      ['Site', nomSite(e.site_id)],
      ['Date d’embauche', e.date_embauche ? formatDateFr(e.date_embauche) : ''],
    ]

    const xLabel = P.marge
    const xColon = P.marge + 50
    const xValeur = P.marge + 56
    const largeurValeur = P.l - P.marge - xValeur
    const interligne = 9.6

    champs.forEach(([label, valeur]) => {
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...accent)
      doc.text(label, xLabel, y)
      doc.text(':', xColon, y)

      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(20, 20, 20)
      const lignes = doc.splitTextToSize((valeur || '').toUpperCase(), largeurValeur)
      doc.text(lignes, xValeur, y)
      y += interligne + (lignes.length - 1) * 5
    })

    // ── Pièces administratives ────────────────────────────────────────
    y += 6
    const sousTitre = 'PIÈCES ADMINISTRATIVES À FOURNIR'
    doc.setFont('helvetica', 'bold').setFontSize(11.5).setTextColor(...accent)
    doc.text(sousTitre, P.l / 2, y, { align: 'center' })
    const lSous = doc.getTextWidth(sousTitre)
    doc.setDrawColor(...accent).setLineWidth(0.4)
    doc.line((P.l - lSous) / 2, y + 1.8, (P.l + lSous) / 2, y + 1.8)
    y += 11

    doc.setFontSize(9.5)
    PIECES.forEach((p) => {
      doc.setFillColor(...accent)
      doc.circle(P.marge + 2, y - 1.2, 0.7, 'F')
      doc.setFont('helvetica', 'bold').setTextColor(...accent)
      doc.text(p, P.marge + 7, y)
      y += 7.5
    })
  })

  doc.save(nomFichier.endsWith('.pdf') ? nomFichier : `${nomFichier}.pdf`)
}
