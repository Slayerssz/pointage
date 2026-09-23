import { useState } from 'react'
import { useFermerSurEchap } from '../lib/impression'
import { formatDH } from '../lib/paie'
import type { LignePaie } from '../lib/types'
import type { VersementsDeBanque } from './ListeVersementsPrint'

/**
 * Quelle banque ? Une liste par banque : on la choisit, on imprime, on
 * porte la feuille au guichet. « Toutes les banques » sort chaque liste
 * sur ses propres pages, d'un coup.
 *
 * Une banque sans nom (fiche incomplète) fait un groupe à part, nommé
 * ainsi, plutôt que de disparaître de la liste.
 */
export default function ChoixListeVersements({
  versements,
  onImprimer,
  onClose,
}: {
  /** Les lignes payées par versement, ce mois-ci. */
  versements: LignePaie[]
  onImprimer: (groupes: VersementsDeBanque[]) => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)

  const parBanque = new Map<string, LignePaie[]>()
  for (const l of versements) {
    const k = (l.banque ?? '').trim().replace(/\s+/g, ' ').toUpperCase() || '(BANQUE NON RENSEIGNÉE)'
    parBanque.set(k, [...(parBanque.get(k) ?? []), l])
  }
  const banques = [...parBanque.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([banque, lignes]) => ({
      banque,
      lignes: [...lignes].sort((a, b) => (a.matricule ?? 0) - (b.matricule ?? 0)),
      total: lignes.reduce((s, l) => s + Number(l.net_a_payer), 0),
    }))

  const [choisie, setChoisie] = useState<string>(banques.length === 1 ? banques[0].banque : '')

  const lancer = () => {
    if (choisie === '*') onImprimer(banques.map(({ banque, lignes }) => ({ banque, lignes })))
    else {
      const b = banques.find((x) => x.banque === choisie)
      if (b) onImprimer([{ banque: b.banque, lignes: b.lignes }])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Liste des versements</h2>
        <p className="mt-1 text-sm text-slate-500">
          Une liste par banque. Montants : le net à payer du mois, primes et retenues comprises.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Banque</span>
          <select
            value={choisie}
            onChange={(e) => setChoisie(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Choisir une banque —</option>
            {banques.map((b) => (
              <option key={b.banque} value={b.banque}>
                {b.banque} — {b.lignes.length} personne{b.lignes.length > 1 ? 's' : ''} · {formatDH(b.total)}
              </option>
            ))}
            {banques.length > 1 && (
              <option value="*">Toutes les banques — une liste par banque ({banques.length})</option>
            )}
          </select>
        </label>

        {parBanque.has('(BANQUE NON RENSEIGNÉE)') && (
          <p className="mt-3 text-sm font-medium text-amber-700">
            {parBanque.get('(BANQUE NON RENSEIGNÉE)')!.length} personne(s) sans banque sur la fiche :
            elles sortent dans une liste à part.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={lancer}
            disabled={!choisie}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Imprimer
          </button>
        </div>
      </div>
    </div>
  )
}
