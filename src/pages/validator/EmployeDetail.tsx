import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatDateFr, todayIso } from '../../lib/dates'
import {
  formatDH,
  useCongesEmploye,
  useContratsEmploye,
  useCreerConge,
  useDettesEmploye,
  useSupprimerConge,
} from '../../lib/paie'
import { TYPES_CONTRAT, contratAffichage, contratStatut, joursRestants } from '../../lib/contrats'
import { TYPES_ABSENCE, gardeLabel } from '../../lib/gardes'
import type { Contrat, Employee, TypeContrat } from '../../lib/types'
import { Chip, DateInputFr, ErrorNote, Spinner } from '../../components/ui'

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

function field(label: string, input: ReactNode) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {input}
    </label>
  )
}

type Onglet = 'contrats' | 'conges' | 'dettes'

/** Panneau « Contrats · Congés · Dettes » d'un employé. */
export default function EmployeDetail({
  employee,
  onImprimerContrat,
}: {
  employee: Employee
  onImprimerContrat: (contrat: Contrat) => void
}) {
  const [onglet, setOnglet] = useState<Onglet>('contrats')

  const onglets: { code: Onglet; label: string }[] = [
    { code: 'contrats', label: 'Contrats' },
    { code: 'conges', label: 'Congés & absences' },
    { code: 'dettes', label: 'Dettes / avances' },
  ]

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {onglets.map((o) => (
          <button
            key={o.code}
            onClick={() => setOnglet(o.code)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              onglet === o.code ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'contrats' && (
        <ContratsPanel employee={employee} onImprimer={onImprimerContrat} />
      )}
      {onglet === 'conges' && <CongesPanel employee={employee} />}
      {onglet === 'dettes' && <DettesPanel employee={employee} />}
    </div>
  )
}

// ------------------------------------------------------------- Contrats -----

function ContratsPanel({
  employee,
  onImprimer,
}: {
  employee: Employee
  onImprimer: (c: Contrat) => void
}) {
  const { data: contrats, isLoading } = useContratsEmploye(employee.id)
  const [nouveau, setNouveau] = useState(false)
  const [edite, setEdite] = useState<Contrat | null>(null)

  if (isLoading) return <Spinner label="Chargement des contrats…" />

  return (
    <div>
      {(nouveau || edite) && (
        <ContratForm
          employee={employee}
          contrat={edite}
          onClose={() => {
            setNouveau(false)
            setEdite(null)
          }}
        />
      )}

      {!nouveau && !edite && (
        <>
          <div className="mb-3 flex justify-end">
            <button
              onClick={() => setNouveau(true)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              + Nouveau contrat
            </button>
          </div>

          {contrats?.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">
              Aucun contrat enregistré pour cet employé.
            </p>
          )}

          <ul className="space-y-2">
            {contrats?.map((c) => {
              const statut = contratStatut(c.date_debut, c.date_fin)
              const aff = contratAffichage(statut, joursRestants(c.date_fin))
              return (
                <li
                  key={c.id}
                  className={`rounded-xl border border-slate-200 p-3 ${c.archive ? 'opacity-50' : aff?.ligne ?? ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                        {c.type_contrat}
                        <span className="font-mono text-xs text-slate-500">{c.numero}</span>
                        {c.archive ? (
                          <Chip tone="slate">Archivé</Chip>
                        ) : (
                          aff && <Chip tone={aff.chip}>{aff.label}</Chip>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Du {formatDateFr(c.date_debut)} au{' '}
                        {c.date_fin ? formatDateFr(c.date_fin) : 'durée indéterminée'}
                        {c.poste ? ` · ${c.poste}` : ''}
                        {c.salaire_mensuel != null ? ` · ${formatDH(c.salaire_mensuel)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => onImprimer(c)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Imprimer / PDF
                      </button>
                      <button
                        onClick={() => setEdite(c)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Modifier
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function ContratForm({
  employee,
  contrat,
  onClose,
}: {
  employee: Employee
  contrat: Contrat | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [f, setF] = useState({
    type_contrat: (contrat?.type_contrat ?? 'CDI') as TypeContrat,
    date_debut: contrat?.date_debut ?? employee.date_embauche ?? todayIso(),
    date_fin: contrat?.date_fin ?? '',
    periode_essai_jours: contrat?.periode_essai_jours?.toString() ?? '90',
    poste: contrat?.poste ?? employee.qualification ?? '',
    lieu_travail: contrat?.lieu_travail ?? '',
    salaire_mensuel: contrat?.salaire_mensuel?.toString() ?? employee.salaire?.toString() ?? '',
    heures_par_jour: contrat?.heures_par_jour?.toString() ?? employee.heures_par_jour?.toString() ?? '8',
    mode_reglement: contrat?.mode_reglement ?? employee.mode_reglement ?? '',
    signe_a: contrat?.signe_a ?? employee.ville ?? '',
    signe_le: contrat?.signe_le ?? todayIso(),
    representant_employeur: contrat?.representant_employeur ?? '',
    observations: contrat?.observations ?? '',
    archive: contrat?.archive ?? false,
  })
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((p) => ({ ...p, [k]: v }))

  const save = useMutation({
    mutationFn: async () => {
      if (!f.date_debut) throw new Error('La date de début est obligatoire.')
      if (f.type_contrat !== 'CDI' && !f.date_fin) {
        throw new Error('Un contrat à durée déterminée doit avoir une date de fin.')
      }
      const payload = {
        company_id: employee.company_id,
        employee_id: employee.id,
        type_contrat: f.type_contrat,
        date_debut: f.date_debut,
        date_fin: f.date_fin || null,
        periode_essai_jours: f.periode_essai_jours ? Number(f.periode_essai_jours) : 0,
        poste: f.poste.trim() || null,
        lieu_travail: f.lieu_travail.trim() || null,
        salaire_mensuel: f.salaire_mensuel.trim() ? Number(f.salaire_mensuel) : null,
        heures_par_jour: f.heures_par_jour.trim() ? Number(f.heures_par_jour) : null,
        mode_reglement: f.mode_reglement || null,
        signe_a: f.signe_a.trim() || null,
        signe_le: f.signe_le || null,
        representant_employeur: f.representant_employeur.trim() || null,
        observations: f.observations.trim() || null,
        archive: f.archive,
      }
      if (contrat) {
        const { error } = await supabase.from('contrats').update(payload).eq('id', contrat.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('contrats').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contrats', employee.id] })
      qc.invalidateQueries({ queryKey: ['contrats-courants'] })
      onClose()
    },
  })

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="mb-4 text-sm font-semibold text-slate-900">
        {contrat ? `Modifier le contrat ${contrat.numero ?? ''}` : 'Nouveau contrat'}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {field('Type de contrat', (
          <select value={f.type_contrat} onChange={(e) => set('type_contrat')(e.target.value)} className={inputCls}>
            {TYPES_CONTRAT.map((t) => (
              <option key={t.code} value={t.code}>{t.label}</option>
            ))}
          </select>
        ))}
        {field('Poste / fonction', (
          <input type="text" value={f.poste} onChange={(e) => set('poste')(e.target.value)} className={inputCls} />
        ))}
        {field('Date de début *', (
          <DateInputFr value={f.date_debut} onChange={set('date_debut')} className={inputCls} />
        ))}
        {field(
          f.type_contrat === 'CDI' ? 'Date de fin (vide = indéterminée)' : 'Date de fin *',
          <DateInputFr value={f.date_fin} onChange={set('date_fin')} className={inputCls} />,
        )}
        {field("Période d'essai (jours)", (
          <input type="number" min="0" value={f.periode_essai_jours}
                 onChange={(e) => set('periode_essai_jours')(e.target.value)} className={inputCls} />
        ))}
        {field('Lieu de travail', (
          <input type="text" value={f.lieu_travail} onChange={(e) => set('lieu_travail')(e.target.value)}
                 className={inputCls} placeholder="Site / adresse" />
        ))}
        {field('Salaire mensuel (DH)', (
          <input type="number" min="0" step="0.01" value={f.salaire_mensuel}
                 onChange={(e) => set('salaire_mensuel')(e.target.value)} className={inputCls} />
        ))}
        {field('Heures par jour', (
          <input type="number" min="0" step="0.5" value={f.heures_par_jour}
                 onChange={(e) => set('heures_par_jour')(e.target.value)} className={inputCls} />
        ))}
        {field('Mode de règlement', (
          <input type="text" value={f.mode_reglement} onChange={(e) => set('mode_reglement')(e.target.value)}
                 className={inputCls} placeholder="Virement / Espèce" />
        ))}
        {field('Représentant de l’employeur', (
          <input type="text" value={f.representant_employeur}
                 onChange={(e) => set('representant_employeur')(e.target.value)} className={inputCls} />
        ))}
        {field('Fait à', (
          <input type="text" value={f.signe_a} onChange={(e) => set('signe_a')(e.target.value)} className={inputCls} />
        ))}
        {field('Fait le', (
          <DateInputFr value={f.signe_le} onChange={set('signe_le')} className={inputCls} />
        ))}
        <div className="sm:col-span-2">
          {field('Observations', (
            <textarea value={f.observations} onChange={(e) => set('observations')(e.target.value)}
                      rows={2} className={inputCls} />
          ))}
        </div>
        {contrat && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.archive} onChange={(e) => set('archive')(e.target.checked)}
                   className="h-4 w-4 rounded border-slate-300" />
            Archiver ce contrat (plus d’alerte de fin)
          </label>
        )}
      </div>

      {save.error && (
        <div className="mt-3">
          <ErrorNote>{save.error.message}</ErrorNote>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Annuler
        </button>
        <button onClick={() => save.mutate()} disabled={save.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------- Congés -----

function CongesPanel({ employee }: { employee: Employee }) {
  const { data: conges, isLoading } = useCongesEmploye(employee.id)
  const creer = useCreerConge(employee.id)
  const supprimer = useSupprimerConge(employee.id)
  const [f, setF] = useState({ debut: '', fin: '', type: 'C', motif: '' })

  if (isLoading) return <Spinner label="Chargement des congés…" />

  return (
    <div>
      <div className="mb-4 rounded-xl border border-slate-200 p-3">
        <p className="mb-3 text-sm font-semibold text-slate-900">Enregistrer un congé / une absence</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('Du *', <DateInputFr value={f.debut} onChange={(v) => setF((p) => ({ ...p, debut: v }))} className={inputCls} />)}
          {field('Au *', <DateInputFr value={f.fin} onChange={(v) => setF((p) => ({ ...p, fin: v }))} className={inputCls} />)}
          {field('Type', (
            <select value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))} className={inputCls}>
              {TYPES_ABSENCE.map((t) => (
                <option key={t.code} value={t.code}>{t.label}</option>
              ))}
            </select>
          ))}
          {field('Motif', (
            <input type="text" value={f.motif} onChange={(e) => setF((p) => ({ ...p, motif: e.target.value }))}
                   className={inputCls} placeholder="facultatif" />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Les jours sont écrits automatiquement dans le pointage. Le jour de repos hebdomadaire de
          l’employé n’est pas décompté.
        </p>
        {creer.error && (
          <div className="mt-3">
            <ErrorNote>{creer.error.message}</ErrorNote>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => creer.mutate(f, { onSuccess: () => setF({ debut: '', fin: '', type: 'C', motif: '' }) })}
            disabled={creer.isPending || !f.debut || !f.fin}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {creer.isPending ? 'Enregistrement…' : 'Enregistrer le congé'}
          </button>
        </div>
      </div>

      {supprimer.error && (
        <div className="mb-3">
          <ErrorNote>{supprimer.error.message}</ErrorNote>
        </div>
      )}

      {conges?.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">Aucun congé enregistré.</p>
      )}

      <ul className="space-y-2">
        {conges?.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {c.jours} jour{c.jours > 1 ? 's' : ''}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                {gardeLabel(c.type)}
                {c.motif ? ` · ${c.motif}` : ''}
              </p>
            </div>
            <button
              onClick={() => supprimer.mutate(c.id)}
              disabled={supprimer.isPending}
              className="shrink-0 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --------------------------------------------------------------- Dettes -----

function DettesPanel({ employee }: { employee: Employee }) {
  const { data: dettes, isLoading } = useDettesEmploye(employee.id)
  const qc = useQueryClient()
  const [f, setF] = useState({ libelle: '', montant: '' })

  const ajouter = useMutation({
    mutationFn: async () => {
      if (!f.libelle.trim()) throw new Error('Indiquez un libellé (ex. « Avance sur salaire »).')
      const montant = Number(f.montant)
      if (!montant || montant <= 0) throw new Error('Le montant doit être supérieur à 0.')
      const { error } = await supabase.from('dettes').insert({
        company_id: employee.company_id,
        employee_id: employee.id,
        libelle: f.libelle.trim(),
        montant_total: montant,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dettes'] })
      setF({ libelle: '', montant: '' })
    },
  })

  const supprimer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dettes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dettes'] }),
  })

  if (isLoading) return <Spinner label="Chargement des dettes…" />

  const reste = (dettes ?? [])
    .filter((d) => !d.soldee)
    .reduce((s, d) => s + (Number(d.montant_total) - Number(d.montant_rembourse)), 0)

  return (
    <div>
      <div className="mb-4 rounded-xl border border-slate-200 p-3">
        <p className="mb-3 text-sm font-semibold text-slate-900">Ajouter une dette / avance</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('Libellé *', (
            <input type="text" value={f.libelle} onChange={(e) => setF((p) => ({ ...p, libelle: e.target.value }))}
                   className={inputCls} placeholder="Avance sur salaire" />
          ))}
          {field('Montant total (DH) *', (
            <input type="number" min="0" step="0.01" value={f.montant}
                   onChange={(e) => setF((p) => ({ ...p, montant: e.target.value }))} className={inputCls} />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Le montant à déduire chaque mois se choisit dans l’onglet <strong>Paie</strong> : vous n’êtes
          pas obligé de tout retenir d’un coup.
        </p>
        {ajouter.error && (
          <div className="mt-3">
            <ErrorNote>{ajouter.error.message}</ErrorNote>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button onClick={() => ajouter.mutate()} disabled={ajouter.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {ajouter.isPending ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </div>

      {reste > 0 && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Reste à rembourser : <strong>{formatDH(reste)}</strong>
        </p>
      )}

      {dettes?.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">Aucune dette enregistrée.</p>
      )}

      <ul className="space-y-2">
        {dettes?.map((d) => {
          const restant = Number(d.montant_total) - Number(d.montant_rembourse)
          return (
            <li key={d.id} className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 ${d.soldee ? 'opacity-60' : ''}`}>
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  {d.libelle}
                  {d.soldee && <Chip tone="green">Soldée</Chip>}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDH(d.montant_total)} · remboursé {formatDH(d.montant_rembourse)} ·{' '}
                  <strong className="text-slate-700">reste {formatDH(restant)}</strong> · créée le{' '}
                  {formatDateFr(d.date_creation)}
                </p>
              </div>
              {Number(d.montant_rembourse) === 0 && (
                <button onClick={() => supprimer.mutate(d.id)} disabled={supprimer.isPending}
                        className="shrink-0 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Supprimer
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
