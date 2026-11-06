import { useState } from 'react'
import { useFermerSurEchap } from '../lib/impression'
import { formatDateFr, todayIso } from '../lib/dates'
import { DateInputFr } from './ui'

/**
 * REPRENDRE QUELQU'UN QUI ÉTAIT SORTI.
 *
 * Il revient avec tout son passé : son matricule, sa C.I.N., son
 * ancienneté, ses contrats, ses mois déjà payés. Rien de tout cela ne
 * se ressaisit. Deux choses, en revanche, ne se devinent pas.
 *
 * LE JOUR DU RETOUR, parce que ses journées se posent à partir de ce
 * jour-là et pas du premier du mois : il n'était pas là avant.
 *
 * SON ANNEXE, parce qu'on ne le remet pas forcément là où il était. Le
 * champ part vide exprès : reconduire l'ancien poste d'office serait
 * une supposition, et personne ne la relirait.
 */
export default function ReprendreEmploye({
  nom,
  dateSortie,
  sites,
  onConfirmer,
  onAnnuler,
  enCours,
  erreur,
}: {
  nom: string
  /** Son départ : le retour ne peut pas lui être antérieur. */
  dateSortie: string | null
  sites: { id: string; name: string }[]
  onConfirmer: (v: { date: string; siteId: string }) => void
  onAnnuler: () => void
  enCours?: boolean
  erreur?: string | null
}) {
  useFermerSurEchap(onAnnuler)
  const [date, setDate] = useState('')
  const [siteId, setSiteId] = useState('')

  const futur = Boolean(date) && date > todayIso()
  const avantLeDepart = Boolean(date) && Boolean(dateSortie) && date <= dateSortie!
  const invalide = !date || !siteId || futur || avantLeDepart

  return (
    <div className="modale fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
         onClick={onAnnuler}>
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!invalide) onConfirmer({ date, siteId })
        }}
      >
        <h2 className="text-lg font-semibold text-slate-900">Le remettre au travail</h2>
        <p className="mt-1 text-sm text-slate-500">
          <strong className="text-slate-700">{nom}</strong> reprend avec sa fiche
          telle quelle : même matricule, même ancienneté, mêmes contrats. Ses mois
          passés ne bougent pas.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Jour du retour
          </span>
          <DateInputFr value={date} onChange={setDate} />
          <span className="mt-1 block text-xs text-slate-500">
            Ses journées se posent à partir de ce jour-là, pas avant.
          </span>
        </label>

        <button
          type="button"
          onClick={() => setDate(todayIso())}
          className="mt-2 text-sm font-medium text-blue-700 underline hover:text-blue-900"
        >
          Aujourd’hui ({formatDateFr(todayIso())})
        </button>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Annexe où il reprend
          </span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— Sélectionnez un site —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        {avantLeDepart && (
          <p className="mt-3 text-sm text-red-600">
            Il est parti le {formatDateFr(dateSortie!)} : son retour doit être après.
          </p>
        )}
        {futur && (
          <p className="mt-3 text-sm text-red-600">
            Ce jour est à venir. On reprend quelqu’un le jour où il revient, pas avant.
          </p>
        )}
        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}

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
            disabled={invalide || enCours}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {enCours ? 'Reprise…' : 'Le reprendre'}
          </button>
        </div>
      </form>
    </div>
  )
}
