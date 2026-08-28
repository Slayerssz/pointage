import { useRef, useState } from 'react'
import {
  formatTaille,
  ouvrirDocument,
  useDeposerDocument,
  useDocuments,
  useSupprimerDocument,
} from '../lib/documents'
import { formatDateFr } from '../lib/dates'
import type { Document } from '../lib/types'
import { ErrorNote } from './ui'

/**
 * Les pièces signées rattachées à un congé ou à un contrat.
 *
 * Circuit : on imprime le document depuis l'application → l'employé signe
 * (et pour un contrat, on fait légaliser) → on scanne → on dépose le fichier ici.
 */
export default function DocumentsSignes({
  companyId,
  employeeId,
  type,
  congeId,
  contratId,
  intitule,
  aide,
}: {
  companyId: string
  employeeId: string
  type: Document['type']
  congeId?: string
  contratId?: string
  /** Ce qu'on attend, en clair (ex. « l'engagement signé »). */
  intitule: string
  /** Phrase d'aide quand aucun fichier n'est encore déposé. */
  aide?: string
}) {
  const { data: docs, isLoading } = useDocuments({ employeeId, congeId, contratId })
  const deposer = useDeposerDocument({ companyId, employeeId, type, congeId, contratId })
  const supprimer = useSupprimerDocument()
  const champ = useRef<HTMLInputElement>(null)
  const [erreurOuverture, setErreurOuverture] = useState<string | null>(null)

  const ouvrir = async (doc: Document) => {
    setErreurOuverture(null)
    try {
      await ouvrirDocument(doc.chemin)
    } catch (e) {
      setErreurOuverture(e instanceof Error ? e.message : String(e))
    }
  }

  const erreur = deposer.error ?? supprimer.error
  const aucun = !isLoading && (docs ?? []).length === 0

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Document signé
        </p>
        <button
          onClick={() => champ.current?.click()}
          disabled={deposer.isPending}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {deposer.isPending ? 'Envoi…' : '+ Joindre un scan'}
        </button>
        <input
          ref={champ}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) deposer.mutate(f)
            e.target.value = ''
          }}
        />
      </div>

      {aucun && (
        <p className="mt-2 text-xs text-slate-500">
          {aide ?? `Aucun scan pour l’instant. Déposez ici ${intitule}.`}{' '}
          PDF ou photo, 10 Mo maximum.
        </p>
      )}

      {(erreur || erreurOuverture) && (
        <div className="mt-2">
          <ErrorNote>{erreur?.message ?? erreurOuverture}</ErrorNote>
        </div>
      )}

      {docs && docs.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
            >
              <button
                onClick={() => ouvrir(d)}
                className="flex min-w-0 items-center gap-2 text-left"
                title="Ouvrir le document"
              >
                <span className="shrink-0 text-slate-400">
                  {d.mime === 'application/pdf' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" />
                      <path d="m3 16 5-5 4 4 3-3 6 6" />
                      <circle cx="9" cy="8" r="1.5" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-slate-800 underline-offset-2 hover:underline">
                    {d.nom_fichier}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {formatDateFr(d.created_at.slice(0, 10))}
                    {d.taille ? ` · ${formatTaille(d.taille)}` : ''}
                  </span>
                </span>
              </button>
              <button
                onClick={() => supprimer.mutate(d)}
                disabled={supprimer.isPending}
                className="shrink-0 rounded px-1.5 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
