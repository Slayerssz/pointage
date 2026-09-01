import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { MOIS_FR, formatDH, formatNombre } from '../lib/paie'
import { ErrorNote, Spinner } from './ui'

interface MoisPaie {
  mois: number
  statut: string
  employes: number
  brut: number
  primes: number
  retenues: number
  net: number
  virement: number
  especes: number
  heures: number
}

interface AnalyticsPaieData {
  annee: number
  par_mois: MoisPaie[]
  annee_totaux: {
    mois_validés: number
    brut: number
    net: number
    primes: number
    retenues: number
    virement: number
    especes: number
  }
  par_banque: { banque: string; employes: number; montant: number }[]
  par_site_principal: { site: string; employes: number; montant: number }[]
  dettes: { employes: number; total: number }
  masse_mensuelle_theorique: number
}

/**
 * Le volet « argent » du tableau de bord : ce que la paie a réellement
 * coûté, mois par mois, et comment ce montant se répartit.
 * Seules les périodes validées entrent dans les cumuls de l'année ;
 * le tableau mensuel montre aussi les mois encore en cours, signalés
 * comme tels, pour qu'un chiffre provisoire ne passe pas pour définitif.
 */
export default function AnalyticsPaie({ companyId }: { companyId: string | null }) {
  const anneeCourante = new Date().getFullYear()
  const [annee, setAnnee] = useState(anneeCourante)
  const [moisOuvert, setMoisOuvert] = useState<number | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-paie', companyId, annee],
    queryFn: async (): Promise<AnalyticsPaieData> => {
      const { data, error } = await supabase.rpc('analytics_paie', {
        p_company: companyId,
        p_annee: annee,
      })
      if (error) throw error
      return data as AnalyticsPaieData
    },
  })

  const annees = [anneeCourante, anneeCourante - 1, anneeCourante - 2, anneeCourante - 3]
  const t = data?.annee_totaux
  const maxNet = Math.max(1, ...(data?.par_mois.map((m) => m.net) ?? [0]))
  const detail = moisOuvert ? data?.par_mois.find((m) => m.mois === moisOuvert) : null

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
          Paie — montants versés
        </h2>
        <select
          value={annee}
          onChange={(e) => { setAnnee(Number(e.target.value)); setMoisOuvert(null) }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          {annees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {isLoading && <Spinner label="Lecture des paies…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}

      {data && t && (
        <div className="space-y-5">
          {/* Cumul de l'année, paies validées uniquement */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Montant
              label={`Net versé en ${annee}`}
              value={t.net}
              tone="green"
              note={`${t.mois_validés} mois validé${t.mois_validés > 1 ? 's' : ''}`}
            />
            <Montant label="Masse brute" value={t.brut} />
            <Montant label="Par virement" value={t.virement} tone="blue" />
            <Montant label="En espèces" value={t.especes} tone="amber" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Montant label="Primes accordées" value={t.primes} tone="blue" />
            <Montant label="Retenues (dettes + autres)" value={t.retenues} tone="red" />
            <Montant
              label="Dettes encore ouvertes"
              value={data.dettes.total}
              tone="red"
              note={`${data.dettes.employes} employé${data.dettes.employes > 1 ? 's' : ''}`}
            />
          </div>

          {/* Mois par mois */}
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Mois par mois
            </h3>
            {data.par_mois.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Aucune paie enregistrée en {annee}.
              </p>
            ) : (
              <div className="space-y-1">
                {data.par_mois.map((m) => {
                  const valide = m.statut === 'paie_validee'
                  const ouvert = moisOuvert === m.mois
                  return (
                    <button
                      key={m.mois}
                      type="button"
                      onClick={() => setMoisOuvert(ouvert ? null : m.mois)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 ${
                        ouvert ? 'bg-slate-50 ring-1 ring-slate-200' : ''
                      }`}
                    >
                      <span className="w-24 shrink-0 text-sm text-slate-700">
                        {MOIS_FR[m.mois - 1]}
                      </span>
                      <span className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                        <span
                          className={`block h-full rounded ${valide ? 'bg-emerald-500' : 'bg-amber-400'}`}
                          style={{ width: `${Math.max(2, (m.net / maxNet) * 100)}%` }}
                        />
                      </span>
                      <span className="w-32 shrink-0 text-right text-sm font-medium tabular-nums text-slate-900">
                        {formatDH(m.net)}
                      </span>
                      <span className="w-24 shrink-0 text-right text-xs text-slate-500">
                        {valide ? `${m.employes} employés` : 'non validé'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Vert : paie validée. Orange : mois encore en cours, le montant peut bouger.
            </p>
          </div>

          {/* Détail du mois cliqué */}
          {detail && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                {MOIS_FR[detail.mois - 1]} {annee}
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
                <Ligne label="Employés payés" value={formatNombre(detail.employes, 0)} />
                <Ligne label="Heures effectuées" value={formatNombre(detail.heures, 1)} />
                <Ligne label="Salaire brut" value={formatDH(detail.brut)} />
                <Ligne label="Primes" value={formatDH(detail.primes)} />
                <Ligne label="Retenues" value={formatDH(detail.retenues)} />
                <Ligne label="Net à payer" value={formatDH(detail.net)} fort />
                <Ligne label="Dont virement" value={formatDH(detail.virement)} />
                <Ligne label="Dont espèces" value={formatDH(detail.especes)} />
              </div>
            </div>
          )}

          {/* Répartitions */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Repartition
              titre="Par site principal"
              items={data.par_site_principal.map((s) => ({
                label: s.site, montant: s.montant, note: `${s.employes} emp.`,
              }))}
            />
            <Repartition
              titre="Virements par banque"
              items={data.par_banque.map((b) => ({
                label: b.banque, montant: b.montant, note: `${b.employes} emp.`,
              }))}
            />
          </div>

          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
            Masse salariale théorique d’un mois complet (26 jours, tous les employés
            en poste, hors primes et retenues) :{' '}
            <strong className="text-slate-700">{formatDH(data.masse_mensuelle_theorique)}</strong>
          </p>
        </div>
      )}
    </section>
  )
}

function Montant({
  label, value, tone = 'slate', note,
}: { label: string; value: number; tone?: 'slate' | 'green' | 'blue' | 'amber' | 'red'; note?: string }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-900',
    green: 'bg-emerald-50 text-emerald-800',
    blue: 'bg-blue-50 text-blue-800',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-800',
  }
  return (
    <div className={`rounded-lg px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{formatDH(value)}</p>
      {note && <p className="text-xs opacity-60">{note}</p>}
    </div>
  )
}

function Ligne({ label, value, fort }: { label: string; value: string; fort?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${fort ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
        {value}
      </span>
    </div>
  )
}

function Repartition({
  titre, items,
}: { titre: string; items: { label: string; montant: number; note: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.montant))
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{titre}</h3>
      {items.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
          Aucune donnée
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 10).map((i) => (
            <div key={i.label}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate text-slate-700">{i.label}</span>
                <span className="shrink-0 tabular-nums text-slate-900">{formatDH(i.montant)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
                  <span
                    className="block h-full rounded bg-slate-400"
                    style={{ width: `${Math.max(2, (i.montant / max) * 100)}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-slate-400">{i.note}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
