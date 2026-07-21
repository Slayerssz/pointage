import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  JOURS_SEMAINE,
  formatDateFr,
  jourDeReposLabel,
  retirementStatus,
  todayIso,
} from '../../lib/dates'
import { useEmployeFiltres, useSites } from '../../lib/queries'
import type { Employee } from '../../lib/types'
import { Chip, DateInputFr, EmptyState, ErrorNote, Pagination, Spinner } from '../../components/ui'

const PAGE_SIZE = 50

const MODES_REGLEMENT = ['Virement', 'Versement', 'Espece']
const QUALIFICATIONS = [
  'AGENT DE SECURITE',
  'AGENT DE NETTOYAGE',
  'AGENT DE JARDINAGE',
  "AGENT D'ACCUEIL",
  'AGENT ADMINISTRATIF',
  'AGENT',
  'SUPERVISEUR',
]

export default function EmployesPage() {
  const { companyId } = useParams()
  const { data: sites } = useSites(companyId)
  const { data: filtres } = useEmployeFiltres(companyId)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [villeFilter, setVilleFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [qualifFilter, setQualifFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('actif')
  const [editing, setEditing] = useState<Employee | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, error, isPlaceholderData } = useQuery({
    queryKey: [
      'employees', companyId, page, debouncedSearch,
      siteFilter, villeFilter, modeFilter, qualifFilter, statutFilter,
    ],
    enabled: Boolean(companyId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from('employees')
        .select(
          'id, company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, qualification, adresse, ville, mode_reglement, telephone, jour_de_repos, jours_travailles, actif, rib, banque, salaire, date_sortie',
          { count: 'exact' },
        )
        .eq('company_id', companyId!)
        .order('matricule', { ascending: true, nullsFirst: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      if (siteFilter) query = query.eq('site_id', siteFilter)
      if (villeFilter) query = query.eq('ville', villeFilter)
      if (modeFilter) query = query.eq('mode_reglement', modeFilter)
      if (qualifFilter) query = query.eq('qualification', qualifFilter)
      if (statutFilter === 'actif') query = query.eq('actif', true)
      else if (statutFilter === 'sorti') query = query.eq('actif', false)
      if (debouncedSearch) {
        const term = debouncedSearch.replaceAll('%', '\\%').replaceAll(',', ' ')
        const clauses = [`nom_prenom.ilike.%${term}%`, `cin.ilike.%${term}%`]
        if (/^\d+$/.test(term)) clauses.push(`matricule.eq.${term}`)
        query = query.or(clauses.join(','))
      }
      const { data, error, count } = await query
      if (error) throw error
      return { rows: data as Employee[], count: count ?? 0 }
    },
  })

  const pageCount = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE))
  const siteName = (id: string) => sites?.find((s) => s.id === id)?.name ?? '—'

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(1)
  }

  const filterSelect = (
    value: string,
    onChange: (v: string) => void,
    allLabel: string,
    options: { value: string; label: string }[],
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Employés</h1>
          <p className="text-sm text-slate-500">
            {data ? `${data.count} employé(s)` : 'Liste du personnel de l’entreprise'}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Ajouter un employé
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, matricule, CIN)…"
          className="w-60 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {filterSelect(siteFilter, resetPage(setSiteFilter), 'Tous les sites',
          (sites ?? []).map((s) => ({ value: s.id, label: s.name })))}
        {filterSelect(villeFilter, resetPage(setVilleFilter), 'Toutes les villes',
          (filtres?.villes ?? []).map((v) => ({ value: v, label: v })))}
        {filterSelect(modeFilter, resetPage(setModeFilter), 'Tous les règlements',
          (filtres?.modes_reglement ?? []).map((v) => ({ value: v, label: v })))}
        {filterSelect(qualifFilter, resetPage(setQualifFilter), 'Toutes les qualifications',
          (filtres?.qualifications ?? []).map((v) => ({ value: v, label: v })))}
        {filterSelect(statutFilter, resetPage(setStatutFilter), 'Tous les statuts', [
          { value: 'actif', label: 'En poste' },
          { value: 'sorti', label: 'Sortis' },
        ])}
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
          <table className="w-full min-w-[1700px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Nom & Prénom</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Âge</th>
                <th className="px-4 py-3 font-medium">Naissance</th>
                <th className="px-4 py-3 font-medium">Embauche</th>
                <th className="px-4 py-3 font-medium">CIN</th>
                <th className="px-4 py-3 font-medium">CNSS</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Adresse</th>
                <th className="px-4 py-3 font-medium">Ville</th>
                <th className="px-4 py-3 font-medium">Repos</th>
                <th className="px-4 py-3 font-medium">Règlement</th>
                <th className="px-4 py-3 font-medium">RIB</th>
                <th className="px-4 py-3 font-medium">Banque</th>
                <th className="px-4 py-3 text-right font-medium">Salaire</th>
                <th className="px-4 py-3 text-right font-medium">Jours travaillés</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((emp) => {
                const retirement = retirementStatus(emp.date_naissance)
                const isRetired = retirement?.kind === 'retired'
                const isGone = !emp.actif
                return (
                  <tr key={emp.id} className={isGone ? 'bg-slate-50 text-slate-400' : isRetired ? 'bg-red-50/80' : undefined}>
                    <td className="px-4 py-3 font-medium text-slate-700">{emp.matricule ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isGone ? 'text-slate-500' : isRetired ? 'text-red-700' : 'text-slate-900'}`}>
                          {emp.nom_prenom}
                        </span>
                        {isGone && (
                          <Chip tone="slate" title={emp.date_sortie ? `Sorti le ${formatDateFr(emp.date_sortie)}` : 'Sorti'}>
                            Sorti{emp.date_sortie ? ` — ${formatDateFr(emp.date_sortie)}` : ''}
                          </Chip>
                        )}
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
                    <td className="max-w-56 truncate px-4 py-3 text-slate-600" title={emp.adresse ?? undefined}>
                      {emp.adresse ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{emp.ville ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{jourDeReposLabel(emp.jour_de_repos)}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.mode_reglement ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{emp.rib ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.banque ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {emp.salaire != null ? `${emp.salaire.toLocaleString('fr-FR')} DH` : '—'}
                    </td>
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

      {(editing || adding) && companyId && (
        <EmployeeFormModal
          companyId={companyId}
          employee={editing}
          onClose={() => {
            setEditing(null)
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

/** Formulaire complet — création (employee=null) ou modification. */
function EmployeeFormModal({
  companyId,
  employee,
  onClose,
}: {
  companyId: string
  employee: Employee | null
  onClose: () => void
}) {
  const { data: sites } = useSites(companyId)
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    site_id: employee?.site_id ?? '',
    matricule: employee?.matricule?.toString() ?? '',
    nom_prenom: employee?.nom_prenom ?? '',
    cin: employee?.cin ?? '',
    cnss: employee?.cnss ?? '',
    date_naissance: employee?.date_naissance ?? '',
    date_embauche: employee?.date_embauche ?? '',
    qualification: employee?.qualification ?? 'AGENT DE SECURITE',
    telephone: employee?.telephone ?? '',
    adresse: employee?.adresse ?? '',
    ville: employee?.ville ?? '',
    mode_reglement: employee?.mode_reglement ?? 'Virement',
    jour_de_repos: employee?.jour_de_repos?.toString() ?? '',
    jours_travailles: employee?.jours_travailles?.toString() ?? '0',
    rib: employee?.rib ?? '',
    banque: employee?.banque ?? '',
    salaire: employee?.salaire?.toString() ?? '',
    statut: employee && !employee.actif ? 'sorti' : 'actif',
    date_sortie: employee?.date_sortie ?? '',
  })

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nom_prenom.trim()) throw new Error('Le nom est obligatoire.')
      if (!form.site_id) throw new Error('Choisissez un site.')
      const payload = {
        site_id: form.site_id,
        // Vide à la création → matricule attribué automatiquement (dernier + 1)
        matricule: form.matricule.trim() ? Number(form.matricule) : null,
        nom_prenom: form.nom_prenom.trim().toUpperCase(),
        cin: form.cin.trim() || null,
        cnss: form.cnss.trim() || null,
        date_naissance: form.date_naissance || null,
        date_embauche: form.date_embauche || null,
        qualification: form.qualification.trim() || null,
        telephone: form.telephone.trim() || null,
        adresse: form.adresse.trim() || null,
        ville: form.ville.trim().toUpperCase() || null,
        mode_reglement: form.mode_reglement || null,
        jour_de_repos: form.jour_de_repos ? Number(form.jour_de_repos) : null,
        jours_travailles: Math.max(0, Number(form.jours_travailles) || 0),
        rib: form.rib.trim() || null,
        banque: form.banque.trim() || null,
        salaire: form.salaire.trim() ? Number(form.salaire) : null,
        // « actif » est dérivé automatiquement de la date de sortie côté base.
        // Statut « sorti » sans date → date du jour.
        date_sortie:
          form.statut === 'sorti' ? form.date_sortie || todayIso() : null,
      }
      if (employee) {
        const { error } = await supabase.from('employees').update(payload).eq('id', employee.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('employees')
          .insert({ ...payload, company_id: companyId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['site-employees'] })
      queryClient.invalidateQueries({ queryKey: ['employe-filtres'] })
      onClose()
    },
  })

  const field = (label: string, input: ReactNode) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {input}
    </label>
  )

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          {employee ? `Modifier — ${employee.nom_prenom}` : 'Ajouter un employé'}
        </h2>
        <p className="mb-5 text-sm text-slate-500">
          {employee
            ? 'Tous les champs sont modifiables.'
            : 'Laissez le matricule vide : le prochain numéro disponible sera attribué automatiquement.'}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {field('Nom & Prénom *', (
            <input type="text" value={form.nom_prenom} onChange={(e) => set('nom_prenom')(e.target.value)} className={inputCls} />
          ))}
          {field('Site *', (
            <select value={form.site_id} onChange={(e) => set('site_id')(e.target.value)} className={inputCls}>
              <option value="">— Choisir un site —</option>
              {sites?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ))}
          {field(employee ? 'Matricule' : 'Matricule (vide = automatique)', (
            <input type="number" value={form.matricule} onChange={(e) => set('matricule')(e.target.value)} className={inputCls} placeholder="automatique" />
          ))}
          {field('Qualification', (
            <select value={form.qualification} onChange={(e) => set('qualification')(e.target.value)} className={inputCls}>
              {[...new Set([...QUALIFICATIONS, form.qualification].filter(Boolean))].map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          ))}
          {field('CIN', (
            <input type="text" value={form.cin} onChange={(e) => set('cin')(e.target.value)} className={inputCls} />
          ))}
          {field('CNSS', (
            <input type="text" value={form.cnss} onChange={(e) => set('cnss')(e.target.value)} className={inputCls} />
          ))}
          {field('Date de naissance', (
            <DateInputFr value={form.date_naissance} onChange={set('date_naissance')} className={inputCls} />
          ))}
          {field("Date d'embauche", (
            <DateInputFr value={form.date_embauche} onChange={set('date_embauche')} className={inputCls} />
          ))}
          {field('Téléphone', (
            <input type="tel" value={form.telephone} onChange={(e) => set('telephone')(e.target.value)} className={inputCls} placeholder="06 00 00 00 00" />
          ))}
          {field('Ville', (
            <input type="text" value={form.ville} onChange={(e) => set('ville')(e.target.value)} className={inputCls} />
          ))}
          <div className="sm:col-span-2">
            {field('Adresse', (
              <input type="text" value={form.adresse} onChange={(e) => set('adresse')(e.target.value)} className={inputCls} />
            ))}
          </div>
          {field('Mode de règlement', (
            <select value={form.mode_reglement} onChange={(e) => set('mode_reglement')(e.target.value)} className={inputCls}>
              {[...new Set([...MODES_REGLEMENT, form.mode_reglement].filter(Boolean))].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ))}
          {field('Jour de repos', (
            <select value={form.jour_de_repos} onChange={(e) => set('jour_de_repos')(e.target.value)} className={inputCls}>
              <option value="">Aucun</option>
              {JOURS_SEMAINE.map((jour, i) => (
                <option key={jour} value={i + 1}>{jour}</option>
              ))}
            </select>
          ))}
          {field('Jours travaillés', (
            <input type="number" min="0" value={form.jours_travailles} onChange={(e) => set('jours_travailles')(e.target.value)} className={inputCls} />
          ))}

          <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700">Paie & banque</p>
          </div>
          {field('Salaire (DH)', (
            <input type="number" min="0" step="0.01" value={form.salaire} onChange={(e) => set('salaire')(e.target.value)} className={inputCls} placeholder="ex. 3000" />
          ))}
          {field('Banque', (
            <input type="text" value={form.banque} onChange={(e) => set('banque')(e.target.value)} className={inputCls} placeholder="ex. Attijariwafa Bank" />
          ))}
          <div className="sm:col-span-2">
            {field('RIB', (
              <input type="text" value={form.rib} onChange={(e) => set('rib')(e.target.value)} className={inputCls} placeholder="24 chiffres" />
            ))}
          </div>

          <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700">Statut</p>
          </div>
          {field('Statut', (
            <select value={form.statut} onChange={(e) => set('statut')(e.target.value)} className={inputCls}>
              <option value="actif">En poste</option>
              <option value="sorti">Sorti</option>
            </select>
          ))}
          {form.statut === 'sorti' &&
            field('Date de sortie', (
              <DateInputFr value={form.date_sortie} onChange={set('date_sortie')} className={inputCls} />
            ))}
        </div>

        {save.error && (
          <div className="mt-4">
            <ErrorNote>Enregistrement impossible : {save.error.message}</ErrorNote>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
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
            {save.isPending ? 'Enregistrement…' : employee ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
