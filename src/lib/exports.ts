/** Exports de la paie : Excel (.xlsx) et PDF.
 *
 *  Les bibliothèques sont chargées à la demande (import dynamique) :
 *  elles ne pèsent sur l'application que lorsqu'on clique sur « Exporter ».
 */

import type { Row, SheetData } from 'write-excel-file/browser'
import { MOIS_FR, estVirement, formatNombre } from './paie'
import type { BulletinSite, LignePaie, TotauxPeriode } from './types'
import { gardeSymbole } from './gardes'

/** Nom de fichier lisible : « Paie_Groupe-Triple-A_Janvier-2026.xlsx ». */
function nomFichier(entreprise: string, annee: number, mois: number, ext: string): string {
  return `Paie_${slug(entreprise)}_${MOIS_FR[mois - 1]}-${annee}.${ext}`
}

function slug(texte: string): string {
  return texte.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}

// ---------------------------------------------------------------- Excel -----

const ENTETE = {
  fontWeight: 'bold',
  backgroundColor: '#065F46',
  textColor: '#FFFFFF',
  align: 'center',
  wrap: true,
} as const

const MONTANT = { type: Number, format: '#,##0.00' } as const

export async function exporterPaieExcel(opts: {
  entreprise: string
  annee: number
  mois: number
  lignes: LignePaie[]
  totaux: TotauxPeriode | undefined
  /** Filtre actif au moment de l'export (ex. « LA COMMUNE · Espece »). */
  filtre?: string
  devise?: string
}) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const { entreprise, annee, mois, lignes, totaux } = opts
  const money = MONTANT

  const rows: SheetData = []

  // Titre
  rows.push([{ value: `PAIE — ${entreprise}`, fontWeight: 'bold', fontSize: 14, columnSpan: 8 }])
  rows.push([{ value: `${MOIS_FR[mois - 1]} ${annee}`, fontSize: 11, columnSpan: 8 }])
  if (opts.filtre) {
    rows.push([{ value: `Sélection : ${opts.filtre}`, fontSize: 11, fontWeight: 'bold', columnSpan: 8 }])
  }
  rows.push([])

  // En-têtes
  const colonnes = [
    'Matricule', 'Nom & Prénom', 'Annexe', 'Site principal', 'Qualification', 'CIN', 'CNSS',
    'Salaire de base', 'Base (j)', 'Jours', 'Congé', 'Malade',
    'Jours payés', 'Heures', 'Salaire brut', 'Prime', 'Retenue dette',
    'Autres retenues', 'NET À PAYER', 'Règlement', 'Banque', 'RIB', 'Observations',
  ]
  rows.push(colonnes.map((c) => ({ value: c, ...ENTETE })))

  for (const l of lignes) {
    rows.push([
      { type: Number, value: l.matricule ?? undefined },
      { type: String, value: l.nom_prenom },
      { type: String, value: l.site_nom ?? undefined },
      { type: String, value: l.site_principal_nom ?? undefined },
      { type: String, value: l.qualification ?? undefined },
      { type: String, value: l.cin ?? undefined },
      { type: String, value: l.cnss ?? undefined },
      { ...money, value: Number(l.salaire_base) },
      { type: Number, value: Number(l.jours_base) },
      { type: Number, value: Number(l.gardes_travaillees) },
      { type: Number, value: Number(l.jours_conge) },
      { type: Number, value: Number(l.jours_maladie) },
      { type: Number, value: Number(l.jours_payes), fontWeight: 'bold' },
      { type: Number, value: l.heures_effectuees == null ? undefined : Number(l.heures_effectuees) },
      { ...money, value: Number(l.salaire_brut) },
      { ...money, value: Number(l.prime) },
      { ...money, value: Number(l.retenue_dette) },
      { ...money, value: Number(l.autres_retenues) },
      { ...money, value: Number(l.net_a_payer), fontWeight: 'bold', backgroundColor: '#ECFDF5' },
      { type: String, value: l.mode_reglement ?? undefined },
      { type: String, value: l.banque ?? undefined },
      { type: String, value: l.rib ?? undefined },
      { type: String, value: l.observations ?? undefined },
    ])
  }

  // Ligne de total
  const somme = (f: (l: LignePaie) => number) => lignes.reduce((s, l) => s + Number(f(l)), 0)
  rows.push([])
  rows.push([
    { value: 'TOTAL', fontWeight: 'bold', columnSpan: 7, backgroundColor: '#F1F5F9' },
    null, null, null, null, null, null,
    { ...money, value: somme((l) => l.salaire_base), fontWeight: 'bold' },
    null, null, null, null, null, null, null,
    { ...money, value: somme((l) => l.salaire_brut), fontWeight: 'bold' },
    { ...money, value: somme((l) => l.prime), fontWeight: 'bold' },
    { ...money, value: somme((l) => l.retenue_dette), fontWeight: 'bold' },
    { ...money, value: somme((l) => l.autres_retenues), fontWeight: 'bold' },
    { ...money, value: somme((l) => l.net_a_payer), fontWeight: 'bold', backgroundColor: '#D1FAE5' },
  ])

  // Récapitulatif des modes de règlement
  if (totaux) {
    rows.push([])
    rows.push([{ value: 'RÉCAPITULATIF', fontWeight: 'bold', columnSpan: 3, backgroundColor: '#F1F5F9' }])
    rows.push([{ type: String, value: 'Nombre d’employés' }, { type: Number, value: Number(totaux.employes) }])
    rows.push([{ type: String, value: 'Total virements' }, { ...money, value: Number(totaux.total_virement) }])
    rows.push([{ type: String, value: 'Total espèces' }, { ...money, value: Number(totaux.total_especes) }])
    rows.push([{ type: String, value: 'TOTAL NET', fontWeight: 'bold' },
               { ...money, value: Number(totaux.total_net), fontWeight: 'bold' }])
    if (totaux.par_banque?.length) {
      rows.push([])
      rows.push([{ value: 'PAR BANQUE (virements)', fontWeight: 'bold', columnSpan: 3, backgroundColor: '#F1F5F9' }])
      rows.push([
        { value: 'Banque', ...ENTETE }, { value: 'Employés', ...ENTETE }, { value: 'Montant', ...ENTETE },
      ])
      for (const b of totaux.par_banque) {
        rows.push([
          { type: String, value: b.banque },
          { type: Number, value: Number(b.n) },
          { ...money, value: Number(b.montant) },
        ])
      }
    }
  }

  const columns = [
    { width: 11 }, { width: 30 }, { width: 24 }, { width: 22 }, { width: 20 }, { width: 12 }, { width: 14 },
    { width: 15 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
    { width: 12 }, { width: 10 }, { width: 15 }, { width: 12 }, { width: 14 },
    { width: 15 }, { width: 16 }, { width: 13 }, { width: 20 }, { width: 28 }, { width: 26 },
  ]

  await writeXlsxFile(rows, {
    columns,
    sheet: `${MOIS_FR[mois - 1]} ${annee}`,
  }).toFile(nomFichier(entreprise, annee, mois, 'xlsx'))
}

