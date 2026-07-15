import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  JOURS_SEMAINE,
  formatDateFr,
  jourDeReposLabel,
  retirementStatus,
} from '../../lib/dates'
import { useSites } from '../../lib/queries'
import type { Employee } from '../../lib/types'
import { Chip, EmptyState, ErrorNote, Pagination, Spinner } from '../../components/ui'

const PAGE_SIZE = 50

export default function EmployesPage() {
  const { companyId } = useParams()
  const { data: sites } = useSites(companyId)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [editing, setEditing] = useState<Employee | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, error, isPlaceholderData } = useQuery({
    queryKey: ['employees', companyId, page, debouncedSearch, siteFilter],
    enabled: Boolean(companyId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from('employees')
        .select(
          'id, company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, qualification, adresse, ville, mode_reglement, telephone, jour_de_repos, jours_travailles, actif',
          { count: 'exact' },
        )
        .eq('company_id', companyId!)
        .order('nom_prenom')
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      if (siteFilter) query = query.eq('site_id', siteFilter)
      if (debouncedSearch) {
        const term = debouncedSearch.replaceAll('%', '\\%').replaceAll(',', ' ')
        query = query.or(
          `nom_prenom.ilike.%${term}%,matricule.ilike.%${term}%,cin.ilike.%${term}%`,
        )
      }
      const { data, error, count } = await query
      if (error) throw error
      return { rows: data as Employee[], count: count ?? 0 }
    },
  })

  const pageCount = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE))
  const siteName = (id: string) => sites?.find((s) => s.id === id)?.name ?? '—'

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Employés</h1>
          <p className="text-sm text-slate-500">
            {data ? `${data.count} employé(s)` : 'Liste du personnel de l’entreprise'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, matricule, CIN)…"
            className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <select
            value={siteFilter}
            onChange={(e) => {
              setSiteFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tous les sites</option>
            {sites?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <Spinner label="Chargement des employés…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}
      {data && data.rows.length === 0 && <EmptyState>Aucun employé trouvé.</EmptyState>}

      {data && data.rows.length > 0 && (
        <div
          className={`overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ${
            isPlaceholderData ? 'opacity-60' : ''
          }`}
        >
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Matricule</th>
                <th className="px-4 py-3 font-medium">Nom & Prénom</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Âge</th>
                <th className="px-4 py-3 font-medium">Naissance</th>
                <th className="px-4 py-3 font-medium">Embauche</th>
                <th className="px-4 py-3 font-medium">CIN</th>
                <th className="px-4 py-3 font-medium">CNSS</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Repos</th>
                <th className="px-4 py-3 font-medium">Règlement</th>
                <th className="px-4 py-3 text-right font-medium">Jours travaillés</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((emp) => {
                const retirement = retirementStatus(emp.date_naissance)
                const isRetired = retirement?.kind === 'retired'
                return (
                  <tr key={emp.id} className={isRetired ? 'bg-red-50/80' : undefined}>
                    <td className="px-4 py-3 text-slate-500">{emp.matricule ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isRetired ? 'text-red-700' : 'text-slate-900'}`}>
                          {emp.nom_prenom}
                        </span>
                        {retirement?.kind === 'retired' && (
                          <Chip tone="red" title={`Né(e) le ${formatDateFr(emp.date_naissance)} — ${retirement.age} ans`}>
                            Âge de retraite atteint
                          </Chip>
                        )}
                        {retirement?.kind === 'approaching' && (
                          <Chip
                            tone={retirement.daysLeft <= 7 ? 'red' : 'amber'}
                            title={`Né(e) le ${formatDateFr(emp.date_naissance)} — ${retirement.age} ans`}
                          >
                            {retirement.daysLeft === 0
                              ? 'Retraite aujourd’hui'
                              : `${retirement.daysLeft} jour${retirement.daysLeft > 1 ? 's' : ''} avant la retraite`}
                          </Chip>
                        )}
                      </div>
                      {emp.qualification && (
                        <p className="text-xs text-slate-500">{emp.qualification}</p>
                      )}
                    </td>
                    <td className="max-w-40 truncate px-4 py-3 text-slate-600">{siteName(emp.site_id)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {retirement ? `${retirement.age} ans` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDateFr(emp.date_naissance)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateFr(emp.date_embauche)}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.cin ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.cnss ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.telephone ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{jourDeReposLabel(emp.jour_de_repos)}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.mode_reglement ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {emp.jours_travailles}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(emp)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} onPage={setPage} />

      {editing && <EditEmployeeModal employee={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EditEmployeeModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [telephone, setTelephone] = useState(employee.telephone ?? '')
  const [jourDeRepos, setJourDeRepos] = useState(employee.jour_de_repos?.toString() ?? '')
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('employees')
        .update({
          telephone: telephone.trim() || null,
          jour_de_repos: jourDeRepos ? Number(jourDeRepos) : null,
        })
        .eq('id', employee.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['site-employees', employee.site_id] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-900">{employee.nom_prenom}</h2>
        <p className="mb-4 text-sm text-slate-500">Modifier les coordonnées</p>

        <label className="mb-1 block text-sm font-medium text-slate-700">Téléphone</label>
        <input
          type="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="06 00 00 00 00"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Jour de repos</label>
        <select
          value={jourDeRepos}
          onChange={(e) => setJourDeRepos(e.target.value)}
          className="mb-5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Aucun</option>
          {JOURS_SEMAINE.map((jour, i) => (
            <option key={jour} value={i + 1}>
              {jour}
            </option>
          ))}
        </select>

        {save.error && (
          <div className="mb-4">
            <ErrorNote>Enregistrement impossible : {save.error.message}</ErrorNote>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Annuler
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
