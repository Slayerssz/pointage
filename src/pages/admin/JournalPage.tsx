import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { EmptyState, ErrorNote, Spinner } from '../../components/ui'
import { useFermerSurEchap } from '../../lib/impression'
import { nomDeLObjet, nomDuChamp, valeurLisible } from '../../lib/champsJournal'

/**
 * LE JOURNAL DES GESTES.
 *
 * Qui a fait quoi, et quand. Une phrase par geste, du plus récent au
 * plus ancien, avec de quoi retrouver la page où cela s'est passé.
 *
 * Délibérément court : le propriétaire veut lire ce qui s'est passé,
 * pas déchiffrer un vidage de colonnes. Ce que la base inscrit est déjà
 * une phrase ; cet écran ne fait que la dater et la nommer.
 */
interface Changement {
  champ: string
  avant: unknown
  apres: unknown
}

interface Ligne {
  id: number
  fait_le: string
  auteur: string | null
  action: string
  objet: string
  company_id: string | null
  resume: string
  lien: string | null
  details: Changement[] | null
}

const TEINTE: Record<string, string> = {
  ajout: 'bg-emerald-100 text-emerald-800',
  modification: 'bg-slate-100 text-slate-700',
  suppression: 'bg-red-100 text-red-800',
  sortie: 'bg-amber-100 text-amber-800',
  retour: 'bg-blue-100 text-blue-800',
  paie: 'bg-violet-100 text-violet-800',
}

/** « Aujourd'hui 14:32 », « hier 09:05 », ou la date entière. */
function quand(iso: string): string {
  const d = new Date(iso)
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const jour = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const matin = new Date()
  const ce = new Date(matin.getFullYear(), matin.getMonth(), matin.getDate())
  const ecart = Math.round((ce.getTime() - jour.getTime()) / 86400000)
  if (ecart === 0) return `Aujourd’hui ${heure}`
  if (ecart === 1) return `Hier ${heure}`
  return `${d.toLocaleDateString('fr-FR')} ${heure}`
}

/** Les périodes qu'on cherche vraiment : « ce qui s'est passé depuis… ». */
const PERIODES = [
  { cle: 'jour', label: 'Aujourd’hui', jours: 1 },
  { cle: 'semaine', label: '7 jours', jours: 7 },
  { cle: 'mois', label: '30 jours', jours: 30 },
  { cle: 'tout', label: 'Tout', jours: 0 },
] as const

