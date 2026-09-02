import { useMemo } from 'react'
import { formatDateFr } from '../lib/dates'
import { modeleEngagement } from '../lib/engagementConge'
import { RedactionDocument } from './ContratRedaction'
import type { Conge, Employee } from '../lib/types'

/**
 * ENGAGEMENT DE CONGÉ ANNUEL — « التزام ».
 *
 * Le papier que le salarié signe : il y déclare avoir pris son congé. Le
 * document est en arabe et se remplit en arabe ; seules les dates et le
 * numéro de C.I.N. restent en caractères latins, comme sur la carte.
 *
 * Les dates du congé déjà saisi sont reprises, ainsi que sa durée : elles
 * viennent du registre, il n'y a pas à les recopier.
 */
export default function EngagementConge({
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
  const modele = useMemo(() => modeleEngagement(entreprise), [entreprise])

  const valeursInitiales = useMemo(
    () => ({
      debut: formatDateFr(conge.date_debut),
      fin: formatDateFr(conge.date_fin),
      // « يوما » : jour(s), au singulier arabe qui suit les nombres
      duree: `${conge.jours} يوما`,
      annee: String(new Date(conge.date_debut + 'T00:00:00').getFullYear()),
    }),
    [conge],
  )

  return (
    <RedactionDocument
      modele={modele}
      employee={employee}
      entreprise={entreprise}
      intitule="Engagement de congé"
      prefixeFichier="Engagement"
      valeursInitiales={valeursInitiales}
      onClose={onClose}
    />
  )
}
