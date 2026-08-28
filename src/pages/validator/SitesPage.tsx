import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSites } from '../../lib/queries'
import type { Site } from '../../lib/types'
import { Chip, EmptyState, ErrorNote, Spinner } from '../../components/ui'

/** Gestion des sites d'une entreprise — accessible au bureau et à l'admin. */
export default function SitesPage() {
  const { companyId } = useParams()
  const { data: sites, isLoading, error } = useSites(companyId)
  const [edite, setEdite] = useState<Site | null>(null)
  const [ajoute, setAjoute] = useState(false)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Sites</h1>
          <p className="text-sm text-slate-500">
            {sites ? `${sites.length} site(s)` : 'Lieux de travail de cette entreprise'}
          </p>
        </div>
        <button
          onClick={() => setAjoute(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Ajouter un site
        </button>
      </div>

      {isLoading && <Spinner label="Chargement…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}
      {sites && sites.length === 0 && <EmptyState>Aucun site pour cette entreprise.</EmptyState>}

      {sites && sites.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {sites.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="flex items-center gap-2 font-medium text-slate-900">
                  {s.name}
                  {!s.pointage_actif && <Chip tone="slate">Sans pointage</Chip>}
                </p>
                <button
                  onClick={() => setEdite(s)}
                  className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Modifier
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(ajoute || edite) && companyId && (
        <SiteFormModal
          companyId={companyId}
          site={edite}
          onClose={() => {
            setAjoute(false)
            setEdite(null)
          }}
        />
      )}
    </div>
  )
}

function SiteFormModal({
  companyId,
  site,
  onClose,
}: {
  companyId: string
  site: Site | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [nom, setNom] = useState(site?.name ?? '')
  const [pointageActif, setPointageActif] = useState(site?.pointage_actif ?? true)
  const [confirmeSuppression, setConfirmeSuppression] = useState(false)

  const invalider = () => {
    qc.invalidateQueries({ queryKey: ['sites'] })
    onClose()
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!nom.trim()) throw new Error('Le nom du site est obligatoire.')
      if (site) {
        const { error } = await supabase.rpc('maj_site', {
          p_site: site.id,
          p_nom: nom,
          p_pointage_actif: pointageActif,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('creer_site', {
          p_company: companyId,
          p_nom: nom,
          p_pointage_actif: pointageActif,
        })
        if (error) throw error
      }
    },
    onSuccess: invalider,
  })

  const supprimer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('supprimer_site', { p_site: site!.id })
      if (error) throw error
    },
    onSuccess: invalider,
  })

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-5 text-lg font-semibold text-slate-900">
          {site ? `Modifier — ${site.name}` : 'Ajouter un site'}
        </h2>

        <label className="mb-1 block text-sm font-medium text-slate-700">Nom du site</label>
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="ex. CENTRE MEDICO RAHRAH"
          className={`${inputCls} mb-4`}
        />

        <label className="mb-4 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={pointageActif}
            onChange={(e) => setPointageActif(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>
            Les employés de ce site se pointent
            <span className="block text-xs text-slate-500">
              Décochez pour un site administratif (superviseurs…) : il n’apparaîtra pas dans le pointage.
            </span>
          </span>
        </label>

        {(save.error || supprimer.error) && (
          <div className="mb-4">
            <ErrorNote>{(save.error ?? supprimer.error)!.message}</ErrorNote>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {site && !confirmeSuppression && (
            <button
              onClick={() => setConfirmeSuppression(true)}
              className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          )}
          {site && confirmeSuppression && (
            <button
              onClick={() => supprimer.mutate()}
              disabled={supprimer.isPending}
              className="mr-auto rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {supprimer.isPending ? '…' : 'Confirmer la suppression'}
            </button>
          )}
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            Annuler
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {save.isPending ? 'Enregistrement…' : site ? 'Enregistrer' : 'Créer le site'}
          </button>
        </div>
      </div>
    </div>
  )
}
