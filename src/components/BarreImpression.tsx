import { useState } from 'react'
import { enregistrerPdf } from '../lib/impression'
import { ErrorNote } from './ui'

/**
 * La barre d'actions commune à tous les documents imprimables.
 *
 * Deux boutons distincts : « Enregistrer en PDF » produit le fichier
 * directement, « Imprimer » ouvre la boîte de dialogue du navigateur.
 * Les deux restent inactifs tant que les images (en-tête, photos) ne
 * sont pas chargées — sinon le document sortirait incomplet.
 */
export default function BarreImpression({
  titre,
  pret,
  imprimer,
  nomFichier,
  orientation = 'portrait',
  genererPdf,
  onClose,
}: {
  titre: string
  pret: boolean
  imprimer: () => void
  nomFichier: string
  orientation?: 'portrait' | 'landscape'
  /** Générateur sur mesure ; à défaut, on photographie la page. */
  genererPdf?: () => Promise<void>
  onClose: () => void
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const pdf = async () => {
    setEnCours(true)
    setErreur(null)
    try {
      if (genererPdf) await genererPdf()
      else await enregistrerPdf(nomFichier, orientation)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="sticky top-0 z-10 bg-slate-900 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-medium text-white">
          {titre}
          {!pret && <span className="ml-2 text-slate-400">· préparation…</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={pdf}
            disabled={!pret || enCours}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {enCours ? 'Création du PDF…' : 'Enregistrer en PDF'}
          </button>
          <button
            onClick={imprimer}
            disabled={!pret}
            className="rounded-lg border border-slate-500 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Imprimer
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>
      {erreur && (
        <div className="px-4 pb-3">
          <ErrorNote>Enregistrement impossible : {erreur}</ErrorNote>
        </div>
      )}
    </div>
  )
}
