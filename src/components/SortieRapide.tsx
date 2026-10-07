import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useFermerSurEchap } from '../lib/impression'
import { todayIso } from '../lib/dates'
import { DateInputFr, ErrorNote } from './ui'
import type { Employee } from '../lib/types'

/**
 * SORTIR QUELQU'UN, TOUT DE SUITE.
 *
 * L'onglet Sorties prépare un départ posément : on annonce, on établit
 * le reçu pour solde de tout compte, on le fait signer, et on ne valide
 * qu'au dernier jour travaillé.
 *
 * Mais il arrive qu'une personne soit simplement partie, et qu'il faille
 * la retirer du pointage sans cérémonie. C'est ce que fait ce bouton :
 * il enregistre la sortie et la valide dans la foulée.
 *
 * Une sortie validée ne se remanie plus. Qui a besoin d'un reçu chiffré
 * passe donc par l'onglet Sorties ; ici, on ne demande que la date — qui
 * décide de la paie — et le motif.
 */
export default function SortieRapide({
  employe,
  onClose,
  onSorti,
}: {
  employe: Employee
  onClose: () => void
  /** Appelé une fois la sortie validée, pour proposer d'aller la voir. */
  onSorti: () => void
}) {
  useFermerSurEchap(onClose)
  const qc = useQueryClient()
  const [date, setDate] = useState(todayIso())
  const [motif, setMotif] = useState('')

  const sortir = useMutation({
    mutationFn: async () => {
      const { data: id, error } = await supabase.rpc('enregistrer_sortie', {
        p_employee: employe.id,
        p_date_sortie: date,
        p_montant: 0,
        p_mode: null,
        p_motif: motif.trim() || null,
        p_champs: {},
      })
      if (error) throw error
      const { error: erreurValidation } = await supabase.rpc('valider_sortie', { p_sortie: id })
      if (erreurValidation) throw erreurValidation
    },
    onSuccess: () => {
      for (const cle of ['employees', 'sorties', 'site-week-pointages', 'site-pointages',
                         'lignes-paie', 'jours-du-mois']) {
        qc.invalidateQueries({ queryKey: [cle] })
      }
      onSorti()
    },
  })

  return (
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (date) sortir.mutate() }}
      >
        <h2 className="text-lg font-semibold text-slate-900">Sortir {employe.nom_prenom}</h2>
        <p className="mt-1 text-sm text-slate-500">
          La personne quitte le registre et le pointage à cette date. Sa fiche, ses
          pointages et ses bulletins restent : elle part dans l’onglet Sorties.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Dernier jour travaillé</span>
          <DateInputFr value={date} onChange={setDate} />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Motif <span className="font-normal text-slate-400">(facultatif)</span>
          </span>
          <input
            type="text"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="ex. Démission"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Une sortie validée ne se modifie plus. Pour un reçu pour solde de tout
          compte chiffré, préparez plutôt le départ depuis l’onglet Sorties.
        </p>

        {sortir.error && <ErrorNote>{(sortir.error as Error).message}</ErrorNote>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!date || sortir.isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {sortir.isPending ? 'Sortie…' : 'Sortir du registre'}
          </button>
        </div>
      </form>
    </div>
  )
}
