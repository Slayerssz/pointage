/**
 * L'ordre de virement, dessiné directement dans le PDF.
 *
 * Pourquoi ne pas photographier la page ? Parce que la capture d'écran
 * (html2canvas) rend mal les tableaux et les aplats : le formulaire
 * ressortait déformé, dans une autre police, et ce n'est pas un document
 * qu'on peut se permettre d'envoyer approximatif — il part à la banque.
 * On le trace donc au millimètre, d'après le modèle papier du groupe.
 */

import { montantEnLettres } from './montantEnLettres'
import { enteteDe } from './entetes'
import { societeDe } from './societes'
import type { LignePaie } from './types'

/** Page A4 et marges, en millimètres. */
// Sans papier à en-tête, le document garde ses propres marges : le haut
// reste libre, au cas où la feuille serait pré-imprimée.
const P = { l: 210, h: 297, marge: 12, haut: 40, bas: 285 }

/** Les trois colonnes du tableau des bénéficiaires, au modèle. */
const COL = { nom: 67, rib: 66, montant: 53 }
const LARGEUR = COL.nom + COL.rib + COL.montant

/** Cartouche : la colonne des intitulés, puis celle des valeurs. */
const CARTOUCHE = { label: 74, valeur: LARGEUR - 74, hauteur: 7 }

const LIGNE = 7.5

/** Les hauteurs fixes de la feuille, en millimètres. */
const H_CARTOUCHE = CARTOUCHE.hauteur * 6 // la case date, puis cinq intitulés
const H_ENTETE_TABLEAU = 9
/** Deux lignes d'adresse, et trois réservées à la somme en toutes lettres. */
const H_FORMULE = 1.5 + 4.6 * 5 + 1.4
const H_SANS_FORMULE = 3
/** Le pavé des signatures, sur la dernière feuille d'un ordre. */
const H_SIGNATURES = 6 + 7 + 40

/**
 * Combien de bénéficiaires par feuille ? Cela dépend du papier : celui
 * de Serclean s'arrête à 240 mm — son angle décoratif — quand celui de
 * Megainter descend jusqu'à 279. L'un tient donc six lignes de moins que
 * l'autre, et la dernière feuille en perd encore pour les signatures.
 *
 * Le PDF et l'aperçu à l'écran appellent tous deux cette fonction : ils
 * ne peuvent pas se mettre à pagineront différemment.
 */
export function paginerOrdre(
  nbLignes: number,
  o: { haut: number; bas: number; avecFormule: boolean },
): number[] {
  const tete = H_CARTOUCHE + (o.avecFormule ? H_FORMULE : H_SANS_FORMULE) + H_ENTETE_TABLEAU
  const dispo = o.bas - o.haut - tete
  const plein = Math.max(1, Math.floor(dispo / LIGNE))
  // Sur la dernière feuille, les signatures prennent leur place. Si rien
  // ne tient plus, elles passent sur une feuille à elles.
  const dernier = Math.floor((dispo - H_SIGNATURES) / LIGNE)

  if (nbLignes <= 0) return [0]
  // Sans place pour les signatures, elles prennent une feuille à elles.
  if (dernier < 1) {
    const pages: number[] = []
    for (let r = nbLignes; r > 0; r -= plein) pages.push(Math.min(plein, r))
    pages.push(0)
    return pages
  }
  if (nbLignes <= dernier) return [nbLignes]

  // Combien de feuilles au minimum ? La dernière porte les signatures et
  // tient donc moins de monde que les autres.
  let k = 1
  while ((k - 1) * plein + dernier < nbLignes) k++

  // Réparti au plus juste : mieux vaut trois feuilles de onze qu'une
  // pleine et une presque vide.
  const pages: number[] = []
  const fin = Math.min(dernier, Math.ceil(nbLignes / k))
  let reste = nbLignes - fin
  for (let i = k - 1; i > 0; i--) {
    const t = Math.min(plein, Math.ceil(reste / i))
    pages.push(t)
    reste -= t
  }
  pages.push(fin)
  return pages
}

