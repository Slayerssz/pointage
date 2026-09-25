import { MOIS_FR } from '../lib/paie'
import { societeDe } from '../lib/societes'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import { enregistrerRecusEspecePdf, numeroRecu } from '../lib/recuEspecePdf'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import type { LignePaie } from '../lib/types'

/**
 * LES REÇUS D'ESPÈCES — le talon que l'employé signe en prenant son argent.
 *
 * Quatre talons par feuille, séparés par un trait de découpe. Le numéro
 * suit le matricule, donc un talon réimprimé garde le sien.
 *
 * Le PDF n'est pas cette page photographiée : il est tracé au millimètre
 * (lib/recuEspecePdf). Ce qui suit est l'aperçu et ce qui part à
 * l'imprimante.
 */
export default function RecusEspecePrint({
  lignes,
  entreprise,
  modeleDocument,
  annee,
  mois,
  onClose,
}: {
  lignes: LignePaie[]
  entreprise: string
  modeleDocument?: string | null
  annee: number
  mois: number
  onClose: () => void
}) {
  useFermerSurEchap(onClose)
  useModeImpression()
  const { pret, imprimer } = useImpression(0)

  const societe = societeDe(entreprise, modeleDocument)
  const nomSociete = (societe?.raisonSociale ?? entreprise).toUpperCase()
  const n2 = (v: number | null | undefined) =>
    v == null ? '' : Number(v).toLocaleString('fr-FR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })
  const dateTexte = new Date(annee, mois, 0).toLocaleDateString('fr-FR')

  // Le rang suit le matricule, comme dans le PDF.
  const ordonnees = [...lignes].sort(
    (a, b) => (a.matricule ?? 1e9) - (b.matricule ?? 1e9) ||
              a.nom_prenom.localeCompare(b.nom_prenom, 'fr'),
  )
  const nomFichier = `Recus_especes_${entreprise.replace(/\s+/g, '_')}_${MOIS_FR[mois - 1]}_${annee}`

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={`Reçus d’espèces — ${lignes.length} talon(s)`}
          pret={pret}
          imprimer={imprimer}
          nomFichier={nomFichier}
          genererPdf={() =>
            enregistrerRecusEspecePdf({
              lignes, entreprise, modeleDocument, annee, mois, nomFichier,
            })
          }
          onClose={onClose}
        />

        <div className="document-imprimable">
          {ordonnees.map((l, i) => (
            <article
              key={l.id}
              className="mx-auto bg-white shadow-xl print:shadow-none"
              style={{
                width: '210mm', height: '74.25mm', padding: '10mm 14mm 8mm',
                marginTop: i === 0 ? '1.5rem' : 0,
                color: '#000', fontFamily: 'Arial, Helvetica, sans-serif',
                position: 'relative',
                // Quatre talons par feuille, puis on change de page.
                breakAfter: (i + 1) % 4 === 0 ? 'page' : 'auto',
                borderTop: i % 4 === 0 ? 'none' : '1px dashed #999',
              }}
            >
              <div className="flex items-start justify-between">
                  <p style={{ fontSize: '13pt', fontWeight: 700 }}>{nomSociete}</p>
                <p style={{ fontSize: '10pt' }}>{dateTexte}</p>
              </div>
              <p style={{ fontSize: '11pt', fontWeight: 700, marginTop: '1.5mm' }}>
                Reçue {numeroRecu(annee, mois, i + 1)}
              </p>

              {/* Le cadre de signature démarre à la hauteur du premier
                  renseignement : sur la même ligne, pas en dessous. */}
              <div style={{ position: 'absolute', right: '14mm', top: '26mm', width: '52mm' }}>
                <p style={{ fontSize: '9pt', textAlign: 'center', marginBottom: '1.5mm' }}>
                  SIGNATURE
                </p>
                <div style={{ height: '22mm', border: '1px solid #000', borderRadius: '2mm' }} />
              </div>

              <dl style={{ marginTop: '5mm', fontSize: '9.5pt' }}>
                {[
                  ['Nom Prenom :', l.nom_prenom.toUpperCase()],
                  ['Matricul :', l.matricule != null ? String(l.matricule) : '—'],
                  ['Site:', (l.site_nom ?? '—').toUpperCase()],
                  ['Salaire Net :', n2(l.net_a_payer)],
                ].map(([label, valeur]) => (
                  <div key={label} className="flex" style={{ marginBottom: '1.8mm' }}>
                    <dt style={{ width: '32mm', flexShrink: 0 }}>{label}</dt>
                    <dd style={{ margin: 0 }}>{valeur}</dd>
                  </div>
                ))}
              </dl>

            </article>
          ))}
        </div>

        <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>
      </div>
    </PortailImpression>
  )
}
