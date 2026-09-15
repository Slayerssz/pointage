import { useFermerSurEchap } from '../lib/impression'
import { Choix } from './ChoixImpression'

/**
 * Deux fiches pour la même personne, et le choix n'est pas cosmétique :
 * la fiche simple est le modèle officiel — photo, neuf champs, pièces à
 * fournir — qu'on remet ou qu'on classe ; la fiche détaillée porte tout
 * ce que le registre sait, salaire et R.I.B. compris. Celle-là reste au
 * bureau.
 */
export default function ChoixFiche({
  nom,
  onSimple,
  onDetaillee,
  onClose,
}: {
  nom: string
  onSimple: () => void
  onDetaillee: () => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
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
            detail="Photo, matricule, identité, adresse, site, date d’embauche, et les pièces à fournir."
            recommande
            onClick={onSimple}
          />
          <Choix
            titre="Fiche détaillée"
            pour="Usage interne, bureau"
            detail="Tout ce que le registre sait : téléphone, situation familiale, horaire, repos, salaire, banque, R.I.B., dette, contrat en cours."
            avertissement="Contient le salaire et le R.I.B."
            onClick={onDetaillee}
          />
        </div>

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
