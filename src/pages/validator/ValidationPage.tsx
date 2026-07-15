import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  formatTimeFr,
  isoDayOfWeek,
  jourDeReposLabel,
  todayIso,
} from '../../lib/dates'
import {
  useSiteEmployees,
  useSitePointages,
  useSites,
  type DayPointage,
} from '../../lib/queries'
import type { Site } from '../../lib/types'
import SiteAccordion from '../../components/SiteAccordion'
import { Chip, EmptyState, ErrorNote, Spinner } from '../../components/ui'

export default function ValidationPage() {
  const { companyId } = useParams()
  const [date, setDate] = useState(todayIso())
  const { data: sites, isLoading, error } = useSites(companyId)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Validation du pointage</h1>
          <p className="text-sm text-slate-500">
            Vérifiez la photo de chaque pointage puis validez ou refusez.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Date
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          />
        </label>
      </div>

      {isLoading && <Spinner label="Chargement des sites…" />}
      {error && <ErrorNote>Impossible de charger les sites : {error.message}</ErrorNote>}
      {sites && sites.length === 0 && <EmptyState>Aucun site pour cette entreprise.</EmptyState>}

      {sites && (
        <SiteAccordion
          sites={sites}
          renderSite={(site, expanded) => (
            <SiteValidationList site={site} date={date} enabled={expanded} onZoom={setZoomUrl} />
          )}
        />
      )}

      {zoomUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomUrl(null)}
        >
          <img src={zoomUrl} alt="Photo de pointage" className="max-h-full max-w-full rounded-lg object-contain" />
          <button className="absolute right-4 top-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white">
            Fermer
          </button>
        </div>
      )}
    </div>
  )
}

function SiteValidationList({
  site,
  date,
  enabled,
  onZoom,
}: {
  site: Site
  date: string
  enabled: boolean
  onZoom: (url: string) => void
}) {
  const employees = useSiteEmployees(site.id, enabled)
  const pointages = useSitePointages(site.id, date, enabled)
  const queryClient = useQueryClient()
  const isToday = date === todayIso()
  const dow = isoDayOfWeek(new Date(date + 'T00:00:00'))

  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'validated' | 'refused' }) => {
      const { error } = await supabase.rpc('validate_pointage', {
        p_pointage_id: id,
        p_decision: decision,
      })
      if (error) throw error
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['site-pointages', site.id] })
    },
  })

  if (employees.isLoading || pointages.isLoading) {
    return <Spinner label="Chargement…" />
  }
  if (employees.error || pointages.error) {
    return (
      <div className="p-4">
        <ErrorNote>Erreur : {(employees.error ?? pointages.error)!.message}</ErrorNote>
      </div>
    )
  }

  const rows = employees.data?.pages.flat() ?? []
  if (rows.length === 0) return <EmptyState>Aucun employé affecté à ce site.</EmptyState>

  const stats = { pointes: 0, valides: 0, repos: 0, absents: 0 }
  const items = rows.map((emp) => {
    const pointage = pointages.data?.get(emp.id)
    const isRepos = emp.jour_de_repos === dow
    if (pointage) {
      stats.pointes++
      if (pointage.status === 'validated') stats.valides++
    } else if (isRepos) {
      stats.repos++
    } else {
      stats.absents++
    }
    return { emp, pointage, isRepos }
  })

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <span>{stats.pointes} pointé(s)</span>
        <span>· {stats.valides} validé(s)</span>
        <span>· {stats.repos} en repos</span>
        <span>· {stats.absents} absent(s)</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map(({ emp, pointage, isRepos }) => (
          <li key={emp.id} className="flex items-center gap-3 px-4 py-3">
            {pointage ? (
              <PointagePhoto pointage={pointage} onZoom={onZoom} />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path d="M15 8h.01M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm18 10-5-5L5 22" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{emp.nom_prenom}</p>
              <p className="truncate text-xs text-slate-500">
                {emp.matricule && <>Mat. {emp.matricule} · </>}
                {pointage ? `Pointé à ${formatTimeFr(pointage.pointed_at)}` : isToday ? '' : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!pointage && isRepos && (
                <Chip tone="slate" title={`Jour de repos : ${jourDeReposLabel(emp.jour_de_repos)}`}>
                  Jour de repos
                </Chip>
              )}
              {!pointage && !isRepos && <Chip tone="amber">Absent</Chip>}
              {pointage?.status === 'validated' && <Chip tone="green">Validé</Chip>}
              {pointage?.status === 'refused' && <Chip tone="red">Refusé</Chip>}
              {pointage?.status === 'pending' && (
                <>
                  <button
                    onClick={() => decide.mutate({ id: pointage.id, decision: 'validated' })}
                    disabled={decide.isPending}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Valider
                  </button>
                  <button
                    onClick={() => decide.mutate({ id: pointage.id, decision: 'refused' })}
                    disabled={decide.isPending}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {decide.error && (
        <div className="p-3">
          <ErrorNote>Action impossible : {decide.error.message}</ErrorNote>
        </div>
      )}
    </div>
  )
}

function PointagePhoto({ pointage, onZoom }: { pointage: DayPointage; onZoom: (url: string) => void }) {
  const { data: url } = useQuery({
    queryKey: ['photo-url', pointage.photo_path],
    staleTime: 55 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('pointages')
        .createSignedUrl(pointage.photo_path, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })

  if (!url) {
    return <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-slate-200" />
  }
  return (
    <button onClick={() => onZoom(url)} className="shrink-0" aria-label="Agrandir la photo">
      <img src={url} alt="Photo de pointage" className="h-14 w-14 rounded-xl object-cover ring-1 ring-slate-200" />
    </button>
  )
}
