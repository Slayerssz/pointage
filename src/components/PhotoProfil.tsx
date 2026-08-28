import { useRef } from 'react'
import { useDeposerPhoto, usePhotoProfil, useSupprimerPhoto } from '../lib/documents'
import type { Employee } from '../lib/types'
import { ErrorNote } from './ui'

/** Initiales, affichées tant qu'aucune photo n'a été déposée. */
function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Photo de profil de l'employé.
 * Sur téléphone, « Prendre une photo » ouvre directement l'appareil photo.
 */
export default function PhotoProfil({ employee }: { employee: Employee }) {
  const { data: url, isLoading } = usePhotoProfil(employee.photo_path)
  const deposer = useDeposerPhoto(employee.company_id, employee.id)
  const supprimer = useSupprimerPhoto(employee.id)
  const fichier = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)

  const erreur = deposer.error ?? supprimer.error

  const choisir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) deposer.mutate(f)
    e.target.value = ''
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          {url ? (
            <img src={url} alt={`Photo de ${employee.nom_prenom}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-400">
              {isLoading && employee.photo_path ? '…' : initiales(employee.nom_prenom)}
            </div>
          )}
          {deposer.isPending && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-medium text-slate-600">
              Envoi…
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-slate-700">Photo de profil</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => camera.current?.click()}
              disabled={deposer.isPending}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Prendre une photo
            </button>
            <button
              onClick={() => fichier.current?.click()}
              disabled={deposer.isPending}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Choisir un fichier
            </button>
            {employee.photo_path && (
              <button
                onClick={() => supprimer.mutate(employee.photo_path!)}
                disabled={supprimer.isPending}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Retirer
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">JPG ou PNG, 5 Mo maximum.</p>
        </div>
      </div>

      <input ref={camera} type="file" accept="image/*" capture="user" className="hidden" onChange={choisir} />
      <input ref={fichier} type="file" accept="image/*" className="hidden" onChange={choisir} />

      {erreur && (
        <div className="mt-3">
          <ErrorNote>{erreur.message}</ErrorNote>
        </div>
      )}
    </div>
  )
}
