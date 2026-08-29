import { formatDateFr } from '../lib/dates'
import { formatDH } from '../lib/paie'
import { modeleDe } from '../lib/modeles'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import DocumentCadre, { Signatures, type Bloc } from './DocumentCadre'
import type { Contrat, Employee } from '../lib/types'

/**
 * CONTRAT DE TRAVAIL
 *
 * Le contenu — les clauses — est le même pour tout le monde : c'est du
 * droit, il ne se décline pas. En revanche la mise en page change d'une
 * société à l'autre (voir src/lib/modeles.ts), pour que deux contrats
 * du groupe ne se ressemblent pas. Tout est en noir et blanc.
 *
 * Pour reprendre la main sur le texte : il est intégralement ci-dessous.
 */
export default function ContratPrint({
  contrat: c,
  employee,
  entreprise,
  onClose,
}: {
  contrat: Contrat
  employee: Employee
  entreprise: string
  onClose: () => void
}) {
  const modele = modeleDe(entreprise)
  useFermerSurEchap(onClose)
  useModeImpression()
  const { pret, imprimer } = useImpression(0)

  const heures = c.heures_par_jour ?? employee.heures_par_jour ?? 8
  const salaire = c.salaire_mensuel ?? employee.salaire
  const journalier = salaire != null ? Number(salaire) / 26 : null
  const essai = Number(c.periode_essai_jours ?? 0)
  const duree = c.date_fin
    ? `à durée déterminée, du ${formatDateFr(c.date_debut)} au ${formatDateFr(c.date_fin)}`
    : 'à durée indéterminée'

  // Le bloc « identité » : repris tel quel par toutes les mises en page
  const identite: [string, string][] = [
    ['Nom et prénom', employee.nom_prenom],
    ['N° de C.I.N.', employee.cin ?? '—'],
    ['N° C.N.S.S.', employee.cnss ?? '—'],
    ['Date de naissance', employee.date_naissance ? formatDateFr(employee.date_naissance) : '—'],
    ['Adresse', [employee.adresse, employee.ville].filter(Boolean).join(', ') || '—'],
    ['Matricule', employee.matricule != null ? String(employee.matricule) : '—'],
  ]

  // Les conditions, telles qu'elles apparaissent dans le modèle « tableau »
  const conditions: [string, string][] = [
    ['Nature du contrat', c.type_contrat],
    ['Date de début', formatDateFr(c.date_debut)],
    ['Date de fin', c.date_fin ? formatDateFr(c.date_fin) : 'Durée indéterminée'],
    ['Poste occupé', c.poste || employee.qualification || '—'],
    ['Lieu de travail', c.lieu_travail || '—'],
    ['Période d’essai', essai > 0 ? `${essai} jours` : 'Sans période d’essai'],
    ['Durée journalière', `${heures} heures`],
    ['Salaire mensuel brut', formatDH(salaire)],
    ['Mode de règlement', c.mode_reglement || employee.mode_reglement || 'Virement bancaire'],
  ]

  // Les clauses. Même fond pour toutes les sociétés.
  const clauses: Bloc[] = [
    {
      titre: 'Engagement',
      corps: (
        <>
          L’Employeur engage le Salarié, qui accepte, dans le cadre d’un contrat de travail{' '}
          {duree}, prenant effet le <strong>{formatDateFr(c.date_debut)}</strong>. Le Salarié
          déclare être libre de tout engagement antérieur.
        </>
      ),
    },
    {
      titre: 'Fonction',
      corps: (
        <>
          Le Salarié est engagé en qualité de{' '}
          <strong>{c.poste || employee.qualification || '—'}</strong>. Il exécutera les tâches
          relevant de cette fonction, ainsi que celles que l’Employeur pourra lui confier dans
          la limite de sa qualification.
        </>
      ),
    },
    {
      titre: 'Lieu de travail',
      corps: (
        <>
          Le Salarié exercera ses fonctions à <strong>{c.lieu_travail || '—'}</strong>.
          L’Employeur se réserve la faculté de l’affecter à tout autre site selon les nécessités
          du service, sans que cette mutation constitue une modification du présent contrat.
        </>
      ),
    },
    ...(essai > 0
      ? [{
          titre: 'Période d’essai',
          corps: (
            <>
              Le présent contrat est assorti d’une période d’essai de{' '}
              <strong>{essai} jours</strong>, renouvelable une fois dans les conditions prévues
              par la loi. Durant cette période, chacune des parties peut rompre le contrat sans
              préavis ni indemnité.
            </>
          ),
        } as Bloc]
      : []),
    {
      titre: 'Durée du travail',
      corps: (
        <>
          La durée journalière de travail est fixée à <strong>{heures} heures</strong> par jour
          travaillé, répartie selon le planning établi par l’Employeur, dans le respect de la
          durée légale du travail.
        </>
      ),
    },
    {
      titre: 'Rémunération',
      corps: (
        <>
          En contrepartie de son travail, le Salarié percevra un salaire mensuel brut de{' '}
          <strong>{formatDH(salaire)}</strong>
          {journalier != null && (
            <> pour un mois complet de vingt-six (26) journées de travail, soit{' '}
              <strong>{formatDH(journalier)}</strong> par journée</>
          )}
          . Le salaire est réglé par{' '}
          <strong>{c.mode_reglement || employee.mode_reglement || 'virement bancaire'}</strong>
          {employee.rib ? <> sur le compte n° {employee.rib}</> : null}, à terme échu.
        </>
      ),
    },
    {
      titre: 'Congés payés',
      corps: (
        <>
          Le Salarié bénéficie des congés payés annuels dans les conditions fixées par le Code du
          travail. Les dates sont arrêtées d’un commun accord, en fonction des nécessités du
          service, et font l’objet d’un engagement écrit signé par le Salarié.
        </>
      ),
    },
    {
      titre: 'Obligations du salarié',
      corps: (
        <>
          Le Salarié s’engage à exécuter son travail avec soin et diligence, à respecter le
          règlement intérieur et les consignes de sécurité, à porter la tenue réglementaire
          fournie par l’Employeur, et à observer la discrétion la plus stricte sur tout ce dont
          il aurait connaissance à l’occasion de ses fonctions.
        </>
      ),
    },
    {
      titre: 'Rupture du contrat',
      corps: c.date_fin ? (
        <>
          Le présent contrat prend fin de plein droit le{' '}
          <strong>{formatDateFr(c.date_fin)}</strong>, sans qu’il soit besoin de préavis. Toute
          rupture anticipée s’effectuera dans les conditions prévues par le Code du travail.
        </>
      ) : (
        <>
          Le présent contrat pourra être rompu par l’une ou l’autre des parties dans les
          conditions de forme et de délai de préavis prévues par le Code du travail.
        </>
      ),
    },
    ...(c.observations
      ? [{ titre: 'Dispositions particulières', corps: <>{c.observations}</> } as Bloc]
      : []),
  ]

  const preambule = (
    <>
      <p style={{ marginBottom: '3mm' }}>
        <strong>ENTRE LES SOUSSIGNÉS :</strong>
      </p>
      <p style={{ marginBottom: '3mm', textAlign: 'justify' }}>
        <strong>{entreprise}</strong>, ci-après désignée « l’Employeur »,
        {c.representant_employeur
          ? <> représentée par <strong>{c.representant_employeur}</strong>,</>
          : <> représentée par son représentant légal,</>}{' '}
        d’une part,
      </p>
      <p style={{ marginBottom: '3mm' }}>ET</p>
      <p style={{ textAlign: 'justify' }}>
        <strong>{employee.nom_prenom}</strong>, ci-après désigné(e) « le Salarié », dont les
        références figurent ci-dessous, d’autre part.
      </p>
    </>
  )

  return (
    <PortailImpression>
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
      <BarreImpression
        titre={`Contrat ${c.numero ?? ''} — ${employee.nom_prenom}`}
        pret={pret}
        imprimer={imprimer}
        nomFichier={`Contrat_${c.numero ?? ''}_${employee.nom_prenom.replace(/\s+/g, '_')}`}
        onClose={onClose}
      />

      <div className="document-imprimable">
        <DocumentCadre
          modele={modele}
          entreprise={entreprise}
          titre="Contrat de travail"
          sousTitre={c.type_contrat === 'CDI' ? undefined : c.type_contrat}
          reference={c.numero ?? undefined}
          preambule={preambule}
          identite={identite}
          titreIdentite="Le Salarié"
          conditions={conditions}
          titreConditions="Conditions d’engagement"
          blocs={clauses}
          conclusion={
            <>
              Fait à <strong>{c.signe_a || '—'}</strong>, le{' '}
              <strong>{c.signe_le ? formatDateFr(c.signe_le) : '—'}</strong>, en deux
              exemplaires originaux, dont un remis à chacune des parties.
            </>
          }
          signatures={
            <Signatures
              modele={modele}
              gauche={{ role: 'L’Employeur', nom: c.representant_employeur || entreprise }}
              droite={{ role: 'Le Salarié', nom: employee.nom_prenom, mention: 'lu et approuvé' }}
            />
          }
        />
      </div>

      <style>{`@media print { @page { size: A4 portrait; margin: 14mm; } }`}</style>
    </div>
    </PortailImpression>
  )
}
