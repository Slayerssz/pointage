import { useState } from 'react'
import { useFermerSurEchap } from '../lib/impression'
import { formatDateFr, todayIso } from '../lib/dates'
import { DateInputFr } from './ui'

/**
 * QUAND EST-IL PARTI ?
 *
 * La date de sortie décide de la paie du mois : jusqu'à quel jour la
 * personne est payée, et à partir de quand elle cesse d'être pointée.
 * On ne la devine donc pas. Il arrive qu'on n'enregistre un départ que
 * cinq jours après coup — la question se pose au moment où l'on change
 * le statut, et pas dans un champ qu'on risque de ne pas voir.
 *
 * Aujourd'hui est proposé d'un bouton, parce que c'est le cas le plus
 * courant ; mais rien n'est inscrit tant qu'on n'a pas confirmé.
 */
export default function DemanderDateSortie({
  nom,
  dateInitiale,
  onConfirmer,
  onAnnuler,
}: {
  nom: string
  /** La date déjà connue, si l'on revient sur un départ. */
  dateInitiale?: string
  onConfirmer: (date: string) => void
  onAnnuler: () => void
}) {
  useFermerSurEchap(onAnnuler)
  const [date, setDate] = useState(dateInitiale ?? '')
  const futur = Boolean(date) && date > todayIso()

  return (
    <div className="modale fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
         onClick={onAnnuler}>
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (date) onConfirmer(date) }}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          Quel est son dernier jour ?
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          <strong className="text-slate-700">{nom}</strong> quitte le registre et le
          pointage à cette date. Sa fiche, ses pointages et ses bulletins restent.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Date de sortie
          </span>
          <DateInputFr value={date} onChange={setDate} />
        </label>

        <button
          type="button"
          onClick={() => setDate(todayIso())}
          className="mt-2 text-sm font-medium text-blue-700 underline hover:text-blue-900"
        >
          Aujourd’hui ({formatDateFr(todayIso())})
        </button>

        {futur && (
          <p className="mt-3 text-sm text-amber-700">
            Cette date est à venir : la personne restera pointée jusque-là.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onAnnuler}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!date}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            Marquer sorti
          </button>
        </div>
      </form>
    </div>
  )
}
