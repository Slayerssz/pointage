import { useFermerSurEchap } from '../lib/impression'
import { Choix } from './ChoixImpression'

/**
 * Deux façons d'imprimer la même paie, et elles ne servent pas à la
 * même chose.
 *
 * La liste simple reste à la maison : le bureau la lit, la vérifie, la
 * classe. Le document détaillé est la pièce qui sort — l'ordre de
 * virement que la banque exécute, la liste des versements qu'on lui
 * porte, les reçus d'espèces qu'on fait signer. Chacun suit le modèle
 * papier de la société, et dépend donc du mode de règlement affiché.
 */

/** Le nom du document officiel qui correspond au mode affiché. */
function documentDu(mode: string | null | undefined): string | null {
  const m = (mode ?? '').toLowerCase()
  if (m.startsWith('vir')) return 'L’ordre de virement'
  if (m.startsWith('vers')) return 'La liste des versements'
  if (m.startsWith('esp')) return 'Les reçus d’espèces'
  return null
}
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
  const officiel = documentDu(mode)

  return (
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Imprimer la paie</h2>
        <p className="mt-1 text-sm text-slate-500">
          <strong className="text-slate-700">{periode}</strong> · {nombre} salarié(s)
          {mode ? ` payés par ${mode.toLowerCase()}` : ''}.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Choix
            titre="Liste simple"
            pour="Pour le bureau"
            detail={
              (especes
                ? 'Matricule, nom, salaire et salaire net. Sans R.I.B. : l’argent se remet en main propre.'
                : 'Matricule, nom, R.I.B., salaire et salaire net.') +
              ' Les salariés sont rangés par site, avec l’effectif et les totaux de chacun.'
            }
            recommande
            onClick={onSimple}
          />
          <Choix
            titre="Document détaillé"
            pour={officiel ? 'La pièce qui sort' : 'Selon le mode de règlement'}
            detail={
              officiel
                ? `${officiel}, dans le modèle papier de la société.`
                : 'L’ordre de virement, la liste des versements ou les reçus d’espèces, selon le mode choisi.'
            }
            indisponible={
              officiel
                ? undefined
                : 'Choisissez d’abord Espèces, Virement ou Versement : chaque mode a son propre modèle.'
            }
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
