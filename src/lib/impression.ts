import { decouperEnPages } from './decoupePdf'
import { useCallback, useEffect, useState } from 'react'

/**
 * N'imprime qu'une fois toutes les images du document réellement chargées.
 *
 * Sans cette précaution, cliquer sur « Imprimer » trop tôt sort une page
 * sans en-tête ni photo : le navigateur imprime ce qu'il a à l'instant T.
 */
export function useImpression(nbImagesAttendues: number) {
  const [pret, setPret] = useState(nbImagesAttendues === 0)

  useEffect(() => {
    if (nbImagesAttendues === 0) {
      setPret(true)
      return
    }
    let annule = false

    const verifier = async () => {
      const images = [...document.querySelectorAll<HTMLImageElement>('.document-imprimable img')]
      if (images.length < nbImagesAttendues) return false
      await Promise.all(
        images.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((r) => {
                img.addEventListener('load', () => r(), { once: true })
                // Une image qui échoue ne doit pas bloquer l'impression
                img.addEventListener('error', () => r(), { once: true })
              }),
        ),
      )
      return true
    }

    // Les images arrivent au fil du rendu : on repasse jusqu'à les avoir toutes
    const boucle = async () => {
      for (let essai = 0; essai < 40 && !annule; essai++) {
        if (await verifier()) {
          if (!annule) setPret(true)
          return
        }
        await new Promise((r) => setTimeout(r, 100))
      }
      if (!annule) setPret(true) // au bout de 4 s, on n'attend plus
    }
    void boucle()

    return () => { annule = true }
  }, [nbImagesAttendues])

  const imprimer = useCallback(() => {
    if (!pret) return
    window.print()
  }, [pret])

  return { pret, imprimer }
}

/** Ferme la fenêtre sur Échap. */
export function useFermerSurEchap(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

/** Marque <body> le temps de l'affichage : seul le document part à l'impression. */
export function useModeImpression() {
  useEffect(() => {
    document.body.classList.add('impression')
    return () => document.body.classList.remove('impression')
  }, [])
}

/**
 * Enregistre le document affiché en PDF, sans passer par la boîte de
 * dialogue d'impression. Une page par fiche quand le document en
 * contient ; sinon, le document est découpé en pages A4, comme le
 * ferait l'imprimante.
 */
export async function enregistrerPdf(
  nomFichier: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
): Promise<void> {
  // html2canvas-pro : le fork qui comprend les couleurs oklch(), celles
  // qu'utilise Tailwind — l'original échoue dessus.
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas-pro'),
  ])

  const racine = document.querySelector<HTMLElement>('.document-imprimable')
  if (!racine) throw new Error('Document introuvable.')

  // Une page par article ; à défaut, tout le document, qu'on découpera.
  const articles = [...racine.querySelectorAll<HTMLElement>(':scope > article')]
  const blocs = articles.length > 0 ? articles : [racine]

  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const largeurPage = pdf.internal.pageSize.getWidth()
  const hauteurPage = pdf.internal.pageSize.getHeight()
  const marge = 8
  const dispoL = largeurPage - marge * 2
  const dispoH = hauteurPage - marge * 2
  let premiere = true

  for (const bloc of blocs) {
    const canvas = await html2canvas(bloc, {
      scale: 2,               // net à l'impression
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })

    // Le bloc est mis à la largeur de la page. S'il tient aussi en
    // hauteur, il part d'une pièce ; sinon on le coupe en pages.
    const echelle = dispoL / canvas.width
    if (canvas.height * echelle <= dispoH) {
      if (!premiere) pdf.addPage('a4', orientation)
      premiere = false
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.94), 'JPEG',
        marge, marge, dispoL, canvas.height * echelle,
      )
      continue
    }

    const tranches = decouperEnPages(
      canvas.height,
      Math.floor(dispoH / echelle),
      coupeFranche(canvas),
    )
    for (const { debut, fin } of tranches) {
      const morceau = document.createElement('canvas')
      morceau.width = canvas.width
      morceau.height = fin - debut
      const ctx = morceau.getContext('2d')
      if (!ctx) throw new Error('Découpage impossible.')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, morceau.width, morceau.height)
      ctx.drawImage(canvas, 0, debut, canvas.width, fin - debut,
                    0, 0, canvas.width, fin - debut)

      if (!premiere) pdf.addPage('a4', orientation)
      premiere = false
      pdf.addImage(
        morceau.toDataURL('image/jpeg', 0.94), 'JPEG',
        marge, marge, dispoL, morceau.height * echelle,
      )
    }
  }

  pdf.save(nomFichier.endsWith('.pdf') ? nomFichier : `${nomFichier}.pdf`)
}

/**
 * Où l'on peut couper sans rien trancher : une ligne entièrement
 * blanche — l'espace entre deux blocs — ou au contraire une ligne
 * pleine d'encre sur toute sa largeur, qui est le filet d'un tableau.
 * Entre les deux, on traverse du texte.
 */
function coupeFranche(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return () => true
  return (y: number) => {
    if (y <= 0 || y >= canvas.height) return false
    const { data } = ctx.getImageData(0, y, canvas.width, 1)
    let encre = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) encre++
    }
    return encre === 0 || encre >= canvas.width * 0.9
  }
}
