import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useBaremeIgr, type TrancheIgr } from '../lib/bulletin'
import { ErrorNote, Spinner } from './ui'

/**
 * LE BARÈME DE L'I.G.R.
 *
 * Volontairement vide au départ : aucun taux n'est inventé. Tant qu'il
 * n'est pas rempli, le bulletin affiche une retenue nulle et le signale
 * en toutes lettres. Une tranche = « de tel brut à tel brut, tel taux ».
 * La somme à déduire est facultative (barème progressif) ; laissez-la à
 * zéro pour un simple pourcentage.
 */
export default function BaremeIgr() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useBaremeIgr()
  const [tranches, setTranches] = useState<TrancheIgr[]>([])
  const [touche, setTouche] = useState(false)

  useEffect(() => {
    if (data && !touche) setTranches(data)
  }, [data, touche])

  const enregistrer = useMutation({
    mutationFn: async () => {
      const propre = tranches
        .filter((t) => t.taux !== null && !Number.isNaN(Number(t.taux)))
        .map((t) => ({
          salaire_min: Number(t.salaire_min) || 0,
          salaire_max: t.salaire_max == null || String(t.salaire_max) === '' ? null : Number(t.salaire_max),
          taux: Number(t.taux) || 0,
          somme_a_deduire: Number(t.somme_a_deduire) || 0,
        }))
        .sort((a, b) => a.salaire_min - b.salaire_min)
      const { error } = await supabase.rpc('maj_bareme_igr', { p_tranches: propre })
      if (error) throw error
    },
    onSuccess: () => {
      setTouche(false)
      qc.invalidateQueries({ queryKey: ['bareme-igr'] })
      qc.invalidateQueries({ queryKey: ['bulletins'] })
    },
  })

  const maj = (i: number, champ: keyof TrancheIgr, v: string) => {
    setTouche(true)
    setTranches((t) =>
      t.map((x, j) => (j === i ? { ...x, [champ]: v === '' ? null : Number(v) } : x)),
    )
  }

  // Une tranche qui commence là où la précédente s'arrête : le cas courant.
  const ajouter = () => {
    setTouche(true)
    const dernier = tranches[tranches.length - 1]
    const debut = dernier?.salaire_max != null ? Number(dernier.salaire_max) + 0.01 : 6000
    setTranches((t) => [...t, { salaire_min: debut, salaire_max: null, taux: 0, somme_a_deduire: 0 }])
  }

  // Un trou ou un chevauchement entre deux tranches donne des retenues fausses.
  const anomalies: string[] = []
  const tri = [...tranches].sort((a, b) => Number(a.salaire_min) - Number(b.salaire_min))
  for (let i = 1; i < tri.length; i++) {
    const prec = tri[i - 1]
    if (prec.salaire_max == null) {
      anomalies.push(`La tranche à partir de ${prec.salaire_min} DH est ouverte : les suivantes ne serviront jamais.`)
      break
    }
    if (Number(tri[i].salaire_min) <= Number(prec.salaire_max)) {
      anomalies.push(`Chevauchement entre ${prec.salaire_min}–${prec.salaire_max} et ${tri[i].salaire_min}–${tri[i].salaire_max ?? '∞'}.`)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
        Barème de l’I.G.R.
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Utilisé par le bulletin de paie. Tant qu’aucune tranche n’est saisie, l’I.G.R.
        reste à zéro et le bulletin l’indique. Les taux ne sont pas préremplis : saisissez
        ceux de votre comptable.
      </p>

      {isLoading && <Spinner label="Lecture du barème…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}

      {!isLoading && (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 text-left font-medium">À partir de (DH)</th>
                  <th className="px-2 py-2 text-left font-medium">Jusqu’à (DH)</th>
                  <th className="px-2 py-2 text-left font-medium">Taux (%)</th>
                  <th className="px-2 py-2 text-left font-medium">Somme à déduire</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {tranches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-sm text-slate-400">
                      Aucune tranche. L’I.G.R. n’est pas retenu.
                    </td>
                  </tr>
                )}
                {tranches.map((t, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <Cellule valeur={t.salaire_min} onChange={(v) => maj(i, 'salaire_min', v)} />
                    <Cellule
                      valeur={t.salaire_max}
                      placeholder="et au-delà"
                      onChange={(v) => maj(i, 'salaire_max', v)}
                    />
                    <Cellule valeur={t.taux} pas="0.01" onChange={(v) => maj(i, 'taux', v)} />
                    <Cellule
                      valeur={t.somme_a_deduire}
                      pas="0.01"
                      onChange={(v) => maj(i, 'somme_a_deduire', v)}
                    />
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={() => { setTouche(true); setTranches((x) => x.filter((_, j) => j !== i)) }}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {anomalies.map((a) => (
            <p key={a} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {a}
            </p>
          ))}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={ajouter}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              + Ajouter une tranche
            </button>
            <button
              onClick={() => enregistrer.mutate()}
              disabled={!touche || enregistrer.isPending}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer le barème'}
            </button>
            {touche && !enregistrer.isPending && (
              <span className="text-xs text-amber-700">Modifications non enregistrées</span>
            )}
            {enregistrer.isSuccess && !touche && (
              <span className="text-xs text-emerald-700">Barème enregistré</span>
            )}
          </div>

          {enregistrer.isError && (
            <ErrorNote>Erreur : {(enregistrer.error as Error).message}</ErrorNote>
          )}

          <p className="mt-3 text-xs text-slate-400">
            Retenue = (brut − C.N.S.S. − A.M.O.) × taux − somme à déduire, jamais négative.
            Laissez la somme à déduire à 0 pour un pourcentage simple.
          </p>
        </>
      )}
    </section>
  )
}

function Cellule({
  valeur, onChange, placeholder, pas,
}: {
  valeur: number | null
  onChange: (v: string) => void
  placeholder?: string
  pas?: string
}) {
  return (
    <td className="px-2 py-1.5">
      <input
        type="number"
        step={pas ?? '1'}
        min="0"
        value={valeur ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-32 rounded border border-slate-300 px-2 py-1 text-sm tabular-nums"
      />
    </td>
  )
}
