import { useState } from 'react'
import { useFermerSurEchap } from '../lib/impression'
import { formatDH } from '../lib/paie'
import type { Bulletin } from '../lib/bulletin'

/**
 * LES TROIS CHIFFRES DU BULLETIN.
 *
 * Le service paie établit le bulletin à partir du salaire brut, du
 * nombre de jours travaillés et de l'avance éventuelle. Les deux
 * premiers arrivent préremplis avec ce que la paie a calculé : on
 * accepte d'un clic, ou on corrige — retaper cinquante salaires que le
 * système connaît déjà n'aurait pas de sens.
 *
 * Le reste du bulletin — C.N.S.S., A.M.O., I.G.R., net — se calcule à
 * partir de ces chiffres-là, côté base, avec les taux de la société.
 */
export interface SaisieBulletinValeurs {
  salaireBrut: number
  jours: number
  avance: number
}

export default function SaisieBulletin({
  bulletin,
  onValider,
  onClose,
}: {
  /** Le bulletin tel que la paie le calcule : sert de point de départ. */
  bulletin: Bulletin
  onValider: (v: SaisieBulletinValeurs) => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)

  const brutPaie = Number(bulletin.lignes.find((l) => l.code === '001')?.gain ?? 0)
  const joursPaie = Number(bulletin.pied.jours_travailles ?? 0)

  const [salaireBrut, setSalaireBrut] = useState(String(brutPaie))
  const [jours, setJours] = useState(String(joursPaie))
  const [avance, setAvance] = useState('0')

  const n = (v: string) => Number(v.replace(',', '.')) || 0
  const invalide = n(salaireBrut) < 0 || n(jours) < 0 || n(avance) < 0
  const modifie = n(salaireBrut) !== brutPaie || n(jours) !== joursPaie || n(avance) !== 0

  const champ = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!invalide) onValider({ salaireBrut: n(salaireBrut), jours: n(jours), avance: n(avance) })
        }}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          Bulletin de {bulletin.employe.nom_prenom}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Trois chiffres, et le bulletin se calcule : cotisations, I.G.R. et net compris.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Salaire brut (DH)</span>
          <input
            type="number" step="0.01" min="0" autoFocus
            value={salaireBrut}
            onChange={(e) => setSalaireBrut(e.target.value)}
            className={champ}
          />
          <span className="mt-1 block text-xs text-slate-500">
            La paie a calculé {formatDH(brutPaie)}.
          </span>
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Jours travaillés</span>
          <input
            type="number" step="0.5" min="0"
            value={jours}
            onChange={(e) => setJours(e.target.value)}
            className={champ}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Le pointage en compte {joursPaie}.
          </span>
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Avance (DH)</span>
          <input
            type="number" step="0.01" min="0"
            value={avance}
            onChange={(e) => setAvance(e.target.value)}
            className={champ}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Retenue sur le bulletin et déduite du net. Laissez 0 s’il n’y en a pas.
          </span>
        </label>

        {invalide && (
          <p className="mt-3 text-sm text-red-600">Un montant ne peut pas être négatif.</p>
        )}

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
            disabled={invalide}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {modifie ? 'Établir le bulletin' : 'Établir sans changement'}
          </button>
        </div>
      </form>
    </div>
  )
}
