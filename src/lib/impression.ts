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
 * dialogue d'impression : une page par fiche, à l'identique de l'écran.
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

  // Une page par article ; à défaut, tout le document sur une page
  const articles = [...racine.querySelectorAll<HTMLElement>(':scope > article')]
  const blocs = articles.length > 0 ? articles : [racine]

  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const largeurPage = pdf.internal.pageSize.getWidth()
  const hauteurPage = pdf.internal.pageSize.getHeight()
  const marge = 8

  for (let i = 0; i < blocs.length; i++) {
    const canvas = await html2canvas(blocs[i], {
      scale: 2,               // net à l'impression
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })

    // Mise à l'échelle en conservant les proportions
    const dispoL = largeurPage - marge * 2
    const dispoH = hauteurPage - marge * 2
    const ratio = Math.min(dispoL / canvas.width, dispoH / canvas.height)
    const l = canvas.width * ratio
    const h = canvas.height * ratio

    if (i > 0) pdf.addPage('a4', orientation)
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.94), 'JPEG',
      (largeurPage - l) / 2, marge, l, h,
    )
  }

  pdf.save(nomFichier.endsWith('.pdf') ? nomFichier : `${nomFichier}.pdf`)
}
