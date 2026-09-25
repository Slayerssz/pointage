import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { formatDH, moisLabel } from '../lib/paie'
import { formatDateFr } from '../lib/dates'
import {
  useBulletinsEmis, useDemanderModification, useRepondreModification,
  useSupprimerBulletin, type BulletinEmis,
} from '../lib/archiveBulletins'
import BulletinPaiePrint from './BulletinPaiePrint'
import { useModeleSociete } from '../lib/modeleSociete'
import { EmptyState, ErrorNote, Spinner } from './ui'
import { useFermerSurEchap } from '../lib/impression'

/**
 * TOUS LES BULLETINS DÉJÀ ÉTABLIS.
 *
 * Chacun se rouvre et se réimprime tel qu'il a été remis. On ne le
 * corrige pas d'un clic : on demande la modification, l'administrateur
 * l'autorise, et alors seulement le bulletin peut être refait — une
 * fois. La suppression, elle, n'appartient qu'à l'administrateur.
 */
export default function ArchiveBulletins({
  companyId, entreprise,
}: { companyId: string | undefined; entreprise: string }) {
  const { profile } = useAuth()
  const estAdmin = profile?.role === 'admin'
  const { data, isLoading, error } = useBulletinsEmis(companyId)
  const { data: cleModele } = useModeleSociete(companyId)

  const [ouvert, setOuvert] = useState<BulletinEmis | null>(null)
  const [aDemander, setADemander] = useState<BulletinEmis | null>(null)
  const [aSupprimer, setASupprimer] = useState<BulletinEmis | null>(null)
  const [recherche, setRecherche] = useState('')

  const repondre = useRepondreModification(companyId)
  const supprimer = useSupprimerBulletin(companyId)

  if (isLoading) return <Spinner label="Lecture des bulletins établis…" />
  if (error) {
    return (
      <ErrorNote>
        {error.message}
        {error.message.includes('bulletins_emis') && (
          <> Le BLOC 37 n’a peut-être pas encore été exécuté dans Supabase.</>
        )}
      </ErrorNote>
    )
  }

  // Le bulletin conservé, réimprimé tel quel.
  if (ouvert) {
    return (
      <BulletinPaiePrint
        bulletins={[ouvert.document]}
        entreprise={entreprise}
        modeleDocument={cleModele}
        onClose={() => setOuvert(null)}
      />
    )
  }

  const q = recherche.trim().toLowerCase()
  const liste = (data ?? []).filter(
    (b) => !q || b.nom_prenom.toLowerCase().includes(q) || String(b.matricule ?? '').includes(q),
  )

  // Regroupés par mois, du plus récent au plus ancien.
  const mois: { cle: string; titre: string; bulletins: BulletinEmis[] }[] = []
  for (const b of liste) {
    const cle = `${b.annee}-${b.mois}`
    const dernier = mois[mois.length - 1]
    if (dernier?.cle === cle) dernier.bulletins.push(b)
    else mois.push({ cle, titre: moisLabel(b.annee, b.mois), bulletins: [b] })
  }

  const enAttente = (data ?? []).filter((b) => b.modification_demandee_le && !b.modification_autorisee)

  return (
    <section>
      <p className="mb-3 text-sm text-slate-500">
        {(data ?? []).length} bulletin{(data ?? []).length > 1 ? 's' : ''} conservé
        {(data ?? []).length > 1 ? 's' : ''}. Chacun se rouvre tel qu’il a été remis. Pour
        en corriger un, demandez la modification : l’administrateur doit l’autoriser.
      </p>

      {estAdmin && enAttente.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">
            {enAttente.length} modification{enAttente.length > 1 ? 's' : ''} à autoriser
          </h3>
          <ul className="mt-2 space-y-2">
            {enAttente.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-sm text-amber-900">
                  <span className="font-medium">{b.nom_prenom}</span>
                  <span className="text-amber-700"> · {moisLabel(b.annee, b.mois)}</span>
                  <span className="block text-xs text-amber-800">« {b.modification_motif} »</span>
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => repondre.mutate({ id: b.id, autoriser: true })}
                    disabled={repondre.isPending}
                    className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
                  >
                    Autoriser
                  </button>
                  <button
                    onClick={() => repondre.mutate({ id: b.id, autoriser: false })}
                    disabled={repondre.isPending}
                    className="rounded-lg border border-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40"
                  >
                    Refuser
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(data ?? []).length > 0 && (
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un nom, un matricule…"
          className="mb-3 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}

      {(data ?? []).length === 0 && (
        <EmptyState>
          Aucun bulletin n’a encore été établi. Ceux que vous éditerez se rangeront ici.
        </EmptyState>
      )}
      {(data ?? []).length > 0 && liste.length === 0 && (
        <p className="text-sm text-slate-500">Personne ne correspond à cette recherche.</p>
      )}

      {mois.map((m) => (
        <div key={m.cle} className="mb-4">
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {m.titre}
          </h3>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {m.bulletins.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">
                    {b.matricule != null && (
                      <span className="mr-2 text-slate-400 tabular-nums">{b.matricule}</span>
                    )}
                    {b.nom_prenom}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Établi le {formatDateFr(b.cree_le.slice(0, 10))}
                    {Number(b.avance) > 0 && ` · avance ${formatDH(b.avance)}`}
                    {b.modification_autorisee && (
                      <span className="font-medium text-emerald-700">
                        {' '}· modification autorisée
                      </span>
                    )}
                    {b.modification_demandee_le && !b.modification_autorisee && (
                      <span className="font-medium text-amber-700"> · modification demandée</span>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatDH(b.net_a_payer)}
                  </span>
                  <button
                    onClick={() => setOuvert(b)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Voir
                  </button>
                  {!b.modification_autorisee && !b.modification_demandee_le && (
                    <button
                      onClick={() => setADemander(b)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Modifier
                    </button>
                  )}
                  {estAdmin && (
                    <button
                      onClick={() => setASupprimer(b)}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {repondre.error && <ErrorNote>{repondre.error.message}</ErrorNote>}
      {supprimer.error && <ErrorNote>{supprimer.error.message}</ErrorNote>}

      {aDemander && (
        <DemanderModification
          bulletin={aDemander}
          companyId={companyId}
          onClose={() => setADemander(null)}
        />
      )}

      {aSupprimer && (
        <Confirmer
          titre={`Supprimer le bulletin de ${aSupprimer.nom_prenom} ?`}
          detail={`${moisLabel(aSupprimer.annee, aSupprimer.mois)} · ${formatDH(aSupprimer.net_a_payer)}. Le document conservé sera perdu : il faudra le refaire pour le retrouver.`}
          enCours={supprimer.isPending}
          onConfirmer={() => supprimer.mutate(aSupprimer.id, { onSuccess: () => setASupprimer(null) })}
          onClose={() => setASupprimer(null)}
        />
      )}
    </section>
  )
}

/** La demande de modification : un motif, que l'administrateur lira. */
function DemanderModification({
  bulletin, companyId, onClose,
}: { bulletin: BulletinEmis; companyId: string | undefined; onClose: () => void }) {
  useFermerSurEchap(onClose)
  const [motif, setMotif] = useState('')
  const demander = useDemanderModification(companyId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (motif.trim()) demander.mutate({ id: bulletin.id, motif }, { onSuccess: onClose })
        }}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          Demander à modifier ce bulletin
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {bulletin.nom_prenom} · {moisLabel(bulletin.annee, bulletin.mois)}. Le bulletin ne
          change pas tout de suite : l’administrateur doit d’abord autoriser.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Qu’est-ce qui doit être corrigé ?
          </span>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            autoFocus
            placeholder="ex. Le salaire brut saisi était celui du mois précédent."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        {demander.error && <ErrorNote>{demander.error.message}</ErrorNote>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!motif.trim() || demander.isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {demander.isPending ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Confirmer({
  titre, detail, enCours, onConfirmer, onClose,
}: {
  titre: string; detail: string; enCours: boolean
  onConfirmer: () => void; onClose: () => void
}) {
  useFermerSurEchap(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900">{titre}</h2>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirmer}
            disabled={enCours}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {enCours ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
