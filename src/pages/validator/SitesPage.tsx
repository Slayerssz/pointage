import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSites, useSitesPrincipaux } from '../../lib/queries'
import type { SitePrincipal } from '../../lib/types'
import { ErrorNote } from '../../components/ui'

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
  const { data: annexes } = useSites(companyId)
  const { data: principaux } = useSitesPrincipaux(companyId)
  const qc = useQueryClient()

  const [principalEdite, setPrincipalEdite] = useState<SitePrincipal | null>(null)
  const [ajoutePrincipal, setAjoutePrincipal] = useState(false)
  const [recherche, setRecherche] = useState('')
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

  // Annexes regroupées par site principal, les indépendantes à la fin
  const groupes = (principaux ?? []).map((p) => ({
    principal: p,
    sites: (annexes ?? []).filter((s) => s.site_principal_id === p.id),
  }))
  const independantes = (annexes ?? []).filter((s) => !s.site_principal_id)

  // La recherche porte sur l'annexe comme sur son site principal : on
  // tape « ONDA » sans savoir lequel des deux porte le nom.
  const q = recherche.trim().toLowerCase()
  const correspond = (nom: string) => nom.toLowerCase().includes(q)
  const groupesFiltres = q
    ? groupes
        .map((g) => ({
          principal: g.principal,
          sites: correspond(g.principal.name) ? g.sites : g.sites.filter((s) => correspond(s.name)),
        }))
        .filter((g) => correspond(g.principal.name) || g.sites.length > 0)
    : groupes
  const independantesFiltrees = q ? independantes.filter((s) => correspond(s.name)) : independantes
  const rienTrouve =
    q && groupesFiltres.length === 0 && independantesFiltrees.length === 0

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

      <input
        type="search"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Chercher un site…"
        className="mb-5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-sm"
      />

      {rienTrouve && (
        <p className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Aucun site ne porte ce nom.
        </p>
      )}

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
              {groupesFiltres.map(({ principal, sites }) => (
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

      {/* Les annexes ne figurent plus ici : elles se tiennent dans
          l'écran de pointage, sous la grille, avec le monde qu'elles
          portent sous les yeux. */}
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Les annexes se gèrent depuis le <strong>Pointage</strong> : ouvrez un site
        principal, et la bande sous la grille permet d’en ajouter, d’y affecter
        quelqu’un, et — pour l’administrateur — de les renommer ou de les supprimer.
      </p>


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
        // Le site principal naît avec sa première annexe, du même nom :
        // on pointe dessus tout de suite, sans avoir à inventer une
        // subdivision que le lieu n'a pas.
        const { error } = await supabase.rpc('creer_site_principal_avec_annexe', {
          p_company: companyId, p_nom: nom,
        })
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
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
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
