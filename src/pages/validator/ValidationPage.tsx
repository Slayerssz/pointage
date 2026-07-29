import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  JOURS_COURTS,
  addDays,
  dateToIso,
  formatDateFr,
  formatTimeFr,
  isoDayOfWeek,
  jourDeReposLabel,
  mondayOf,
  todayIso,
  weekDates,
} from '../../lib/dates'
import {
  useSiteEmployees,
  useSiteWeekPointages,
  useSites,
  type DayPointage,
  type SiteEmployee,
} from '../../lib/queries'
import type { Site } from '../../lib/types'
import { TYPES_GARDE, gardeSymbole, type TypeGarde } from '../../lib/gardes'
import SiteAccordion from '../../components/SiteAccordion'
import { EmptyState, ErrorNote, Spinner } from '../../components/ui'

/** Cellule sélectionnée dans la grille (pour le détail / les actions). */
interface CellSelection {
  employee: SiteEmployee
  site: Site
  date: string
  pointage: DayPointage | null
}

export default function ValidationPage() {
  const { companyId } = useParams()
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const { data: sites, isLoading, error } = useSites(companyId, { pointageOnly: true })
  const [selection, setSelection] = useState<CellSelection | null>(null)

  const mondayIso = dateToIso(monday)
  const sundayIso = dateToIso(addDays(monday, 6))
  const isCurrentWeek = mondayIso === dateToIso(mondayOf(new Date()))

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Pointage de la semaine</h1>
          <p className="text-sm text-slate-500">
            Cliquez sur une case : voir la photo, valider, refuser ou marquer présent.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setMonday((m) => addDays(m, -7))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Semaine préc.
          </button>
          <span className="min-w-40 text-center font-medium text-slate-700">
            {formatDateFr(mondayIso)} — {formatDateFr(sundayIso)}
          </span>
          <button
            onClick={() => setMonday((m) => addDays(m, 7))}
            disabled={isCurrentWeek}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Semaine suiv. →
          </button>
        </div>
      </div>

      {/* Légende */}
      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <LegendItem cls="bg-emerald-500 text-white" sym="X">Une garde</LegendItem>
        <LegendItem cls="bg-emerald-500 text-white" sym="X̸">Une garde et demi</LegendItem>
        <LegendItem cls="bg-emerald-500 text-white" sym="XX">Deux gardes</LegendItem>
        <LegendItem cls="bg-emerald-500 text-white" sym="RT">Repos travaillé</LegendItem>
        <LegendItem cls="bg-amber-400 text-white" sym="!">Photo à valider</LegendItem>
        <LegendItem cls="bg-red-500 text-white" sym="✕">Refusé</LegendItem>
        <LegendItem cls="bg-blue-400 text-white" sym="R">Jour de repos</LegendItem>
        <LegendItem cls="bg-slate-200 text-slate-500" sym="–">Absent</LegendItem>
      </div>

      {isLoading && <Spinner label="Chargement des sites…" />}
      {error && <ErrorNote>Impossible de charger les sites : {error.message}</ErrorNote>}
      {sites && sites.length === 0 && <EmptyState>Aucun site pour cette entreprise.</EmptyState>}

      {sites && (
        <SiteAccordion
          sites={sites}
          renderSite={(site, expanded) => (
            <SiteWeekGrid
              site={site}
              mondayIso={mondayIso}
              sundayIso={sundayIso}
              enabled={expanded}
              onSelect={setSelection}
            />
          )}
        />
      )}

      {selection && (
        <CellModal selection={selection} onClose={() => setSelection(null)} />
      )}
    </div>
  )
}

function LegendItem({ cls, sym, children }: { cls: string; sym: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`flex h-4 w-5 items-center justify-center rounded text-[10px] font-bold ${cls}`}>
        {sym}
      </span>
      {children}
    </span>
  )
}

