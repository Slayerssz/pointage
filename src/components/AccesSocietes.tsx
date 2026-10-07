import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { ErrorNote, Spinner } from './ui'

/**
 * LES SOCIÉTÉS CONFIÉES À UN COMPTE DU PERSONNEL.
 *
 * Le personnel tient les dossiers partout, mais ne pointe que là où on
 * l'a nommément autorisé. L'administrateur coche ici les sociétés : ce
 * qui est coché, ce compte le voit et le pointe ; le reste lui reste
 * fermé, et il ne le voit même pas au moment de choisir une société.
 */
export default function AccesSocietes({ userId }: { userId: string }) {
  const qc = useQueryClient()

  const { data: societes, isLoading } = useQuery({
    queryKey: ['societes-toutes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })

  const { data: accordees } = useQuery({
    queryKey: ['acces-societes', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acces_societes')
        .select('company_id')
        .eq('user_id', userId)
      if (error) throw error
      return (data ?? []).map((r) => r.company_id as string)
    },
  })

  const [choisies, setChoisies] = useState<string[] | null>(null)
  useEffect(() => {
    if (accordees) setChoisies(accordees)
  }, [accordees])

  const enregistrer = useMutation({
    mutationFn: async (liste: string[]) => {
      const { error } = await supabase.rpc('admin_definir_acces_societes', {
        p_user: userId,
        p_companies: liste,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acces-societes', userId] }),
  })

  if (isLoading || choisies === null) return <Spinner label="Lecture des sociétés…" />

  const basculer = (id: string) =>
    setChoisies((l) => (l!.includes(id) ? l!.filter((x) => x !== id) : [...l!, id]))

  const inchange =
    accordees != null &&
    choisies.length === accordees.length &&
    choisies.every((id) => accordees.includes(id))

  return (
    <div className="border-t border-slate-100 pt-4">
      <h4 className="text-sm font-semibold text-slate-800">Pointage : sociétés confiées</h4>
      <p className="mt-1 text-xs text-slate-500">
        Ce compte verra le pointage des sociétés cochées, et pourra y pointer comme
        le bureau. Décoché, il n’y a plus accès — et ne les voit plus du tout.
      </p>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {(societes ?? []).map((c) => (
          <label key={c.id} className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={choisies.includes(c.id)}
              onChange={() => basculer(c.id)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="min-w-0 truncate">{c.name}</span>
          </label>
        ))}
      </div>

      {enregistrer.error && <ErrorNote>{(enregistrer.error as Error).message}</ErrorNote>}

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => enregistrer.mutate(choisies)}
          disabled={inchange || enregistrer.isPending}
          className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {inchange ? (
          <span className="text-xs text-slate-500">
            {choisies.length === 0
              ? 'Aucune société confiée : ce compte ne pointe nulle part.'
              : `${choisies.length} société(s) confiée(s).`}
          </span>
        ) : (
          <button
            onClick={() => setChoisies(accordees ?? [])}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-800"
          >
            Annuler les changements
          </button>
        )}
      </div>
    </div>
  )
}