// ------------------------------------------------------------------ PDF -----

export async function exporterPaiePdf(opts: {
  entreprise: string
  annee: number
  mois: number
  lignes: LignePaie[]
  totaux: TotauxPeriode | undefined
  filtre?: string
  devise?: string
}) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableMod.default
  const { entreprise, annee, mois, lignes, totaux } = opts
  const devise = opts.devise ?? 'DH'

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const largeur = doc.internal.pageSize.getWidth()
  const n2 = (v: number | null) => (v == null ? '' : Number(v).toLocaleString('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }))

  doc.setFontSize(15).setFont('helvetica', 'bold')
  doc.text(`ÉTAT DE PAIE — ${entreprise.toUpperCase()}`, largeur / 2, 14, { align: 'center' })
  doc.setFontSize(11).setFont('helvetica', 'normal')
  doc.text(
    opts.filtre ? `${MOIS_FR[mois - 1]} ${annee} — ${opts.filtre}` : `${MOIS_FR[mois - 1]} ${annee}`,
    largeur / 2, 20, { align: 'center' },
  )
  doc.setFontSize(8).setTextColor(110)
  doc.text(
    `${lignes.length} employé(s) · Édité le ${new Date().toLocaleDateString('fr-FR')}`,
    largeur / 2, 25, { align: 'center' },
  )
  doc.setTextColor(0)

  autoTable(doc, {
    startY: 29,
    head: [[
      'Mat.', 'Nom & Prénom', 'Site', 'Sal. base', 'Jours', 'C', 'M',
      'J. payés', 'Heures', 'Brut', 'Prime', 'Dette', 'Autres', 'NET', 'Règlement', 'Banque',
    ]],
    body: lignes.map((l) => [
      l.matricule ?? '',
      l.nom_prenom,
      l.site_nom ?? '',
      n2(l.salaire_base),
      formatNombre(Number(l.gardes_travaillees)),
      formatNombre(Number(l.jours_conge)),
      formatNombre(Number(l.jours_maladie)),
      formatNombre(Number(l.jours_payes)),
      l.heures_effectuees == null ? '' : formatNombre(Number(l.heures_effectuees)),
      n2(l.salaire_brut),
      n2(l.prime),
      n2(l.retenue_dette),
      n2(l.autres_retenues),
      n2(l.net_a_payer),
      l.mode_reglement ?? '',
      l.banque ?? '',
    ]),
    foot: [[
      '', 'TOTAL', '', '', '', '', '', '', '',
      n2(lignes.reduce((s, l) => s + Number(l.salaire_brut), 0)),
      n2(lignes.reduce((s, l) => s + Number(l.prime), 0)),
      n2(lignes.reduce((s, l) => s + Number(l.retenue_dette), 0)),
      n2(lignes.reduce((s, l) => s + Number(l.autres_retenues), 0)),
      n2(lignes.reduce((s, l) => s + Number(l.net_a_payer), 0)),
      '', '',
    ]],
    styles: { fontSize: 7, cellPadding: 1.4, overflow: 'linebreak' },
    headStyles: { fillColor: [6, 95, 70], textColor: 255, fontSize: 7, halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { halign: 'right', cellWidth: 11 },
      1: { cellWidth: 44 },
      2: { cellWidth: 30 },
      3: { halign: 'right', cellWidth: 17 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 9 },
      6: { halign: 'center', cellWidth: 9 },
      7: { halign: 'center', cellWidth: 14 },
      8: { halign: 'right', cellWidth: 14 },
      9: { halign: 'right', cellWidth: 18 },
      10: { halign: 'right', cellWidth: 15 },
      11: { halign: 'right', cellWidth: 15 },
      12: { halign: 'right', cellWidth: 15 },
      13: { halign: 'right', cellWidth: 19, fontStyle: 'bold' },
      14: { cellWidth: 18 },
      15: { cellWidth: 22 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: () => {
      const page = doc.getNumberOfPages()
      doc.setFontSize(7).setTextColor(130)
      doc.text(`Page ${page}`, largeur - 14, doc.internal.pageSize.getHeight() - 7, { align: 'right' })
      doc.setTextColor(0)
    },
  })

  // Récapitulatif sur une page dédiée
  if (totaux) {
    doc.addPage('a4', 'landscape')
    doc.setFontSize(13).setFont('helvetica', 'bold')
    doc.text('RÉCAPITULATIF', largeur / 2, 16, { align: 'center' })
    autoTable(doc, {
      startY: 24,
      body: [
        ['Nombre d’employés', String(totaux.employes)],
        ['Total brut', `${n2(totaux.total_brut)} ${devise}`],
        ['Total primes', `${n2(totaux.total_primes)} ${devise}`],
        ['Total retenues de dette', `- ${n2(totaux.total_dettes)} ${devise}`],
        ['Autres retenues', `- ${n2(totaux.total_autres_retenues)} ${devise}`],
        ['À payer par virement', `${n2(totaux.total_virement)} ${devise}`],
        ['À payer en espèces', `${n2(totaux.total_especes)} ${devise}`],
        ['TOTAL NET À PAYER', `${n2(totaux.total_net)} ${devise}`],
      ],
      styles: { fontSize: 10, cellPadding: 2.6 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'right', cellWidth: 55, fontStyle: 'bold' } },
      margin: { left: largeur / 2 - 68 },
      theme: 'grid',
    })

    if (totaux.par_banque?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const y = (doc as any).lastAutoTable.finalY + 10
      doc.setFontSize(11).setFont('helvetica', 'bold')
      doc.text('Virements par banque', largeur / 2, y, { align: 'center' })
      autoTable(doc, {
        startY: y + 4,
        head: [['Banque', 'Employés', 'Montant']],
        body: totaux.par_banque.map((b) => [b.banque, String(b.n), `${n2(b.montant)} ${devise}`]),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [6, 95, 70], textColor: 255 },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
        margin: { left: largeur / 2 - 68 },
        tableWidth: 136,
        theme: 'grid',
      })
    }
  }

  doc.save(nomFichier(entreprise, annee, mois, 'pdf'))
}

// ------------------------------------------- Bulletin journalier (PDF) -----

export async function exporterBulletinPdf(opts: {
  entreprise: string
  date: string
  sites: BulletinSite[]
}) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableMod.default
  const { entreprise, date, sites } = opts

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const largeur = doc.internal.pageSize.getWidth()
  const dateFr = date.split('-').reverse().join('/')

  sites.forEach((site, i) => {
    if (i > 0) doc.addPage()
    doc.setFontSize(14).setFont('helvetica', 'bold')
    doc.text(entreprise.toUpperCase(), largeur / 2, 16, { align: 'center' })
    doc.setFontSize(12)
    doc.text(`BULLETIN DE PRÉSENCE — ${site.site}`, largeur / 2, 23, { align: 'center' })
    doc.setFontSize(10).setFont('helvetica', 'normal')
    doc.text(dateFr, largeur / 2, 29, { align: 'center' })

    autoTable(doc, {
      startY: 34,
      head: [['N°', 'Matricule', 'Nom & Prénom', 'Qualification', 'CIN', 'Garde', 'Heure']],
      body: site.employes.map((e, n) => [
        String(n + 1),
        e.matricule ?? '',
        e.nom_prenom,
        e.qualification ?? '',
        e.cin ?? '',
        gardeSymbole(e.type_garde),
        e.heure ?? '—',
      ]),
      styles: { fontSize: 9, cellPadding: 1.8 },
      headStyles: { fillColor: [6, 95, 70], textColor: 255 },
      columnStyles: {
        0: { halign: 'right', cellWidth: 10 },
        1: { halign: 'right', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 16 },
        6: { halign: 'center', cellWidth: 18 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y = (doc as any).lastAutoTable.finalY + 12
    doc.setFontSize(9)
    doc.text(`Total présents : ${site.employes.length}`, 14, y)
    doc.text('Visa du responsable :', largeur - 14, y, { align: 'right' })
    doc.line(largeur - 70, y + 14, largeur - 14, y + 14)
  })

  doc.save(`Bulletin_${slug(entreprise)}_${date}.pdf`)
}

/** Le bulletin journalier au format Excel (une feuille, tous les sites). */
export async function exporterBulletinExcel(opts: {
  entreprise: string
  date: string
  sites: BulletinSite[]
}) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const { entreprise, date, sites } = opts

  const rows: SheetData = []
  rows.push([{ value: `BULLETIN DE PRÉSENCE — ${entreprise}`, fontWeight: 'bold', fontSize: 14, columnSpan: 6 }])
  rows.push([{ value: date.split('-').reverse().join('/'), fontSize: 11, columnSpan: 6 }])

  for (const site of sites) {
    rows.push([])
    rows.push([{ value: site.site, fontWeight: 'bold', backgroundColor: '#F1F5F9', columnSpan: 6 }])
    rows.push(['Matricule', 'Nom & Prénom', 'Qualification', 'CIN', 'Garde', 'Heure']
      .map((c): Row[number] => ({ value: c, ...ENTETE })))
    for (const e of site.employes) {
      rows.push([
        { type: Number, value: e.matricule ?? undefined },
        { type: String, value: e.nom_prenom },
        { type: String, value: e.qualification ?? undefined },
        { type: String, value: e.cin ?? undefined },
        { type: String, value: gardeSymbole(e.type_garde) },
        { type: String, value: e.heure ?? undefined },
      ])
    }
    rows.push([{ type: String, value: `Total : ${site.employes.length}`, fontWeight: 'bold' }])
  }

  await writeXlsxFile(rows, {
    columns: [{ width: 12 }, { width: 32 }, { width: 22 }, { width: 14 }, { width: 10 }, { width: 10 }],
    sheet: 'Présences',
  }).toFile(`Bulletin_${slug(entreprise)}_${date}.xlsx`)
}

export { estVirement }