/** Découpe les lignes d'après la pagination calculée. */
export function decouperOrdre<T>(
  lignes: T[],
  o: { haut: number; bas: number; avecFormule: boolean },
): T[][] {
  const tailles = paginerOrdre(lignes.length, o)
  const pages: T[][] = []
  let i = 0
  for (const t of tailles) {
    pages.push(lignes.slice(i, i + t))
    i += t
  }
  return pages
}

const GRIS: [number, number, number] = [217, 217, 217]

/**
 * Les banques de Vigilma et de Serclean veulent la formule d'usage sous
 * le cartouche ; les autres ne la demandent pas. Elle n'est donc imprimée
 * que pour ces deux sociétés-là.
 */
const AVEC_FORMULE = ['VIGILMA', 'SERCLEAN']
export const veutLaFormule = (entreprise: string) => {
  const n = entreprise.toUpperCase()
  return AVEC_FORMULE.some((m) => n.includes(m))
}

/**
 * Le papier à en-tête, prêt à être posé dans le PDF. jsPDF veut les
 * données de l'image, pas son adresse : on va donc la chercher.
 *
 * Le chargement peut échouer — réseau coupé, fichier absent. Dans ce cas
 * le document sort sans son papier plutôt que pas du tout : un ordre de
 * virement sur feuille blanche reste un ordre de virement.
 */
