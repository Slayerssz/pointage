import { useState } from 'react'
import { useFermerSurEchap } from '../lib/impression'
import { formatDH } from '../lib/paie'
import type { LignePaie } from '../lib/types'
import type { OrdreDeSite } from './OrdreVirementPrint'

/**
 * Quel site part à la banque ? Un ordre de virement par site : on choisit
 * le site, on imprime, on passe au suivant. « Tous les sites » sort tous
 * les ordres d'un coup, chacun sur ses pages.
 *
 * Le R.I.B. de la société (« RIB ORDINATEUR » sur le formulaire) se tape
 * ici : on ne l'a pas encore pour les dix sociétés. Le dernier saisi est
 * gardé dans ce navigateur, par société, pour ne pas le retaper chaque
 * mois — il n'est enregistré nulle part ailleurs.
 */
const cleRib = (companyId: string) => `rib-ordinateur:${companyId}`
export default function ChoixOrdreVirement({
  virements,
  companyId,
  siteInitial,
  onImprimer,
  onClose,
}: {
  /** Les lignes payées par virement, ce mois-ci. */
  virements: LignePaie[]
  companyId: string
  /** Le site déjà choisi dans le parcours de la paie, s'il y en a un. */
  siteInitial?: string
  onImprimer: (ordres: OrdreDeSite[], ribOrdinateur: string) => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)

  const [rib, setRib] = useState(() => {
    try { return localStorage.getItem(cleRib(companyId)) ?? '' } catch { return '' }
  })
  const ribPropre = rib.replace(/\s/g, '')
  const ribValide = /^[0-9]{24}$/.test(ribPropre)

  const parSite = new Map<string, LignePaie[]>()
  for (const l of virements) {
    const k = l.site_nom?.trim() || '(sans site)'
    parSite.set(k, [...(parSite.get(k) ?? []), l])
  }
  const sites = [...parSite.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([site, lignes]) => ({
      site,
      lignes: [...lignes].sort((a, b) => a.nom_prenom.localeCompare(b.nom_prenom, 'fr')),
      total: lignes.reduce((s, l) => s + Number(l.net_a_payer), 0),
      sansRib: lignes.filter((l) => !l.rib).length,
    }))

  const [choisi, setChoisi] = useState<string>(
    siteInitial && sites.some((s) => s.site === siteInitial)
      ? siteInitial
      : sites.length === 1 ? sites[0].site : '',
  )

  const lancer = () => {
    try { localStorage.setItem(cleRib(companyId), ribPropre) } catch { /* navigateur sans stockage */ }
    if (choisi === '*') onImprimer(sites.map(({ site, lignes }) => ({ site, lignes })), ribPropre)
    else {
      const s = sites.find((x) => x.site === choisi)
      if (s) onImprimer([{ site: s.site, lignes: s.lignes }], ribPropre)
    }
  }

  const selection = choisi === '*' ? sites : sites.filter((s) => s.site === choisi)
  const sansRib = selection.reduce((n, s) => n + s.sansRib, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Ordre de virement</h2>
        <p className="mt-1 text-sm text-slate-500">
          Le formulaire pour la banque, un par site. Montants : le net à payer du mois,
          primes et retenues comprises.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            R.I.B. de la société
            <span className="ml-1 font-normal text-slate-500">— « RIB ORDINATEUR », le compte à débiter</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={rib}
            onChange={(e) => setRib(e.target.value)}
            placeholder="24 chiffres"
            dir="ltr"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
          />
          {ribPropre && !ribValide && (
            <span className="mt-1 block text-xs text-amber-700">
              Un R.I.B. compte 24 chiffres — {ribPropre.length} pour l’instant.
            </span>
          )}
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Site</span>
          <select
            value={choisi}
            onChange={(e) => setChoisi(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Choisir un site —</option>
            {sites.map((s) => (
              <option key={s.site} value={s.site}>
                {s.site} — {s.lignes.length} virement{s.lignes.length > 1 ? 's' : ''} · {formatDH(s.total)}
              </option>
            ))}
            {sites.length > 1 && (
              <option value="*">Tous les sites — un ordre par site ({sites.length})</option>
            )}
          </select>
        </label>

        {sansRib > 0 && (
          <p className="mt-3 text-sm font-medium text-red-700">
            {sansRib} bénéficiaire{sansRib > 1 ? 's' : ''} sans R.I.B. : la banque ne pourra
            pas les payer. Ils sortiront marqués « R.I.B. MANQUANT ».
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
            disabled={!choisi || !ribValide}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Imprimer
          </button>
        </div>
      </div>
    </div>
  )
}
