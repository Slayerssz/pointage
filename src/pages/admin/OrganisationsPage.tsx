import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatNombre, useParametresPaie } from '../../lib/paie'
import type { Company } from '../../lib/types'
import { EmptyState, ErrorNote, Spinner } from '../../components/ui'

/**
 * Entreprises — réservé à l'administrateur.
 * Lui seul peut créer une entreprise ; les sites se gèrent depuis
 * l'onglet « Sites » de chaque entreprise (bureau et admin).
 */
export default function OrganisationsPage() {
  const navigate = useNavigate()
  const [ajoute, setAjoute] = useState(false)
  const [renomme, setRenomme] = useState<Company | null>(null)
  const [parametres, setParametres] = useState<Company | null>(null)

  const { data: companies, isLoading, error } = useQuery({
    queryKey: ['companies'],
    queryFn: async (): Promise<(Company & { sites: { count: number }[]; employees: { count: number }[] })[]> => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, sites(count), employees(count)')
        .order('name')
      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any
    },
  })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Entreprises</h1>
          <p className="text-sm text-slate-500">
            {companies ? `${companies.length} entreprise(s)` : 'Organisations gérées dans l’application'}
          </p>
        </div>
        <button
          onClick={() => setAjoute(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Créer une entreprise
        </button>
      </div>

      <p className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Seul l’administrateur peut créer une entreprise. Les <strong>sites</strong> se créent depuis
        l’onglet « Sites » à l’intérieur de chaque entreprise (le bureau peut le faire).
      </p>

      {isLoading && <Spinner label="Chargement…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}
      {companies && companies.length === 0 && <EmptyState>Aucune entreprise.</EmptyState>}

      {companies && companies.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {companies.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.sites?.[0]?.count ?? 0} site(s) · {c.employees?.[0]?.count ?? 0} employé(s)
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <button
                    onClick={() => navigate(`/c/${c.id}`)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Ouvrir
                  </button>
                  <button
                    onClick={() => setParametres(c)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Paramètres de paie
                  </button>
                  <button
                    onClick={() => setRenomme(c)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Renommer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(ajoute || renomme) && (
        <CompanyFormModal
          company={renomme}
          onClose={() => {
            setAjoute(false)
            setRenomme(null)
          }}
        />
      )}

      {parametres && (
        <ParametresPaieModal company={parametres} onClose={() => setParametres(null)} />
      )}
    </div>
  )
}

function CompanyFormModal({ company, onClose }: { company: Company | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [nom, setNom] = useState(company?.name ?? '')

  const save = useMutation({
    mutationFn: async () => {
      if (!nom.trim()) throw new Error('Le nom est obligatoire.')
      if (company) {
        const { error } = await supabase.rpc('admin_renommer_entreprise', {
          p_company: company.id,
          p_nom: nom,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('admin_creer_entreprise', { p_nom: nom })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      onClose()
    },
  })

  return (
    <Modal title={company ? `Renommer — ${company.name}` : 'Créer une entreprise'} onClose={onClose}>
      <label className="mb-1 block text-sm font-medium text-slate-700">Nom de l’entreprise</label>
      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="ex. Groupe Triple A"
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />
      {save.error && (
        <div className="mb-4">
          <ErrorNote>{save.error.message}</ErrorNote>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Annuler
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? 'Enregistrement…' : company ? 'Renommer' : 'Créer'}
        </button>
      </div>
    </Modal>
  )
}

function ParametresPaieModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: p, isLoading } = useParametresPaie(company.id)
  const [joursBase, setJoursBase] = useState('')
  const [maladiePayee, setMaladiePayee] = useState(true)
  const [congePaye, setCongePaye] = useState(true)
  const [heuresDefaut, setHeuresDefaut] = useState('')
  const [initialise, setInitialise] = useState(false)

  if (p && !initialise) {
    setJoursBase(String(p.jours_base))
    setMaladiePayee(p.maladie_payee)
    setCongePaye(p.conge_paye)
    setHeuresDefaut(p.heures_par_jour_defaut != null ? String(p.heures_par_jour_defaut) : '8')
    setInitialise(true)
  }

  const save = useMutation({
    mutationFn: async () => {
      const jb = Number(joursBase)
      if (!jb || jb <= 0) throw new Error('Le nombre de jours de base doit être supérieur à 0.')
      const { error } = await supabase.rpc('maj_parametres_paie', {
        p_company: company.id,
        p_jours_base: jb,
        p_maladie_payee: maladiePayee,
        p_conge_paye: congePaye,
        p_heures_defaut: heuresDefaut ? Number(heuresDefaut) : null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parametres-paie', company.id] })
      onClose()
    },
  })

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

  return (
    <Modal title={`Paramètres de paie — ${company.name}`} onClose={onClose}>
      {isLoading ? (
        <Spinner label="Chargement…" />
      ) : (
        <>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Jours pour un salaire complet
          </label>
          <input type="number" min="1" step="0.5" value={joursBase}
                 onChange={(e) => setJoursBase(e.target.value)} className={`${inputCls} mb-1`} />
          <p className="mb-4 text-xs text-slate-500">
            Un employé qui atteint {formatNombre(Number(joursBase) || 26)} jours touche 100 % de son
            salaire. En dessous, le salaire est calculé au prorata ; au-dessus (gardes
            supplémentaires), il augmente.
          </p>

          <label className="mb-1 block text-sm font-medium text-slate-700">
            Heures par jour (valeur par défaut)
          </label>
          <input type="number" min="0" step="0.5" value={heuresDefaut}
                 onChange={(e) => setHeuresDefaut(e.target.value)} className={`${inputCls} mb-4`} />

          <label className="mb-2 flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={maladiePayee} onChange={(e) => setMaladiePayee(e.target.checked)}
                   className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>
              Les jours « Malade » sont payés
              <span className="block text-xs text-slate-500">
                Décoché : le jour reste une absence approuvée, mais il n’est pas payé.
              </span>
            </span>
          </label>

          <label className="mb-4 flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={congePaye} onChange={(e) => setCongePaye(e.target.checked)}
                   className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>
              Les jours de congé sont payés
              <span className="block text-xs text-slate-500">
                « Congé sans solde » n’est jamais payé, quel que soit ce réglage.
              </span>
            </span>
          </label>

          <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Ces réglages s’appliquent aux mois <strong>non encore clôturés</strong>. Un mois déjà
            validé garde les paramètres qui étaient en vigueur au moment de sa clôture.
          </p>

          {save.error && (
            <div className="mb-4">
              <ErrorNote>{save.error.message}</ErrorNote>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
              Annuler
            </button>
            <button onClick={() => save.mutate()} disabled={save.isPending}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-lg font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}
