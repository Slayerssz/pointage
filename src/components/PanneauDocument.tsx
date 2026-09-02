import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ModeleContrat } from '../lib/contratsModeles'
import ContratDocument from './ContratDocument'

/**
 * LE FORMULAIRE ET LA PAGE, CÔTE À CÔTE.
 *
 * À gauche ce qu'on saisit, à droite la page telle qu'elle sortira de
 * l'imprimante, à jour à chaque frappe. On ne remplit pas à l'aveugle
 * pour découvrir le résultat au moment d'imprimer : on voit le document
 * se composer pendant qu'on le rédige.
 */
export default function PanneauDocument({
  modele,
  valeurs,
  enTete,
  children,
  actions,
}: {
  modele: ModeleContrat | null
  valeurs: Record<string, string>
  /** Ce qui coiffe le formulaire : titre, avertissements. */
  enTete?: ReactNode
  children: ReactNode
  actions: ReactNode
}) {
  // « Taille réelle » : la page aux dimensions de l'impression, avec
  // défilement. Utile pour relire une ligne en arabe.
  const [tailleReelle, setTailleReelle] = useState(false)

  // Le formulaire garde une largeur de lecture ; tout le reste va au
  // document, qui doit rester lisible sans qu'on plisse les yeux.
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-xl border border-slate-200 p-4">
        {enTete}
        {children}
        <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>

      <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-100 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Aperçu du document
          </p>
          {modele && (
            <button
              onClick={() => setTailleReelle((x) => !x)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {tailleReelle ? 'Ajuster à la largeur' : 'Taille réelle'}
            </button>
          )}
        </div>
        {modele ? (
          <PageAEchelle tailleReelle={tailleReelle}>
            <ContratDocument modele={modele} valeurs={valeurs} />
          </PageAEchelle>
        ) : (
          <p className="px-3 py-10 text-center text-sm text-slate-400">
            Aucun modèle de document enregistré pour cette société.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Met la page A4 à la largeur disponible sans la déformer, et réserve
 * exactement la hauteur qu'elle occupe une fois réduite — sinon la mise
 * à l'échelle laisserait un grand vide sous le document.
 */
function PageAEchelle({
  children, tailleReelle,
}: { children: ReactNode; tailleReelle: boolean }) {
  const boite = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const [echelle, setEchelle] = useState(1)
  const [hauteur, setHauteur] = useState(0)
  const PX_PAR_MM = 96 / 25.4
  const LARGEUR = 210 * PX_PAR_MM

  useEffect(() => {
    const el = boite.current
    if (!el) return
    const mesurer = () => {
      const e = tailleReelle ? 1 : Math.min(1, el.clientWidth / LARGEUR)
      setEchelle(e)
      if (page.current) setHauteur(page.current.scrollHeight * e)
    }
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(el)
    if (page.current) ro.observe(page.current)
    return () => ro.disconnect()
  }, [LARGEUR, tailleReelle])

  return (
    <div ref={boite} className={tailleReelle ? 'overflow-x-auto' : 'overflow-hidden'}>
      <div style={{ height: hauteur || undefined }}>
        <div
          ref={page}
          className="bg-white shadow-lg"
          style={{ width: LARGEUR, transform: `scale(${echelle})`, transformOrigin: 'top left' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
