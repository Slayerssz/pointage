import { useState } from 'react'
import { useFermerSurEchap } from '../lib/impression'
import { PIECES, type Piece } from '../lib/pieces'
import { Choix } from './ChoixImpression'

/**
 * Deux fiches pour la même personne, et le choix n'est pas cosmétique :
 * la fiche simple est le modèle officiel — photo, les champs d'identité,
 * les pièces demandées — qu'on remet ou qu'on classe ; la fiche détaillée porte tout
 * ce que le registre sait, salaire et R.I.B. compris. Celle-là reste au
 * bureau.
 *
 * Les pièces administratives se cochent avant d'imprimer : on ne réclame
 * pas toujours les trois, et une ligne imprimée est une pièce qu'on
 * finira par redemander à quelqu'un.
 */
export default function ChoixFiche({
  nom,
  onSimple,
  onDetaillee,
  onClose,
}: {
  nom: string
  onSimple: (pieces: Piece[]) => void
  onDetaillee: () => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)
  const [choisies, setChoisies] = useState<Piece[]>([...PIECES])

  const basculer = (p: Piece) =>
    setChoisies((liste) =>
      liste.includes(p) ? liste.filter((x) => x !== p) : [...PIECES].filter((x) => x === p || liste.includes(x)))

  return (
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Imprimer la fiche</h2>
        <p className="mt-1 text-sm text-slate-500">
          <strong className="text-slate-700">{nom}</strong>. Quelle fiche ?
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Choix
            titre="Fiche simple"
            pour="Le modèle officiel"
            detail="Photo, matricule, identité, adresse, site, date d’embauche, et les pièces demandées."
            recommande
            onClick={() => onSimple(choisies)}
          />
          <Choix
            titre="Fiche détaillée"
            pour="Usage interne, bureau"
            detail="Tout ce que le registre sait : téléphone, situation familiale, horaire, repos, salaire, banque, R.I.B."
            avertissement="Contient le salaire et le R.I.B."
            onClick={onDetaillee}
          />
        </div>

        <fieldset className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Pièces à réclamer
          </legend>
          <p className="text-xs text-slate-500">
            Elles ne figurent que sur la fiche simple. Décochez celles dont vous
            n’avez pas besoin ; sans aucune, le pavé ne s’imprime pas.
          </p>
          <div className="mt-2 space-y-1.5">
            {PIECES.map((p) => (
              <label key={p} className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={choisies.includes(p)}
                  onChange={() => basculer(p)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
