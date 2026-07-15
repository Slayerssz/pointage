import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Company } from '../lib/types'
import { EmptyState, Spinner } from '../components/ui'

export default function CompanySelectPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async (): Promise<Company[]> => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name')
      if (error) throw error
      return data
    },
  })

  if (companies && companies.length === 1) {
    return <Navigate to={`/c/${companies[0].id}`} replace />
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Choisir une entreprise</h1>
          <p className="mt-1 text-sm text-slate-500">
            Connecté en tant que <span className="font-medium">{profile?.username}</span>
          </p>
        </div>
        <button
          onClick={signOut}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Déconnexion
        </button>
      </div>

      {isLoading && <Spinner label="Chargement des entreprises…" />}
      {companies && companies.length === 0 && (
        <EmptyState>
          Aucune entreprise ne vous est attribuée. Contactez l'administrateur.
        </EmptyState>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {companies?.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/c/${c.id}`)}
            className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-400 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M3 21h18M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14M9 9h2m2 0h2M9 13h2m2 0h2M9 17h2m2 0h2" />
              </svg>
            </div>
            <p className="font-semibold text-slate-900 group-hover:text-emerald-700">{c.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">Accéder au tableau de bord →</p>
          </button>
        ))}
      </div>
    </div>
  )
}
