import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatDateFr, todayIso } from '../../lib/dates'
import { formatDH } from '../../lib/paie'
import { modeleSolde } from '../../lib/soldeToutCompte'
import { champsASaisir, dateDoc, valeursEmploye } from '../../lib/champsDocument'
import {
  useAnnulerSortie, useEnregistrerSortie, useSorties, useValiderSortie, type Sortie,
} from '../../lib/sorties'
import PanneauDocument from '../../components/PanneauDocument'
import { Chip, EmptyState, ErrorNote, Spinner } from '../../components/ui'
import type { Employee } from '../../lib/types'

/**
 * LES SORTIES.
 *
 * Un départ s'annonce deux semaines à l'avance. On prépare ici le reçu
 * pour solde de tout compte, on le fait signer, et ce n'est qu'au dernier
 * jour travaillé qu'on valide. Tant que ce n'est pas validé, la personne
 * reste au registre et continue d'être pointée.
 *
 * Valider ne supprime personne : la fiche garde sa date de sortie, ses
 * pointages et ses bulletins de paie. Elle quitte les listes actives.
 */
export default function SortiesPage() {
  const { companyId } = useParams()
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

  const { data: employes, isLoading } = useQuery({
    queryKey: ['employees-actifs', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', companyId!)
        .eq('actif', true)
        .order('nom_prenom')
      if (error) throw error
      return (data ?? []) as Employee[]
    },
  })

  const { data: sorties } = useSorties(companyId)
  const [choisi, setChoisi] = useState<string>('')

  const enCours = (sorties ?? []).filter((s) => !s.valide)
  const validees = (sorties ?? []).filter((s) => s.valide)
  const employe = (employes ?? []).find((e) => e.id === choisi) ?? null
  const sortieDeLEmploye = enCours.find((s) => s.employee_id === choisi) ?? null

  return (
    <div className="mx-auto max-w-[104rem]">
      <div className="mb-6">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Sorties</h1>
        <p className="text-sm text-slate-500">
          Préparer le reçu pour solde de tout compte d’un salarié qui part.
          Il reste en poste et continue d’être pointé jusqu’à la validation.
        </p>
      </div>

      {isLoading && <Spinner label="Chargement des employés…" />}

      {employes && (
        <>
          <label className="mb-5 block max-w-lg">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Quel employé s’en va ?
            </span>
            <select
              value={choisi}
              onChange={(e) => setChoisi(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— Choisir un employé —</option>
              {employes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.matricule != null ? `${e.matricule} — ` : ''}{e.nom_prenom}
                  {e.qualification ? ` · ${e.qualification}` : ''}
                </option>
              ))}
            </select>
          </label>

          {employe && (
            <FormulaireSortie
              key={employe.id}
              employee={employe}
              entreprise={company?.name ?? ''}
              companyId={companyId}
              sortie={sortieDeLEmploye}
              onFini={() => setChoisi('')}
            />
          )}
        </>
      )}

      {enCours.length > 0 && (
        <ListeSorties
          titre="Départs en préparation"
          aide="Ces personnes sont encore en poste. Validez le jour de leur départ."
          sorties={enCours}
          employes={employes ?? []}
          companyId={companyId}
          onReprendre={(s) => setChoisi(s.employee_id)}
        />
      )}

      {validees.length > 0 && (
        <ListeSorties
          titre="Départs validés"
          aide="Ces fiches ont quitté les listes actives. Rien n’a été supprimé."
          sorties={validees}
          employes={employes ?? []}
          companyId={companyId}
        />
      )}

      {employes?.length === 0 && (
        <EmptyState>Aucun employé en poste : rien à préparer ici.</EmptyState>
      )}
    </div>
  )
}

