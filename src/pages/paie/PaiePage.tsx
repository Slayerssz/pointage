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
  usePeriodeDuMois,
  useTotauxPeriode,
} from '../../lib/paie'
import { exporterPaieExcel, exporterPaiePdf } from '../../lib/exports'
import OrdreVirementPrint, { type OrdreDeSite } from '../../components/OrdreVirementPrint'
import ChoixDansLaPaie from '../../components/ChoixDansLaPaie'
import ListeVersementsPrint from '../../components/ListeVersementsPrint'
import RecusEspecePrint from '../../components/RecusEspecePrint'
import type { LignePaie, PeriodePaie } from '../../lib/types'
import { Chip, EmptyState, ErrorNote, Spinner } from '../../components/ui'
import { useModeleSociete } from '../../lib/modeleSociete'

export default function PaiePage() {
  const { companyId } = useParams()
  // Le mois en cours par défaut : sa paie existe toujours et se met à jour
  // avec le pointage. On circule d'un mois à l'autre, jamais vers l'avenir.
  const maintenant = new Date()
  const [annee, setAnnee] = useState(maintenant.getFullYear())
  const [mois, setMois] = useState(maintenant.getMonth() + 1)
  const { data: periode, isLoading, error, isFetching } = usePeriodeDuMois(companyId, annee, mois)
  const { data: periodes } = usePeriodes(companyId)

  const decaler = (pas: number) => {
    const d = new Date(annee, mois - 1 + pas, 1)
    setAnnee(d.getFullYear())
    setMois(d.getMonth() + 1)
  }
  const estMoisCourant =
    annee === maintenant.getFullYear() && mois === maintenant.getMonth() + 1
  const statutDuMois = (a: number, m: number) =>
    periodes?.find((p) => p.annee === a && p.mois === m) ?? null

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">La Paie</h1>
        <p className="text-sm text-slate-500">
          La paie du mois est toujours là et suit le pointage au jour le jour. À la fin du mois,
          le bureau demande la validation ; l’administrateur l’accepte et le mois se verrouille.
        </p>
      </div>

      {/* Le mois, au-dessus de tout le reste */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => decaler(-1)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
          title="Mois précédent"
        >
          ←
        </button>
        <span className="min-w-44 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-center text-sm font-semibold text-slate-900">
          {moisLabel(annee, mois)}
          {(() => {
            const p = statutDuMois(annee, mois)
            return p ? (
              <span className="ml-2 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: couleurStatut(p) }} />
            ) : null
          })()}
        </span>
        <button
          onClick={() => decaler(1)}
          disabled={estMoisCourant}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          title={estMoisCourant ? 'Le mois en cours est le dernier' : 'Mois suivant'}
        >
          →
        </button>
        {!estMoisCourant && (
          <button
            onClick={() => { setAnnee(maintenant.getFullYear()); setMois(maintenant.getMonth() + 1) }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Mois en cours
          </button>
        )}
        {isFetching && <span className="text-xs text-slate-400">mise à jour…</span>}
      </div>

      {isLoading && <Spinner label="Ouverture de la paie du mois…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}

      {!isLoading && !error && !periode && (
        <EmptyState>Ce mois n’a pas encore commencé.</EmptyState>
      )}

      {periode && <PeriodeDetail key={periode.id} periode={periode} companyId={companyId} />}
    </div>
  )
}

/** Virement / Versement / Espèces, quelle que soit la façon dont c'est écrit. */
function modeDe(m: string | null | undefined): string {
  const v = (m ?? '').toLowerCase()
  if (v.startsWith('vir')) return 'Virement'
  if (v.startsWith('vers')) return 'Versement'
  if (v.startsWith('esp')) return 'Espèces'
  return m?.trim() || 'Sans mode de règlement'
}
const banqueDe = (l: LignePaie) =>
  (l.banque ?? '').trim().replace(/\s+/g, ' ').toUpperCase() || '(BANQUE NON RENSEIGNÉE)'

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
  // Le parcours : un mode de règlement, puis un site (virement, espèces)
  // ou une banque (versement). Chaque étape réduit le tableau.
  const [filtreReglement, setFiltreReglement] = useState('')
  const [filtreSite, setFiltreSite] = useState('')
  const [filtreBanque, setFiltreBanque] = useState('')
  const [filtrePrincipal, setFiltrePrincipal] = useState('')
  const [motifReouverture, setMotifReouverture] = useState('')
  const [exportEnCours, setExportEnCours] = useState<string | null>(null)
  const [erreurExport, setErreurExport] = useState<string | null>(null)
  // Vient d'être validée → on met les exports en avant
  const [vientDeValider, setVientDeValider] = useState(false)

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies').select('id, name, rib_ordinateur').eq('id', companyId!).single()
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
  const attendAdmin = periode.statut === 'validation_demandee'
  // Rien ne se saisit tant que l'administrateur n'a pas répondu.
  const modifiable = estPaie && !verrouille && !enDemande && !attendAdmin
  // La validation ne s'ouvre qu'une fois le mois terminé.
  const dernierJour = new Date(periode.annee, periode.mois, 0)
  const moisTermine = new Date() >= new Date(
    dernierJour.getFullYear(), dernierJour.getMonth(), dernierJour.getDate(), 0, 0, 0,
  )

  const recalculer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('generer_lignes_paie', { p_periode: periode.id })
      if (error) throw error
    },
    onSuccess: invalider,
  })

  const demanderValidation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('demander_validation_paie', { p_periode: periode.id })
      if (error) throw error
    },
    onSuccess: invalider,
  })

  const annulerDemande = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('annuler_demande_validation', { p_periode: periode.id })
      if (error) throw error
    },
    onSuccess: invalider,
  })

  const repondreValidation = useMutation({
    mutationFn: async (accepter: boolean) => {
      const { error } = await supabase.rpc('repondre_validation_paie', {
        p_periode: periode.id, p_accepter: accepter,
      })
      if (error) throw error
    },
    onSuccess: (_d, accepter) => {
      invalider()
      if (accepter) setVientDeValider(true)
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
      if (filtreReglement && modeDe(l.mode_reglement) !== filtreReglement) return false
      if (filtreSite && (l.site_nom ?? '') !== filtreSite) return false
      if (filtreBanque && banqueDe(l) !== filtreBanque) return false
      if (filtrePrincipal && (l.site_principal_nom ?? '') !== filtrePrincipal) return false
      if (!q) return true
      return (
        l.nom_prenom.toLowerCase().includes(q) ||
        String(l.matricule ?? '').includes(q) ||
        (l.site_nom ?? '').toLowerCase().includes(q)
      )
    })
  }, [lignes, recherche, filtreReglement, filtreSite, filtreBanque, filtrePrincipal])

  const filtreActif = Boolean(
    filtreReglement || filtreSite || filtreBanque || filtrePrincipal || recherche.trim(),
  )

  // Les étapes du parcours, comptées sur le mois entier (pas sur ce qui
  // est déjà filtré) : on voit toujours tous les sites, toutes les banques.
  const etapes = useMemo(() => {
    const somme = (liste: LignePaie[]) => liste.reduce((s, l) => s + Number(l.net_a_payer), 0)
    const modes = new Map<string, LignePaie[]>()
    for (const l of lignes ?? []) {
      const k = modeDe(l.mode_reglement)
      modes.set(k, [...(modes.get(k) ?? []), l])
    }
    const ORDRE = ['Virement', 'Versement', 'Espèces']
    const listeModes = [...modes.entries()]
      .sort(([a], [b]) => {
        const ia = ORDRE.indexOf(a), ib = ORDRE.indexOf(b)
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'fr')
      })
      .map(([mode, liste]) => ({ mode, n: liste.length, total: somme(liste) }))

    const duMode = filtreReglement ? (modes.get(filtreReglement) ?? []) : []
    const par = (cle: (l: LignePaie) => string) => {
      const m = new Map<string, LignePaie[]>()
      for (const l of duMode) m.set(cle(l), [...(m.get(cle(l)) ?? []), l])
      return [...m.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'fr'))
        .map(([nom, liste]) => ({ nom, n: liste.length, total: somme(liste) }))
    }
    return {
      modes: listeModes,
      // Le versement se range par banque — c'est au guichet qu'on porte
      // l'argent ; le virement par site, comme l'ordre qui part à la banque.
      secondes: filtreReglement === 'Versement'
        ? par(banqueDe)
        : par((l) => l.site_nom?.trim() || '(sans site)'),
      totalDuMode: somme(duMode),
      nDuMode: duMode.length,
    }
  }, [lignes, filtreReglement])

  const choisirMode = (m: string) => {
    setFiltreReglement(m === filtreReglement ? '' : m)
    setFiltreSite(''); setFiltreBanque('')
  }
  const choisirSeconde = (v: string) => {
    if (filtreReglement === 'Versement') setFiltreBanque(v)
    else setFiltreSite(v)
  }
  const secondeActive = filtreReglement === 'Versement' ? filtreBanque : filtreSite

  // Cliquer sur Virement ou Versement ouvre la fenêtre du second choix :
  // on y lit les montants avant de décider, ce qu'un menu ne montre pas.
  const [choixOuvert, setChoixOuvert] = useState<string | null>(null)
  const ouvrirMode = (m: string) => {
    if (m === filtreReglement && m !== '') { setChoixOuvert(m); return }
    choisirMode(m)
    if (m === 'Virement' || m === 'Versement') setChoixOuvert(m)
  }

  // Les valeurs proposées viennent des lignes du mois : on ne propose que
  // ce qui existe réellement dans cette paie.
  const valeurs = useMemo(() => {
    const uniq = (f: (l: LignePaie) => string | null) =>
      [...new Set((lignes ?? []).map(f).filter((v): v is string => Boolean(v)))].sort()
    return {
      principaux: uniq((l) => l.site_principal_nom),
    }
  }, [lignes])

  /** Les totaux d'une liste de lignes — c'est ce que le patron veut lire. */
  const totauxDe = (liste: LignePaie[]) => {
    const somme = (f: (l: LignePaie) => number) =>
      liste.reduce((s, l) => s + Number(f(l)), 0)
    return {
      employes: liste.length,
      total_brut: somme((l) => l.salaire_brut),
      total_primes: somme((l) => l.prime),
      total_dettes: somme((l) => l.retenue_dette),
      total_autres_retenues: somme((l) => l.autres_retenues),
      total_net: somme((l) => l.net_a_payer),
      total_virement: liste.filter((l) => estVirement(l.mode_reglement))
        .reduce((s, l) => s + Number(l.net_a_payer), 0),
      total_especes: liste.filter((l) => !estVirement(l.mode_reglement))
        .reduce((s, l) => s + Number(l.net_a_payer), 0),
      par_banque: Object.entries(
        liste.filter((l) => estVirement(l.mode_reglement)).reduce((acc, l) => {
          const b = (l.banque ?? '').trim() || '(non renseignée)'
          acc[b] = acc[b] ?? { n: 0, montant: 0 }
          acc[b].n += 1
          acc[b].montant += Number(l.net_a_payer)
          return acc
        }, {} as Record<string, { n: number; montant: number }>),
      ).map(([banque, v]) => ({ banque, ...v })).sort((a, b) => b.montant - a.montant),
    }
  }
  const totauxFiltres = useMemo(() => totauxDe(filtrees), [filtrees])

  // Les lignes, un mode de règlement après l'autre : les virements
  // ensemble, les versements ensemble, les espèces ensemble. Chacun se
  // lit et s'imprime seul — l'espèce se compte en caisse, le virement
  // part à la banque, ce ne sont pas les mêmes gens qui les traitent.
  const [ordres, setOrdres] = useState<OrdreDeSite[] | null>(null)
  // Ce qui part à l'impression : les lignes affichées, et le site choisi.
  const [versements, setVersements] = useState<{ lignes: LignePaie[]; precision: string | null } | null>(null)
  const [recus, setRecus] = useState<LignePaie[] | null>(null)

  /**
   * Ce qu'on imprime est ce qu'on a sous les yeux : la sélection courante.
   * Sans second choix, le tout se scinde par groupe — une feuille par
   * banque pour les virements, une liste par site pour les versements.
   */
  /** Le document du mode affiché, dans son modèle. */
  const imprimerPour = (mode: string, liste: LignePaie[]) => {
    if (mode === 'Virement') {
      setOrdres(aImprimer(
        liste, (l) => l.site_nom?.trim() || '(sans site)', filtreSite, 'TOUS LES VIREMENTS',
      ))
    } else if (mode === 'Versement') {
      setVersements({ lignes: liste, precision: filtreBanque || null })
    } else if (mode === 'Espèces') {
      setRecus(liste)
    }
  }
  const imprimerLaSelection = () => imprimerPour(filtreReglement, filtrees)

  const aImprimer = (
    lignes: LignePaie[],
    cle: (l: LignePaie) => string,
    choix: string,
    toutLabel: string,
  ): { intitule: string; lignes: LignePaie[] }[] => {
    if (choix) return [{ intitule: choix, lignes }]
    const par = new Map<string, LignePaie[]>()
    for (const l of lignes) par.set(cle(l), [...(par.get(cle(l)) ?? []), l])
    if (par.size <= 1) return [{ intitule: [...par.keys()][0] ?? toutLabel, lignes }]
    return [...par.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([intitule, l]) => ({ intitule, lignes: l }))
  }
  // La clé de modèle prime sur le nom : une société renommée garde son siège.
  const { data: cleModele } = useModeleSociete(companyId)

  const groupes = useMemo(() => {
    const cle = (m: string | null) => {
      const v = (m ?? '').toLowerCase()
      if (v.startsWith('vir')) return 'Virement'
      if (v.startsWith('vers')) return 'Versement'
      if (v.startsWith('esp')) return 'Espèces'
      return m?.trim() || 'Sans mode de règlement'
    }
    const ORDRE = ['Virement', 'Versement', 'Espèces']
    const par = new Map<string, LignePaie[]>()
    for (const l of filtrees) {
      const k = cle(l.mode_reglement)
      par.set(k, [...(par.get(k) ?? []), l])
    }
    return [...par.entries()]
      .sort(([a], [b]) => {
        const ia = ORDRE.indexOf(a), ib = ORDRE.indexOf(b)
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'fr')
      })
      .map(([mode, liste]) => ({ mode, liste, totaux: totauxDe(liste) }))
  }, [filtrees])

  const exporter = async (
    format: 'excel' | 'pdf',
    sousEnsemble?: { lignes: LignePaie[]; libelle: string },
  ) => {
    if (!lignes) return
    setExportEnCours(format)
    setErreurExport(null)
    try {
      // L'export reprend exactement ce qui est affiché : si un filtre est
      // actif, on n'exporte que cette sélection, avec ses propres totaux.
      // Un mode de règlement seul s'exporte de la même façon, à son nom.
      const selection = sousEnsemble?.lignes ?? filtrees
      const libelleFiltre = [filtrePrincipal, filtreSite, filtreBanque, filtreReglement, sousEnsemble?.libelle]
        .filter(Boolean).join(' · ')
      const opts = {
        entreprise: company?.name ?? 'Entreprise',
        annee: periode.annee,
        mois: periode.mois,
        lignes: selection,
        totaux: sousEnsemble ? totauxDe(selection) : filtreActif ? totauxFiltres : totaux,
        filtre: libelleFiltre || undefined,
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
    recalculer.error ?? demanderValidation.error ?? annulerDemande.error ??
    repondreValidation.error ?? demanderReouverture.error ?? repondre.error

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
            {/* Imprimer ouvre le document du mode choisi — l'ordre de
                virement, la liste des versements, les reçus d'espèces —
                dans le modèle papier qui lui revient. */}
            <button
              onClick={imprimerLaSelection}
              disabled={!filtreReglement || filtrees.length === 0}
              title={
                filtreReglement
                  ? `Imprimer : ${filtreReglement.toLowerCase()}`
                  : 'Choisissez d’abord Espèces, Virement ou Versement'
              }
              className="rounded-lg border border-slate-800 bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              Imprimer
            </button>
            {modifiable && (
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

      {/* Le parcours. D'abord quatre cartes : tout, espèces, virement,
          versement. Puis, selon la carte, le site ou la banque. Chaque
          choix réduit le tableau ; on en change quand on veut. */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[{ mode: '', n: lignes?.length ?? 0, total: etapes.modes.reduce((t, m) => t + m.total, 0) }, ...['Espèces', 'Virement', 'Versement']
          .map((m) => etapes.modes.find((x) => x.mode === m) ?? { mode: m, n: 0, total: 0 })]
          .map((c) => {
            const actif = filtreReglement === c.mode
            return (
              <button
                key={c.mode || 'tout'}
                onClick={() => ouvrirMode(c.mode)}
                disabled={!c.mode ? false : c.n === 0}
                className={`rounded-xl border p-3 text-left transition disabled:opacity-40 ${
                  actif
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <span className="block text-xs font-semibold tracking-wide uppercase">
                  {c.mode || 'Tout'}
                </span>
                <span className={`mt-1 block text-lg font-semibold tabular-nums ${actif ? '' : 'text-slate-900'}`}>
                  {formatDH(c.total)}
                </span>
                <span className={`block text-xs ${actif ? 'text-slate-300' : 'text-slate-500'}`}>
                  {c.n} employé{c.n > 1 ? 's' : ''}
                </span>
              </button>
            )
          })}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {filtreReglement && filtreReglement !== 'Espèces' && (
          <button
            onClick={() => setChoixOuvert(filtreReglement)}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:border-slate-400"
          >
            {filtreReglement === 'Versement' ? 'Banque' : 'Site'} :{' '}
            <span className="font-semibold">
              {secondeActive || `Tout (${etapes.secondes.length})`}
            </span>
            <span className="ml-2 text-slate-400">changer</span>
          </button>
        )}

        {!filtreReglement && valeurs.principaux.length > 0 && (
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

        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un nom, un matricule…"
          className="w-52 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />

        {filtreActif && (
          <button
            onClick={() => {
              setRecherche(''); setFiltreReglement(''); setFiltreSite('')
              setFiltreBanque(''); setFiltrePrincipal('')
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
              <th className="px-3 py-3 text-right font-medium">Transport</th>
              <th className="px-3 py-3 text-right font-medium">Panier</th>
              <th className="px-3 py-3 text-right font-medium">Prime</th>
              <th className="px-3 py-3 text-right font-medium">Dette</th>
              <th className="px-3 py-3 text-right font-medium">Autres</th>
              <th className="px-3 py-3 text-right font-medium">Net à payer</th>
              <th className="px-3 py-3 font-medium">Règlement</th>
            </tr>
          </thead>
          {groupes.map((g) => (
            <tbody key={g.mode} className="divide-y divide-slate-100">
              <tr className="bg-slate-100">
                <td colSpan={99} className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                      {g.mode}
                      <span className="ml-2 font-normal normal-case text-slate-500">
                        {g.liste.length} employé{g.liste.length > 1 ? 's' : ''} ·{' '}
                        {formatDH(g.totaux.total_net)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {g.mode === 'Espèces' && (
                        <button
                          onClick={() => imprimerPour('Espèces', g.liste)}
                          className="rounded-md border border-slate-900 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                          title="Les talons à faire signer, trois par feuille"
                        >
                          Reçus
                        </button>
                      )}
                      {g.mode === 'Versement' && (
                        <button
                          onClick={() => imprimerPour('Versement', g.liste)}
                          className="rounded-md border border-slate-900 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                          title="La liste de ce qui est affiché — un site par liste si aucun n’est choisi"
                        >
                          Liste des versements
                        </button>
                      )}
                      {g.mode === 'Virement' && (
                        <button
                          onClick={() => imprimerPour('Virement', g.liste)}
                          className="rounded-md border border-slate-900 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                          title="Le formulaire pour la banque — une feuille par banque si aucune n’est choisie"
                        >
                          Ordre de virement
                        </button>
                      )}
                    {groupes.length > 1 && (
                      <>
                        <button
                          onClick={() => exporter('pdf', { lignes: g.liste, libelle: g.mode })}
                          disabled={exportEnCours != null}
                          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          title={`Imprimer uniquement les ${g.mode.toLowerCase()}`}
                        >
                          PDF {g.mode.toLowerCase()}
                        </button>
                        <button
                          onClick={() => exporter('excel', { lignes: g.liste, libelle: g.mode })}
                          disabled={exportEnCours != null}
                          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Excel
                        </button>
                      </>
                    )}
                    </span>
                  </div>
                </td>
              </tr>
              {g.liste.map((l) => (
                <LigneRow
                  key={l.id}
                  ligne={l}
                  modifiable={modifiable}
                  resteDette={dettes?.get(l.employee_id) ?? 0}
                  onSaved={invalider}
                  />
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {versements && (
        <ListeVersementsPrint
          lignes={versements.lignes}
          precision={versements.precision}
          entreprise={company?.name ?? ''}
          modeleDocument={cleModele}
          annee={periode.annee}
          mois={periode.mois}
          onClose={() => setVersements(null)}
        />
      )}

      {choixOuvert && (
        <ChoixDansLaPaie
          titre={choixOuvert === 'Virement' ? 'Virements' : 'Versements'}
          question={
            choixOuvert === 'Versement'
              ? 'Quelle banque voulez-vous voir ?'
              : 'Quel site voulez-vous voir ?'
          }
          options={etapes.secondes}
          choisi={secondeActive}
          totalGeneral={etapes.totalDuMode}
          nGeneral={etapes.nDuMode}
          onChoisir={choisirSeconde}
          onClose={() => setChoixOuvert(null)}
        />
      )}

      {recus && (
        <RecusEspecePrint
          lignes={recus}
          entreprise={company?.name ?? ''}
          modeleDocument={cleModele}
          annee={periode.annee}
          mois={periode.mois}
          onClose={() => setRecus(null)}
        />
      )}

      {ordres && (
        <OrdreVirementPrint
          ordres={ordres}
          entreprise={company?.name ?? ''}
          modeleDocument={cleModele}
          ribOrdinateur={company?.rib_ordinateur ?? null}
          annee={periode.annee}
          mois={periode.mois}
          onClose={() => setOrdres(null)}
        />
      )}

      {/* La clôture, à deux mains : le bureau demande, l'administrateur
          accepte. Tant que le mois court, rien à valider — la paie se
          contente de suivre le pointage. */}
      {estPaie && !verrouille && !enDemande && !attendAdmin && lignes && lignes.length > 0 && (
        moisTermine ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">
              Clôturer {moisLabel(periode.annee, periode.mois)}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Le mois est terminé. En demandant la validation, vous figez la paie : plus de
              pointage ni de saisie dessus, le temps que l’administrateur l’examine. C’est lui
              qui la valide pour de bon.
            </p>
            <button
              onClick={() => demanderValidation.mutate()}
              disabled={demanderValidation.isPending}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {demanderValidation.isPending ? 'Envoi…' : 'Demander la validation'}
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Le mois est en cours : cette paie se met à jour à chaque pointage. La validation
            s’ouvrira le {new Intl.DateTimeFormat('fr-FR').format(dernierJour)}.
          </p>
        )
      )}

      {/* Demandé : le bureau attend, l'administrateur tranche. */}
      {attendAdmin && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Validation demandée pour {moisLabel(periode.annee, periode.mois)}
          </p>
          <p className="mt-1 text-sm text-amber-800">
            {estAdmin
              ? 'Accepter impute les retenues de dette et verrouille le mois. Refuser le rouvre : le bureau pourra le corriger.'
              : 'La paie est figée en attendant la réponse de l’administrateur. Vous pouvez encore retirer la demande.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {estAdmin && (
              <>
                <button
                  onClick={() => repondreValidation.mutate(true)}
                  disabled={repondreValidation.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {repondreValidation.isPending ? '…' : 'Accepter et verrouiller le mois'}
                </button>
                <button
                  onClick={() => repondreValidation.mutate(false)}
                  disabled={repondreValidation.isPending}
                  className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  Refuser et rouvrir
                </button>
              </>
            )}
            {!estAdmin && (
              <button
                onClick={() => annulerDemande.mutate()}
                disabled={annulerDemande.isPending}
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                {annulerDemande.isPending ? '…' : 'Retirer la demande'}
              </button>
            )}
          </div>
        </div>
      )}

   </div>
  )
}


/** Une ligne de paie : les montants ajustables sont éditables sur place. */
function LigneRow({
  ligne,
  modifiable,
  resteDette,
  onSaved,
}: {
  ligne: LignePaie
  modifiable: boolean
  resteDette: number
  onSaved: () => void
}) {
  const [prime, setPrime] = useState(String(ligne.prime ?? 0))
  const [dette, setDette] = useState(String(ligne.retenue_dette ?? 0))
  const [autres, setAutres] = useState(String(ligne.autres_retenues ?? 0))
  // Le montant change d'un mois à l'autre : il se saisit ici, pas sur la fiche.
  const [transport, setTransport] = useState(String(ligne.frais_transport ?? 0))
  const [panier, setPanier] = useState(String(ligne.frais_panier ?? 0))

  useEffect(() => {
    setPrime(String(ligne.prime ?? 0))
    setDette(String(ligne.retenue_dette ?? 0))
    setAutres(String(ligne.autres_retenues ?? 0))
    setTransport(String(ligne.frais_transport ?? 0))
    setPanier(String(ligne.frais_panier ?? 0))
  }, [ligne.prime, ligne.retenue_dette, ligne.autres_retenues,
      ligne.frais_transport, ligne.frais_panier])

  const enregistrer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('maj_ligne_paie', {
        p_ligne: ligne.id,
        p_prime: Number(prime) || 0,
        p_retenue_dette: Number(dette) || 0,
        p_autres_retenues: Number(autres) || 0,
        p_observations: null,
        p_frais_transport: Number(transport) || 0,
        p_frais_panier: Number(panier) || 0,
      })
      if (error) throw error
    },
    onSuccess: onSaved,
  })

  const modifie =
    Number(prime) !== Number(ligne.prime) ||
    Number(dette) !== Number(ligne.retenue_dette) ||
    Number(autres) !== Number(ligne.autres_retenues) ||
    Number(transport) !== Number(ligne.frais_transport) ||
    Number(panier) !== Number(ligne.frais_panier)

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
      <td className="px-3 py-2 text-right">{champ(transport, setTransport)}</td>
      <td className="px-3 py-2 text-right">{champ(panier, setPanier)}</td>
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
    </tr>
  )
}
