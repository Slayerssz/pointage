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
import { useEmployeFiltres, useSites, useSitesPrincipaux } from '../../lib/queries'
import { useAuth } from '../../contexts/AuthContext'
import { formatGardes } from '../../lib/gardes'
import { useContratsCourants, formatDH } from '../../lib/paie'
import { contratAffichage } from '../../lib/contrats'
import type { Contrat, Employee, SituationFamiliale } from '../../lib/types'
import { SITUATIONS_AVEC_ENFANTS, SITUATIONS_FAMILIALES } from '../../lib/types'
import PhotoProfil from '../../components/PhotoProfil'
import FichePrint from '../../components/FichePrint'
import ListePrint from '../../components/ListePrint'
import { Chip, DateInputFr, EmptyState, ErrorNote, Pagination, Spinner } from '../../components/ui'
import EmployeDetail from './EmployeDetail'
import ContratPrint from '../../components/ContratPrint'

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
  const { data: contrats } = useContratsCourants(companyId)
  const { data: principaux } = useSitesPrincipaux(companyId)
  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies').select('id, name').eq('id', companyId!).single()
      if (error) throw error
      return data
    },
  })
  const [impression, setImpression] = useState<{ contrat: Contrat; employee: Employee } | null>(null)
  // Fiche individuelle (une personne) et liste du personnel (la sélection)
  const [fiche, setFiche] = useState<Employee | null>(null)
  const [liste, setListe] = useState<Employee[] | null>(null)
  const [chargementListe, setChargementListe] = useState(false)
  const { data: entreprises } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [villeFilter, setVilleFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [qualifFilter, setQualifFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('actif')
  const [contratFilter, setContratFilter] = useState('')
  const [principalFilter, setPrincipalFilter] = useState('')
  const { profile } = useAuth()
  const estAdmin = profile?.role === 'admin'
  // L'admin peut voir le personnel de TOUTES les entreprises d'un coup.
  const [toutesEntreprises, setToutesEntreprises] = useState(false)
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
      siteFilter, villeFilter, modeFilter, qualifFilter, statutFilter, toutesEntreprises,
      principalFilter,
    ],
    enabled: Boolean(companyId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from('employees')
        .select(
          'id, company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, qualification, adresse, ville, mode_reglement, telephone, jour_de_repos, jours_travailles, actif, rib, banque, salaire, heures_par_jour, dette, situation_familiale, nombre_enfants, photo_path, date_sortie',
          { count: 'exact' },
        )
        .order('matricule', { ascending: true, nullsFirst: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      // Vue « toutes les entreprises » : réservée à l'administrateur
      if (!(estAdmin && toutesEntreprises)) query = query.eq('company_id', companyId!)
      if (siteFilter) query = query.eq('site_id', siteFilter)
      // Filtrer sur un site principal = filtrer sur toutes ses annexes
      if (principalFilter) {
        const ids = (sites ?? [])
          .filter((s) => s.site_principal_id === principalFilter)
          .map((s) => s.id)
        query = query.in('site_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      }
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
  // En vue « toutes les entreprises », les sites des autres sociétés ne sont
  // pas chargés : on n'affiche donc pas de nom de site trompeur.
  const siteCell = (id: string) => (toutesEntreprises ? '—' : siteName(id))

  // Le filtre « contrat » s'applique sur la page affichée (les statuts de
  // contrat sont calculés à partir de la vue contrats_courants).
  const lignes = (data?.rows ?? []).filter((emp) => {
    if (!contratFilter) return true
    const c = contrats?.get(emp.id)
    if (contratFilter === 'sans') return !c
    return c?.statut === contratFilter
  })

  /** Liste du personnel : tous les employés correspondant aux filtres
   *  actuels, et pas seulement ceux de la page affichée. */
  const imprimerSelection = async () => {
    setChargementListe(true)
    try {
      let q = supabase
        .from('employees')
        .select(
          'id, company_id, site_id, matricule, nom_prenom, cin, cnss, date_naissance, date_embauche, qualification, adresse, ville, mode_reglement, telephone, jour_de_repos, jours_travailles, actif, rib, banque, salaire, heures_par_jour, dette, situation_familiale, nombre_enfants, photo_path, date_sortie',
        )
        .order('matricule', { ascending: true, nullsFirst: false })
        .limit(500)
      if (!(estAdmin && toutesEntreprises)) q = q.eq('company_id', companyId!)
      if (siteFilter) q = q.eq('site_id', siteFilter)
      if (principalFilter) {
        const ids = (sites ?? [])
          .filter((s) => s.site_principal_id === principalFilter)
          .map((s) => s.id)
        q = q.in('site_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      }
      if (villeFilter) q = q.eq('ville', villeFilter)
      if (modeFilter) q = q.eq('mode_reglement', modeFilter)
      if (qualifFilter) q = q.eq('qualification', qualifFilter)
      if (statutFilter === 'actif') q = q.eq('actif', true)
      else if (statutFilter === 'sorti') q = q.eq('actif', false)
      const { data: rows, error } = await q
      if (error) throw error
      setListe(rows as Employee[])
    } finally {
      setChargementListe(false)
    }
  }

  /** Ce qui a été filtré, pour le rappeler en tête de la liste imprimée. */
  const intituleListe = [
    principalFilter ? principaux?.find((p) => p.id === principalFilter)?.name : null,
    siteFilter ? sites?.find((s) => s.id === siteFilter)?.name : null,
    qualifFilter || null,
    villeFilter || null,
    modeFilter || null,
    statutFilter === 'sorti' ? 'Employés sortis' : null,
  ].filter(Boolean).join(' · ')

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
            {data
              ? `${data.count} employé(s)${estAdmin && toutesEntreprises ? ' — toutes entreprises' : ''}`
              : 'Liste du personnel'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={imprimerSelection}
            disabled={chargementListe || !data?.count}
            title="Liste de tous les employés correspondant aux filtres, regroupés par site"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {chargementListe ? 'Préparation…' : `Imprimer la liste${data ? ` (${data.count})` : ''}`}
          </button>
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + Ajouter un employé
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, matricule, CIN)…"
          className="w-60 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {!toutesEntreprises && (principaux ?? []).length > 0 &&
          filterSelect(principalFilter, resetPage(setPrincipalFilter), 'Tous les sites principaux',
            (principaux ?? []).map((p) => ({ value: p.id, label: p.name })))}
        {!toutesEntreprises && filterSelect(siteFilter, resetPage(setSiteFilter), 'Toutes les annexes',
          (sites ?? [])
            .filter((s) => !principalFilter || s.site_principal_id === principalFilter)
            .map((s) => ({ value: s.id, label: s.name })))}
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
        {estAdmin && (
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={toutesEntreprises}
              onChange={(e) => { setToutesEntreprises(e.target.checked); setPage(1) }}
              className="h-4 w-4 rounded border-slate-300"
            />
            Toutes les entreprises
          </label>
        )}
        {filterSelect(contratFilter, resetPage(setContratFilter), 'Tous les contrats', [
          { value: 'bientot', label: 'Contrat bientôt terminé (≤ 10 j)' },
          { value: 'termine', label: 'Contrat terminé' },
          { value: 'actif', label: 'Contrat en cours' },
          { value: 'sans', label: 'Sans contrat' },
        ])}
      </div>

      {isLoading && <Spinner label="Chargement des employés…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}
      {data && lignes.length === 0 && <EmptyState>Aucun employé trouvé.</EmptyState>}

      {data && lignes.length > 0 && (
        <div
          className={`overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ${
            isPlaceholderData ? 'opacity-60' : ''
          }`}
        >
          <table className="w-full min-w-[1900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Nom & Prénom</th>
                {estAdmin && toutesEntreprises && (
                  <th className="px-4 py-3 font-medium">Entreprise</th>
                )}
                <th className="px-4 py-3 font-medium">Annexe</th>
                <th className="px-4 py-3 font-medium">Âge</th>
                <th className="px-4 py-3 font-medium">Naissance</th>
                <th className="px-4 py-3 font-medium">Embauche</th>
                <th className="px-4 py-3 font-medium">CIN</th>
                <th className="px-4 py-3 font-medium">CNSS</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Adresse</th>
                <th className="px-4 py-3 font-medium">Ville</th>
                <th className="px-4 py-3 font-medium">Repos</th>
                <th className="px-4 py-3 font-medium">Contrat</th>
                <th className="px-4 py-3 font-medium">Règlement</th>
                <th className="px-4 py-3 font-medium">RIB</th>
                <th className="px-4 py-3 font-medium">Banque</th>
                <th className="px-4 py-3 text-right font-medium">Salaire</th>
                <th className="px-4 py-3 text-right font-medium">H / jour</th>
                <th className="px-4 py-3 text-right font-medium">Gardes</th>
                <th className="sticky right-0 bg-white px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lignes.map((emp) => {
                const retirement = retirementStatus(emp.date_naissance)
                const isRetired = retirement?.kind === 'retired'
                const isGone = !emp.actif
                const contrat = contrats?.get(emp.id)
                const aff = contratAffichage(contrat?.statut ?? null, contrat?.jours_restants ?? null)
                // Contrat bientôt fini → ligne BLEUE · contrat terminé → ligne JAUNE
                const fondContrat = isGone || isRetired ? '' : (aff?.ligne ?? '')
                return (
                  <tr
                    key={emp.id}
                    className={
                      isGone
                        ? 'bg-slate-50 text-slate-400'
                        : isRetired
                          ? 'bg-red-50/80'
                          : fondContrat || undefined
                    }
                  >
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
                    {estAdmin && toutesEntreprises && (
                      <td className="max-w-40 truncate px-4 py-3 font-medium text-slate-700">
                        {entreprises?.find((c) => c.id === emp.company_id)?.name ?? '—'}
                      </td>
                    )}
                    <td className="max-w-40 truncate px-4 py-3 text-slate-600">{siteCell(emp.site_id)}</td>
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
                    <td className="px-4 py-3">
                      {contrat ? (
                        <div>
                          <p className="text-xs font-medium text-slate-700">
                            {contrat.type_contrat}
                            {contrat.date_fin && (
                              <span className="font-normal text-slate-500">
                                {' '}· fin {formatDateFr(contrat.date_fin)}
                              </span>
                            )}
                          </p>
                          {aff && (aff.chip === 'blue' || aff.chip === 'amber') && (
                            <Chip tone={aff.chip}>{aff.label}</Chip>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Aucun contrat</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{emp.mode_reglement ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{emp.rib ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.banque ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                      {emp.salaire != null ? formatDH(emp.salaire) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                      {emp.heures_par_jour != null ? `${formatGardes(emp.heures_par_jour)} h` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 tabular-nums">
                      {formatGardes(emp.jours_travailles)}
                    </td>
                    <td className="sticky right-0 bg-inherit px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setFiche(emp)}
                          title="Imprimer la fiche de cet employé"
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                        >
                          Fiche
                        </button>
                        <button
                          onClick={() => setEditing(emp)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                        >
                          Modifier
                        </button>
                      </div>
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
          entreprise={company?.name ?? ''}
          onImprimerContrat={(contrat, employee) => setImpression({ contrat, employee })}
          onClose={() => {
            setEditing(null)
            setAdding(false)
          }}
        />
      )}

      {fiche && (
        <FichePrint
          employees={[fiche]}
          entreprise={company?.name ?? ''}
          sites={sites ?? []}
          onClose={() => setFiche(null)}
        />
      )}

      {liste && liste.length > 0 && (
        <ListePrint
          employees={liste}
          entreprise={company?.name ?? ''}
          sites={sites ?? []}
          principaux={principaux ?? []}
          intitule={intituleListe || undefined}
          onClose={() => setListe(null)}
        />
      )}

      {impression && (
        <ContratPrint
          contrat={impression.contrat}
          employee={impression.employee}
          entreprise={company?.name ?? ''}
          onClose={() => setImpression(null)}
        />
      )}
    </div>
  )
}

/** Formulaire complet — création (employee=null) ou modification. */
function EmployeeFormModal({
  companyId,
  employee,
  entreprise,
  onImprimerContrat,
  onClose,
}: {
  companyId: string
  employee: Employee | null
  entreprise: string
  onImprimerContrat: (contrat: Contrat, employee: Employee) => void
  onClose: () => void
}) {
  const { data: sites } = useSites(companyId)
  const queryClient = useQueryClient()
  // « Fiche » = les informations de l'employé ; « Dossier » = contrats,
  // congés et dettes (uniquement pour un employé déjà enregistré).
  const [vue, setVue] = useState<'fiche' | 'dossier'>('fiche')

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
    heures_par_jour: employee?.heures_par_jour?.toString() ?? '8',
    situation_familiale: employee?.situation_familiale ?? '',
    nombre_enfants: employee?.nombre_enfants?.toString() ?? '0',
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
        heures_par_jour: form.heures_par_jour.trim() ? Number(form.heures_par_jour) : null,
        situation_familiale: form.situation_familiale || null,
        // Un célibataire n'a pas d'enfants à déclarer ici
        nombre_enfants: SITUATIONS_AVEC_ENFANTS.includes(form.situation_familiale as SituationFamiliale)
          ? Math.max(0, Number(form.nombre_enfants) || 0)
          : 0,
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
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          {employee ? `${employee.nom_prenom}` : 'Ajouter un employé'}
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          {employee
            ? 'Fiche, contrats, congés et dettes de cet employé.'
            : 'Laissez le matricule vide : le prochain numéro disponible sera attribué automatiquement.'}
        </p>

        {employee && (
          <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
            {([
              { code: 'fiche', label: 'Fiche' },
              { code: 'dossier', label: 'Contrats · Congés · Dettes' },
            ] as const).map((o) => (
              <button
                key={o.code}
                onClick={() => setVue(o.code)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  vue === o.code ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {employee && vue === 'dossier' && (
          <EmployeDetail
            employee={employee}
            entreprise={entreprise}
            onImprimerContrat={(contrat) => onImprimerContrat(contrat, employee)}
          />
        )}

        {employee && vue === 'fiche' && (
          <div className="mb-5">
            <PhotoProfil employee={employee} />
          </div>
        )}

        <div className={`grid gap-4 sm:grid-cols-2 ${employee && vue !== 'fiche' ? 'hidden' : ''}`}>
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
          {field('Situation familiale', (
            <select
              value={form.situation_familiale}
              onChange={(e) => set('situation_familiale')(e.target.value)}
              className={inputCls}
            >
              <option value="">— Non renseignée —</option>
              {SITUATIONS_FAMILIALES.map((sf) => (
                <option key={sf} value={sf}>{sf}</option>
              ))}
            </select>
          ))}
          {SITUATIONS_AVEC_ENFANTS.includes(form.situation_familiale as SituationFamiliale) &&
            field("Nombre d'enfants", (
              <input
                type="number" min="0" max="30" value={form.nombre_enfants}
                onChange={(e) => set('nombre_enfants')(e.target.value)} className={inputCls}
              />
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
          {field('Gardes travaillées', (
            <input type="number" min="0" step="0.5" value={form.jours_travailles} onChange={(e) => set('jours_travailles')(e.target.value)} className={inputCls} />
          ))}

          <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700">Paie & banque</p>
          </div>
          {field('Salaire mensuel (DH)', (
            <input type="number" min="0" step="0.01" value={form.salaire} onChange={(e) => set('salaire')(e.target.value)} className={inputCls} placeholder="ex. 3000" />
          ))}
          {field('Heures par jour', (
            <input type="number" min="0" step="0.5" value={form.heures_par_jour} onChange={(e) => set('heures_par_jour')(e.target.value)} className={inputCls} placeholder="ex. 8" />
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

        {save.error && (!employee || vue === 'fiche') && (
          <div className="mt-4">
            <ErrorNote>Enregistrement impossible : {save.error.message}</ErrorNote>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {employee && vue === 'fiche' && (
            <SupprimerEmploye employee={employee} onDeleted={onClose} />
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            {employee && vue === 'dossier' ? 'Fermer' : 'Annuler'}
          </button>
          {(!employee || vue === 'fiche') && (
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {save.isPending ? 'Enregistrement…' : employee ? 'Enregistrer' : 'Ajouter'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface ApercuSuppression {
  nom_prenom: string
  pointages: number
  photos: number
  contrats: number
  conges: number
  documents: number
  dette_restante: number
  lignes_paie: number
  mois_de_paie: string[]
  supprimable: boolean
}

/**
 * Suppression d'un employé. On montre d'abord exactement ce qui serait
 * effacé : tout est en cascade, donc la décision doit être éclairée.
 * Un employé déjà passé en paie n'est pas supprimable — on le marque « Sorti ».
 */
function SupprimerEmploye({
  employee,
  onDeleted,
}: {
  employee: Employee
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  const [ouvert, setOuvert] = useState(false)

  const { data: apercu, isLoading } = useQuery({
    queryKey: ['apercu-suppression', employee.id],
    enabled: ouvert,
    queryFn: async (): Promise<ApercuSuppression> => {
      const { data, error } = await supabase.rpc('apercu_suppression_employe', {
        p_employee_id: employee.id,
      })
      if (error) throw error
      return data as ApercuSuppression
    },
  })

  const supprimer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('supprimer_employe', { p_employee_id: employee.id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['site-employees'] })
      queryClient.invalidateQueries({ queryKey: ['employe-filtres'] })
      onDeleted()
    },
  })

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Supprimer
      </button>
    )
  }

  return (
    <div className="mr-auto w-full rounded-xl border border-red-200 bg-red-50 p-3">
      {isLoading && <p className="text-sm text-red-800">Vérification…</p>}

      {apercu && !apercu.supprimable && (
        <>
          <p className="text-sm font-semibold text-red-900">Suppression impossible</p>
          <p className="mt-1 text-sm text-red-800">
            {apercu.nom_prenom} figure dans {apercu.lignes_paie} bulletin(s) de paie
            {apercu.mois_de_paie.length > 0 && ` (${apercu.mois_de_paie.join(', ')})`}. Le
            supprimer effacerait cet historique de paie. Passez son statut à{' '}
            <strong>« Sorti »</strong> : il quitte les listes sans rien perdre.
          </p>
        </>
      )}

      {apercu && apercu.supprimable && (
        <>
          <p className="text-sm font-semibold text-red-900">
            Supprimer définitivement {apercu.nom_prenom} ?
          </p>
          <p className="mt-1 text-sm text-red-800">Seront effacés en même temps :</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-red-800">
            <li>{apercu.pointages} pointage(s){apercu.photos > 0 && `, dont ${apercu.photos} avec photo`}</li>
            <li>{apercu.contrats} contrat(s)</li>
            <li>{apercu.conges} congé(s)</li>
            <li>{apercu.documents} document(s) signé(s)</li>
            {Number(apercu.dette_restante) > 0 && (
              <li>
                une dette de <strong>{formatDH(apercu.dette_restante)}</strong> encore due
              </li>
            )}
          </ul>
          <p className="mt-2 text-sm text-red-800">
            Si cet employé a réellement travaillé, préférez le statut <strong>« Sorti »</strong>.
          </p>
        </>
      )}

      {supprimer.error && (
        <div className="mt-2">
          <ErrorNote>{supprimer.error.message}</ErrorNote>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setOuvert(false)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Annuler
        </button>
        {apercu?.supprimable && (
          <button
            onClick={() => supprimer.mutate()}
            disabled={supprimer.isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {supprimer.isPending ? 'Suppression…' : 'Oui, supprimer définitivement'}
          </button>
        )}
      </div>
    </div>
  )
}
