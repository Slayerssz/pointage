import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatDH, moisLabel, usePeriodeDuMois } from '../../lib/paie'
import { useBulletins, type SaisieBulletin as Saisie } from '../../lib/bulletin'
import SaisieBulletin from '../../components/SaisieBulletin'
import { useModeleSociete } from '../../lib/modeleSociete'
import BulletinPaiePrint from '../../components/BulletinPaiePrint'
import RecapPaiePrint from '../../components/RecapPaiePrint'
import { EmptyState, ErrorNote, Spinner } from '../../components/ui'

/**
 * LES BULLETINS DE PAIE.
 *
 * Un mois, et ce qu'on en tire : un bulletin par personne, l'état
 * d'ensemble pour la banque et le comptable, ou le bulletin d'un seul
 * employé qu'on cherche par son nom.
 *
 * Le bulletin ne concerne que les employés payés par virement : ce sont
 * les seuls déclarés à la C.N.S.S.
 */
export default function BulletinsPage() {
  const { companyId } = useParams()
  const maintenant = new Date()
  const [annee, setAnnee] = useState(maintenant.getFullYear())
  const [mois, setMois] = useState(maintenant.getMonth() + 1)
  const { data: periode, isLoading, error } = usePeriodeDuMois(companyId, annee, mois)

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

  const decaler = (pas: number) => {
    const d = new Date(annee, mois - 1 + pas, 1)
    setAnnee(d.getFullYear())
    setMois(d.getMonth() + 1)
  }
  const estMoisCourant = annee === maintenant.getFullYear() && mois === maintenant.getMonth() + 1

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Bulletins de paie</h1>
        <p className="text-sm text-slate-500">
          Le bulletin ne concerne que les employés payés par <strong>virement</strong> : ce sont
          les seuls déclarés à la C.N.S.S. Un par personne, ou l’état d’ensemble du mois.
        </p>
      </div>

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
      </div>

      {isLoading && <Spinner label="Ouverture du mois…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}
      {!isLoading && !error && !periode && (
        <EmptyState>Ce mois n’a pas encore commencé.</EmptyState>
      )}

      {periode && (
        <BulletinsDuMois
          periodeId={periode.id}
          entreprise={company?.name ?? 'Entreprise'}
          companyId={companyId}
        />
      )}
    </div>
  )
}

/** Ce qu'on peut éditer pour un mois donné, une fois ses bulletins chargés. */
function BulletinsDuMois({
  periodeId, entreprise, companyId,
}: { periodeId: string; entreprise: string; companyId: string | undefined }) {
  const { data: cleModele } = useModeleSociete(companyId)
  const { data, isLoading, error } = useBulletins(periodeId, null)
  const [forme, setForme] = useState<'individuel' | 'recap' | null>(null)
  // Demander le bulletin de quelqu'un passe par trois questions : le
  // brut, les jours, l'avance. Tant qu'on n'y a pas répondu, rien ne sort.
  const [aSaisir, setASaisir] = useState<string | null>(null)
  const [unSeul, setUnSeul] = useState<{ id: string; saisie: Saisie } | null>(null)
  const [recherche, setRecherche] = useState('')

  if (isLoading) return <Spinner label="Préparation des bulletins…" />
  if (error) {
    return (
      <ErrorNote>
        {error.message}
        {error.message.includes('bulletin_paie') && (
          <> Le BLOC 15 n’a peut-être pas encore été exécuté dans Supabase.</>
        )}
      </ErrorNote>
    )
  }
  if (!data || data.length === 0) {
    return (
      <EmptyState>
        Aucun bulletin pour ce mois. Le bulletin ne concerne que les employés payés par
        virement, les seuls déclarés à la C.N.S.S.
      </EmptyState>
    )
  }

  // Impression en cours : le document occupe tout l'écran.
  if (forme === 'recap') {
    return <RecapPaiePrint bulletins={data} entreprise={entreprise}
                           modeleDocument={cleModele} onClose={() => setForme(null)} />
  }
  if (forme === 'individuel') {
    return <BulletinPaiePrint bulletins={data} entreprise={entreprise}
                              modeleDocument={cleModele} onClose={() => setForme(null)} />
  }
  if (unSeul) {
    return (
      <BulletinUnSeul
        periodeId={periodeId}
        employeeId={unSeul.id}
        saisie={unSeul.saisie}
        entreprise={entreprise}
        modeleDocument={cleModele}
        onClose={() => setUnSeul(null)}
      />
    )
  }

  const q = recherche.trim().toLowerCase()
  const filtres = q
    ? data.filter((b) =>
        b.employe.nom_prenom.toLowerCase().includes(q) ||
        String(b.employe.matricule ?? '').includes(q))
    : data
  const total = data.reduce((s, b) => s + Number(b.pied.net_a_payer), 0)

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Forme
          titre="Un bulletin par employé"
          pour="À remettre à chacun"
          detail={`${data.length} page${data.length > 1 ? 's' : ''} A4, une par personne, avec le détail de ses cotisations et son net.`}
          onClick={() => setForme('individuel')}
        />
        <Forme
          titre="Un état pour tout le monde"
          pour="Pour la banque et le comptable"
          detail="Une ligne par employé, regroupée par site, avec sous-totaux et total général. A4 paysage."
          onClick={() => setForme('recap')}
        />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
            Le bulletin d’une seule personne
          </h2>
          <span className="text-sm text-slate-500">
            {data.length} employé(s) par virement · {formatDH(total)}
          </span>
        </div>
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un nom, un matricule…"
          className="mb-3 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        {filtres.length === 0 && (
          <p className="text-sm text-slate-500">Personne ne correspond à cette recherche.</p>
        )}

        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {filtres.map((b) => (
            <li key={b.ligne_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  {b.employe.matricule != null && (
                    <span className="mr-2 text-slate-400 tabular-nums">{b.employe.matricule}</span>
                  )}
                  {b.employe.nom_prenom}
                </span>
                <span className="block text-xs text-slate-500">
                  {b.employe.site_nom ?? '—'}
                  {b.employe.banque ? ` · ${b.employe.banque}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatDH(b.pied.net_a_payer)}
                </span>
                <button
                  onClick={() => setASaisir(b.employe.id)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Bulletin
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {aSaisir && (
        <SaisieBulletin
          nom={data.find((b) => b.employe.id === aSaisir)?.employe.nom_prenom ?? ''}
          onValider={(v) => { setUnSeul({ id: aSaisir, saisie: v }); setASaisir(null) }}
          onClose={() => setASaisir(null)}
        />
      )}
    </>
  )
}

/**
 * Le bulletin d'une seule personne, recalculé d'après ce qui vient
 * d'être saisi. C'est la base qui refait le calcul : les taux et le
 * barème de l'I.G.R. sont chez elle, pas ici.
 */
function BulletinUnSeul({
  periodeId, employeeId, saisie, entreprise, modeleDocument, onClose,
}: {
  periodeId: string
  employeeId: string
  saisie: Saisie
  entreprise: string
  modeleDocument?: string | null
  onClose: () => void
}) {
  const { data, isLoading, error } = useBulletins(periodeId, employeeId, saisie)
  if (isLoading) return <Spinner label="Établissement du bulletin…" />
  if (error) return <ErrorNote>{error.message}</ErrorNote>
  if (!data || data.length === 0) {
    return <EmptyState>Ce bulletin n’a pas pu être établi.</EmptyState>
  }
  return (
    <BulletinPaiePrint bulletins={data} entreprise={entreprise}
                       modeleDocument={modeleDocument} onClose={onClose} />
  )
}

function Forme({
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
