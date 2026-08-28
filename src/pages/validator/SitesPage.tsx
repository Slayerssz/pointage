import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSites, useSitesPrincipaux } from '../../lib/queries'
import type { Site, SitePrincipal } from '../../lib/types'
import { Chip, EmptyState, ErrorNote, Spinner } from '../../components/ui'

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

/**
 * Deux niveaux :
 *   Site principal (ex. « LA COMMUNE ») → regroupe des annexes
 *   Annexe         (ex. « COMMUNE HAY RIAD ») → c'est là que sont les employés
 *
 * Les sites qui existaient déjà sont les annexes : rien n'a bougé.
 */
export default function SitesPage() {
  const { companyId } = useParams()
  const { data: annexes, isLoading, error } = useSites(companyId)
  const { data: principaux } = useSitesPrincipaux(companyId)
  const qc = useQueryClient()

  const [edite, setEdite] = useState<Site | null>(null)
  const [ajoute, setAjoute] = useState(false)
  const [principalEdite, setPrincipalEdite] = useState<SitePrincipal | null>(null)
  const [ajoutePrincipal, setAjoutePrincipal] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [cible, setCible] = useState('')

  // Compter les employés par annexe, pour savoir ce qu'on déplace
  const { data: effectifs } = useQuery({
    queryKey: ['effectifs-sites', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('employees')
        .select('site_id')
        .eq('company_id', companyId!)
        .eq('actif', true)
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data as { site_id: string }[]) {
        m.set(r.site_id, (m.get(r.site_id) ?? 0) + 1)
      }
      return m
    },
  })

  const lier = useMutation({
    mutationFn: async (principalId: string | null) => {
      const { error } = await supabase.rpc('lier_annexes', {
        p_annexes: [...selection],
        p_principal: principalId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      setSelection(new Set())
      setCible('')
    },
  })

  const bascule = (id: string) =>
    setSelection((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const nomPrincipal = (id: string | null) =>
    id ? (principaux?.find((p) => p.id === id)?.name ?? '—') : null

  // Annexes regroupées par site principal, les indépendantes à la fin
  const groupes = (principaux ?? []).map((p) => ({
    principal: p,
    sites: (annexes ?? []).filter((s) => s.site_principal_id === p.id),
  }))
  const independantes = (annexes ?? []).filter((s) => !s.site_principal_id)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Sites</h1>
        <p className="text-sm text-slate-500">
          Les <strong>annexes</strong> sont les lieux où travaillent les employés. Un{' '}
          <strong>site principal</strong> en regroupe plusieurs — pratique pour voir d’un coup
          tout le personnel d’un ensemble comme « la commune ».
        </p>
      </div>

      {/* ---------- Sites principaux ---------- */}
      <div className="mb-6">
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Sites principaux
          </h2>
          <button
            onClick={() => setAjoutePrincipal(true)}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            + Site principal
          </button>
        </div>

        {principaux && principaux.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Aucun site principal. Créez-en un (ex. « LA COMMUNE »), puis rattachez-lui les annexes
            ci-dessous.
          </p>
        )}

        {principaux && principaux.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {groupes.map(({ principal, sites }) => (
                <li key={principal.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{principal.name}</p>
                    <p className="text-xs text-slate-500">
                      {sites.length} annexe(s) ·{' '}
                      {sites.reduce((n, s) => n + (effectifs?.get(s.id) ?? 0), 0)} employé(s)
                    </p>
                  </div>
                  <button
                    onClick={() => setPrincipalEdite(principal)}
                    className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Modifier
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ---------- Barre de rattachement ---------- */}
      {selection.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-emerald-900">
            {selection.size} annexe(s) sélectionnée(s)
          </span>
          <select
            value={cible}
            onChange={(e) => setCible(e.target.value)}
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">— Choisir un site principal —</option>
            {principaux?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => lier.mutate(cible)}
            disabled={!cible || lier.isPending}
            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {lier.isPending ? '…' : 'Lier'}
          </button>
          <button
            onClick={() => lier.mutate(null)}
            disabled={lier.isPending}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40"
          >
            Détacher
          </button>
          <button
            onClick={() => setSelection(new Set())}
            className="ml-auto text-sm text-emerald-800 hover:underline"
          >
            Annuler
          </button>
        </div>
      )}

      {lier.error && (
        <div className="mb-3">
          <ErrorNote>{lier.error.message}</ErrorNote>
        </div>
      )}

      {/* ---------- Annexes ---------- */}
      <div className="mb-2 flex items-end justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Annexes {annexes ? `(${annexes.length})` : ''}
        </h2>
        <button
          onClick={() => setAjoute(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Ajouter une annexe
        </button>
      </div>

      {isLoading && <Spinner label="Chargement…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}
      {annexes && annexes.length === 0 && <EmptyState>Aucune annexe.</EmptyState>}

      {annexes && annexes.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {[...groupes.flatMap((g) => g.sites), ...independantes].map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selection.has(s.id)}
                  onChange={() => bascule(s.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300"
                  aria-label={`Sélectionner ${s.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                    {s.name}
                    {!s.pointage_actif && <Chip tone="slate">Sans pointage</Chip>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.site_principal_id ? (
                      <>
                        Rattachée à <strong>{nomPrincipal(s.site_principal_id)}</strong>
                      </>
                    ) : (
                      'Non rattachée'
                    )}
                    {' · '}
                    {effectifs?.get(s.id) ?? 0} employé(s)
                  </p>
                </div>
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
        <AnnexeModal
          companyId={companyId}
          site={edite}
          annexes={annexes ?? []}
          principaux={principaux ?? []}
          nbEmployes={edite ? (effectifs?.get(edite.id) ?? 0) : 0}
          onClose={() => {
            setAjoute(false)
            setEdite(null)
          }}
        />
      )}

      {(ajoutePrincipal || principalEdite) && companyId && (
        <PrincipalModal
          companyId={companyId}
          principal={principalEdite}
          nbAnnexes={
            principalEdite
              ? (annexes ?? []).filter((s) => s.site_principal_id === principalEdite.id).length
              : 0
          }
          onClose={() => {
            setAjoutePrincipal(false)
            setPrincipalEdite(null)
          }}
        />
      )}
    </div>
  )
}

function AnnexeModal({
  companyId,
  site,
  annexes,
  principaux,
  nbEmployes,
  onClose,
}: {
  companyId: string
  site: Site | null
  annexes: Site[]
  principaux: SitePrincipal[]
  nbEmployes: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [nom, setNom] = useState(site?.name ?? '')
  const [pointageActif, setPointageActif] = useState(site?.pointage_actif ?? true)
  const [principal, setPrincipal] = useState(site?.site_principal_id ?? '')
  const [suppression, setSuppression] = useState(false)
  const [cible, setCible] = useState('')

  const invalider = () => {
    qc.invalidateQueries({ queryKey: ['sites'] })
    qc.invalidateQueries({ queryKey: ['effectifs-sites'] })
    qc.invalidateQueries({ queryKey: ['employees'] })
    onClose()
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!nom.trim()) throw new Error('Le nom de l’annexe est obligatoire.')
      if (site) {
        const { error } = await supabase.rpc('maj_site', {
          p_site: site.id, p_nom: nom, p_pointage_actif: pointageActif,
        })
        if (error) throw error
        const { error: e2 } = await supabase.rpc('lier_annexes', {
          p_annexes: [site.id], p_principal: principal || null,
        })
        if (e2) throw e2
      } else {
        const { data, error } = await supabase.rpc('creer_site', {
          p_company: companyId, p_nom: nom, p_pointage_actif: pointageActif,
        })
        if (error) throw error
        if (principal) {
          const { error: e2 } = await supabase.rpc('lier_annexes', {
            p_annexes: [data as string], p_principal: principal,
          })
          if (e2) throw e2
        }
      }
    },
    onSuccess: invalider,
  })

  const supprimer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('supprimer_site', {
        p_site: site!.id,
        p_site_cible: cible || null,
      })
      if (error) throw error
    },
    onSuccess: invalider,
  })

  const autres = annexes.filter((a) => a.id !== site?.id)

  return (
    <Modal title={site ? `Annexe — ${site.name}` : 'Ajouter une annexe'} onClose={onClose}>
      <label className="mb-1 block text-sm font-medium text-slate-700">Nom de l’annexe</label>
      <input
        type="text" value={nom} onChange={(e) => setNom(e.target.value)}
        placeholder="ex. COMMUNE DE HAY RIAD" className={`${inputCls} mb-4`}
      />

      <label className="mb-1 block text-sm font-medium text-slate-700">Site principal</label>
      <select value={principal} onChange={(e) => setPrincipal(e.target.value)} className={`${inputCls} mb-1`}>
        <option value="">— Aucun (annexe indépendante) —</option>
        {principaux.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <p className="mb-4 text-xs text-slate-500">
        Pour en rattacher plusieurs d’un coup, cochez-les dans la liste et utilisez « Lier ».
      </p>

      <label className="mb-4 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox" checked={pointageActif}
          onChange={(e) => setPointageActif(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span>
          Les employés de cette annexe se pointent
          <span className="block text-xs text-slate-500">
            Décochez pour une annexe administrative : elle n’apparaîtra pas dans le pointage.
          </span>
        </span>
      </label>

      {/* Suppression, avec déplacement des employés */}
      {site && suppression && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-900">Supprimer « {site.name} » ?</p>
          {nbEmployes > 0 ? (
            <>
              <p className="mt-1 text-sm text-red-800">
                Cette annexe compte <strong>{nbEmployes} employé(s)</strong>. Choisissez où les
                déplacer — ils ne seront jamais supprimés.
              </p>
              <select
                value={cible} onChange={(e) => setCible(e.target.value)}
                className={`${inputCls} mt-2 bg-white`}
              >
                <option value="">— Déplacer les employés vers… —</option>
                {autres.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </>
          ) : (
            <p className="mt-1 text-sm text-red-800">
              Cette annexe est vide : elle peut être supprimée sans conséquence.
            </p>
          )}
          {supprimer.error && (
            <div className="mt-2">
              <ErrorNote>{supprimer.error.message}</ErrorNote>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setSuppression(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
            <button
              onClick={() => supprimer.mutate()}
              disabled={supprimer.isPending || (nbEmployes > 0 && !cible)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {supprimer.isPending ? '…' : 'Confirmer la suppression'}
            </button>
          </div>
        </div>
      )}

      {save.error && (
        <div className="mb-4">
          <ErrorNote>{save.error.message}</ErrorNote>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {site && !suppression && (
          <button
            onClick={() => setSuppression(true)}
            className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Supprimer
          </button>
        )}
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Annuler
        </button>
        <button
          onClick={() => save.mutate()} disabled={save.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? 'Enregistrement…' : site ? 'Enregistrer' : 'Créer l’annexe'}
        </button>
      </div>
    </Modal>
  )
}

function PrincipalModal({
  companyId,
  principal,
  nbAnnexes,
  onClose,
}: {
  companyId: string
  principal: SitePrincipal | null
  nbAnnexes: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [nom, setNom] = useState(principal?.name ?? '')
  const [confirme, setConfirme] = useState(false)

  const invalider = () => {
    qc.invalidateQueries({ queryKey: ['sites-principaux'] })
    qc.invalidateQueries({ queryKey: ['sites'] })
    onClose()
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!nom.trim()) throw new Error('Le nom est obligatoire.')
      if (principal) {
        const { error } = await supabase.rpc('maj_site_principal', { p_id: principal.id, p_nom: nom })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('creer_site_principal', { p_company: companyId, p_nom: nom })
        if (error) throw error
      }
    },
    onSuccess: invalider,
  })

  const supprimer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('supprimer_site_principal', { p_id: principal!.id })
      if (error) throw error
    },
    onSuccess: invalider,
  })

  return (
    <Modal
      title={principal ? `Site principal — ${principal.name}` : 'Nouveau site principal'}
      onClose={onClose}
    >
      <label className="mb-1 block text-sm font-medium text-slate-700">Nom</label>
      <input
        type="text" value={nom} onChange={(e) => setNom(e.target.value)}
        placeholder="ex. LA COMMUNE" className={`${inputCls} mb-4`}
      />

      {principal && confirme && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Supprimer « {principal.name} » ? Ses <strong>{nbAnnexes} annexe(s)</strong> seront
          simplement détachées — ni les annexes ni leurs employés ne sont supprimés.
        </div>
      )}

      {(save.error || supprimer.error) && (
        <div className="mb-4">
          <ErrorNote>{(save.error ?? supprimer.error)!.message}</ErrorNote>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {principal && (
          confirme ? (
            <button
              onClick={() => supprimer.mutate()} disabled={supprimer.isPending}
              className="mr-auto rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {supprimer.isPending ? '…' : 'Confirmer'}
            </button>
          ) : (
            <button
              onClick={() => setConfirme(true)}
              className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          )
        )}
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Annuler
        </button>
        <button
          onClick={() => save.mutate()} disabled={save.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? 'Enregistrement…' : principal ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </Modal>
  )
}

function Modal({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-lg font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}
