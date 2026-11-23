import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatDateFr, formatTimeFr } from '../lib/dates'
import type { DayPointage, SiteEmployee } from '../lib/queries'
import type { Site } from '../lib/types'
import {
  TYPES_ABSENCE,
  TYPES_FERIE,
  TYPES_REPOS,
  TYPES_TRAVAIL,
  gardeCouleur,
  gardeLabel,
  gardeSymbole,
  type TypeGarde,
} from '../lib/gardes'
import { ErrorNote } from './ui'

/**
 * UNE CASE DU POINTAGE, ET CE QU'ON EN FAIT.
 *
 * La case se lit d'un coup d'œil : sa lettre et sa couleur disent ce
 * qu'a été la journée. La fenêtre qui s'ouvre dessus porte le reste —
 * la photo s'il y en a une, le choix de la lettre, et les gestes du
 * bureau : valider, refuser, corriger, effacer.
 *
 * Les deux vivent ici, et non dans un écran, parce que deux écrans s'en
 * servent : la grille du mois et celle d'origine.
 */

/** Cellule sélectionnée dans la grille (pour le détail / les actions). */
export interface CellSelection {
  employee: SiteEmployee
  site: Site
  date: string
  pointage: DayPointage | null
}

export function DayCell({
  pointage,
  isFuture,
  onClick,
  large = false,
}: {
  pointage: DayPointage | null
  isFuture: boolean
  onClick: () => void
  /** Dans une carte de téléphone, la case prend toute sa colonne. */
  large?: boolean
}) {
  let cls = 'bg-slate-100 text-slate-400'
  let label = '–'
  let title = 'Absent — cliquer pour marquer présent ou justifier'

  if (pointage?.status === 'validated') {
    cls = gardeCouleur(pointage.type_garde)
    label = gardeSymbole(pointage.type_garde)
    title = `${gardeLabel(pointage.type_garde)} — cliquer pour modifier`
  } else if (pointage?.status === 'pending') {
    cls = 'bg-amber-400 text-white animate-pulse'
    label = '!'
    title = 'Photo en attente de validation'
  } else if (pointage?.status === 'refused') {
    cls = 'bg-red-500 text-white'
    label = '✕'
    title = 'Refusé'
  } else if (isFuture) {
    // On ne pointe pas l'avenir : la case est là, mais éteinte.
    return (
      <span
        title="Jour à venir"
        className={`inline-block rounded-lg bg-slate-50 ${large ? 'h-10 w-full' : 'h-7 w-8'}`}
      />
    )
  }

  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center rounded-lg font-bold transition hover:scale-110 ${
        large ? 'h-10 w-full text-sm' : 'h-7 w-8 text-xs'
      } ${cls}`}
    >
      {label}
    </button>
  )
}

export function CellModal({ selection, onClose }: { selection: CellSelection; onClose: () => void }) {
  const { employee, site, date, pointage } = selection
  const queryClient = useQueryClient()
  const [zoom, setZoom] = useState(false)
  const [type, setType] = useState<TypeGarde>((pointage?.type_garde as TypeGarde) ?? 'X')

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['site-week-pointages', site.id] })
    queryClient.invalidateQueries({ queryKey: ['site-pointages', site.id] })
    queryClient.invalidateQueries({ queryKey: ['employees'] })
  }

  const decide = useMutation({
    mutationFn: async (decision: 'validated' | 'refused') => {
      const { error } = await supabase.rpc('validate_pointage', {
        p_pointage_id: pointage!.id,
        p_decision: decision,
        p_type: type,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const changerType = useMutation({
    mutationFn: async (newType: TypeGarde) => {
      const { error } = await supabase.rpc('changer_type_garde', {
        p_pointage_id: pointage!.id,
        p_type: newType,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const marquer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('marquer_present', {
        p_employee_id: employee.id,
        p_date: date,
        p_type: type,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const supprimer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('supprimer_pointage', { p_pointage_id: pointage!.id })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const { data: photoUrl } = useQuery({
    queryKey: ['photo-url', pointage?.photo_path],
    enabled: Boolean(pointage?.photo_path),
    staleTime: 55 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('pointages')
        .createSignedUrl(pointage!.photo_path!, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })

  const mutationError =
    decide.error ?? marquer.error ?? changerType.error ?? supprimer.error
  const estConge = Boolean(pointage?.conge_id)

  const boutonType = (t: (typeof TYPES_TRAVAIL)[number]) => {
    const active = type === t.code
    return (
      <button
        key={t.code}
        title={t.valeur === 0 ? t.label : `${t.label} (${t.valeur.toLocaleString('fr-FR')} garde)`}
        disabled={estConge}
        onClick={() => {
          setType(t.code)
          if (pointage?.status === 'validated') changerType.mutate(t.code)
        }}
        className={`rounded-lg border px-2 py-2 text-center transition disabled:opacity-40 ${
          active
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
      >
        <span className="block text-base font-bold">{t.symbole}</span>
        <span className="block text-[10px] leading-tight">
          {t.valeur === 0 ? '—' : `${t.valeur.toLocaleString('fr-FR')} g.`}
        </span>
      </button>
    )
  }

  return (
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">{employee.nom_prenom}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {site.name} · {formatDateFr(date)}
          {pointage && (
            <>
              {' '}·{' '}
              {pointage.photo_path
                ? `Pointé à ${formatTimeFr(pointage.pointed_at)}`
                : 'Saisi par le bureau'}
            </>
          )}
        </p>

        {estConge && (
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Ce jour fait partie d’un congé enregistré. Pour le modifier, passez par la fiche
            de l’employé (onglet Employés → Congés).
          </div>
        )}

        {pointage?.photo_path && photoUrl && (
          <button onClick={() => setZoom(true)} className="mb-4 block w-full">
            <img
              src={photoUrl}
              alt="Photo de pointage"
              className="max-h-64 w-full rounded-xl object-cover ring-1 ring-slate-200"
            />
          </button>
        )}
        {pointage?.photo_path && !photoUrl && (
          <div className="mb-4 h-40 w-full animate-pulse rounded-xl bg-slate-200" />
        )}

        {pointage?.status !== 'refused' && (
          <div className="mb-4">
            <p className="mb-1.5 text-sm font-medium text-slate-700">Jour travaillé</p>
            <div className="grid grid-cols-5 gap-1.5">{TYPES_TRAVAIL.map(boutonType)}</div>

            <p className="mb-1.5 mt-3 text-sm font-medium text-slate-700">Repos</p>
            <div className="grid grid-cols-4 gap-1.5">{TYPES_REPOS.map(boutonType)}</div>

            <p className="mb-1.5 mt-3 text-sm font-medium text-slate-700">Jour férié</p>
            <div className="grid grid-cols-4 gap-1.5">{TYPES_FERIE.map(boutonType)}</div>

            <p className="mb-1.5 mt-3 text-sm font-medium text-slate-700">Absence approuvée</p>
            <div className="grid grid-cols-4 gap-1.5">{TYPES_ABSENCE.map(boutonType)}</div>

            <p className="mt-2 text-xs text-slate-500">{gardeLabel(type)}</p>
          </div>
        )}

        {mutationError && (
          <div className="mb-3">
            <ErrorNote>{mutationError.message}</ErrorNote>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Fermer
          </button>

          {/* Supprimer un jour saisi à la main (hors congé) */}
          {pointage?.status === 'validated' && !pointage.photo_path && !estConge && (
            <button
              onClick={() => supprimer.mutate()}
              disabled={supprimer.isPending}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {supprimer.isPending ? '…' : 'Supprimer'}
            </button>
          )}

          {pointage?.status === 'pending' && (
            <>
              <button
                onClick={() => decide.mutate('refused')}
                disabled={decide.isPending}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Refuser
              </button>
              <button
                onClick={() => decide.mutate('validated')}
                disabled={decide.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Valider ({gardeSymbole(type)})
              </button>
            </>
          )}

          {(!pointage || pointage.status === 'refused') && (
            <button
              onClick={() => marquer.mutate()}
              disabled={marquer.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {marquer.isPending ? '…' : `Enregistrer (${gardeSymbole(type)})`}
            </button>
          )}
        </div>
      </div>

      {zoom && photoUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => {
            e.stopPropagation()
            setZoom(false)
          }}
        >
          <img src={photoUrl} alt="Photo de pointage" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}
