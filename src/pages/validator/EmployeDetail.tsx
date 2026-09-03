import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { addDays, dateToIso, formatDateFr, todayIso } from '../../lib/dates'
import {
  formatDH,
  useCongesEmploye,
  useContratsEmploye,
  useCreerConge,
  useSupprimerConge,
} from '../../lib/paie'
import { TYPES_CONTRAT, contratAffichage, contratStatut, joursRestants } from '../../lib/contrats'
import { TYPES_ABSENCE, gardeLabel } from '../../lib/gardes'
import type { Conge, Contrat, Employee, TypeContrat } from '../../lib/types'
import { Chip, ErrorNote, Spinner } from '../../components/ui'
import DocumentsSignes from '../../components/DocumentsSignes'
import EngagementConge from '../../components/EngagementConge'
import PanneauDocument from '../../components/PanneauDocument'
import { jetonsDuModele, modeleContrat } from '../../lib/contratsModeles'
import { modeleEngagement } from '../../lib/engagementConge'
import { champsASaisir, dateDoc, valeursEmploye } from '../../lib/champsDocument'
import { useSites } from '../../lib/queries'
import { useDocuments } from '../../lib/documents'

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

type Onglet = 'contrats' | 'conges' | 'dette'

/** Panneau « Contrats · Congés · Dettes » d'un employé. */
export default function EmployeDetail({
  employee,
  entreprise,
  onImprimerContrat,
}: {
  employee: Employee
  entreprise: string
  onImprimerContrat: (contrat: Contrat) => void
}) {
  const [onglet, setOnglet] = useState<Onglet>('contrats')

  const onglets: { code: Onglet; label: string }[] = [
    { code: 'contrats', label: 'Contrats' },
    { code: 'conges', label: 'Congés & absences' },
    { code: 'dette', label: 'Dette' },
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
        <ContratsPanel employee={employee} entreprise={entreprise} onImprimer={onImprimerContrat} />
      )}
      {onglet === 'conges' && <CongesPanel employee={employee} entreprise={entreprise} />}
      {onglet === 'dette' && <DettePanel employee={employee} />}
    </div>
  )
}

// ------------------------------------------------------------- Contrats -----

