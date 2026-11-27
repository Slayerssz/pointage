import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useRemplacants } from '../lib/queries'
import { formatDateFr } from '../lib/dates'
import type { DayPointage, SiteEmployee } from '../lib/queries'
import type { Site } from '../lib/types'
import { ErrorNote } from './ui'

/**
 * LE MENU D'UNE CASE.
 *
 * Pointer, c'est répéter le même geste trois cents fois par mois. Une
 * fenêtre qui s'ouvre, se lit et se referme à chaque case était un
 * écran de trop : on choisit ici d'un seul clic, sur place.
 *
 * REMPLACEMENT ne s'offre que sur un repos, un congé ou une maladie :
 * on ne remplace pas quelqu'un qui est venu. Il ouvre alors la liste
 * des remplaçants — la même pour toutes les sociétés — et la journée
 * part dans le tableau de paie du joker, au tarif figé à cet instant.
 *
 * SORTIE est à part, en bas et en rouge : il ne marque pas une journée,
 * il met fin à un contrat. La case cliquée devient le premier jour
 * d'absence, les journées d'après sont retirées, et le départ s'ouvre
 * dans la section Sorties.
 */

/**
 * Ce qu'une case peut devenir d'un seul clic, dans l'ordre où le bureau
 * s'en sert. « Deux gardes » et « Repos travaillé » sont les deux
 * journées qui comptent double à la paie — elles avaient disparu du
 * menu, leur calcul n'a jamais bougé.
 *
 * La demi-garde et la garde et demie restent hors du choix : les
 * pointages qui les portent gardent leur valeur, on n'en crée plus.
 */
const CHOIX = [
  { code: 'X', libelle: 'Présent', couleur: 'text-emerald-700', fond: 'hover:bg-emerald-50' },
  { code: 'XX', libelle: 'Deux gardes', couleur: 'text-emerald-800', fond: 'hover:bg-emerald-50' },
  { code: 'RT', libelle: 'Repos travaillé', couleur: 'text-teal-700', fond: 'hover:bg-teal-50' },
  { code: 'R', libelle: 'Repos', couleur: 'text-blue-700', fond: 'hover:bg-blue-50' },
  { code: 'M', libelle: 'Malade', couleur: 'text-violet-700', fond: 'hover:bg-violet-50' },
  { code: 'C', libelle: 'Congé', couleur: 'text-sky-700', fond: 'hover:bg-sky-50' },
  { code: 'AJ', libelle: 'Absent', couleur: 'text-rose-700', fond: 'hover:bg-rose-50' },
] as const

/** Un remplacement ne se pose que sur une absence — pas sur un présent. */
const REMPLACABLES = ['R', 'C', 'M']

