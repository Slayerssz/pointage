import { useState } from 'react'
import { useFermerSurEchap } from '../lib/impression'

/**
 * LES TROIS CHIFFRES DU BULLETIN.
 *
 * Le service paie établit le bulletin à partir de trois chiffres qu'il
 * saisit : le salaire brut, le nombre de jours travaillés, l'avance
 * éventuelle. Les champs partent vides — c'est la réponse à ces
 * questions qui fait le bulletin, pas ce que la paie avait calculé.
 *
 * Le reste — C.N.S.S., A.M.O., I.G.R., net — se calcule à partir de ces
 * chiffres-là, côté base, avec les taux de la société.
 */
export interface SaisieBulletinValeurs {
  salaireBrut: number
  jours: number
  avance: number
  /** L'intitulé du gain saisi, s'il y en a un. */
  gainLibelle: string
  gainMontant: number
}

export default function SaisieBulletin({
  nom,
  onValider,
  onClose,
}: {
  nom: string
  onValider: (v: SaisieBulletinValeurs) => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)

  const [salaireBrut, setSalaireBrut] = useState('')
  const [jours, setJours] = useState('')
  const [avance, setAvance] = useState('')
  // Le contraire de l'avance : un montant qui s'ajoute, sous le nom que
  // la paie lui donne — il change d'un mois à l'autre.
  const [gainLibelle, setGainLibelle] = useState('')
  const [gainMontant, setGainMontant] = useState('')

  const n = (v: string) => Number(v.replace(',', '.')) || 0
  const vide = salaireBrut.trim() === '' || jours.trim() === ''
  const negatif = n(salaireBrut) < 0 || n(jours) < 0 || n(avance) < 0 || n(gainMontant) < 0
  // Un montant sans nom n'aurait pas de libellé sur le bulletin.
  const gainSansNom = n(gainMontant) > 0 && gainLibelle.trim() === ''
  const invalide = vide || negatif || gainSansNom

  const champ = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums'

  return (
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!invalide) {
            onValider({
              salaireBrut: n(salaireBrut), jours: n(jours), avance: n(avance),
              gainLibelle: gainLibelle.trim(), gainMontant: n(gainMontant),
            })
          }
        }}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          Bulletin de {nom}
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
            placeholder="ex. 3046"
            className={champ}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Jours travaillés</span>
          <input
            type="number" step="0.5" min="0"
            value={jours}
            onChange={(e) => setJours(e.target.value)}
            placeholder="ex. 26"
            className={champ}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Avance (DH)</span>
          <input
            type="number" step="0.01" min="0"
            value={avance}
            onChange={(e) => setAvance(e.target.value)}
            placeholder="0"
            className={champ}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Portée en retenue et déduite du net. À laisser vide s’il n’y en a pas.
          </span>
        </label>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">Un montant à ajouter ?</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Le contraire de l’avance : il s’ajoute au net. Donnez-lui son nom — il
            paraîtra tel quel sur le bulletin. À laisser vide s’il n’y en a pas.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={gainLibelle}
              onChange={(e) => setGainLibelle(e.target.value)}
              placeholder="ex. Prime exceptionnelle"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number" step="0.01" min="0"
              value={gainMontant}
              onChange={(e) => setGainMontant(e.target.value)}
              placeholder="0"
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          {gainSansNom && (
            <p className="mt-2 text-sm text-red-600">Dites à quel titre ce montant s’ajoute.</p>
          )}
        </div>

        {negatif && (
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
            Établir le bulletin
          </button>
        </div>
      </form>
    </div>
  )
}
