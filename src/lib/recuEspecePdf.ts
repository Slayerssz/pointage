/**
 * LE REÇU D'ESPÈCES — le talon que l'employé signe en prenant son argent.
 *
 * Reproduit le talon papier du groupe : la société, le numéro de reçu, les
 * quatre renseignements, la date, et le cadre de signature. Trois talons
 * par feuille A4, séparés par un trait de découpe — on imprime, on coupe,
 * on distribue.
 *
 * Tracé au millimètre plutôt que photographié : c'est une pièce
 * comptable, elle doit sortir nette et identique à chaque fois.
 */

import { societeDe } from './societes'
import type { LignePaie } from './types'

const P = { l: 210, h: 297 }
/** Trois talons par page. */
const PAR_PAGE = 3
const HAUTEUR = P.h / PAR_PAGE
const MARGE = 14

const n2 = (v: number | string | null | undefined) =>
  v == null ? '' : Number(v)
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    // Les polices du PDF ignorent l'espace fine insécable : elle sortirait
    // en barre oblique.
    .replace(/[  \s]/g, ' ')

/**
 * Le numéro du reçu : N07-2026003, soit le mois, l'année, et le rang de
 * l'employé dans le mois. Établi d'après le matricule, donc stable :
 * réimprimer un talon lui redonne son numéro.
 */
export function numeroRecu(annee: number, mois: number, rang: number): string {
  return `N${String(mois).padStart(2, '0')}-${annee}${String(rang).padStart(3, '0')}`
}

export async function dessinerRecusEspece(opts: {
  lignes: LignePaie[]
  entreprise: string
  modeleDocument?: string | null
  annee: number
  mois: number
  jsPDFModule?: { jsPDF: new (o: object) => unknown }
}) {
  const { jsPDF } = opts.jsPDFModule ?? (await import('jspdf'))
  const { entreprise, annee, mois } = opts
  const societe = societeDe(entreprise, opts.modeleDocument)
  const nomSociete = (societe?.raisonSociale ?? entreprise).toUpperCase()

  // Le rang suit le matricule : un talon réimprimé garde son numéro.
  const lignes = [...opts.lignes].sort(
    (a, b) => (a.matricule ?? 1e9) - (b.matricule ?? 1e9) ||
              a.nom_prenom.localeCompare(b.nom_prenom, 'fr'),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setLineWidth(0.3)

  // La date du talon : le dernier jour du mois payé.
  const dernier = new Date(annee, mois, 0)
  const dateTexte = dernier.toLocaleDateString('fr-FR')

  const texte = (t: string, x: number, y: number, o: {
    gras?: boolean; taille?: number; aligne?: 'left' | 'right' | 'center'
  } = {}) => {
    doc.setFont('helvetica', o.gras ? 'bold' : 'normal')
    doc.setFontSize(o.taille ?? 10)
    doc.text(t, x, y, o.aligne ? { align: o.aligne } : undefined)
  }

  lignes.forEach((l, i) => {
    const place = i % PAR_PAGE
    if (i > 0 && place === 0) doc.addPage('a4', 'portrait')

    const haut = place * HAUTEUR
    const x = MARGE
    let y = haut + 16

    // Le trait de découpe, entre deux talons.
    if (place > 0) {
      doc.setLineDashPattern([2, 1.6], 0)
      doc.setDrawColor(150)
      doc.line(6, haut, P.l - 6, haut)
      doc.setLineDashPattern([], 0)
      doc.setDrawColor(0)
    }

    texte(nomSociete, x, y, { gras: true, taille: 14 })
    y += 7
    texte(`Reçue ${numeroRecu(annee, mois, i + 1)}`, x, y, { gras: true, taille: 12 })
    y += 10

    const champs: [string, string][] = [
      ['Nom Prenom :', l.nom_prenom.toUpperCase()],
      ['Matricul :', l.matricule != null ? String(l.matricule) : '—'],
      ['Site:', (l.site_nom ?? '—').toUpperCase()],
      ['Salaire Net :', n2(l.net_a_payer)],
    ]
    for (const [label, valeur] of champs) {
      texte(label, x, y, { taille: 10 })
      texte(valeur, x + 32, y, { taille: 10 })
      y += 6.5
    }

    // La date, puis le cadre de signature, à droite.
    const cadreL = 52
    const cadreH = 26
    const cadreX = P.l - MARGE - cadreL
    const cadreY = haut + HAUTEUR - cadreH - 12
    texte(dateTexte, P.l - MARGE, cadreY - 4, { taille: 10, aligne: 'right' })
    texte('SIGNATURE', cadreX, cadreY - 4, { taille: 9 })
    doc.roundedRect(cadreX, cadreY, cadreL, cadreH, 2, 2)
  })

  return doc
}

export async function enregistrerRecusEspecePdf(opts: {
  lignes: LignePaie[]
  entreprise: string
  modeleDocument?: string | null
  annee: number
  mois: number
  nomFichier: string
}): Promise<void> {
  const doc = await dessinerRecusEspece(opts)
  doc.save(opts.nomFichier.endsWith('.pdf') ? opts.nomFichier : `${opts.nomFichier}.pdf`)
}