export default function MenuCase({
  employee,
  site,
  date,
  pointage,
  remplacant,
  onFerme,
}: {
  employee: SiteEmployee
  site: Site
  date: string
  pointage: DayPointage | null
  /** Le remplaçant déjà posé sur cette case, s'il y en a un. */
  remplacant: { nom: string; montant: number } | null
  onFerme: () => void
}) {
  const qc = useQueryClient()
  const [vue, setVue] = useState<'menu' | 'remplacement' | 'sortie'>('menu')
  const [recherche, setRecherche] = useState('')
  const remplacants = useRemplacants(vue === 'remplacement')

  const rafraichir = () => {
    for (const cle of ['pointages-des-annexes', 'site-week-pointages', 'site-pointages',
                       'remplacements-du-mois', 'employees', 'employes-des-annexes',
                       'employees-sortis', 'lignes-paie']) {
      qc.invalidateQueries({ queryKey: [cle] })
    }
  }

  // Un seul appel, qu'il y ait déjà quelque chose sur la case ou non :
  // la fonction pose la lettre demandée et remplace ce qui s'y trouvait.
  // Deviner ici menait au refus « il a déjà un pointage ce jour-là »
  // quand l'écran ne voyait pas la journée — celle, par exemple, qu'un
  // agent venait d'envoyer en photo le matin même.
  const poser = useMutation({
    mutationFn: async (type: string) => {
      const { error } = await supabase.rpc('marquer_present', {
        p_employee_id: employee.id, p_date: date, p_type: type,
      })
      if (error) throw error
    },
    onSuccess: () => { rafraichir(); onFerme() },
  })

  const effacer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('supprimer_pointage', { p_pointage_id: pointage!.id })
      if (error) throw error
    },
    onSuccess: () => { rafraichir(); onFerme() },
  })

  const remplacer = useMutation({
    mutationFn: async (remplacantId: string) => {
      const { error } = await supabase.rpc('poser_remplacement', {
        p_remplacant: remplacantId, p_employee: employee.id, p_date: date,
      })
      if (error) throw error
    },
    onSuccess: () => { rafraichir(); onFerme() },
  })

  const retirerRemplacement = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('retirer_remplacement', {
        p_employee: employee.id, p_date: date,
      })
      if (error) throw error
    },
    onSuccess: () => { rafraichir(); onFerme() },
  })

  const sortir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('sortir_employe_depuis', {
        p_employee: employee.id, p_date: date,
      })
      if (error) throw error
    },
    onSuccess: () => { rafraichir(); onFerme() },
  })

  const erreur = poser.error ?? effacer.error ?? remplacer.error
    ?? retirerRemplacement.error ?? sortir.error
  // Ce que la case porte déjà : une journée en attente de validation
  // porte elle aussi une lettre, et la pastille doit la montrer —
  // sinon le bureau repose la même lettre en croyant la case vide.
  const actuel = pointage && pointage.status !== 'refused' ? pointage.type_garde : null
  const estConge = Boolean(pointage?.conge_id)
  const remplacable = REMPLACABLES.includes(String(actuel))

  const q = recherche.trim().toLowerCase()
  const liste = (remplacants.data ?? []).filter(
    (r) => r.actif && (!q || r.nom_prenom.toLowerCase().includes(q)
      || String(r.matricule ?? '').includes(q)),
  )

  return (
    <div className="modale fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
         onClick={onFerme}>
      <div
        className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-4 py-2.5">
          <p className="truncate text-sm font-semibold text-slate-900">{employee.nom_prenom}</p>
          <p className="text-xs text-slate-500">{site.name} · {formatDateFr(date)}</p>
        </div>

        {estConge && (
          <p className="border-b border-sky-100 bg-sky-50 px-4 py-2 text-xs text-sky-800">
            Ce jour fait partie d’un congé enregistré : il se modifie depuis la fiche.
          </p>
        )}

        {erreur && (
          <div className="px-3 pt-2">
            <ErrorNote>{(erreur as Error).message}</ErrorNote>
          </div>
        )}

        {/* ── Le menu ────────────────────────────────────────────── */}
        {vue === 'menu' && (
          <>
            <ul className="py-1">
              {CHOIX.map((c) => (
                <li key={c.code}>
                  <button
                    disabled={estConge || poser.isPending}
                    onClick={() => poser.mutate(c.code)}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium disabled:opacity-40 ${c.couleur} ${c.fond}`}
                  >
                    {c.libelle}
                    {actuel === c.code && <span className="text-xs">●</span>}
                  </button>
                </li>
              ))}

              <li className="my-1 border-t border-slate-100" />

              {/* Remplacement : seulement sur une absence, et dit
                  pourquoi quand il ne s'offre pas. */}
              <li>
                {remplacant ? (
                  <button
                    onClick={() => retirerRemplacement.mutate()}
                    disabled={retirerRemplacement.isPending}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                  >
                    <span className="min-w-0 truncate">
                      Remplacé par {remplacant.nom}
                    </span>
                    <span className="shrink-0 text-xs">retirer</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setVue('remplacement')}
                    disabled={!remplacable}
                    title={remplacable
                      ? 'Choisir un remplaçant'
                      : 'Un remplacement ne se pose que sur un repos, un congé ou une maladie.'}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                  >
                    Remplacement…
                  </button>
                )}
              </li>

              {pointage?.status === 'validated' && !estConge && !pointage.photo_path && (
                <li>
                  <button
                    onClick={() => effacer.mutate()}
                    disabled={effacer.isPending}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Effacer la journée
                  </button>
                </li>
              )}

              <li className="my-1 border-t border-slate-100" />
              <li>
                <button
                  onClick={() => setVue('sortie')}
                  className="w-full px-4 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Sortie…
                </button>
              </li>
            </ul>
          </>
        )}

        {/* ── Choisir un remplaçant ──────────────────────────────── */}
        {vue === 'remplacement' && (
          <div className="p-3">
            <input
              autoFocus
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Chercher un remplaçant…"
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <ul className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
              {remplacants.isLoading && (
                <li className="px-3 py-2 text-sm text-slate-500">Chargement…</li>
              )}
              {!remplacants.isLoading && liste.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-500">
                  {q ? 'Personne de ce nom.' : 'Aucun remplaçant enregistré.'}
                </li>
              )}
              {liste.map((r) => (
                <li key={r.id} className="border-b border-slate-100 last:border-0">
                  <button
                    onClick={() => remplacer.mutate(r.id)}
                    disabled={remplacer.isPending}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40"
                  >
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {r.nom_prenom}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {r.matricule != null ? `Mat. ${r.matricule}` : '—'}
                      {r.tarif_journalier != null
                        ? ` · ${r.tarif_journalier} DH / jour`
                        : ' · au tarif de la personne remplacée'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setVue('menu')}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Retour
            </button>
          </div>
        )}

        {/* ── Confirmer la sortie ────────────────────────────────── */}
        {vue === 'sortie' && (
          <div className="p-4">
            <p className="text-sm text-slate-700">
              <strong>{employee.nom_prenom}</strong> ne travaille plus à partir du{' '}
              <strong>{formatDateFr(date)}</strong>.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Son dernier jour sera la veille. Les journées déjà posées après seront
              retirées, et son départ s’ouvrira dans la section Sorties, à compléter.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setVue('menu')}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={() => sortir.mutate()}
                disabled={sortir.isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {sortir.isPending ? '…' : 'Le sortir'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
