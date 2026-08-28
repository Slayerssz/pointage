import { useEffect } from 'react'
import { formatDateFr } from '../lib/dates'
import { gardeLabel } from '../lib/gardes'
import type { Conge, Employee } from '../lib/types'

/**
 * ENGAGEMENT DE CONGÉ — le papier que l'employé signe.
 *
 * Circuit : on l'imprime ici → l'employé le signe → on le scanne →
 * on le rattache au congé (bouton « Joindre un scan »).
 *
 * Le texte est modifiable dans ce seul fichier.
 */
export default function EngagementPrint({
  conge,
  employee,
  entreprise,
  onClose,
}: {
  conge: Conge
  employee: Employee
  entreprise: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.classList.add('impression')
    return () => document.body.classList.remove('impression')
  }, [])

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-slate-900 px-4 py-3 print:hidden">
        <p className="text-sm font-medium text-white">
          Engagement de congé — {employee.nom_prenom}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Imprimer / Enregistrer en PDF
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>

      <div className="document-imprimable mx-auto my-6 max-w-[210mm] bg-white p-[18mm] text-[11pt] leading-relaxed text-black shadow-xl print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-10 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">{entreprise}</h1>
          <p className="mt-8 text-xl font-bold uppercase underline">Engagement de congé</p>
        </header>

        <p className="mb-6">
          Je soussigné(e) <strong>{employee.nom_prenom}</strong>
          {employee.cin ? <>, titulaire de la C.I.N. n° <strong>{employee.cin}</strong></> : null}
          {employee.matricule != null ? <>, matricule n° <strong>{employee.matricule}</strong></> : null}
          {employee.qualification ? <>, exerçant en qualité de {employee.qualification}</> : null}
          , reconnais avoir été autorisé(e) par mon employeur à m’absenter de mon poste de
          travail dans les conditions suivantes :
        </p>

        <table className="mb-6 w-full border-collapse text-[11pt]">
          <tbody>
            <tr>
              <td className="w-1/2 border border-black px-3 py-2">Nature de l’absence</td>
              <td className="border border-black px-3 py-2 font-semibold">{gardeLabel(conge.type)}</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-2">Du</td>
              <td className="border border-black px-3 py-2 font-semibold">{formatDateFr(conge.date_debut)}</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-2">Au</td>
              <td className="border border-black px-3 py-2 font-semibold">{formatDateFr(conge.date_fin)}</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-2">Nombre de jours décomptés</td>
              <td className="border border-black px-3 py-2 font-semibold">{conge.jours}</td>
            </tr>
            {conge.motif && (
              <tr>
                <td className="border border-black px-3 py-2">Motif</td>
                <td className="border border-black px-3 py-2">{conge.motif}</td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="mb-4 text-justify">
          Je m’engage à reprendre mon poste de travail le lendemain de la date de fin indiquée
          ci-dessus. Je reconnais avoir été informé(e) que toute absence prolongée au-delà de
          cette date, sans autorisation écrite préalable de l’employeur, sera considérée comme
          une absence irrégulière.
        </p>

        <p className="mb-10 text-justify">
          Le présent engagement est établi en deux exemplaires, dont un remis à l’intéressé(e).
        </p>

        <div className="mt-16 flex justify-between gap-8">
          <div className="w-1/2 text-center">
            <p className="mb-16 font-semibold">L’Employeur</p>
            <p className="border-t border-black pt-1 text-sm">{entreprise}</p>
          </div>
          <div className="w-1/2 text-center">
            <p className="mb-16 font-semibold">Le Salarié</p>
            <p className="border-t border-black pt-1 text-sm">
              {employee.nom_prenom}
              <br />
              <span className="text-xs">(lu et approuvé)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
