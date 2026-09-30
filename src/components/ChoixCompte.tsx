import { useFermerSurEchap } from '../lib/impression'
import { nomDuCompte, type CompteBancaire } from '../lib/comptesSociete'

/**
 * De quel compte part l'ordre de virement ?
 *
 * Une société qui a deux banques ne les met pas toutes les deux sur la
 * même feuille : celle qui exécute l'ordre n'a que faire de l'autre.
 * La question ne se pose donc que là où il y a le choix.
 */
export default function ChoixCompte({
  entreprise,
  comptes,
  onChoisir,
  onClose,
}: {
  entreprise: string
  comptes: CompteBancaire[]
  onChoisir: (compte: CompteBancaire) => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)

  return (
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">De quel compte ?</h2>
        <p className="mt-1 text-sm text-slate-500">
          <strong className="text-slate-700">{entreprise}</strong> a {comptes.length} comptes.
          Seul celui que vous choisissez paraîtra sur l’ordre de virement.
        </p>

        <div className="mt-4 space-y-2">
          {comptes.map((c) => (
            <button
              key={c.rib}
              onClick={() => onChoisir(c)}
              className="flex w-full flex-col rounded-xl border border-slate-300 p-3 text-left transition hover:border-slate-900 hover:bg-slate-50"
            >
              <span className="text-sm font-semibold text-slate-900">{nomDuCompte(c)}</span>
              <span className="mt-0.5 font-mono text-xs tracking-wide text-slate-500">
                {c.rib}
              </span>
            </button>
          ))}
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