function SiteWeekGrid({
  site,
  mondayIso,
  sundayIso,
  enabled,
  onSelect,
}: {
  site: Site
  mondayIso: string
  sundayIso: string
  enabled: boolean
  onSelect: (sel: CellSelection) => void
}) {
  const employees = useSiteEmployees(site.id, enabled)
  const pointages = useSiteWeekPointages(site.id, mondayIso, sundayIso, enabled)
  const dates = weekDates(new Date(mondayIso + 'T00:00:00'))
  const today = todayIso()

  if (employees.isLoading || pointages.isLoading) return <Spinner label="Chargement…" />
  if (employees.error || pointages.error) {
    return (
      <div className="p-4">
        <ErrorNote>Erreur : {(employees.error ?? pointages.error)!.message}</ErrorNote>
      </div>
    )
  }

  const rows = employees.data?.pages.flat() ?? []
  if (rows.length === 0) return <EmptyState>Aucun employé affecté à ce site.</EmptyState>

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs text-slate-500">
            <th className="px-4 py-2 text-left font-medium">Employé</th>
            {dates.map((d, i) => (
              <th
                key={d}
                className={`px-1 py-2 text-center font-medium ${d === today ? 'text-emerald-600' : ''}`}
              >
                {JOURS_COURTS[i]}
                <br />
                {d.slice(8, 10)}/{d.slice(5, 7)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((emp) => {
            const empDays = pointages.data?.get(emp.id)
            return (
              <tr key={emp.id}>
                <td className="max-w-48 px-4 py-2">
                  <p className="truncate font-medium text-slate-900">{emp.nom_prenom}</p>
                  <p className="text-xs text-slate-400">
                    {emp.matricule != null ? `Mat. ${emp.matricule}` : ''}
                  </p>
                </td>
                {dates.map((d, i) => (
                  <td key={d} className="px-1 py-2 text-center">
                    <DayCell
                      pointage={empDays?.get(d) ?? null}
                      isRepos={emp.jour_de_repos === i + 1}
                      isFuture={d > today}
                      onClick={() =>
                        onSelect({ employee: emp, site, date: d, pointage: empDays?.get(d) ?? null })
                      }
                    />
                  </td>
                ))}
              </tr>
            )
          })}
          {employees.hasNextPage && (
            <tr>
              <td colSpan={8} className="p-3 text-center">
                <button
                  onClick={() => employees.fetchNextPage()}
                  disabled={employees.isFetchingNextPage}
                  className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-50"
                >
                  {employees.isFetchingNextPage ? 'Chargement…' : 'Afficher plus'}
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function DayCell({
  pointage,
  isRepos,
  isFuture,
  onClick,
}: {
  pointage: DayPointage | null
  isRepos: boolean
  isFuture: boolean
  onClick: () => void
}) {
  let cls = 'bg-slate-100 text-slate-400'
  let label = '–'
  let title = 'Absent — cliquer pour marquer présent'

  if (pointage?.status === 'validated') {
    cls = 'bg-emerald-500 text-white'
    label = gardeSymbole(pointage.type_garde)
    title = 'Présent (validé) — cliquer pour changer le type'
  } else if (pointage?.status === 'pending') {
    cls = 'bg-amber-400 text-white animate-pulse'
    label = '!'
    title = 'Photo en attente de validation'
  } else if (pointage?.status === 'refused') {
    cls = 'bg-red-500 text-white'
    label = '✕'
    title = 'Refusé'
  } else if (isRepos) {
    cls = 'bg-blue-400 text-white'
    label = 'R'
    title = 'Jour de repos'
  } else if (isFuture) {
    return <span className="inline-block h-7 w-7 rounded-lg bg-slate-50" />
  }

  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition hover:scale-110 ${cls}`}
    >
      {label}
    </button>
  )
}

function CellModal({ selection, onClose }: { selection: CellSelection; onClose: () => void }) {
  const { employee, site, date, pointage } = selection
  const queryClient = useQueryClient()
  const [zoom, setZoom] = useState(false)
  // Jour de repos de cet employé ? → défaut « Repos travaillé »
  const isReposDay = employee.jour_de_repos === isoDayOfWeek(new Date(date + 'T00:00:00'))
  const [type, setType] = useState<TypeGarde>(
    (pointage?.type_garde as TypeGarde) ?? (isReposDay ? 'RT' : 'X'),
  )

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['site-week-pointages', site.id] })
    queryClient.invalidateQueries({ queryKey: ['site-pointages', site.id] })
  }

  const decide = useMutation({
    mutationFn: async (decision: 'validated' | 'refused') => {
      const { error } = await supabase.rpc('validate_pointage', {
        p_pointage_id: pointage!.id,
        p_decision: decision,
        p_type: type,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const changerType = useMutation({
    mutationFn: async (newType: TypeGarde) => {
      const { error } = await supabase.rpc('changer_type_garde', {
        p_pointage_id: pointage!.id,
        p_type: newType,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const marquerPresent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('marquer_present', {
        p_employee_id: employee.id,
        p_date: date,
        p_type: type,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const { data: photoUrl } = useQuery({
    queryKey: ['photo-url', pointage?.photo_path],
    enabled: Boolean(pointage?.photo_path),
    staleTime: 55 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('pointages')
        .createSignedUrl(pointage!.photo_path!, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })

  const mutationError = decide.error ?? marquerPresent.error ?? changerType.error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">{employee.nom_prenom}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {site.name} · {formatDateFr(date)}
          {pointage && (
            <>
              {' '}
              ·{' '}
              {pointage.photo_path
                ? `Pointé à ${formatTimeFr(pointage.pointed_at)}`
                : 'Présence marquée par le bureau'}
            </>
          )}
        </p>

        {pointage?.photo_path && photoUrl && (
          <button onClick={() => setZoom(true)} className="mb-4 block w-full">
            <img
              src={photoUrl}
              alt="Photo de pointage"
              className="max-h-64 w-full rounded-xl object-cover ring-1 ring-slate-200"
            />
          </button>
        )}
        {pointage?.photo_path && !photoUrl && (
          <div className="mb-4 h-40 w-full animate-pulse rounded-xl bg-slate-200" />
        )}

        {!pointage && employee.jour_de_repos != null && (
          <p className="mb-3 text-sm text-blue-600">
            Jour de repos de cet employé : {jourDeReposLabel(employee.jour_de_repos)}
          </p>
        )}

        {/* Sélecteur de type de garde : à l'acceptation, à la présence manuelle,
            ou pour changer un pointage déjà validé. */}
        {pointage?.status !== 'refused' && (
          <div className="mb-4">
            <p className="mb-1.5 text-sm font-medium text-slate-700">Type de garde</p>
            <div className="grid grid-cols-4 gap-1.5">
              {TYPES_GARDE.map((t) => {
                const active = type === t.code
                return (
                  <button
                    key={t.code}
                    title={`${t.label} (${t.valeur.toLocaleString('fr-FR')})`}
                    onClick={() => {
                      setType(t.code)
                      // Si déjà validé, changer immédiatement le type
                      if (pointage?.status === 'validated') changerType.mutate(t.code)
                    }}
                    className={`rounded-lg border px-2 py-2 text-center transition ${
                      active
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-base font-bold">{t.symbole}</span>
                    <span className="block text-[10px] leading-tight">
                      {t.valeur.toLocaleString('fr-FR')} g.
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {TYPES_GARDE.find((t) => t.code === type)?.label}
            </p>
          </div>
        )}

        {mutationError && (
          <div className="mb-3">
            <ErrorNote>{mutationError.message}</ErrorNote>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Fermer
          </button>
          {pointage?.status === 'pending' && (
            <>
              <button
                onClick={() => decide.mutate('refused')}
                disabled={decide.isPending}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Refuser
              </button>
              <button
                onClick={() => decide.mutate('validated')}
                disabled={decide.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Valider ({gardeSymbole(type)})
              </button>
            </>
          )}
          {(!pointage || pointage.status === 'refused') && (
            <button
              onClick={() => marquerPresent.mutate()}
              disabled={marquerPresent.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {marquerPresent.isPending ? '…' : `Marquer présent (${gardeSymbole(type)})`}
            </button>
          )}
        </div>
      </div>

      {zoom && photoUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => {
            e.stopPropagation()
            setZoom(false)
          }}
        >
          <img src={photoUrl} alt="Photo de pointage" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}
