import { useFermerSurEchap } from '../lib/impression'

/**
 * Deux façons d'imprimer la même sélection, et le choix n'est pas
 * cosmétique : la liste complète porte les salaires, les adresses et les
 * téléphones, la liste simplifiée s'arrête au nom, au C.I.N. et au numéro
 * C.N.S.S. C'est celle qu'on remet au client — d'où le rappel explicite.
 */
export default function ChoixImpression({
  nombre,
  siteNom,
  onComplete,
  onSimplifiee,
  onClose,
}: {
  nombre: number
  /** L'annexe filtrée, s'il y en a une : elle nomme le document. */
  siteNom: string | null
  onComplete: () => void
  onSimplifiee: () => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Imprimer la liste</h2>
        <p className="mt-1 text-sm text-slate-500">
          {nombre} employé(s)
          {siteNom ? (
            <> sur <strong className="text-slate-700">{siteNom}</strong>.</>
          ) : (
            <> — toute la sélection en cours.</>
          )}{' '}
          Que doit montrer le document ?
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Choix
            titre="Liste complète"
            pour="Usage interne"
            detail="Qualification, dates, contact, ville, règlement, salaire, gardes — regroupés par annexe."
            avertissement="Contient les salaires."
            onClick={onComplete}
          />
          <Choix
            titre="Liste simplifiée"
            pour="À remettre au client"
            detail="N°, nom et prénom, C.I.N., n° C.N.S.S. Rien d’autre ne sort."
            recommande
            onClick={onSimplifiee}
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

function Choix({
  titre, pour, detail, avertissement, recommande, onClick,
}: {
  titre: string
  pour: string
  detail: string
  avertissement?: string
  recommande?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col rounded-xl border p-4 text-left transition hover:bg-slate-50 ${
        recommande ? 'border-slate-900' : 'border-slate-300'
      }`}
    >
      <span className="block text-sm font-semibold text-slate-900">{titre}</span>
      <span className="mt-0.5 block text-xs font-medium tracking-wide text-slate-500 uppercase">
        {pour}
      </span>
      <span className="mt-2 block text-sm text-slate-600">{detail}</span>
      {avertissement && (
        <span className="mt-2 block text-xs font-medium text-amber-700">{avertissement}</span>
      )}
    </button>
  )
}
