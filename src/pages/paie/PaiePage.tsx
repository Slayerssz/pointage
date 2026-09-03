import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  STATUT_PERIODE,
  estVirement,
  formatDH,
  formatNombre,
  moisLabel,
  usePaieInvalidation,
  useDettesOuvertes,
  useLignesPaie,
  usePeriodes,
  useTotauxPeriode,
} from '../../lib/paie'
import { exporterPaieExcel, exporterPaiePdf } from '../../lib/exports'
import type { LignePaie, PeriodePaie } from '../../lib/types'
import { Chip, EmptyState, ErrorNote, Spinner } from '../../components/ui'
import BulletinPaiePrint from '../../components/BulletinPaiePrint'
import RecapPaiePrint from '../../components/RecapPaiePrint'
import { useBulletins } from '../../lib/bulletin'
import { useModeleSociete } from '../../lib/modeleSociete'

export default function PaiePage() {
  const { companyId } = useParams()
  const { data: periodes, isLoading, error } = usePeriodes(companyId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Sélectionner automatiquement la période la plus récente
  useEffect(() => {
    if (!selectedId && periodes?.length) setSelectedId(periodes[0].id)
  }, [periodes, selectedId])

  const periode = periodes?.find((p) => p.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">La Paie</h1>
        <p className="text-sm text-slate-500">
          Chaque mois validé par le bureau arrive ici : salaires calculés automatiquement à partir
          du pointage, retenues, puis validation et export.
        </p>
      </div>

      {isLoading && <Spinner label="Chargement des périodes…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}

      {periodes && periodes.length === 0 && (
        <EmptyState>
          Aucun mois n’a encore été clôturé. Le bureau doit d’abord valider le pointage d’un mois
          depuis l’onglet Pointage.
        </EmptyState>
      )}

      {periodes && periodes.length > 0 && (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {periodes.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                  p.id === selectedId
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {moisLabel(p.annee, p.mois)}
                <span className="ml-2 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ backgroundColor: couleurStatut(p) }} />
              </button>
            ))}
          </div>

          {periode && <PeriodeDetail key={periode.id} periode={periode} companyId={companyId} />}
        </>
      )}
    </div>
  )
}

function couleurStatut(p: PeriodePaie): string {
  switch (p.statut) {
    case 'paie_validee': return '#10b981'
    case 'pointage_valide': return '#3b82f6'
    case 'reouverture_demandee': return '#f59e0b'
    default: return '#cbd5e1'
  }
}

