import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ErrorNote } from './ui'

/**
 * Écran verrouillé : il faut ressaisir son mot de passe pour entrer.
 *
 * Pensé pour le cas où le poste reste allumé et la session ouverte :
 * quelqu'un qui passe derrière ne doit pas pouvoir ouvrir l'écran.
 * Le verrou se remet dès qu'on quitte la page.
 */
export default function VerrouMotDePasse({
  titre,
  explication,
  children,
}: {
  titre: string
  explication: string
  children: ReactNode
}) {
  const { profile } = useAuth()
  const [ouvert, setOuvert] = useState(false)
  const [motDePasse, setMotDePasse] = useState('')
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => { champ.current?.focus() }, [])

  const verifier = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('verifier_mon_mot_de_passe', {
        p_password: motDePasse,
      })
      if (error) throw error
      if (data !== true) throw new Error('Mot de passe incorrect.')
    },
    onSuccess: () => {
      setMotDePasse('')
      setOuvert(true)
    },
  })

  if (ouvert) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2">
          <p className="text-sm text-emerald-800">
            {titre} déverrouillé — le verrou se remet dès que vous quittez la page.
          </p>
          <button
            onClick={() => setOuvert(false)}
            className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Verrouiller
          </button>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3" />
          </svg>
        </div>

        <h1 className="mb-1 text-lg font-semibold text-slate-900">{titre}</h1>
        <p className="mb-5 text-sm text-slate-500">{explication}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (motDePasse) verifier.mutate()
          }}
        >
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Mot de passe de {profile?.username}
          </label>
          <input
            ref={champ}
            type="password"
            value={motDePasse}
            autoComplete="current-password"
            onChange={(e) => setMotDePasse(e.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />

          {verifier.error && (
            <div className="mb-4">
              <ErrorNote>{verifier.error.message}</ErrorNote>
            </div>
          )}

          <button
            type="submit"
            disabled={verifier.isPending || !motDePasse}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {verifier.isPending ? 'Vérification…' : 'Déverrouiller'}
          </button>
        </form>
      </div>
    </div>
  )
}