function ContratsPanel({
  employee,
  entreprise,
  onImprimer,
}: {
  employee: Employee
  entreprise: string
  onImprimer: (c: Contrat) => void
}) {
  const { data: contrats, isLoading } = useContratsEmploye(employee.id)
  const [nouveau, setNouveau] = useState(false)
  const [edite, setEdite] = useState<Contrat | null>(null)
  // Renouvellement : le formulaire est prérempli avec l'ancien contrat,
  // dates déjà avancées. Il ne reste qu'à ajuster la fin et le salaire.
  const [renouvele, setRenouvele] = useState<Contrat | null>(null)

  if (isLoading) return <Spinner label="Chargement des contrats…" />

  return (
    <div>
      {(nouveau || edite || renouvele) && (
        <ContratForm
          employee={employee}
          entreprise={entreprise}
          contrat={edite}
          renouvelle={renouvele}
          onClose={() => {
            setNouveau(false)
            setEdite(null)
            setRenouvele(null)
          }}
        />
      )}

      {!nouveau && !edite && !renouvele && (
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
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {!c.archive && (
                        <button
                          onClick={() => setRenouvele(c)}
                          title="Repart de ce contrat : dates avancées, il ne reste que la fin et le salaire à ajuster"
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            statut === 'bientot' || statut === 'termine'
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Renouveler
                        </button>
                      )}
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

                  {/* Circuit : imprimer → signer → légaliser → scanner → joindre */}
                  <div className="mt-3">
                    <DocumentsSignes
                      companyId={employee.company_id}
                      employeeId={employee.id}
                      type="contrat"
                      contratId={c.id}
                      intitule="le contrat signé et légalisé"
                      aide="Imprimez le contrat, faites-le signer et légaliser, puis déposez le scan ici."
                    />
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

/** Le jour suivant une date ISO. Calcul en dates locales : toISOString()
 *  ferait reculer d'un jour au Maroc (UTC+1). */
function lendemain(iso: string): string {
  return dateToIso(addDays(new Date(iso + 'T00:00:00'), 1))
}

/** La veille du même jour, un an plus tard. */
function unAnApres(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  d.setFullYear(d.getFullYear() + 1)
  return dateToIso(addDays(d, -1))
}

function ContratForm({
  employee,
  entreprise,
  contrat,
  renouvelle,
  onClose,
}: {
  employee: Employee
  entreprise: string
  contrat: Contrat | null
  renouvelle?: Contrat | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const modele = modeleContrat(entreprise)
  // Le lieu de travail se choisit parmi les annexes de la société : on ne
  // demande à personne de retenir quatre-vingt-douze noms de sites.
  const { data: sites } = useSites(employee.company_id)
  // Un renouvellement reprend tout l'ancien contrat, mais enchaîne les dates :
  // début = lendemain de l'ancienne fin, fin = un an plus tard.
  const base = contrat ?? renouvelle ?? null
  const debutRenouv =
    renouvelle?.date_fin ? lendemain(renouvelle.date_fin) : todayIso()
  const [f, setF] = useState({
    type_contrat: (base?.type_contrat ?? 'CDI') as TypeContrat,
    date_debut: renouvelle ? debutRenouv : (contrat?.date_debut ?? employee.date_embauche ?? todayIso()),
    date_fin: renouvelle
      ? (renouvelle.date_fin ? unAnApres(debutRenouv) : '')
      : (contrat?.date_fin ?? ''),
    periode_essai_jours: renouvelle ? '0' : (base?.periode_essai_jours?.toString() ?? '90'),
    poste: base?.poste ?? employee.qualification ?? '',
    lieu_travail: base?.lieu_travail ?? '',
    salaire_mensuel: base?.salaire_mensuel?.toString() ?? employee.salaire?.toString() ?? '',
    heures_par_jour: base?.heures_par_jour?.toString() ?? employee.heures_par_jour?.toString() ?? '8',
    mode_reglement: base?.mode_reglement ?? employee.mode_reglement ?? '',
    signe_a: base?.signe_a ?? employee.ville ?? '',
    signe_le: renouvelle ? todayIso() : (contrat?.signe_le ?? todayIso()),
    representant_employeur: base?.representant_employeur ?? '',
    observations: base?.observations ?? '',
    archive: contrat?.archive ?? false,
  })
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((p) => ({ ...p, [k]: v }))

  // Les mentions du document que le formulaire ne couvre pas : le numéro du
  // marché, la durée en toutes lettres… On les conserve avec le contrat,
  // faute de quoi une réimpression donnerait un autre document.
  const [docLibre, setDocLibre] = useState<Record<string, string>>(() => ({
    ...(modeleContrat(entreprise)?.defauts ?? {}),
    ...((contrat?.champs_document ?? renouvelle?.champs_document ?? {}) as Record<string, string>),
  }))

  // Ce que le formulaire alimente tout seul sur le document.
  // Sur un contrat en arabe, le nom, le domicile et le lieu de signature
  // ne peuvent PAS venir du formulaire : le registre les écrit en
  // caractères latins et la pièce se rédige en arabe. Ils rejoignent donc
  // les mentions à saisir, au lieu de rester en pointillés pour toujours.
  const enArabe = modele?.langue === 'ar'
  const COUVERTS = enArabe
    ? ['cin', 'naissance', 'debut', 'fin', 'salaire', 'fonction', 'fait_le']
    : ['nom', 'cin', 'naissance', 'adresse', 'debut', 'fin',
       'salaire', 'fonction', 'fait_a', 'fait_le']

  const valeursDoc: Record<string, string> = {
    ...(modele?.defauts ?? {}),
    ...valeursEmploye(employee, modele),
    debut: dateDoc(f.date_debut),
    fin: dateDoc(f.date_fin),
    salaire: f.salaire_mensuel,
    fonction: f.poste,
    fait_le: dateDoc(f.signe_le),
    ...(enArabe ? {} : { fait_a: f.signe_a }),
    ...docLibre,
  }
  const aSaisir = champsASaisir(modele, COUVERTS)

  // Le contrat de BO ne parle ni de période d'essai ni de mode de règlement :
  // ces champs existent au registre mais ne s'impriment pas. On le dit, plutôt
  // que de laisser chercher pourquoi « rien ne change quand je tape ».
  const jetons = jetonsDuModele(modele)
  const surLePapier = (jeton: string) => jetons.has(jeton)
  const marque = (label: string, jeton: string) =>
    surLePapier(jeton) ? label : `${label} ⋯`

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
        champs_document: docLibre,
      }
      if (contrat) {
        const { error } = await supabase.from('contrats').update(payload).eq('id', contrat.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('contrats').insert(payload)
        if (error) throw error
        // Renouvellement : l'ancien contrat passe en archive, il ne déclenche
        // plus d'alerte de fin, mais reste consultable dans l'historique.
        if (renouvelle) {
          const { error: e2 } = await supabase
            .from('contrats').update({ archive: true }).eq('id', renouvelle.id)
          if (e2) throw e2
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contrats', employee.id] })
      qc.invalidateQueries({ queryKey: ['contrats-courants'] })
      onClose()
    },
  })

  return (
    <PanneauDocument
      modele={modele}
      valeurs={valeursDoc}
      enTete={
        <>
          <p className="mb-4 text-sm font-semibold text-slate-900">
            {contrat
              ? `Modifier le contrat ${contrat.numero ?? ''}`
              : renouvelle
                ? `Renouveler le contrat ${renouvelle.numero ?? ''}`
                : 'Nouveau contrat'}
          </p>
          {renouvelle && (
            <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Tout est repris de l’ancien contrat. Vérifiez la <strong>date de fin</strong> et le
              <strong> salaire</strong>, puis enregistrez : l’ancien contrat sera archivé
              automatiquement.
            </p>
          )}
          {modele?.langue === 'ar' && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Le contrat de cette société est <strong>en arabe</strong> : les mentions
              du document se saisissent en arabe, plus bas. Les dates, le C.I.N. et
              les montants restent en chiffres et lettres latins.
            </p>
          )}
        </>
      }
      actions={
        <>
          {save.error && (
            <div className="w-full">
              <ErrorNote>{save.error.message}</ErrorNote>
            </div>
          )}
          {contrat && <SupprimerContrat contrat={contrat} onDeleted={onClose} />}
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            Annuler
          </button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        Les champs suivis de <span className="text-slate-400">⋯</span> restent au
        registre : ce modèle de contrat ne les imprime pas.
      </p>

      <Section titre="L’engagement">
      <div className="grid gap-3 sm:grid-cols-2">
        {field('Type de contrat', (
          <select value={f.type_contrat} onChange={(e) => set('type_contrat')(e.target.value)} className={inputCls}>
            {TYPES_CONTRAT.map((t) => (
              <option key={t.code} value={t.code}>{t.label}</option>
            ))}
          </select>
        ))}
        {field(marque('Poste / fonction', 'fonction'), (
          <input type="text" value={f.poste} onChange={(e) => set('poste')(e.target.value)} className={inputCls} />
        ))}
        {/* Calendrier natif : plus sûr que la saisie au clavier, et déjà
            ce que fait le formulaire des congés. */}
        {field(marque('Date de début *', 'debut'), (
          <input type="date" value={f.date_debut}
                 onChange={(e) => set('date_debut')(e.target.value)} className={inputCls} />
        ))}
        {field(
          marque(f.type_contrat === 'CDI' ? 'Date de fin (vide = indéterminée)' : 'Date de fin *', 'fin'),
          <input type="date" value={f.date_fin} min={f.date_debut || undefined}
                 onChange={(e) => set('date_fin')(e.target.value)} className={inputCls} />,
        )}
        {field("Période d'essai (jours)" + ' ⋯', (
          <input type="number" min="0" value={f.periode_essai_jours}
                 onChange={(e) => set('periode_essai_jours')(e.target.value)} className={inputCls} />
        ))}
        {field('Lieu de travail' + ' ⋯', (
          <select value={f.lieu_travail} onChange={(e) => set('lieu_travail')(e.target.value)}
                  className={inputCls}>
            <option value="">— Annexe de la société —</option>
            {(sites ?? []).map((si) => (
              <option key={si.id} value={si.name}>{si.name}</option>
            ))}
            {/* Un contrat plus ancien peut porter un lieu qui n'est plus une
                annexe : on le garde plutôt que de l'effacer en silence. */}
            {f.lieu_travail && !(sites ?? []).some((si) => si.name === f.lieu_travail) && (
              <option value={f.lieu_travail}>{f.lieu_travail}</option>
            )}
          </select>
        ))}
      </div>
      </Section>

      <Section titre="La rémunération">
      <div className="grid gap-3 sm:grid-cols-2">
        {field(marque('Salaire mensuel (DH)', 'salaire'), (
          <input type="number" min="0" step="0.01" value={f.salaire_mensuel}
                 onChange={(e) => set('salaire_mensuel')(e.target.value)} className={inputCls} />
        ))}
        {field('Heures par jour' + ' ⋯', (
          <input type="number" min="0" step="0.5" value={f.heures_par_jour}
                 onChange={(e) => set('heures_par_jour')(e.target.value)} className={inputCls} />
        ))}
        {field('Mode de règlement' + ' ⋯', (
          <input type="text" value={f.mode_reglement} onChange={(e) => set('mode_reglement')(e.target.value)}
                 className={inputCls} placeholder="Virement / Espèce" />
        ))}
      </div>
      </Section>

      <Section titre="La signature">
      <div className="grid gap-3 sm:grid-cols-2">
        {field('Représentant de l’employeur' + ' ⋯', (
          <input type="text" value={f.representant_employeur}
                 onChange={(e) => set('representant_employeur')(e.target.value)} className={inputCls} />
        ))}
        {field(marque('Fait à', 'fait_a'), (
          <input type="text" value={f.signe_a} onChange={(e) => set('signe_a')(e.target.value)} className={inputCls} />
        ))}
        {field(marque('Fait le', 'fait_le'), (
          <input type="date" value={f.signe_le}
                 onChange={(e) => set('signe_le')(e.target.value)} className={inputCls} />
        ))}
        <div className="sm:col-span-2">
          {field('Observations (usage interne, ne s’imprime pas)', (
            <textarea value={f.observations} onChange={(e) => set('observations')(e.target.value)}
                      rows={2} className={inputCls} />
          ))}
        </div>
        {contrat && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={f.archive} onChange={(e) => set('archive')(e.target.checked)}
                   className="h-4 w-4 rounded border-slate-300" />
            Archiver ce contrat (plus d’alerte de fin)
          </label>
        )}
      </div>
      </Section>

      {aSaisir.length > 0 && (
        <Section
          titre="Ce qui ne figure que sur le contrat"
          aide={enArabe
            ? 'À saisir en arabe. Ces mentions n’existent nulle part ailleurs en base.'
            : 'Ces mentions n’existent nulle part ailleurs en base.'}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {aSaisir.map((c) => (
              <div key={c.id}>
                {field(c.label, (
                  c.type === 'long' ? (
                    <textarea
                      dir="auto" rows={2} value={docLibre[c.id] ?? ''}
                      onChange={(e) => setDocLibre((p) => ({ ...p, [c.id]: e.target.value }))}
                      className={inputCls}
                    />
                  ) : (
                    <input
                      dir="auto"
                      type={c.type === 'nombre' ? 'number' : 'text'}
                      value={docLibre[c.id] ?? ''}
                      onChange={(e) => setDocLibre((p) => ({ ...p, [c.id]: e.target.value }))}
                      className={inputCls}
                    />
                  )
                ))}
                {c.aide && <p className="mt-1 text-xs text-slate-400">{c.aide}</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Un champ vide s’imprime en pointillés, comme sur le formulaire papier.
          </p>
        </Section>
      )}
    </PanneauDocument>
  )
}

/** Un groupe de champs, avec son intitulé — plutôt qu'une grille de douze
 *  cases où rien ne dit ce qui va ensemble. */
function Section({
  titre, aide, children,
}: { titre: string; aide?: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 [&+&]:mt-4">
      <p className="text-sm font-semibold text-slate-900">{titre}</p>
      {aide && <p className="mt-0.5 mb-3 text-xs text-slate-500">{aide}</p>}
      <div className={aide ? '' : 'mt-3'}>{children}</div>
    </div>
  )
}

/**
 * Suppression d'un contrat. Les pièces signées qui lui sont rattachées
 * partent avec lui (cascade) : on le dit avant, pas après.
 */
function SupprimerContrat({
  contrat,
  onDeleted,
}: {
  contrat: Contrat
  onDeleted: () => void
}) {
  const qc = useQueryClient()
  const [ouvert, setOuvert] = useState(false)
  const { data: docs } = useDocuments({ contratId: contrat.id })

  const supprimer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('contrats').delete().eq('id', contrat.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contrats'] })
      qc.invalidateQueries({ queryKey: ['contrats-courants'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
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
      <p className="text-sm font-semibold text-red-900">
        Supprimer le contrat {contrat.numero ?? ''} ?
      </p>
      <p className="mt-1 text-sm text-red-800">
        {docs && docs.length > 0
          ? `Ses ${docs.length} document(s) signé(s) seront effacés en même temps.`
          : 'Aucun document signé n’y est rattaché.'}
        {' '}Pour garder la trace d’un ancien contrat, préférez l’archiver.
      </p>
      {supprimer.error && (
        <div className="mt-2">
          <ErrorNote>{supprimer.error.message}</ErrorNote>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setOuvert(false)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
        >
          Annuler
        </button>
        <button
          onClick={() => supprimer.mutate()}
          disabled={supprimer.isPending}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {supprimer.isPending ? 'Suppression…' : 'Oui, supprimer'}
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------- Congés -----

function CongesPanel({
  employee,
  entreprise,
}: {
  employee: Employee
  entreprise: string
}) {
  const { data: conges, isLoading } = useCongesEmploye(employee.id)
  const creer = useCreerConge(employee.id)
  const supprimer = useSupprimerConge(employee.id)
  const [f, setF] = useState({ debut: '', fin: '', type: 'C', motif: '' })
  const [engagement, setEngagement] = useState<Conge | null>(null)

  // L'engagement se remplit ICI, en même temps que le congé : ce sont les
  // dates saisies sur ce formulaire qui alimentent le document, et le
  // document qui se compose sous les yeux pendant la saisie.
  const modele = useMemo(() => modeleEngagement(entreprise), [entreprise])
  const [docLibre, setDocLibre] = useState<Record<string, string>>(
    () => ({ ...(modeleEngagement(entreprise).defauts ?? {}) }),
  )

  const jours = f.debut && f.fin && f.fin >= f.debut
    ? Math.round((new Date(f.fin + 'T00:00:00').getTime()
                - new Date(f.debut + 'T00:00:00').getTime()) / 86400000) + 1
    : 0

  const COUVERTS = ['cin', 'naissance', 'debut', 'fin', 'annee', 'duree']
  const valeursDoc: Record<string, string> = {
    ...(modele.defauts ?? {}),
    ...valeursEmploye(employee, modele),
    debut: dateDoc(f.debut),
    fin: dateDoc(f.fin),
    annee: f.debut ? f.debut.slice(0, 4) : '',
    duree: jours > 0 ? `${jours} يوما` : '',
    ...docLibre,
  }
  const aSaisir = champsASaisir(modele, COUVERTS)

  if (isLoading) return <Spinner label="Chargement des congés…" />

  return (
    <div>
      <div className="mb-4">
      <PanneauDocument
        modele={modele}
        valeurs={valeursDoc}
        enTete={
          <>
            <p className="mb-1 text-sm font-semibold text-slate-900">
              Enregistrer un congé / une absence
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Les dates saisies ici composent l’engagement à droite, et sont
              écrites dans le pointage à l’enregistrement.
            </p>
          </>
        }
        actions={
          <>
            {creer.error && (
              <div className="w-full">
                <ErrorNote>{creer.error.message}</ErrorNote>
              </div>
            )}
            <button
              onClick={() =>
                creer.mutate(
                  { ...f, champsDocument: docLibre },
                  {
                    onSuccess: () => {
                      setF({ debut: '', fin: '', type: 'C', motif: '' })
                      setDocLibre({ ...(modele.defauts ?? {}) })
                    },
                  },
                )
              }
              disabled={creer.isPending || !f.debut || !f.fin}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {creer.isPending ? 'Enregistrement…' : 'Enregistrer le congé'}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Calendrier natif : plus rapide que la saisie au clavier */}
          {field('Du *', (
            <input
              type="date" value={f.debut}
              onChange={(e) => setF((p) => ({ ...p, debut: e.target.value }))}
              className={inputCls}
            />
          ))}
          {field('Au *', (
            <input
              type="date" value={f.fin} min={f.debut || undefined}
              onChange={(e) => setF((p) => ({ ...p, fin: e.target.value }))}
              className={inputCls}
            />
          ))}
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
          l’employé n’est pas décompté. Un employé peut cumuler plusieurs congés, à condition
          qu’ils ne se chevauchent pas.
        </p>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-1 text-sm font-semibold text-slate-900">
            Mentions de l’engagement signé
          </p>
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            L’engagement est <strong>en arabe</strong> : basculez le clavier. Le champ
            s’oriente tout seul. Le C.I.N. et les dates restent en caractères latins.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {aSaisir.map((c) => (
              <div key={c.id}>
                {field(c.label, (
                  c.type === 'long' ? (
                    <textarea
                      dir="auto" rows={2} value={docLibre[c.id] ?? ''}
                      onChange={(e) => setDocLibre((p) => ({ ...p, [c.id]: e.target.value }))}
                      className={inputCls}
                    />
                  ) : (
                    <input
                      dir="auto" type="text" value={docLibre[c.id] ?? ''}
                      onChange={(e) => setDocLibre((p) => ({ ...p, [c.id]: e.target.value }))}
                      className={inputCls}
                    />
                  )
                ))}
                {c.aide && <p className="mt-1 text-xs text-slate-400">{c.aide}</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Un champ vide s’imprime en pointillés, comme sur le formulaire papier.
          </p>
        </div>
      </PanneauDocument>
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
          <li key={c.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
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
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <button
                  onClick={() => setEngagement(c)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Imprimer / PDF
                </button>
                <button
                  onClick={() => supprimer.mutate(c.id)}
                  disabled={supprimer.isPending}
                  className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </div>
            </div>

            {/* Circuit : imprimer → faire signer → scanner → joindre */}
            <div className="mt-3">
              <DocumentsSignes
                companyId={employee.company_id}
                employeeId={employee.id}
                type="engagement"
                congeId={c.id}
                intitule="l’engagement signé"
                aide="Imprimez l’engagement, faites-le signer, puis déposez le scan ici."
              />
            </div>
          </li>
        ))}
      </ul>

      {engagement && (
        <EngagementConge
          conge={engagement}
          employee={employee}
          entreprise={entreprise}
          onClose={() => setEngagement(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Dette -----

/**
 * Un seul montant : ce que l'employé doit encore.
 *
 * Le remboursement se pilote depuis la paie — on y saisit ce qu'on retient
 * sur le mois, et à la validation ce solde baisse d'autant.
 */
function DettePanel({ employee }: { employee: Employee }) {
  const qc = useQueryClient()
  const [montant, setMontant] = useState(String(employee.dette ?? 0))

  const enregistrer = useMutation({
    mutationFn: async () => {
      const v = Number(montant)
      if (!Number.isFinite(v) || v < 0) throw new Error('Le montant doit être positif ou nul.')
      const { error } = await supabase
        .from('employees').update({ dette: v }).eq('id', employee.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['dettes'] })
    },
  })

  const modifie = Number(montant) !== Number(employee.dette ?? 0)

  return (
    <div>
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="mb-1 text-sm font-semibold text-slate-900">Dette de l’employé</p>
        <p className="mb-4 text-sm text-slate-600">
          Ce que {employee.nom_prenom} doit encore. Vous n’avez rien à déduire ici : dans
          l’onglet <strong>Paie</strong>, vous saisissez le montant retenu sur le mois, et à la
          validation ce solde baisse d’autant.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Montant dû (DH)</span>
            <input
              type="number" min="0" step="0.01" value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className={`${inputCls} w-44 tabular-nums`}
            />
          </label>
          <button
            onClick={() => enregistrer.mutate()}
            disabled={enregistrer.isPending || !modifie}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {enregistrer.isSuccess && !modifie && (
            <span className="text-sm text-emerald-700">Enregistré ✓</span>
          )}
        </div>

        {enregistrer.error && (
          <div className="mt-3">
            <ErrorNote>{enregistrer.error.message}</ErrorNote>
          </div>
        )}
      </div>

      {Number(employee.dette ?? 0) > 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Solde actuel : <strong>{formatDH(employee.dette)}</strong>. Il apparaîtra en rappel sous
          la colonne « Dette » de la paie.
        </p>
      )}
    </div>
  )
}
