/**
 * La liste des versements, dessinée directement dans le PDF.
 *
 * Même raison que l'ordre de virement : la capture d'écran déforme les
 * tableaux, et ce document-là se porte au guichet. On le trace au
 * millimètre, d'après la liste papier du groupe.
 *
 * La liste est continue : les gens y sont regroupés par banque, chaque
 * groupe suivi de son total, et l'ensemble coule de page en page.
 */

import { societeDe } from './societes'
import type { LignePaie } from './types'

const P = { l: 210, h: 297, marge: 14, haut: 14 }

/** Les cinq colonnes, en millimètres. */
const COL = { mat: 18, nom: 52, site: 32, rib: 52, salaire: 28 }
const LARGEUR = COL.mat + COL.nom + COL.site + COL.rib + COL.salaire

const LIGNE = 6.4
const GRIS: [number, number, number] = [228, 228, 228]

const n2 = (v: number | string | null | undefined) =>
  v == null ? '' : Number(v)
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    // Les polices du PDF ignorent l'espace fine insécable : elle sortait
    // en barre oblique. Une espace ordinaire, donc.
    .replace(/[  \s]/g, ' ')

const banqueDe = (l: LignePaie) =>
  (l.banque ?? '').trim().replace(/\s+/g, ' ').toUpperCase() || '(BANQUE NON RENSEIGNÉE)'

