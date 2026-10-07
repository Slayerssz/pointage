import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { EmptyState, ErrorNote, Spinner } from '../../components/ui'

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
interface Ligne {
  id: number
  fait_le: string
  auteur: string | null
  action: string
  objet: string
  company_id: string | null
  resume: string
  lien: string | null
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

export default function JournalPage() {
  const { companyId } = useParams()
  const [combien, setCombien] = useState(100)
  const [recherche, setRecherche] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['journal', combien],
    queryFn: async (): Promise<Ligne[]> => {
      const { data, error } = await supabase
        .from('journal')
        .select('id, fait_le, auteur, action, objet, company_id, resume, lien')
        .order('fait_le', { ascending: false })
        .limit(combien)
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
  const lignes = (data ?? []).filter(
    (l) => !q || l.resume.toLowerCase().includes(q) || (l.auteur ?? '').toLowerCase().includes(q),
  )

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Journal</h1>
        <p className="text-sm text-slate-500">
          Ce qui se passe dans le système, du plus récent au plus ancien.
        </p>
      </div>

      <input
        type="search"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Chercher un nom, un geste…"
        className="mb-3 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      {lignes.length === 0 ? (
        <EmptyState>
          {q ? 'Rien ne correspond à cette recherche.' : 'Le journal est encore vide.'}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {lignes.map((l) => (
            <li key={l.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-3">
              <span className="w-36 shrink-0 text-xs text-slate-400 tabular-nums">
                {quand(l.fait_le)}
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                  TEINTE[l.action] ?? 'bg-slate-100 text-slate-700'
                }`}
              >
                {l.action}
              </span>
              <span className="min-w-0 flex-1 text-sm text-slate-800">
                <strong className="font-semibold">{l.auteur ?? 'inconnu'}</strong> {l.resume}
              </span>
              {l.lien && (
                <Link
                  to={`/c/${l.company_id ?? companyId}/${l.lien}`}
                  className="shrink-0 text-xs font-medium text-blue-700 underline hover:text-blue-900"
                >
                  voir
                </Link>
              )}
            </li>
          ))}
        </ul>
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
