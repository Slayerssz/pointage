import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Sort le document imprimable de l'application et le rattache directement
 * au <body>.
 *
 * Pourquoi : masquer le reste avec `visibility: hidden` ne suffit pas —
 * les éléments masqués gardent leur place et continuent d'occuper des
 * pages. Un long tableau d'employés derrière la fenêtre produisait ainsi
 * trois pages blanches. En sortant le document, on peut escamoter
 * complètement le reste (`display: none`) : il ne reste que le document.
 */
export default function PortailImpression({ children }: { children: ReactNode }) {
  const [hote] = useState(() => {
    const d = document.createElement('div')
    d.className = 'zone-impression'
    return d
  })

  useEffect(() => {
    document.body.appendChild(hote)
    return () => { document.body.removeChild(hote) }
  }, [hote])

  return createPortal(children, hote)
}