export default function JournalPage() {
  const { companyId } = useParams()
  const [combien, setCombien] = useState(100)
  const [recherche, setRecherche] = useState('')
  const [periode, setPeriode] = useState<string>('semaine')
  const [action, setAction] = useState('')
  const [auteur, setAuteur] = useState('')
  const [ouverte, setOuverte] = useState<Ligne | null>(null)

  // La période se filtre en base : inutile de rapporter trois mois pour
  // n'en montrer qu'un jour. Le reste se trie sur ce qu'on a sous la main.
  const depuis = (() => {
    const p = PERIODES.find((x) => x.cle === periode)
    if (!p || p.jours === 0) return null
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (p.jours - 1))
    return d.toISOString()
  })()

  const { data, isLoading, error } = useQuery({
    queryKey: ['journal', combien, depuis],
    queryFn: async (): Promise<Ligne[]> => {
      let q = supabase
        .from('journal')
        .select('id, fait_le, auteur, action, objet, company_id, resume, lien, details')
        .order('fait_le', { ascending: false })
        .limit(combien)
      if (depuis) q = q.gte('fait_le', depuis)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Ligne[]
    },
  })

  if (isLoading) return <Spinner label="Lecture du journal…" />
  if (error) {
    return (
      <ErrorNote>
        {error.message}
        {error.message.includes('journal') && (
          <> Le BLOC 41 n’a peut-être pas encore été exécuté dans Supabase.</>
        )}
      </ErrorNote>
    )
  }

  const q = recherche.trim().toLowerCase()
  const lignes = (data ?? []).filter((l) => {
    if (action && l.action !== action) return false
    if (auteur && (l.auteur ?? '') !== auteur) return false
    if (!q) return true
    return l.resume.toLowerCase().includes(q) || (l.auteur ?? '').toLowerCase().includes(q)
  })

  // Ce qu'on propose vient de ce qui s'est réellement passé : pas de
  // filtre qui ne rendrait rien.
  const actions = [...new Set((data ?? []).map((l) => l.action))].sort()
  const auteurs = [...new Set((data ?? []).map((l) => l.auteur).filter(Boolean))].sort() as string[]
  const filtre = Boolean(action || auteur || q)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Journal</h1>
        <p className="text-sm text-slate-500">
          Ce qui se passe dans le système, du plus récent au plus ancien.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
          {PERIODES.map((p) => (
            <button
              key={p.cle}
              onClick={() => setPeriode(p.cle)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                periode === p.cle ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {actions.length > 1 && (
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tous les gestes</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}

        {auteurs.length > 1 && (
          <select
            value={auteur}
            onChange={(e) => setAuteur(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tout le monde</option>
            {auteurs.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}

        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un nom, un geste…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-56"
        />

        {filtre && (
          <button
            onClick={() => { setAction(''); setAuteur(''); setRecherche('') }}
            className="text-sm font-medium text-slate-500 underline hover:text-slate-800"
          >
            Tout afficher
          </button>
        )}

        <span className="ml-auto text-sm text-slate-500">
          {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
        </span>
      </div>

      {lignes.length === 0 ? (
        <EmptyState>
          {filtre
            ? 'Rien ne correspond à ces filtres.'
            : periode === 'tout'
              ? 'Le journal est encore vide : il se remplit à mesure qu’on travaille.'
              : 'Rien sur cette période. Essayez « Tout ».'}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {/* Sur téléphone la ligne se plie en deux : l'heure et le geste
              au-dessus, la phrase en dessous — plutôt qu'une phrase
              coincée dans un tiers de la largeur. */}
          {lignes.map((l) => (
            <li key={l.id} className="px-4 py-3 sm:flex sm:items-baseline sm:gap-x-2">
              <div className="flex items-baseline gap-2 sm:contents">
                <span className="text-xs text-slate-400 tabular-nums sm:w-36 sm:shrink-0">
                  {quand(l.fait_le)}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    TEINTE[l.action] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {l.action}
                </span>
                <button
                  onClick={() => setOuverte(l)}
                  className="ml-auto shrink-0 text-xs font-medium text-blue-700 underline hover:text-blue-900 sm:order-last sm:ml-0"
                >
                  voir
                </button>
              </div>
              <span className="mt-1 block min-w-0 flex-1 text-sm text-slate-800 sm:mt-0">
                <strong className="font-semibold">{l.auteur ?? 'inconnu'}</strong> {l.resume}
              </span>
            </li>
          ))}
        </ul>
      )}

      {ouverte && (
        <DetailDuGeste
          ligne={ouverte}
          companyId={companyId}
          onClose={() => setOuverte(null)}
        />
      )}

      {lignes.length > 0 && (data ?? []).length >= combien && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setCombien((n) => n + 200)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Afficher plus
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * CE QUI A CHANGÉ, EXACTEMENT.
 *
 * On ouvre le geste, on lit la liste des colonnes qui ont bougé et
 * leurs deux valeurs. Ouvrir la page reste possible, mais ce n'est plus
 * la seule réponse : le plus souvent, la question est « quoi ? », pas
 * « où ? ».
 */
function DetailDuGeste({
  ligne, companyId, onClose,
}: { ligne: Ligne; companyId: string | undefined; onClose: () => void }) {
  useFermerSurEchap(onClose)
  const details = ligne.details ?? []

  return (
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {nomDeLObjet(ligne.objet)}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          <strong className="text-slate-700">{ligne.auteur ?? 'inconnu'}</strong>{' '}
          {ligne.resume} · {quand(ligne.fait_le)}
        </p>

        {details.length === 0 ? (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
            Ce geste n’a pas de détail à montrer. Les lignes écrites avant la mise
            à jour du journal n’en ont pas non plus : le relevé n’existait pas
            encore.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 text-left font-medium">Champ</th>
                <th className="py-2 text-left font-medium">Avant</th>
                <th className="py-2 text-left font-medium">Après</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {details.map((d) => (
                <tr key={d.champ}>
                  <td className="py-2 pr-3 font-medium text-slate-700">
                    {nomDuChamp(d.champ)}
                  </td>
                  <td className="py-2 pr-3 text-slate-500 line-through decoration-slate-300">
                    {valeurLisible(d.avant)}
                  </td>
                  <td className="py-2 font-semibold text-slate-900">
                    {valeurLisible(d.apres)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {ligne.lien && (
            <Link
              to={`/c/${ligne.company_id ?? companyId}/${ligne.lien}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ouvrir la page
            </Link>
          )}
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
