import { useFermerSurEchap } from '../lib/impression'
import { Choix } from './ChoixImpression'

/**
 * Deux états pour la même paie. Le simple est celui qu'on lit et qu'on
 * fait circuler : qui, combien brut, combien net — et le R.I.B. quand
 * l'argent part en banque. Le détaillé ouvre les colonnes
 * intermédiaires, et reste au bureau.
 */
export default function ChoixEtatSalaires({
  periode,
  nombre,
  mode,
  onSimple,
  onDetaillee,
  onClose,
}: {
  periode: string
  nombre: number
  /** Le mode de règlement affiché, s'il y en a un. */
  mode?: string | null
  onSimple: () => void
  onDetaillee: () => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)
  const especes = (mode ?? '').toLowerCase().startsWith('esp')

  return (
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">État des salaires</h2>
        <p className="mt-1 text-sm text-slate-500">
          <strong className="text-slate-700">{periode}</strong> · {nombre} salarié(s)
          {mode ? ` payés par ${mode.toLowerCase()}` : ''}. Les salariés sont rangés par
          site, avec l’effectif et les totaux de chacun.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Choix
            titre="État simple"
            pour="À lire et à faire circuler"
            detail={
              especes
                ? 'Matricule, nom, salaire et salaire net. Sans R.I.B. : l’argent se remet en main propre.'
                : 'Matricule, nom, R.I.B., salaire et salaire net.'
            }
            recommande
            onClick={onSimple}
          />
          <Choix
            titre="État détaillé"
            pour="Usage interne, bureau"
            detail="Ajoute le salaire de base, la prime, le transport, le panier, le crédit et les autres retenues. A4 paysage."
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
