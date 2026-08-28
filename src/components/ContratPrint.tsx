import { useEffect } from 'react'
import { formatDateFr } from '../lib/dates'
import { formatDH } from '../lib/paie'
import type { Contrat, Employee } from '../lib/types'

/**
 * MODÈLE DE CONTRAT — c'est ce document qui est imprimé / enregistré en PDF.
 *
 * ⚠️ Pour utiliser VOTRE modèle : tout le texte se trouve dans ce seul
 * fichier. Remplacez les paragraphes ci-dessous par les vôtres ; les
 * valeurs entre accolades ({employee.nom_prenom}, {c.salaire_mensuel}…)
 * se remplissent automatiquement depuis la fiche employé et le contrat.
 *
 * L'impression passe par le navigateur : « Imprimer » → « Enregistrer au
 * format PDF ». La mise en page A4 est déjà réglée plus bas.
 */
export default function ContratPrint({
  contrat,
  employee,
  entreprise,
  onClose,
}: {
  contrat: Contrat
  employee: Employee
  entreprise: string
  onClose: () => void
}) {
  const c = contrat

  // Échap pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Pendant l'affichage : seul le document part à l'impression
  // (règles dans src/index.css, section « Impression d'un document »).
  useEffect(() => {
    document.body.classList.add('impression')
    return () => document.body.classList.remove('impression')
  }, [])

  const dureeTexte =
    c.date_fin == null
      ? 'à durée indéterminée'
      : `à durée déterminée, du ${formatDateFr(c.date_debut)} au ${formatDateFr(c.date_fin)}`

  const salaireJour =
    c.salaire_mensuel != null ? Number(c.salaire_mensuel) / 26 : null

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-slate-900 px-4 py-3 print:hidden">
        <p className="text-sm font-medium text-white">
          Contrat {c.numero} — {employee.nom_prenom}
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
        {/* En-tête */}
        <header className="mb-8 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">{entreprise}</h1>
          <p className="mt-6 text-xl font-bold uppercase underline">
            Contrat de travail {c.type_contrat === 'CDI' ? '' : `— ${c.type_contrat}`}
          </p>
          <p className="mt-1 text-sm">N° {c.numero}</p>
        </header>

        {/* Parties */}
        <section className="mb-6">
          <p className="mb-3 font-bold">ENTRE LES SOUSSIGNÉS :</p>
          <p className="mb-3">
            <strong>{entreprise}</strong>, ci-après désignée « l’Employeur »,
            {c.representant_employeur ? (
              <> représentée par <strong>{c.representant_employeur}</strong>,</>
            ) : (
              <> représentée par son représentant légal,</>
            )}{' '}
            d’une part,
          </p>
          <p className="mb-2">ET</p>
          <p>
            <strong>{employee.nom_prenom}</strong>
            {employee.cin ? <>, titulaire de la C.I.N. n° <strong>{employee.cin}</strong></> : null}
            {employee.date_naissance ? <>, né(e) le {formatDateFr(employee.date_naissance)}</> : null}
            {employee.adresse || employee.ville ? (
              <>, demeurant à {[employee.adresse, employee.ville].filter(Boolean).join(', ')}</>
            ) : null}
            {employee.cnss ? <>, immatriculé(e) à la CNSS sous le n° {employee.cnss}</> : null}
            , ci-après désigné(e) « le Salarié », d’autre part.
          </p>
        </section>

        <p className="mb-6 font-bold">IL A ÉTÉ CONVENU CE QUI SUIT :</p>

        <Article n={1} titre="Engagement">
          L’Employeur engage le Salarié, qui accepte, dans le cadre d’un contrat de travail{' '}
          {dureeTexte}, à compter du <strong>{formatDateFr(c.date_debut)}</strong>.
        </Article>

        <Article n={2} titre="Fonction">
          Le Salarié est engagé en qualité de{' '}
          <strong>{c.poste || employee.qualification || '—'}</strong>. Il s’engage à exécuter les
          tâches qui lui sont confiées avec soin et diligence, et à respecter le règlement intérieur
          de l’Employeur.
        </Article>

        <Article n={3} titre="Lieu de travail">
          Le Salarié exercera ses fonctions à <strong>{c.lieu_travail || '—'}</strong>. L’Employeur
          se réserve la possibilité de l’affecter à tout autre site selon les nécessités du service.
        </Article>

        {Number(c.periode_essai_jours) > 0 && (
          <Article n={4} titre="Période d’essai">
            Le présent contrat est assorti d’une période d’essai de{' '}
            <strong>{c.periode_essai_jours} jours</strong>, pendant laquelle chacune des parties
            peut y mettre fin sans préavis ni indemnité, conformément aux dispositions du Code du
            travail.
          </Article>
        )}

        <Article n={Number(c.periode_essai_jours) > 0 ? 5 : 4} titre="Durée du travail">
          La durée journalière de travail est fixée à{' '}
          <strong>{c.heures_par_jour ?? employee.heures_par_jour ?? 8} heures</strong> par jour
          travaillé, dans le respect de la durée légale du travail.
        </Article>

        <Article n={Number(c.periode_essai_jours) > 0 ? 6 : 5} titre="Rémunération">
          En contrepartie de son travail, le Salarié percevra un salaire mensuel brut de{' '}
          <strong>{formatDH(c.salaire_mensuel ?? employee.salaire)}</strong>
          {salaireJour != null && (
            <>
              , correspondant à une base de 26 jours travaillés, soit{' '}
              <strong>{formatDH(salaireJour)}</strong> par journée de travail
            </>
          )}
          . Le salaire est payé par{' '}
          <strong>{c.mode_reglement || employee.mode_reglement || 'virement bancaire'}</strong>
          {employee.rib ? <> sur le compte n° {employee.rib}</> : null}.
        </Article>

        <Article n={Number(c.periode_essai_jours) > 0 ? 7 : 6} titre="Congés">
          Le Salarié bénéficie des congés payés annuels dans les conditions prévues par le Code du
          travail, après accord préalable de l’Employeur sur les dates.
        </Article>

        <Article n={Number(c.periode_essai_jours) > 0 ? 8 : 7} titre="Rupture du contrat">
          {c.date_fin == null ? (
            <>
              Le présent contrat pourra être rompu par l’une ou l’autre des parties dans les
              conditions et selon les délais de préavis prévus par le Code du travail.
            </>
          ) : (
            <>
              Le présent contrat prend fin de plein droit le{' '}
              <strong>{formatDateFr(c.date_fin)}</strong>, sans qu’il soit nécessaire de donner un
              préavis. Toute rupture anticipée s’effectuera dans les conditions prévues par le Code
              du travail.
            </>
          )}
        </Article>

        {c.observations && (
          <Article n={Number(c.periode_essai_jours) > 0 ? 9 : 8} titre="Dispositions particulières">
            {c.observations}
          </Article>
        )}

        <p className="mt-8">
          Fait à <strong>{c.signe_a || '—'}</strong>, le{' '}
          <strong>{c.signe_le ? formatDateFr(c.signe_le) : '—'}</strong>, en deux exemplaires
          originaux, dont un remis à chacune des parties.
        </p>

        {/* Signatures */}
        <div className="mt-14 flex justify-between gap-8">
          <div className="w-1/2 text-center">
            <p className="mb-16 font-semibold">L’Employeur</p>
            <p className="border-t border-black pt-1 text-sm">
              {c.representant_employeur || entreprise}
            </p>
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

function Article({ n, titre, children }: { n: number; titre: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 break-inside-avoid">
      <p className="mb-1 font-bold">
        Article {n} — {titre}
      </p>
      <p className="text-justify">{children}</p>
    </section>
  )
}
