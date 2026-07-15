import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../lib/image'
import { isoDayOfWeek, jourDeReposLabel, todayIso } from '../../lib/dates'
import {
  useSiteEmployees,
  useSitePointages,
  useSites,
  type SiteEmployee,
} from '../../lib/queries'
import type { Site } from '../../lib/types'
import CameraCapture from '../../components/CameraCapture'
import SiteAccordion from '../../components/SiteAccordion'
import { Chip, EmptyState, ErrorNote, Spinner } from '../../components/ui'

interface CaptureTarget {
  employee: SiteEmployee
  site: Site
}

export default function AgentPointagePage() {
  const { companyId } = useParams()
  const { data: sites, isLoading, error } = useSites(companyId)
  const [target, setTarget] = useState<CaptureTarget | null>(null)
  const queryClient = useQueryClient()

  const submitPointage = async (photo: Blob) => {
    if (!target || !companyId) return
    const compressed = await compressImage(photo)
    const path = `${companyId}/${target.employee.id}/${todayIso()}_${crypto.randomUUID()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('pointages')
      .upload(path, compressed, { contentType: 'image/jpeg' })
    if (uploadError) throw new Error(`Envoi de la photo impossible : ${uploadError.message}`)

    const { error: insertError } = await supabase.from('pointages').insert({
      company_id: companyId,
      site_id: target.site.id,
      employee_id: target.employee.id,
      photo_path: path,
    })
    if (insertError) {
      if (insertError.code === '23505') {
        throw new Error('Cet employé a déjà été pointé aujourd’hui.')
      }
      throw new Error(`Enregistrement impossible : ${insertError.message}`)
    }

    await queryClient.invalidateQueries({ queryKey: ['site-pointages', target.site.id] })
    setTarget(null)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Pointage</h1>
      <p className="mb-6 text-sm text-slate-500">
        Sélectionnez un site puis pointez chaque employé présent en prenant une photo.
      </p>

      {isLoading && <Spinner label="Chargement des sites…" />}
      {error && <ErrorNote>Impossible de charger les sites : {error.message}</ErrorNote>}
      {sites && sites.length === 0 && <EmptyState>Aucun site pour cette entreprise.</EmptyState>}

      {sites && (
        <SiteAccordion
          sites={sites}
          renderSite={(site, expanded) => (
            <SiteEmployeeList site={site} enabled={expanded} onPointer={(employee) => setTarget({ employee, site })} />
          )}
        />
      )}

      {target && (
        <CameraCapture
          title={`Pointer — ${target.employee.nom_prenom}`}
          onConfirm={submitPointage}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  )
}

function SiteEmployeeList({
  site,
  enabled,
  onPointer,
}: {
  site: Site
  enabled: boolean
  onPointer: (employee: SiteEmployee) => void
}) {
  const employees = useSiteEmployees(site.id, enabled)
  const pointages = useSitePointages(site.id, todayIso(), enabled)
  const todayDow = isoDayOfWeek()

  if (employees.isLoading || pointages.isLoading) {
    return <Spinner label="Chargement des employés…" />
  }
  if (employees.error) {
    return (
      <div className="p-4">
        <ErrorNote>Erreur : {employees.error.message}</ErrorNote>
      </div>
    )
  }

  const rows = employees.data?.pages.flat() ?? []
  if (rows.length === 0) return <EmptyState>Aucun employé affecté à ce site.</EmptyState>

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((emp) => {
        const pointage = pointages.data?.get(emp.id)
        const isRepos = emp.jour_de_repos === todayDow
        return (
          <li key={emp.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{emp.nom_prenom}</p>
              <p className="truncate text-xs text-slate-500">
                {emp.matricule && <>Mat. {emp.matricule} · </>}
                {emp.qualification ?? ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {pointage?.status === 'validated' && <Chip tone="green">Validé</Chip>}
              {pointage?.status === 'pending' && <Chip tone="blue">En attente</Chip>}
              {pointage?.status === 'refused' && <Chip tone="red">Refusé</Chip>}
              {!pointage && isRepos && (
                <Chip tone="slate" title={`Jour de repos : ${jourDeReposLabel(emp.jour_de_repos)}`}>
                  Jour de repos
                </Chip>
              )}
              {(!pointage || pointage.status === 'refused') && (
                <button
                  onClick={() => onPointer(emp)}
                  className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Pointer
                </button>
              )}
            </div>
          </li>
        )
      })}
      {employees.hasNextPage && (
        <li className="p-3 text-center">
          <button
            onClick={() => employees.fetchNextPage()}
            disabled={employees.isFetchingNextPage}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-50"
          >
            {employees.isFetchingNextPage ? 'Chargement…' : 'Afficher plus'}
          </button>
        </li>
      )}
    </ul>
  )
}
