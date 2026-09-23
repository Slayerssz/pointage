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
 * Trois talons par feuille, séparés par un trait de découpe. Le numéro
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
                width: '210mm', height: '99mm', padding: '14mm 14mm 10mm',
                marginTop: i === 0 ? '1.5rem' : 0,
                color: '#000', fontFamily: 'Arial, Helvetica, sans-serif',
                position: 'relative',
                // Trois talons par feuille, puis on change de page.
                breakAfter: (i + 1) % 3 === 0 ? 'page' : 'auto',
                borderTop: i % 3 === 0 ? 'none' : '1px dashed #999',
              }}
            >
              <p style={{ fontSize: '14pt', fontWeight: 700 }}>{nomSociete}</p>
              <p style={{ fontSize: '12pt', fontWeight: 700, marginTop: '2mm' }}>
                Reçue {numeroRecu(annee, mois, i + 1)}
              </p>

              <dl style={{ marginTop: '7mm', fontSize: '10pt' }}>
                {[
                  ['Nom Prenom :', l.nom_prenom.toUpperCase()],
                  ['Matricul :', l.matricule != null ? String(l.matricule) : '—'],
                  ['Site:', (l.site_nom ?? '—').toUpperCase()],
                  ['Salaire Net :', n2(l.net_a_payer)],
                ].map(([label, valeur]) => (
                  <div key={label} className="flex" style={{ marginBottom: '2.2mm' }}>
                    <dt style={{ width: '32mm', flexShrink: 0 }}>{label}</dt>
                    <dd style={{ margin: 0 }}>{valeur}</dd>
                  </div>
                ))}
              </dl>

              {/* La date et le cadre de signature, en bas à droite */}
              <div style={{ position: 'absolute', right: '14mm', bottom: '10mm', width: '52mm' }}>
                <div className="flex items-end justify-between" style={{ fontSize: '9pt', marginBottom: '1.5mm' }}>
                  <span>SIGNATURE</span>
                  <span style={{ fontSize: '10pt' }}>{dateTexte}</span>
                </div>
                <div style={{ height: '26mm', border: '1px solid #000', borderRadius: '2mm' }} />
              </div>
            </article>
          ))}
        </div>

        <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>
      </div>
    </PortailImpression>
  )
}
