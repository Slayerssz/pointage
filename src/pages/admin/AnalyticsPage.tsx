import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatDateFr } from '../../lib/dates'
import { EmptyState, ErrorNote, Spinner } from '../../components/ui'

interface Dashboard {
  date: string
  entreprises: number
  employes_total: number
  employes_actifs: number
  employes_sortis: number
  retraite_atteinte: number
  retraite_proche: number
  presents_today: number
  en_attente_today: number
  refuses_today: number
  attendus_today: number
  absents_today: number
  repos_today: number
  par_entreprise: { nom: string; employes: number; actifs: number; retraite: number }[]
  par_qualification: { label: string; n: number }[]
  par_ville: { label: string; n: number }[]
  par_reglement: { label: string; n: number }[]
  age_tranches: Record<string, number>
  embauches_par_mois: { mois: string; n: number }[]
  pointages_semaine: { date: string; valides: number; en_attente: number; refuses: number }[]
}

export default function AnalyticsPage() {
  // Sélecteur d'entreprise : « toutes » ou une entreprise précise.
  const [scope, setScope] = useState<string>('all')

  const { data: allCompanies } = useQuery({
    queryKey: ['companies-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name')
      if (error) throw error
      return data
    },
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', scope],
    queryFn: async (): Promise<Dashboard> => {
      const { data, error } = await supabase.rpc('admin_dashboard', {
        p_company: scope === 'all' ? null : scope,
      })
      if (error) throw error
      return data as Dashboard
    },
  })

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Tableau de bord</h1>
          <p className="text-sm text-slate-500">
            {data ? `Données au ${formatDateFr(data.date)}` : 'Vue d’ensemble et statistiques'}
          </p>
        </div>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Toutes les entreprises</option>
          {allCompanies?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isLoading && <Spinner label="Calcul des statistiques…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}

      {data && (
        <div className="space-y-6">
          {/* Effectif */}
          <Section title="Effectif">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Entreprises" value={data.entreprises} />
              <Stat label="Employés (total)" value={data.employes_total} />
              <Stat label="En poste" value={data.employes_actifs} tone="green" />
              <Stat label="Sortis" value={data.employes_sortis} tone="slate" />
            </div>
          </Section>

          {/* Retraite */}
          <Section title="Retraite (65 ans)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Âge de retraite atteint" value={data.retraite_atteinte} tone="red" />
              <Stat label="Proche (≤ 30 jours)" value={data.retraite_proche} tone="amber" />
            </div>
          </Section>

          {/* Présences du jour */}
          <Section title={`Présences du jour (${formatDateFr(data.date)})`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Attendus" value={data.attendus_today} />
              <Stat label="Présents (validés)" value={data.presents_today} tone="green" />
              <Stat label="En attente" value={data.en_attente_today} tone="amber" />
              <Stat label="Refusés" value={data.refuses_today} tone="red" />
              <Stat label="Absents" value={data.absents_today} tone="red" />
              <Stat label="En repos" value={data.repos_today} tone="blue" />
            </div>
          </Section>

          {/* Pointages de la semaine */}
          <Section title="Pointages des 7 derniers jours">
            <WeekBars data={data.pointages_semaine} />
          </Section>

          {/* Répartitions */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Par entreprise">
              <BarList
                items={data.par_entreprise.map((e) => ({ label: e.nom, n: e.actifs }))}
                emptyLabel="Aucune donnée"
              />
            </Section>
            <Section title="Par qualification">
              <BarList items={data.par_qualification} emptyLabel="Aucune donnée" />
            </Section>
            <Section title="Répartition par âge (en poste)">
              <BarList
                items={Object.entries(data.age_tranches).map(([label, n]) => ({ label, n }))}
                keepOrder
              />
            </Section>
            <Section title="Par mode de règlement">
              <BarList items={data.par_reglement} emptyLabel="Aucune donnée" />
            </Section>
            <Section title="Villes (top 12)">
              <BarList items={data.par_ville} emptyLabel="Aucune donnée" />
            </Section>
            <Section title="Embauches (12 derniers mois)">
              <BarList
                items={data.embauches_par_mois.map((m) => ({ label: m.mois, n: m.n }))}
                keepOrder
              />
            </Section>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  )
}

const STAT_TONES = {
  slate: 'text-slate-900',
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  blue: 'text-blue-600',
} as const

function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: number
  tone?: keyof typeof STAT_TONES
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className={`text-2xl font-semibold tabular-nums ${STAT_TONES[tone]}`}>
        {value.toLocaleString('fr-FR')}
      </p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  )
}

/** Barres de magnitude (une seule teinte émeraude). */
function BarList({
  items,
  emptyLabel,
  keepOrder,
}: {
  items: { label: string; n: number }[]
  emptyLabel?: string
  keepOrder?: boolean
}) {
  if (!items || items.length === 0) return <EmptyState>{emptyLabel ?? 'Aucune donnée'}</EmptyState>
  const rows = keepOrder ? items : [...items].sort((a, b) => b.n - a.n)
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-xs text-slate-600" title={r.label}>
            {r.label}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full rounded bg-emerald-500"
              style={{ width: `${(r.n / max) * 100}%`, minWidth: r.n > 0 ? '0.5rem' : 0 }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">
            {r.n}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Barres empilées par jour : validés / en attente / refusés (couleurs de statut). */
function WeekBars({
  data,
}: {
  data: { date: string; valides: number; en_attente: number; refuses: number }[]
}) {
  const max = Math.max(1, ...data.map((d) => d.valides + d.en_attente + d.refuses))
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-end justify-between gap-2" style={{ height: 160 }}>
        {data.map((d) => {
          const total = d.valides + d.en_attente + d.refuses
          const h = (v: number) => `${(v / max) * 140}px`
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full max-w-10 flex-col justify-end" style={{ height: 140 }}>
                {d.refuses > 0 && <div style={{ height: h(d.refuses) }} className="rounded-t bg-red-400" title={`${d.refuses} refusé(s)`} />}
                {d.en_attente > 0 && <div style={{ height: h(d.en_attente) }} className="bg-amber-400" title={`${d.en_attente} en attente`} />}
                {d.valides > 0 && <div style={{ height: h(d.valides) }} className="rounded-b bg-emerald-500" title={`${d.valides} validé(s)`} />}
                {total === 0 && <div className="h-1 rounded bg-slate-100" />}
              </div>
              <span className="text-[10px] text-slate-400">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500" /> Validés</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-400" /> En attente</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-400" /> Refusés</span>
      </div>
    </div>
  )
}
