import type { SheetData } from 'write-excel-file/browser'
import { formaterRib, libelleOperations, type OrdreDeVirement } from './ordreVirementPdf'
import { societeDe } from './societes'
import { MOIS_FR } from './dates'
import { nomDeFeuille } from './nomFeuilleExcel'

/**
 * L'ORDRE DE VIREMENT EN TABLEUR.
 *
 * Le même document que le PDF, dans la forme que la banque reconnaît :
 * le cartouche d'abord — raison sociale, R.I.B. de l'ordinateur, nombre
 * et montant des opérations, libellé — puis les bénéficiaires.
 *
 * L'export général de la paie ne convenait pas ici : vingt colonnes de
 * salaires et de retenues, là où la banque n'en attend que trois.
 *
 * Une feuille par ordre, c'est-à-dire par site principal : on envoie la
 * feuille qui concerne l'agence, pas le classeur entier. Pas de
 * pagination — un tableur n'a pas de pages, et couper la liste en
 * tranches de douze n'aurait servi à rien.
 *
 * Les R.I.B. partent en texte, jamais en nombre : vingt-quatre chiffres
 * dans une cellule numérique, et le tableur les arrondit en notation
 * scientifique. C'est un numéro de compte, pas une quantité.
 */

const ENTETE = {
  fontWeight: 'bold',
  backgroundColor: '#D9D9D9',
  align: 'center',
  wrap: true,
} as const

const MONTANT = { type: Number, format: '#,##0.00' } as const

export async function exporterOrdreVirementExcel(opts: {
  ordres: OrdreDeVirement[]
  entreprise: string
  modeleDocument?: string | null
  ribOrdinateur: string | null
  annee: number
  mois: number
}): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const { ordres, entreprise, annee, mois } = opts

  const raison = (societeDe(entreprise, opts.modeleDocument)?.raisonSociale ?? entreprise)
    .toUpperCase()
  const libelle = libelleOperations(annee, mois)
  const ribPropre = formaterRib(opts.ribOrdinateur)
  const aujourdhui = new Date().toLocaleDateString('fr-FR')

  const deja = new Set<string>()
  const feuilles = ordres.map((ordre) => {
    const total = ordre.lignes.reduce((s, l) => s + Number(l.net_a_payer), 0)
    const rows: SheetData = []

    const cartouche = (label: string, valeur: string | number) =>
      rows.push([
        { value: label, fontWeight: 'bold' },
        { value: valeur, fontWeight: 'bold', type: String },
      ])

    rows.push([{ value: 'Date', fontWeight: 'bold' }, { value: aujourdhui, type: String }])
    cartouche('RAISON SOCIAL', `SOCIETE ${raison}`)
    cartouche('RIB ORDINATEUR', ribPropre)
    rows.push([
      { value: "NOMBRE TOTAL D'OPERATIONS", fontWeight: 'bold' },
      { value: ordre.lignes.length, type: Number },
    ])
    rows.push([
      { value: "MONTANT TOTAL D'OPERATIONS", fontWeight: 'bold' },
      { value: total, ...MONTANT, fontWeight: 'bold' },
    ])
    cartouche('LIBELLE OPERATIONS', libelle)
    rows.push([])

    rows.push([
      { value: 'Nom Bénéficiare', ...ENTETE },
      { value: 'RIB Bénéficiare', ...ENTETE },
      { value: 'Montant Virement', ...ENTETE },
    ])
    for (const l of ordre.lignes) {
      rows.push([
        { value: l.nom_prenom.toUpperCase(), type: String },
        // Sans R.I.B., la case reste vide et se voit : la banque ne peut
        // pas exécuter cette ligne-là.
        { value: formaterRib(l.rib) || 'R.I.B. MANQUANT', type: String },
        { value: Number(l.net_a_payer), ...MONTANT },
      ])
    }
    rows.push([
      { value: 'TOTAL', fontWeight: 'bold' },
      { value: '', type: String },
      { value: total, ...MONTANT, fontWeight: 'bold' },
    ])

    return {
      data: rows,
      sheet: nomDeFeuille(ordre.intitule, deja),
      columns: [{ width: 34 }, { width: 30 }, { width: 18 }],
    }
  })

  const nom = `Ordre_virement_${entreprise.replace(/[^\p{L}\p{N}]+/gu, '-')}` +
    `_${MOIS_FR[mois - 1]}-${annee}.xlsx`
  await writeXlsxFile(feuilles).toFile(nom)
}
