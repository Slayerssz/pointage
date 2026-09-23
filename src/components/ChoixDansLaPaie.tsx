import { useFermerSurEchap } from '../lib/impression'
import { formatDH } from '../lib/paie'

/**
 * Choisir où regarder dans la paie : quelle banque pour les virements,
 * quel site pour les versements.
 *
 * Une fenêtre plutôt qu'un menu déroulant : la liste montre d'un coup
 * combien de personnes et combien d'argent il y a derrière chaque choix,
 * ce qu'un menu ne dit pas. « Tout » reste en tête — c'est souvent ce
 * qu'on veut.
 */
export interface OptionPaie {
  nom: string
  n: number
  total: number
}

export default function ChoixDansLaPaie({
  titre,
  question,
  options,
  choisi,
  totalGeneral,
  nGeneral,
  onChoisir,
  onClose,
}: {
  titre: string
  question: string
  options: OptionPaie[]
  /** Le choix courant : '' pour « tout ». */
  choisi: string
  totalGeneral: number
  nGeneral: number
  onChoisir: (valeur: string) => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)

  const Ligne = ({ nom, n, total, valeur }: OptionPaie & { valeur: string }) => (
    <button
      onClick={() => { onChoisir(valeur); onClose() }}
      className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${
        choisi === valeur
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white hover:border-slate-400'
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{nom}</span>
        <span className={`block text-xs ${choisi === valeur ? 'text-slate-300' : 'text-slate-500'}`}>
          {n} employé{n > 1 ? 's' : ''}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatDH(total)}</span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">{titre}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {options.length === 0
            ? 'Personne n’est payé de cette façon ce mois-ci.'
            : options.length === 1
              ? `${question} Il n’y en a qu’un ce mois-ci.`
              : question}
        </p>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          <Ligne nom="Tout" n={nGeneral} total={totalGeneral} valeur="" />
          {options.length > 0 && <div className="h-px bg-slate-100" />}
          {options.map((o) => (
            <Ligne key={o.nom} {...o} valeur={o.nom} />
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
