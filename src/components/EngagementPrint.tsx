import { addDays, dateToIso, formatDateFr, todayIso } from '../lib/dates'
import { gardeLabel } from '../lib/gardes'
import { modeleDe } from '../lib/modeles'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import DocumentCadre, { Signatures, type Bloc } from './DocumentCadre'
import type { Conge, Employee } from '../lib/types'

/**
 * ENGAGEMENT DE CONGÉ
 *
 * Le papier que le salarié signe avant de partir. Comme pour le contrat,
 * la mise en page suit le modèle propre à chaque société — deux sociétés
 * du groupe n'ont pas le même document. Noir et blanc.
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
  const modele = modeleDe(entreprise)
  useFermerSurEchap(onClose)
  useModeImpression()
  const { pret, imprimer } = useImpression(0)

  // Lendemain de la fin du congé. On reste en dates locales : passer par
  // toISOString() ferait reculer d'un jour au Maroc (UTC+1).
  const reprise = formatDateFr(dateToIso(addDays(new Date(conge.date_fin + 'T00:00:00'), 1)))

  const identite: [string, string][] = [
    ['Nom et prénom', employee.nom_prenom],
    ['N° de C.I.N.', employee.cin ?? '—'],
    ['Matricule', employee.matricule != null ? String(employee.matricule) : '—'],
    ['Qualification', employee.qualification ?? '—'],
  ]

  const conditions: [string, string][] = [
    ['Nature de l’absence', gardeLabel(conge.type)],
    ['Date de départ', formatDateFr(conge.date_debut)],
    ['Date de fin', formatDateFr(conge.date_fin)],
    ['Jours décomptés', String(conge.jours)],
    ['Reprise du travail', reprise],
    ...(conge.motif ? ([['Motif', conge.motif]] as [string, string][]) : []),
  ]

  const clauses: Bloc[] = [
    {
      titre: 'Objet',
      corps: (
        <>
          Je soussigné(e) <strong>{employee.nom_prenom}</strong>, reconnais avoir été autorisé(e)
          par mon employeur à m’absenter de mon poste de travail au titre de{' '}
          <strong>{gardeLabel(conge.type).toLowerCase()}</strong>, du{' '}
          <strong>{formatDateFr(conge.date_debut)}</strong> au{' '}
          <strong>{formatDateFr(conge.date_fin)}</strong>, soit{' '}
          <strong>{conge.jours}</strong> jour(s) décompté(s).
        </>
      ),
    },
    {
      titre: 'Engagement de reprise',
      corps: (
        <>
          Je m’engage à reprendre mon poste de travail le{' '}
          <strong>{reprise}</strong>, à l’heure habituelle de prise de service.
        </>
      ),
    },
    {
      titre: 'Absence irrégulière',
      corps: (
        <>
          Je reconnais avoir été informé(e) que toute absence prolongée au-delà de cette date,
          sans autorisation écrite préalable de l’employeur, sera considérée comme une absence
          irrégulière et pourra donner lieu aux sanctions prévues par le règlement intérieur et
          par le Code du travail.
        </>
      ),
    },
    {
      titre: 'Exemplaires',
      corps: (
        <>
          Le présent engagement est établi en deux exemplaires, dont un remis à l’intéressé(e)
          après signature.
        </>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
      <BarreImpression
        titre={`Engagement de congé — ${employee.nom_prenom}`}
        pret={pret}
        imprimer={imprimer}
        nomFichier={`Engagement_${employee.nom_prenom.replace(/\s+/g, '_')}`}
        onClose={onClose}
      />

      <div className="document-imprimable">
        <DocumentCadre
          modele={modele}
          entreprise={entreprise}
          titre="Engagement de congé"
          identite={identite}
          titreIdentite="Le Salarié"
          conditions={conditions}
          titreConditions="Période d’absence"
          blocs={clauses}
          conclusion={
            <>
              Fait à <strong>{employee.ville || '—'}</strong>, le{' '}
              <strong>{formatDateFr(todayIso())}</strong>.
            </>
          }
          signatures={
            <Signatures
              modele={modele}
              gauche={{ role: 'L’Employeur', nom: entreprise }}
              droite={{ role: 'Le Salarié', nom: employee.nom_prenom, mention: 'lu et approuvé' }}
            />
          }
        />
      </div>

      <style>{`@media print { @page { size: A4 portrait; margin: 14mm; } }`}</style>
    </div>
  )
}