async function chargerPapier(url: string): Promise<string | null> {
  try {
    const reponse = await fetch(url)
    if (!reponse.ok) return null
    const blob = await reponse.blob()
    return await new Promise<string>((resoudre, rejeter) => {
      const lecteur = new FileReader()
      lecteur.onload = () => resoudre(String(lecteur.result))
      lecteur.onerror = () => rejeter(lecteur.error)
      lecteur.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Le papier de la société et les marges qu'il impose. Sans papier, on
 * retombe sur celles d'origine — la feuille blanche reste utilisable.
 */
export function papierDe(entreprise: string, modeleDocument?: string | null) {
  const papier = enteteDe(entreprise, modeleDocument).papier
  return {
    papier: papier ?? null,
    haut: papier?.haut ?? P.haut,
    bas: papier?.bas ?? P.bas,
  }
}

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

/** Le modèle écrit les R.I.B. d'un seul tenant, sans séparateur. */
const formaterRib = (v: string | null | undefined) => (v ? v.replace(/\s/g, '') : '')

/**
 * Dessine les ordres et renvoie le document. Séparé de l'enregistrement
 * pour qu'on puisse le rendre ailleurs qu'un navigateur — et le vérifier.
 */
export async function dessinerOrdreVirement(opts: {
  ordres: OrdreDeVirement[]
  entreprise: string
  /** Clé de modèle de la société : elle prime sur son nom. */
  modeleDocument?: string | null
  ribOrdinateur: string | null
  annee: number
  mois: number
  /** Injectable pour les essais hors navigateur. */
  jsPDFModule?: { jsPDF: new (o: object) => unknown }
  /** Injectable pour les essais : à défaut, l'image est allée chercher. */
  papierCharge?: (url: string) => Promise<string | null>
}) {
  const { jsPDF } = opts.jsPDFModule ?? (await import('jspdf'))
  const { ordres, entreprise, ribOrdinateur, annee, mois } = opts
  // La banque veut la raison sociale complète, pas le nom court du registre.
  const raison = (societeDe(entreprise, opts.modeleDocument)?.raisonSociale ?? entreprise)
    .toUpperCase()

  // Le papier à en-tête de la société, et la bande de page qu'il laisse
  // libre. S'il n'a pas pu être chargé, le document sort sur feuille
  // blanche, avec les marges d'origine : mieux vaut cela que rien.
  const { papier } = papierDe(entreprise, opts.modeleDocument)
  const image = papier ? await (opts.papierCharge ?? chargerPapier)(papier.image) : null
  const haut = image ? papier!.haut : P.haut
  const bas = image ? papier!.bas : P.bas
  const avecFormule = veutLaFormule(entreprise)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setLineWidth(0.4)

  /** Pose le papier à en-tête sur la feuille courante, sous tout le reste. */
  const poserLePapier = () => {
    if (image) doc.addImage(image, 'JPEG', 0, 0, P.l, P.h)
  }

  const aujourdhui = new Date().toLocaleDateString('fr-FR')
  const libelle = `Virement Salaire mois ${String(mois).padStart(2, '0')}/${annee}`
  const ribPropre = formaterRib(ribOrdinateur)

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
    const pages = decouperOrdre(ordre.lignes, { haut, bas, avecFormule })

    pages.forEach((page, p) => {
      // Chaque feuille est un ordre à elle seule : elle ne compte et ne
      // totalise que les virements qu'elle porte. Reprendre le total de
      // l'ordre entier ferait annoncer à la banque, sur chaque feuille,
      // une somme qui ne correspond pas aux lignes imprimées dessous.
      const total = page.reduce((s, l) => s + Number(l.net_a_payer), 0)
      if (!premiere) doc.addPage('a4', 'portrait')
      premiere = false
      poserLePapier()

      const x = P.marge
      let y = haut

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

      // La date, dans sa case, en haut à droite au-dessus du cartouche.
      case_(x + COL.nom + COL.rib, y, COL.montant, CARTOUCHE.hauteur,
            `Date        :   ${aujourdhui}`, { gras: true, taille: 9.5 })
      y += CARTOUCHE.hauteur

      ligneCartouche('RAISON SOCIAL', `SOCIETE ${raison}`, { valeurGrasse: true })
      ligneCartouche('RIB ORDINATEUR', ribPropre, { valeurGrasse: true })
      ligneCartouche("NOMBRE TOTAL D'OPERATIONS", String(page.length), { valeurGrasse: true })
      ligneCartouche("MONTANT TOTAL D'OPERATIONS", n2(total), { valeurGrasse: true })
      ligneCartouche('LIBELLE OPERATIONS', libelle, { valeurGrasse: true })

      // La formule adressée à la banque : Vigilma et Serclean seulement.
      if (avecFormule) {
        // Sa hauteur est fixée d'avance — c'est elle qui a servi à
        // paginer. On dessine dedans, puis on reprend au millimètre prévu.
        const depart = y
        y += 1.5
        doc.setFont('times', 'bold').setFontSize(9.5)
        doc.text('Nous Vous Prions De Bien Vouloir De Virer Par', x, y + 3.4)
        y += 4.6
        doc.text(
          `Le Debit De Nous Compte N° ${ribPropre} De La Societe ${raison}`,
          x, y + 3.4,
        )
        y += 4.6
        // La somme en toutes lettres : c'est elle qui fait foi.
        const enLettres = montantEnLettres(total)
        const lignesSomme = (doc.splitTextToSize(
          `Les Virements Suivants: La Somme de ${enLettres}`, LARGEUR,
        ) as string[]).slice(0, 3)
        for (const l of lignesSomme) {
          doc.text(l, x, y + 3.4)
          y += 4.6
        }
        y = depart + H_FORMULE
      } else {
        y += H_SANS_FORMULE
      }

      // ── Les bénéficiaires ─────────────────────────────────────────
      const hEntete = H_ENTETE_TABLEAU
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
          // Courier maigre en 8 points sortait délavé à l'impression, à
          // côté des noms en 9. Le R.I.B. est ce qu'on recopie à la
          // banque : il doit être le plus lisible de la ligne. En gras et
          // à la même taille, les vingt-quatre chiffres tiennent toujours
          // largement dans la colonne (46 mm sur les 66 disponibles).
          case_(x + COL.nom, y, COL.rib, LIGNE, rib, { mono: true, taille: 9, gras: true })
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
  modeleDocument?: string | null
  ribOrdinateur: string | null
  annee: number
  mois: number
  nomFichier: string
}): Promise<void> {
  const doc = await dessinerOrdreVirement(opts)
  doc.save(opts.nomFichier.endsWith('.pdf') ? opts.nomFichier : `${opts.nomFichier}.pdf`)
}