function PeriodeDetail({ periode, companyId }: { periode: PeriodePaie; companyId: string | undefined }) {
  const { profile } = useAuth()
  const { data: lignes, isLoading } = useLignesPaie(periode.id)
  const { data: totaux } = useTotauxPeriode(periode.id)
  const { data: dettes } = useDettesOuvertes(companyId)
  const invalider = usePaieInvalidation(companyId, periode.id)
  const [recherche, setRecherche] = useState('')
  const [filtreReglement, setFiltreReglement] = useState('')
  const [filtreSite, setFiltreSite] = useState('')
  const [filtrePrincipal, setFiltrePrincipal] = useState('')
  const [motifReouverture, setMotifReouverture] = useState('')
  const [exportEnCours, setExportEnCours] = useState<string | null>(null)
  const [erreurExport, setErreurExport] = useState<string | null>(null)
  // Vient d'être validée → on met les exports en avant
  const [vientDeValider, setVientDeValider] = useState(false)
  // Bulletins : null = fermé, '' = tous les virements, un id = un seul employé
  const [bulletinPour, setBulletinPour] = useState<string | null>(null)

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

  // Le bureau couvre la paie : il modifie les lignes comme le service paie.
  const estPaie =
    profile?.role === 'paie' || profile?.role === 'admin' || profile?.role === 'validator'
  const estAdmin = profile?.role === 'admin'
  const verrouille = periode.statut === 'paie_validee'
  const enDemande = periode.statut === 'reouverture_demandee'

  const recalculer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('generer_lignes_paie', { p_periode: periode.id })
      if (error) throw error
    },
    onSuccess: invalider,
  })

  const validerPaie = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('valider_paie', { p_periode: periode.id })
      if (error) throw error
    },
    onSuccess: () => {
      invalider()
      setVientDeValider(true)
    },
  })

  const demanderReouverture = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('demander_reouverture', {
        p_periode: periode.id,
        p_motif: motifReouverture,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalider()
      setMotifReouverture('')
    },
  })

  const repondre = useMutation({
    mutationFn: async (approuver: boolean) => {
      const { error } = await supabase.rpc('repondre_reouverture', {
        p_periode: periode.id,
        p_approuver: approuver,
      })
      if (error) throw error
    },
    onSuccess: invalider,
  })

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return (lignes ?? []).filter((l) => {
      if (filtreReglement && (l.mode_reglement ?? '') !== filtreReglement) return false
      if (filtreSite && (l.site_nom ?? '') !== filtreSite) return false
      if (filtrePrincipal && (l.site_principal_nom ?? '') !== filtrePrincipal) return false
      if (!q) return true
      return (
        l.nom_prenom.toLowerCase().includes(q) ||
        String(l.matricule ?? '').includes(q) ||
        (l.site_nom ?? '').toLowerCase().includes(q)
      )
    })
  }, [lignes, recherche, filtreReglement, filtreSite, filtrePrincipal])

  const filtreActif = Boolean(filtreReglement || filtreSite || filtrePrincipal || recherche.trim())

  // Les valeurs proposées viennent des lignes du mois : on ne propose que
  // ce qui existe réellement dans cette paie.
  const valeurs = useMemo(() => {
    const uniq = (f: (l: LignePaie) => string | null) =>
      [...new Set((lignes ?? []).map(f).filter((v): v is string => Boolean(v)))].sort()
    return {
      reglements: uniq((l) => l.mode_reglement),
      sites: uniq((l) => l.site_nom),
      principaux: uniq((l) => l.site_principal_nom),
    }
  }, [lignes])

  /** Totaux de la sélection courante — c'est ce que le patron veut lire. */
  const totauxFiltres = useMemo(() => {
    const somme = (f: (l: LignePaie) => number) =>
      filtrees.reduce((s, l) => s + Number(f(l)), 0)
    return {
      employes: filtrees.length,
      total_brut: somme((l) => l.salaire_brut),
      total_primes: somme((l) => l.prime),
      total_dettes: somme((l) => l.retenue_dette),
      total_autres_retenues: somme((l) => l.autres_retenues),
      total_net: somme((l) => l.net_a_payer),
      total_virement: filtrees.filter((l) => estVirement(l.mode_reglement))
        .reduce((s, l) => s + Number(l.net_a_payer), 0),
      total_especes: filtrees.filter((l) => !estVirement(l.mode_reglement))
        .reduce((s, l) => s + Number(l.net_a_payer), 0),
      par_banque: Object.entries(
        filtrees.filter((l) => estVirement(l.mode_reglement)).reduce((acc, l) => {
          const b = (l.banque ?? '').trim() || '(non renseignée)'
          acc[b] = acc[b] ?? { n: 0, montant: 0 }
          acc[b].n += 1
          acc[b].montant += Number(l.net_a_payer)
          return acc
        }, {} as Record<string, { n: number; montant: number }>),
      ).map(([banque, v]) => ({ banque, ...v })).sort((a, b) => b.montant - a.montant),
    }
  }, [filtrees])

  const exporter = async (format: 'excel' | 'pdf') => {
    if (!lignes) return
    setExportEnCours(format)
    setErreurExport(null)
    try {
      // L'export reprend exactement ce qui est affiché : si un filtre est
      // actif, on n'exporte que cette sélection, avec ses propres totaux.
      const opts = {
        entreprise: company?.name ?? 'Entreprise',
        annee: periode.annee,
        mois: periode.mois,
        lignes: filtrees,
        totaux: filtreActif ? totauxFiltres : totaux,
        filtre: filtreActif
          ? [filtrePrincipal, filtreSite, filtreReglement].filter(Boolean).join(' · ')
          : undefined,
      }
      if (format === 'excel') await exporterPaieExcel(opts)
      else await exporterPaiePdf(opts)
    } catch (e) {
      setErreurExport(e instanceof Error ? e.message : String(e))
    } finally {
      setExportEnCours(null)
    }
  }

  const statut = STATUT_PERIODE[periode.statut]
  const erreur =
    recalculer.error ?? validerPaie.error ?? demanderReouverture.error ?? repondre.error

  if (isLoading) return <Spinner label="Chargement de la paie…" />

  return (
    <div>
      {/* En-tête de période */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              {moisLabel(periode.annee, periode.mois)}
              <Chip tone={statut.tone}>{statut.label}</Chip>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Base {formatNombre(periode.jours_base)} jours = salaire complet ·{' '}
              Malade {periode.maladie_payee ? 'payé' : 'non payé'} ·{' '}
              Congé {periode.conge_paye ? 'payé' : 'non payé'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exporter('excel')}
              disabled={exportEnCours !== null || !lignes?.length}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              {exportEnCours === 'excel' ? 'Export…' : 'Excel'}
            </button>
            <button
              onClick={() => exporter('pdf')}
              disabled={exportEnCours !== null || !lignes?.length}
              className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
            >
              {exportEnCours === 'pdf' ? 'Export…' : 'PDF'}
            </button>
            <button
              onClick={() => setBulletinPour('')}
              disabled={!lignes?.some((l) => (l.mode_reglement ?? '').toLowerCase().startsWith('vir'))}
              title="Un bulletin par employé payé par virement"
              className="rounded-lg border border-blue-300 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
            >
              Bulletins de paie
            </button>
            {estPaie && !verrouille && !enDemande && (
              <button
                onClick={() => recalculer.mutate()}
                disabled={recalculer.isPending}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                {recalculer.isPending ? 'Recalcul…' : 'Recalculer'}
              </button>
            )}
          </div>
        </div>

        {totaux && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Total label="Employés" value={String(totauxFiltres.employes)} />
              <Total label="Total brut" value={formatDH(totauxFiltres.total_brut)} />
              <Total label="Retenues" value={formatDH(totauxFiltres.total_dettes + totauxFiltres.total_autres_retenues)} />
              <Total label="Virements" value={formatDH(totauxFiltres.total_virement)} />
              <Total label="NET À PAYER" value={formatDH(totauxFiltres.total_net)} fort />
            </div>
            {filtreActif && (
              <p className="mt-2 text-xs text-slate-500">
                Ces totaux ne portent que sur la sélection.
                {' '}Paie complète du mois : <strong>{formatDH(totaux.total_net)}</strong> pour{' '}
                {totaux.employes} employé(s).
              </p>
            )}
            {/* Espèces / virement : la question la plus fréquente */}
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              <span>
                À payer en <strong className="text-slate-900">espèces</strong> :{' '}
                <span className="tabular-nums">{formatDH(totauxFiltres.total_especes)}</span>
              </span>
              <span>
                Par <strong className="text-slate-900">virement</strong> :{' '}
                <span className="tabular-nums">{formatDH(totauxFiltres.total_virement)}</span>
              </span>
              {totauxFiltres.par_banque.map((b) => (
                <span key={b.banque} className="text-slate-500">
                  {b.banque} : <span className="tabular-nums">{formatDH(b.montant)}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {erreurExport && (
        <div className="mb-4">
          <ErrorNote>Export impossible : {erreurExport}</ErrorNote>
        </div>
      )}
      {erreur && (
        <div className="mb-4">
          <ErrorNote>{erreur.message}</ErrorNote>
        </div>
      )}

      {/* Demande de réouverture en attente : seul l'admin tranche */}
      {enDemande && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Demande de réouverture</p>
          <p className="mt-1 text-sm text-amber-800">
            Motif : « {periode.reouverture_motif} »
          </p>
          {estAdmin ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => repondre.mutate(false)}
                disabled={repondre.isPending}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Refuser
              </button>
              <button
                onClick={() => repondre.mutate(true)}
                disabled={repondre.isPending}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {repondre.isPending ? '…' : 'Approuver et rouvrir le mois'}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-700">
              En attente de la décision de l’administrateur.
            </p>
          )}
        </div>
      )}

      {/* Juste après la validation : récupérer l'Excel et le PDF */}
      {vientDeValider && verrouille && (
        <div className="mb-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            Paie de {moisLabel(periode.annee, periode.mois)} validée ✓
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Récupérez l’état de paie complet — tous les employés, les totaux, et la répartition
            virement / espèces par banque.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => exporter('excel')}
              disabled={exportEnCours !== null}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {exportEnCours === 'excel' ? 'Export…' : 'Télécharger l’Excel'}
            </button>
            <button
              onClick={() => exporter('pdf')}
              disabled={exportEnCours !== null}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {exportEnCours === 'pdf' ? 'Export…' : 'Télécharger le PDF'}
            </button>
            <button
              onClick={() => setVientDeValider(false)}
              className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}

      {/* Paie validée : demander la réouverture */}
      {verrouille && !vientDeValider && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Paie validée — verrouillée</p>
          <p className="mt-1 text-sm text-slate-600">
            Pour corriger ce mois, demandez la réouverture : un administrateur devra l’approuver.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={motifReouverture}
              onChange={(e) => setMotifReouverture(e.target.value)}
              placeholder="Motif de la demande…"
              className="min-w-64 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => demanderReouverture.mutate()}
              disabled={demanderReouverture.isPending || !motifReouverture.trim()}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-40"
            >
              {demanderReouverture.isPending ? '…' : 'Demander la réouverture'}
            </button>
          </div>
        </div>
      )}

      {/* Recherche */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (nom, matricule, site)…"
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        {valeurs.principaux.length > 0 && (
          <select
            value={filtrePrincipal}
            onChange={(e) => setFiltrePrincipal(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tous les sites principaux</option>
            {valeurs.principaux.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}
        <select
          value={filtreSite}
          onChange={(e) => setFiltreSite(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Toutes les annexes</option>
          {valeurs.sites.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select
          value={filtreReglement}
          onChange={(e) => setFiltreReglement(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Tous les règlements</option>
          {valeurs.reglements.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        {filtreActif && (
          <button
            onClick={() => {
              setRecherche(''); setFiltreReglement(''); setFiltreSite(''); setFiltrePrincipal('')
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Tout afficher
          </button>
        )}
        <p className="ml-auto text-sm text-slate-500">{filtrees.length} ligne(s)</p>
      </div>

      {/* Tableau de paie */}
      <div className="tableau-large rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1500px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="fige-gauche px-3 py-3 font-medium">Employé</th>
              <th className="px-3 py-3 font-medium">Annexe</th>
              <th className="px-3 py-3 text-right font-medium">Salaire base</th>
              <th className="px-3 py-3 text-center font-medium">Jours</th>
              <th className="px-3 py-3 text-center font-medium">C / M</th>
              <th className="px-3 py-3 text-center font-medium">J. payés</th>
              <th className="px-3 py-3 text-right font-medium">Heures</th>
              <th className="px-3 py-3 text-right font-medium">Brut</th>
              <th className="px-3 py-3 text-right font-medium">Prime</th>
              <th className="px-3 py-3 text-right font-medium">Dette</th>
              <th className="px-3 py-3 text-right font-medium">Autres</th>
              <th className="px-3 py-3 text-right font-medium">Net à payer</th>
              <th className="px-3 py-3 font-medium">Règlement</th>
              <th className="fige-droite px-3 py-3 text-right font-medium">Bulletin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrees.map((l) => (
              <LigneRow
                key={l.id}
                ligne={l}
                modifiable={estPaie && !verrouille && !enDemande}
                resteDette={dettes?.get(l.employee_id) ?? 0}
                onSaved={invalider}
                onBulletin={() => setBulletinPour(l.employee_id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Valider la paie */}
      {estPaie && !verrouille && !enDemande && lignes && lignes.length > 0 && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            Valider la paie de {moisLabel(periode.annee, periode.mois)}
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Les retenues de dette seront imputées sur les dettes des employés, et la paie sera
            verrouillée. Toute correction devra passer par une demande de réouverture approuvée par
            l’administrateur.
          </p>
          <button
            onClick={() => validerPaie.mutate()}
            disabled={validerPaie.isPending}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {validerPaie.isPending ? 'Validation…' : 'Valider la paie'}
          </button>
        </div>
      )}

      {bulletinPour !== null && (
        <BulletinsModale
          periodeId={periode.id}
          employeeId={bulletinPour || null}
          entreprise={company?.name ?? 'Entreprise'}
          companyId={companyId}
          onClose={() => setBulletinPour(null)}
        />
      )}
    </div>
  )
}

/**
 * Charge les bulletins avant de les afficher : l'impression ne doit
 * jamais partir sur une page à moitié remplie.
 */
function BulletinsModale({
  periodeId, employeeId, entreprise, companyId, onClose,
}: {
  periodeId: string; employeeId: string | null; entreprise: string
  companyId: string | undefined; onClose: () => void
}) {
  const { data: cleModele } = useModeleSociete(companyId)
  const { data, isLoading, error } = useBulletins(periodeId, employeeId)
  // Un seul employé : on va droit à son bulletin. Toute la période : on
  // demande d'abord si c'est un bulletin par personne ou l'état d'ensemble.
  const [forme, setForme] = useState<'individuel' | 'recap' | null>(
    employeeId ? 'individuel' : null,
  )

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-800/60">
        <div className="rounded-xl bg-white px-6 py-5 shadow-xl">
          <Spinner label="Préparation des bulletins…" />
        </div>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-800/60 p-4">
        <div className="max-w-md rounded-xl bg-white p-5 shadow-xl">
          <ErrorNote>
            {error?.message ?? 'Bulletins indisponibles.'}
            {String(error?.message ?? '').includes('bulletin_paie') && (
              <> Le BLOC 15 n’a peut-être pas encore été exécuté dans Supabase.</>
            )}
          </ErrorNote>
          <button onClick={onClose} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            Fermer
          </button>
        </div>
      </div>
    )
  }
  if (data.length === 0) {
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-800/60 p-4">
        <div className="max-w-md rounded-xl bg-white p-5 text-sm shadow-xl">
          <p className="font-semibold text-slate-900">Aucun bulletin à éditer</p>
          <p className="mt-1 text-slate-600">
            Le bulletin de paie ne concerne que les employés payés par virement,
            les seuls déclarés à la C.N.S.S. Aucun n’apparaît dans cette sélection.
          </p>
          <button onClick={onClose} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            Fermer
          </button>
        </div>
      </div>
    )
  }
  if (forme === null) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold text-slate-900">Bulletins de paie</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.length} employé(s) payé(s) par virement. Sous quelle forme ?
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <FormeBulletin
              titre="Un bulletin par employé"
              pour="À remettre à chacun"
              detail={`${data.length} page${data.length > 1 ? 's' : ''} A4, une par personne, avec le détail de ses cotisations et son net.`}
              onClick={() => setForme('individuel')}
            />
            <FormeBulletin
              titre="Un état pour tout le monde"
              pour="Pour la banque et le comptable"
              detail="Une ligne par employé, regroupée par site, avec sous-totaux et total général. A4 paysage."
              onClick={() => setForme('recap')}
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    )
  }

  return forme === 'recap' ? (
    <RecapPaiePrint bulletins={data} entreprise={entreprise}
                    modeleDocument={cleModele} onClose={onClose} />
  ) : (
    <BulletinPaiePrint bulletins={data} entreprise={entreprise}
                       modeleDocument={cleModele} onClose={onClose} />
  )
}

function FormeBulletin({
  titre, pour, detail, onClick,
}: { titre: string; pour: string; detail: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-xl border border-slate-300 p-4 text-left transition hover:border-slate-900 hover:bg-slate-50"
    >
      <span className="block text-sm font-semibold text-slate-900">{titre}</span>
      <span className="mt-0.5 block text-xs font-medium tracking-wide text-slate-500 uppercase">
        {pour}
      </span>
      <span className="mt-2 block text-sm text-slate-600">{detail}</span>
    </button>
  )
}

function Total({ label, value, fort }: { label: string; value: string; fort?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${fort ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className={`truncate text-base font-semibold tabular-nums ${fort ? 'text-emerald-800' : 'text-slate-900'}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

/** Une ligne de paie : les montants ajustables sont éditables sur place. */
function LigneRow({
  ligne,
  modifiable,
  resteDette,
  onSaved,
  onBulletin,
}: {
  ligne: LignePaie
  modifiable: boolean
  resteDette: number
  onSaved: () => void
  onBulletin: () => void
}) {
  // Le bulletin de paie ne concerne que les virements : ce sont les
  // seuls employés déclarés à la C.N.S.S.
  const bulletinDisponible = estVirement(ligne.mode_reglement)
  const [prime, setPrime] = useState(String(ligne.prime ?? 0))
  const [dette, setDette] = useState(String(ligne.retenue_dette ?? 0))
  const [autres, setAutres] = useState(String(ligne.autres_retenues ?? 0))

  useEffect(() => {
    setPrime(String(ligne.prime ?? 0))
    setDette(String(ligne.retenue_dette ?? 0))
    setAutres(String(ligne.autres_retenues ?? 0))
  }, [ligne.prime, ligne.retenue_dette, ligne.autres_retenues])

  const enregistrer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('maj_ligne_paie', {
        p_ligne: ligne.id,
        p_prime: Number(prime) || 0,
        p_retenue_dette: Number(dette) || 0,
        p_autres_retenues: Number(autres) || 0,
        p_observations: null,
      })
      if (error) throw error
    },
    onSuccess: onSaved,
  })

  const modifie =
    Number(prime) !== Number(ligne.prime) ||
    Number(dette) !== Number(ligne.retenue_dette) ||
    Number(autres) !== Number(ligne.autres_retenues)

  const champ = (v: string, set: (s: string) => void, max?: number) => (
    <input
      type="number"
      min="0"
      step="0.01"
      max={max}
      value={v}
      disabled={!modifiable}
      onChange={(e) => set(e.target.value)}
      onBlur={() => modifie && enregistrer.mutate()}
      className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm tabular-nums disabled:border-transparent disabled:bg-transparent"
    />
  )

  const complet = Number(ligne.jours_payes) >= Number(ligne.jours_base)

  return (
    <tr className={enregistrer.isError ? 'bg-red-50' : 'bg-white'}>
      <td className="fige-gauche px-3 py-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-slate-600">
            {ligne.matricule ?? '—'}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{ligne.nom_prenom}</p>
            {ligne.qualification && (
              <p className="truncate text-xs text-slate-500">{ligne.qualification}</p>
            )}
            {enregistrer.isError && (
              <p className="text-xs text-red-600">{(enregistrer.error as Error).message}</p>
            )}
          </div>
        </div>
      </td>
      <td className="max-w-40 px-3 py-2 text-slate-600">
        <p className="truncate">{ligne.site_nom ?? '—'}</p>
        {ligne.site_principal_nom && (
          <p className="truncate text-xs text-slate-400">{ligne.site_principal_nom}</p>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatDH(ligne.salaire_base)}</td>
      <td className="px-3 py-2 text-center tabular-nums text-slate-700">
        {formatNombre(ligne.gardes_travaillees)}
      </td>
      <td className="px-3 py-2 text-center text-xs tabular-nums text-slate-500">
        {formatNombre(ligne.jours_conge)} / {formatNombre(ligne.jours_maladie)}
      </td>
      <td className="px-3 py-2 text-center">
        <span
          className={`inline-block rounded px-2 py-0.5 text-sm font-semibold tabular-nums ${
            complet ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
          }`}
          title={complet ? 'Mois complet — salaire entier' : `Sur ${formatNombre(ligne.jours_base)} jours`}
        >
          {formatNombre(ligne.jours_payes)}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
        {ligne.heures_effectuees == null ? '—' : `${formatNombre(ligne.heures_effectuees)} h`}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatDH(ligne.salaire_brut)}</td>
      <td className="px-3 py-2 text-right">{champ(prime, setPrime)}</td>
      <td className="px-3 py-2 text-right">
        {champ(dette, setDette, resteDette || undefined)}
        {resteDette > 0 && (
          <p className="mt-0.5 text-[10px] text-amber-700">reste {formatDH(resteDette)}</p>
        )}
      </td>
      <td className="px-3 py-2 text-right">{champ(autres, setAutres)}</td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
        {formatDH(ligne.net_a_payer)}
      </td>
      <td className="px-3 py-2">
        <p className="text-xs text-slate-700">{ligne.mode_reglement ?? '—'}</p>
        {estVirement(ligne.mode_reglement) && (
          <p className="truncate text-[10px] text-slate-500" title={ligne.rib ?? undefined}>
            {ligne.banque ?? 'banque ?'} · {ligne.rib ?? 'RIB manquant'}
          </p>
        )}
      </td>
      <td className="fige-droite px-3 py-2 text-right">
        {bulletinDisponible ? (
          <button
            onClick={onBulletin}
            className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            Bulletin
          </button>
        ) : (
          <span className="text-xs text-slate-300" title="Bulletin réservé aux virements (C.N.S.S.)">
            —
          </span>
        )}
      </td>
    </tr>
  )
}
