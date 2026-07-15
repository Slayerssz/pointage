import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase, supabaseConfigured, usernameToEmail } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ErrorNote } from '../components/ui'

export default function LoginPage() {
  const { session } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    setSubmitting(false)
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? "Nom d'utilisateur ou mot de passe incorrect."
          : `Erreur de connexion : ${error.message}`,
      )
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <svg viewBox="0 0 64 64" className="h-9 w-9">
              <path
                d="M18 34 L28 44 L47 22"
                fill="none"
                stroke="#34d399"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">Pointage</h1>
          <p className="mt-1 text-sm text-slate-400">Système de pointage du personnel</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-xl shadow-black/20"
        >
          {!supabaseConfigured && (
            <ErrorNote>
              Supabase n'est pas configuré. Copiez <code>.env.example</code> vers{' '}
              <code>.env</code> et remplissez les valeurs.
            </ErrorNote>
          )}
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              Nom d'utilisateur
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="ex. agent1"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="••••••••"
            />
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button
            type="submit"
            disabled={submitting || !supabaseConfigured}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
