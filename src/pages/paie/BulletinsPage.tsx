import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { addDays, dateToIso, formatDateFr, todayIso } from '../../lib/dates'
import { useBulletinJournalier } from '../../lib/paie'
import { exporterBulletinExcel, exporterBulletinPdf } from '../../lib/exports'
import { gardeCouleur, gardeLabel, gardeSymbole } from '../../lib/gardes'
import { EmptyState, ErrorNote, Spinner } from '../../components/ui'

/**
 * Bulletin de présence journalier : chaque site, avec les employés qui y ont
 * travaillé ce jour-là. Imprimable / exportable, un site par page en PDF.
 */
export default function BulletinsPage() {
  const { companyId } = useParams()
  const [date, setDate] = useState(todayIso())
  const { data: sites, isLoading, error } = useBulletinJournalier(companyId, date)
  const [exportEnCours, setExportEnCours] = useState<string | null>(null)
  const [erreurExport, setErreurExport] = useState<string | null>(null)

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

  const total = (sites ?? []).reduce((s, x) => s + x.employes.length, 0)

  const exporter = async (format: 'excel' | 'pdf') => {
    if (!sites?.length) return
    setExportEnCours(format)
    setErreurExport(null)
    try {
      const opts = { entreprise: company?.name ?? 'Entreprise', date, sites }
      if (format === 'excel') await exporterBulletinExcel(opts)
      else await exporterBulletinPdf(opts)
    } catch (e) {
      setErreurExport(e instanceof Error ? e.message : String(e))
    } finally {
      setExportEnCours(null)
    }
  }

  const decaler = (n: number) => setDate(dateToIso(addDays(new Date(date + 'T00:00:00'), n)))

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Bulletin de présence</h1>
          <p className="text-sm text-slate-500">
            Chaque site et les employés qui y ont travaillé, jour par jour.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exporter('excel')}
            disabled={exportEnCours !== null || !sites?.length}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
          >
            {exportEnCours === 'excel' ? 'Export…' : 'Excel'}
          </button>
          <button
            onClick={() => exporter('pdf')}
            disabled={exportEnCours !== null || !sites?.length}
            className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
          >
            {exportEnCours === 'pdf' ? 'Export…' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => decaler(-1)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Jour préc.
        </button>
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => decaler(1)}
          disabled={date >= todayIso()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Jour suiv. →
        </button>
        <button
          onClick={() => setDate(todayIso())}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Aujourd’hui
        </button>
        <span className="ml-1 text-sm text-slate-500">
          {formatDateFr(date)} · {total} présence(s) sur {sites?.length ?? 0} site(s)
        </span>
      </div>

      {erreurExport && (
        <div className="mb-4">
          <ErrorNote>Export impossible : {erreurExport}</ErrorNote>
        </div>
      )}

      {isLoading && <Spinner label="Chargement…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}
      {sites && sites.length === 0 && (
        <EmptyState>Aucune présence validée le {formatDateFr(date)}.</EmptyState>
      )}

      <div className="space-y-4">
        {sites?.map((site) => (
          <div key={site.site_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-900">{site.site}</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {site.employes.length} présent(s)
              </span>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">N°</th>
                  <th className="px-4 py-2 font-medium">Nom & Prénom</th>
                  <th className="px-4 py-2 font-medium">Qualification</th>
                  <th className="px-4 py-2 font-medium">CIN</th>
                  <th className="px-4 py-2 text-center font-medium">Garde</th>
                  <th className="px-4 py-2 text-center font-medium">Heure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {site.employes.map((e) => (
                  <tr key={e.employee_id}>
                    <td className="px-4 py-2 text-slate-600">{e.matricule ?? '—'}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{e.nom_prenom}</td>
                    <td className="px-4 py-2 text-slate-600">{e.qualification ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{e.cin ?? '—'}</td>
                    <td className="px-4 py-2 text-center">
                      <span
                        title={gardeLabel(e.type_garde)}
                        className={`inline-flex h-6 w-8 items-center justify-center rounded text-xs font-bold ${gardeCouleur(e.type_garde)}`}
                      >
                        {gardeSymbole(e.type_garde)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-slate-600">
                      {e.photo ? (e.heure ?? '—') : <span className="text-xs text-slate-400">bureau</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