function FormulaireSortie({
  employee, entreprise, companyId, sortie, onFini,
}: {
  employee: Employee
  entreprise: string
  companyId: string | undefined
  sortie: Sortie | null
  onFini: () => void
}) {
  const modele = useMemo(() => modeleSolde(entreprise), [entreprise])
  const enregistrer = useEnregistrerSortie(companyId)
  const valider = useValiderSortie(companyId)

  const [f, setF] = useState({
    date_sortie: sortie?.date_sortie ?? todayIso(),
    montant: sortie?.montant != null ? String(sortie.montant) : '',
    mode: sortie?.mode_reglement ?? employee.mode_reglement ?? 'Virement',
    motif: sortie?.motif ?? '',
  })
  const [docLibre, setDocLibre] = useState<Record<string, string>>(() => ({
    ...(modeleSolde(entreprise).defauts ?? {}),
    ...((sortie?.champs_document ?? {}) as Record<string, string>),
  }))
  const [confirme, setConfirme] = useState(false)

  // Ce que la fiche de l'employé apporte au reçu, sans rien retaper.
  const COUVERTS = ['nom', 'cin', 'adresse', 'mode', 'montant', 'fait_le']
  const valeursDoc: Record<string, string> = {
    ...valeursEmploye(employee, modele),
    nom: employee.nom_prenom,
    adresse: [employee.adresse, employee.ville].filter(Boolean).join(', '),
    montant: f.montant,
    mode: f.mode,
    fait_le: dateDoc(f.date_sortie),
    ...docLibre,
  }
  const aSaisir = champsASaisir(modele, COUVERTS)

  useEffect(() => { setConfirme(false) }, [f.date_sortie, f.montant])

  const champs = {
    employeeId: employee.id,
    dateSortie: f.date_sortie,
    montant: Number(f.montant) || 0,
    mode: f.mode,
    motif: f.motif,
    champs: docLibre,
  }

  return (
    <PanneauDocument
      modele={modele}
      valeurs={valeursDoc}
      enTete={
        <>
          <p className="text-sm font-semibold text-slate-900">
            Reçu pour solde de tout compte — {employee.nom_prenom}
          </p>
          <p className="mt-0.5 mb-3 text-xs text-slate-500">
            {employee.matricule != null && <>Matricule {employee.matricule} · </>}
            {employee.cin ?? 'C.I.N. manquante'}
            {employee.cnss ? ` · C.N.S.S. ${employee.cnss}` : ' · sans n° C.N.S.S.'}
          </p>
        </>
      }
      actions={
        <>
          {(enregistrer.error || valider.error) && (
            <div className="w-full">
              <ErrorNote>
                {(enregistrer.error ?? valider.error)?.message}
              </ErrorNote>
            </div>
          )}
          <button
            onClick={() => enregistrer.mutate(champs)}
            disabled={enregistrer.isPending || !f.date_sortie}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {enregistrer.isPending ? 'Enregistrement…' : sortie ? 'Mettre à jour' : 'Enregistrer'}
          </button>
          {sortie && !confirme && (
            <button
              onClick={() => setConfirme(true)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Valider le départ
            </button>
          )}
          {sortie && confirme && (
            <button
              onClick={() => valider.mutate(sortie.id, { onSuccess: onFini })}
              disabled={valider.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
            >
              {valider.isPending ? 'Validation…' : 'Confirmer : il quitte les listes'}
            </button>
          )}
        </>
      }
    >
      {!sortie && (
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Enregistrez d’abord le départ. Il pourra être corrigé jusqu’à la validation,
          qui se fait le dernier jour travaillé.
        </p>
      )}
      {confirme && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          Après validation, <strong>{employee.nom_prenom}</strong> disparaît des listes
          d’employés et du pointage. Sa fiche, ses pointages et ses bulletins de paie
          restent consultables. Seul l’administrateur peut le remettre en poste.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Dernier jour travaillé *
          </span>
          <input
            type="date" value={f.date_sortie}
            onChange={(e) => setF((p) => ({ ...p, date_sortie: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Solde de tout compte (DH) *
          </span>
          <input
            type="number" min="0" step="0.01" value={f.montant}
            onChange={(e) => setF((p) => ({ ...p, montant: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Payé en</span>
          <select
            value={f.mode}
            onChange={(e) => setF((p) => ({ ...p, mode: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {['Virement', 'Espece', 'Versement'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Motif (usage interne, ne s’imprime pas)
          </span>
          <input
            type="text" value={f.motif}
            onChange={(e) => setF((p) => ({ ...p, motif: e.target.value }))}
            placeholder="Démission, fin de marché…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {aSaisir.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-1 text-sm font-semibold text-slate-900">
            Ce qui ne figure que sur le reçu
          </p>
          <p className="mb-3 text-xs text-slate-500">
            Prérempli depuis l’identité de la société. Un champ vide s’imprime en pointillés.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {aSaisir.map((c) => (
              <label key={c.id} className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{c.label}</span>
                {c.type === 'long' ? (
                  <textarea
                    rows={2} value={docLibre[c.id] ?? ''}
                    onChange={(e) => setDocLibre((p) => ({ ...p, [c.id]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    type="text" value={docLibre[c.id] ?? ''}
                    onChange={(e) => setDocLibre((p) => ({ ...p, [c.id]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </PanneauDocument>
  )
}

function ListeSorties({
  titre, aide, sorties, employes, companyId, onReprendre,
}: {
  titre: string
  aide: string
  sorties: Sortie[]
  employes: Employee[]
  companyId: string | undefined
  onReprendre?: (s: Sortie) => void
}) {
  const annuler = useAnnulerSortie(companyId)
  const nom = (id: string) =>
    employes.find((e) => e.id === id)?.nom_prenom ?? 'Employé sorti'

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">{titre}</h2>
      <p className="mt-0.5 mb-3 text-xs text-slate-500">{aide}</p>
      <ul className="space-y-2">
        {sorties.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">
                {nom(s.employee_id)}
                <Chip tone={s.valide ? 'slate' : 'amber'}>
                  {s.valide ? 'Sorti' : 'En préparation'}
                </Chip>
              </p>
              <p className="text-xs text-slate-500">
                Dernier jour {formatDateFr(s.date_sortie)} · {formatDH(s.montant)}
                {s.mode_reglement ? ` en ${s.mode_reglement.toLowerCase()}` : ''}
                {s.motif ? ` · ${s.motif}` : ''}
              </p>
            </div>
            {!s.valide && (
              <div className="flex shrink-0 gap-1.5">
                {onReprendre && (
                  <button
                    onClick={() => onReprendre(s)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Reprendre
                  </button>
                )}
                <button
                  onClick={() => annuler.mutate(s.id)}
                  disabled={annuler.isPending}
                  className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {annuler.error && <ErrorNote>{annuler.error.message}</ErrorNote>}
    </section>
  )
}
