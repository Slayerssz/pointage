/**
 * DÉCOUPER UN DOCUMENT HAUT EN PAGES A4.
 *
 * « Enregistrer en PDF » photographie le document affiché. Tant qu'il
 * tenait sur une page, le réduire suffisait. Une liste de deux cents
 * personnes, elle, mesure deux mètres de haut : la réduire à une seule
 * page donnait une colonne de noms illisible, qui ne ressemblait plus
 * du tout à ce qui sort de l'imprimante.
 *
 * On la coupe donc en tranches d'une page. Reste à choisir où couper :
 * une coupe au millimètre près tombe au milieu d'une ligne de texte et
 * en laisse la moitié sur chaque page. D'où `estCoupeFranche` : on
 * recule depuis la coupe idéale jusqu'à trouver une ligne qui ne
 * traverse rien — un blanc entre deux blocs, ou le filet horizontal
 * d'un tableau, qui est un endroit parfaitement propre où couper.
 *
 * Le fichier ne dépend de rien : les essais le chargent seul.
 */

export interface Tranche {
  /** Première ligne de la tranche, en pixels de l'image. */
  debut: number
  /** Première ligne de la tranche suivante : la fin est exclue. */
  fin: number
}

export function decouperEnPages(
  hauteurImage: number,
  hauteurPage: number,
  /** Vrai si l'on peut couper à cette ligne sans rien trancher. */
  estCoupeFranche: (y: number) => boolean = () => true,
  /** De combien on s'autorise à remonter pour trouver mieux. */
  reculMax = Math.round(hauteurPage * 0.15),
): Tranche[] {
  if (!(hauteurImage > 0) || !(hauteurPage > 0)) return []

  const tranches: Tranche[] = []
  let debut = 0

  // Une page par tour. La borne compte les tours pour qu'une mesure
  // absurde ne tourne pas sans fin.
  const maxPages = Math.ceil(hauteurImage / hauteurPage) + 2
  while (debut < hauteurImage && tranches.length < maxPages) {
    const ideal = debut + hauteurPage
    if (ideal >= hauteurImage) {
      tranches.push({ debut, fin: hauteurImage })
      break
    }

    // On remonte depuis la coupe idéale. Jamais au-delà du recul permis,
    // et jamais au point de ne plus avancer.
    const plancher = Math.max(debut + 1, ideal - reculMax)
    let fin = ideal
    for (let y = ideal; y >= plancher; y--) {
      if (estCoupeFranche(y)) { fin = y; break }
    }

    tranches.push({ debut, fin })
    debut = fin
  }

  return tranches
}