export async function dessinerListeVersements(opts: {
  lignes: LignePaie[]
  entreprise: string
  modeleDocument?: string | null
  /** Ce qui a été filtré (un site, par exemple) : rappelé sous le titre. */
  precision?: string | null
  annee: number
  mois: number
  jsPDFModule?: { jsPDF: new (o: object) => unknown }
}) {
  const { jsPDF } = opts.jsPDFModule ?? (await import('jspdf'))
  const { lignes, entreprise, annee, mois, precision } = opts
  const societe = societeDe(entreprise, opts.modeleDocument)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setLineWidth(0.3)

  // Regroupées par banque, dans l'ordre alphabétique — comme le papier.
  const parBanque = new Map<string, LignePaie[]>()
  for (const l of lignes) parBanque.set(banqueDe(l), [...(parBanque.get(banqueDe(l)) ?? []), l])
  const groupes = [...parBanque.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))

  const periode = `${String(mois).padStart(2, '0')}-${annee}`
  const x = P.marge
  let y = 0
  let page = 0
  // Le « 1/2 » ne peut s'écrire qu'une fois la dernière page connue :
  // on retient où le poser, et on y revient à la fin.
  const numeros: { page: number; x: number; y: number }[] = []

  const texte = (t: string, tx: number, ty: number, o: {
    gras?: boolean; taille?: number; aligne?: 'left' | 'right' | 'center'; mono?: boolean
  } = {}) => {
    doc.setFont(o.mono ? 'courier' : 'helvetica', o.gras ? 'bold' : 'normal')
    doc.setFontSize(o.taille ?? 9)
    doc.text(t, tx, ty, o.aligne ? { align: o.aligne } : undefined)
  }

  /** L'en-tête : la société, le titre, la période, le numéro de page. */
  const enTete = () => {
    page += 1
    if (page > 1) doc.addPage('a4', 'portrait')
    y = P.haut

    texte((societe?.raisonSociale ?? entreprise).toUpperCase(), x, y, { gras: true, taille: 9 })
    y += 4
    if (societe?.siege) {
      texte(societe.siege.toUpperCase(), x, y, { gras: true, taille: 9 })
      y += 4
    }
    y += 4

    texte('Liste des Versement', x, y, { taille: 12 })
    texte('Page', x + LARGEUR - 20, y, { gras: true, taille: 10 })
    numeros.push({ page, x: x + LARGEUR, y })
    y += 6
    texte(`Periode ${periode}`, x, y, { taille: 10 })
    if (precision) texte(precision.toUpperCase(), x + LARGEUR, y, { taille: 9, aligne: 'right', gras: true })
    y += 4

    // La ligne d'intitulés
    const hEntete = 7
    let cx = x
    const cols: [string, number][] = [
      ['MAT', COL.mat], ['Nom & Prénom', COL.nom], ['Site', COL.site],
      ['RIB', COL.rib], ['Salaire', COL.salaire],
    ]
    for (const [libelle, larg] of cols) {
      doc.rect(cx, y, larg, hEntete)
      texte(libelle, cx + larg / 2, y + 4.8, { aligne: 'center', taille: 9 })
      cx += larg
    }
    y += hEntete
  }

  /** Reste-t-il la place d'écrire n millimètres ? */
  const place = (n: number) => y + n <= P.h - 16

  enTete()

  for (const [banque, gens] of groupes) {
    // Le titre de banque, ses gens et son total ne se coupent pas au ras
    // d'une page : on saute plutôt.
    if (!place(9 + LIGNE * 2)) enTete()

    // Titre du groupe
    doc.rect(x, y, LARGEUR, 8)
    texte(banque, x + 2, y + 5.6, { gras: true, taille: 11 })
    y += 8

    for (const l of gens) {
      if (!place(LIGNE + 8)) {
        enTete()
        doc.rect(x, y, LARGEUR, 8)
        texte(`${banque} (suite)`, x + 2, y + 5.6, { gras: true, taille: 11 })
        y += 8
      }
      let cx = x
      const cellules: [string, number, 'left' | 'right' | 'center', boolean][] = [
        [l.matricule != null ? String(l.matricule) : '', COL.mat, 'left', false],
        [l.nom_prenom.toUpperCase(), COL.nom, 'left', false],
        [(l.site_nom ?? '').toUpperCase(), COL.site, 'left', false],
        [(l.rib ?? '').replace(/\s/g, ''), COL.rib, 'left', true],
        [n2(l.net_a_payer), COL.salaire, 'right', false],
      ]
      for (const [t, larg, aligne, mono] of cellules) {
        doc.rect(cx, y, larg, LIGNE)
        if (t) {
          const tx = aligne === 'right' ? cx + larg - 1.5 : cx + 1.5
          // Le nom et le site sont rognés plutôt que de déborder.
          const max = larg - 3
          let v = t
          doc.setFont(mono ? 'courier' : 'helvetica', 'normal')
          doc.setFontSize(mono ? 7.5 : 8.5)
          while (v && doc.getTextWidth(v) > max) v = v.slice(0, -1)
          texte(v, tx, y + 4.4, { aligne, mono, taille: mono ? 7.5 : 8.5 })
        }
        cx += larg
      }
      y += LIGNE
    }

    // Le total de la banque
    const total = gens.reduce((s, l) => s + Number(l.net_a_payer), 0)
    if (!place(LIGNE + 2)) enTete()
    texte('Total', x + 1.5, y + 4.6, { gras: true, taille: 10 })
    texte(banque, x + COL.mat + 1.5, y + 4.6, { gras: true, taille: 10 })
    texte(n2(total), x + LARGEUR - 1.5, y + 4.6, { gras: true, taille: 10, aligne: 'right' })
    y += LIGNE + 3
  }

  // Le total général ferme la liste.
  if (!place(10)) enTete()
  y += 2
  doc.setFillColor(...GRIS)
  doc.rect(x, y, LARGEUR, 8, 'FD')
  texte(`TOTAL GÉNÉRAL — ${lignes.length} versement(s)`, x + 2, y + 5.6, { gras: true, taille: 10 })
  texte(n2(lignes.reduce((s, l) => s + Number(l.net_a_payer), 0)),
        x + LARGEUR - 2, y + 5.6, { gras: true, taille: 10, aligne: 'right' })

  for (const n of numeros) {
    doc.setPage(n.page)
    texte(`${n.page}/${page}`, n.x, n.y, { gras: true, taille: 10, aligne: 'right' })
  }

  return doc
}

export async function enregistrerListeVersementsPdf(opts: {
  lignes: LignePaie[]
  entreprise: string
  modeleDocument?: string | null
  precision?: string | null
  annee: number
  mois: number
  nomFichier: string
}): Promise<void> {
  const doc = await dessinerListeVersements(opts)
  doc.save(opts.nomFichier.endsWith('.pdf') ? opts.nomFichier : `${opts.nomFichier}.pdf`)
}
