import type { SheetData } from 'write-excel-file/browser'
import { dirhams, formaterRib, totalDirhams, type OrdreDeVirement } from './ordreVirementPdf'
import { MOIS_FR } from './dates'
import { nomDeFeuille } from './nomFeuilleExcel'

/**
 * L'ORDRE DE VIREMENT EN TABLEUR — le modèle de la banque.
 *
 * Cinq colonnes, et rien d'autre : mois et année, numéro de ligne,
 * R.I.B., nom, montant. Une ligne TOTAL pour finir. C'est la feuille
 * que la banque sait relire telle quelle ; le cartouche — raison
 * sociale, R.I.B. de l'ordinateur, libellé — n'y a pas sa place, il est
 * saisi dans leur formulaire. Il reste sur le PDF, qui, lui, se signe.
 *
 * Une feuille par ordre, c'est-à-dire par site principal. Quand il n'y
 * en a qu'une, elle porte le nom du modèle, « liste virement 1 » : le
 * nom du fichier dit déjà la société et le mois. Quand il y en a
 * plusieurs, chaque onglet prend le nom de son site — sans cela, le
 * bureau ne saurait plus laquelle envoyer à quelle agence.
 *
 * Pas de pagination : un tableur n'a pas de pages, et couper la liste en
 * tranches de douze n'aurait servi à rien.
 *
 * Les R.I.B. partent en texte, jamais en nombre : vingt-quatre chiffres
 * dans une cellule numérique, et le tableur les arrondit en notation
 * scientifique. C'est un numéro de compte, pas une quantité.
 *
 * Les montants partent en dirhams entiers, comme sur le PDF.
 */

/** La police du modèle, reprise cellule par cellule. */
const POLICE = { fontFamily: 'Times New Roman' } as const
const TRAIT = { borderStyle: 'thin', borderColor: '#000000' } as const

const ENTETE = {
  ...POLICE,
  ...TRAIT,
  fontSize: 12,
  fontWeight: 'bold',
  backgroundColor: '#D9D9D9',
  align: 'center',
  alignVertical: 'center',
  wrap: true,
  height: 38,
} as const

/** Une cellule de corps : même police, même filet, même hauteur. */
const CORPS = { ...POLICE, ...TRAIT, fontSize: 11, alignVertical: 'center', height: 25 } as const

/**
 * Les montants sont arrondis au dirham ; le format en garde les deux
 * décimales, qui valent donc toujours « 00 » — la banque lit une
 * colonne à deux décimales.
 */
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

  // Le modèle attend « MMYYYY », en texte : un zéro de tête se perd dès
  // qu'on laisse le tableur y voir un nombre.
  const periode = `${String(mois).padStart(2, '0')}${annee}`

  const deja = new Set<string>()
  const feuilles = ordres.map((ordre) => {
    const rows: SheetData = []

    rows.push([
      { value: 'Mois & Année (MMYYYY)', ...ENTETE, fontSize: 11 },
      { value: 'N°', ...ENTETE },
      { value: 'RIB Bénéficiare', ...ENTETE },
      { value: 'Nom Bénéficiare', ...ENTETE },
      { value: 'Montant Virement', ...ENTETE },
    ])

    ordre.lignes.forEach((l, i) => {
      rows.push([
        { value: periode, ...CORPS, fontSize: 12, fontWeight: 'bold', type: String },
        { value: i + 1, ...CORPS, fontSize: 12, align: 'center', type: Number },
        // Sans R.I.B., la case reste vide et se voit : la banque ne peut
        // pas exécuter cette ligne-là.
        { value: formaterRib(l.rib) || 'R.I.B. MANQUANT', ...CORPS, align: 'left', type: String },
        { value: l.nom_prenom.toUpperCase(), ...CORPS, align: 'left', type: String },
        { value: dirhams(l.net_a_payer), ...CORPS, align: 'right', ...MONTANT },
      ])
    })

    // Comme dans le modèle, la ligne de total n'encadre que les deux
    // cases qui portent quelque chose.
    rows.push([
      { value: '', ...POLICE, height: 25, type: String },
      { value: '', ...POLICE, height: 25, type: String },
      { value: 'TOTAL', ...CORPS, fontSize: 12, fontWeight: 'bold', align: 'center', type: String },
      { value: '', ...POLICE, height: 25, type: String },
      {
        value: totalDirhams(ordre.lignes),
        ...CORPS, fontSize: 12, fontWeight: 'bold', align: 'right', ...MONTANT,
      },
    ])

    return {
      data: rows,
      sheet: ordres.length > 1 ? nomDeFeuille(ordre.intitule, deja) : 'liste virement 1',
      columns: [{ width: 23 }, { width: 15 }, { width: 36 }, { width: 38 }, { width: 20 }],
    }
  })

  const nom = `Ordre_virement_${entreprise.replace(/[^\p{L}\p{N}]+/gu, '-')}` +
    `_${MOIS_FR[mois - 1]}-${annee}.xlsx`
  await writeXlsxFile(feuilles).toFile(nom)
}
