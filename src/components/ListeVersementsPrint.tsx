import { MOIS_FR } from '../lib/paie'
import { societeDe } from '../lib/societes'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import { enregistrerListeVersementsPdf } from '../lib/listeVersementsPdf'
import type { LignePaie } from '../lib/types'

/**
 * LA LISTE DES VERSEMENTS — ce qu'on porte à chaque banque.
 *
 * Reproduit la liste papier du groupe : la société et son siège en
 * tête, « Liste des Versements », la période, puis MAT / Nom & Prénom /
 * Site / RIB / Salaire, avec un total par banque.
 *
 * La liste est continue, comme le papier : les gens y sont regroupés par
 * banque, chaque groupe suivi de son total, et l'ensemble coule de page
 * en page. Ce qui est imprimé est ce que la paie affiche — le site
 * choisi, ou tous.
 *
 * Le PDF n'est pas cette page photographiée : il est tracé au millimètre
 * (lib/listeVersementsPdf). Ce qui suit est l'aperçu à l'écran et ce qui
 * part à l'imprimante.
 */

/** Le regroupement par banque, calculé ici comme dans le PDF. */
const banqueDe = (l: LignePaie) =>
  (l.banque ?? '').trim().replace(/\s+/g, ' ').toUpperCase() || '(BANQUE NON RENSEIGNÉE)'

export default function ListeVersementsPrint({
  lignes,
  precision,
  entreprise,
  modeleDocument,
  annee,
  mois,
  onClose,
}: {
  lignes: LignePaie[]
  /** Le site choisi, s'il y en a un : rappelé en tête de liste. */
  precision?: string | null
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
  const n2 = (v: number | null | undefined) =>
    v == null ? '' : Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const periode = `${String(mois).padStart(2, '0')}-${annee}`
  const cell: React.CSSProperties = {
    border: '1px solid #000', padding: '1.2mm 1.8mm', fontSize: '9pt',
  }

  const groupes = (() => {
    const par = new Map<string, LignePaie[]>()
    for (const l of lignes) par.set(banqueDe(l), [...(par.get(banqueDe(l)) ?? []), l])
    return [...par.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
  })()
  const totalGeneral = lignes.reduce((s, l) => s + Number(l.net_a_payer), 0)
  const titre = `Liste des versements — ${lignes.length} versement(s)`
  const nomFichier =
    `Versements_${(precision ?? entreprise).replace(/\s+/g, '_')}_${MOIS_FR[mois - 1]}_${annee}`

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={titre}
          pret={pret}
          imprimer={imprimer}
          nomFichier={nomFichier}
          genererPdf={() =>
            enregistrerListeVersementsPdf({
              lignes, entreprise, modeleDocument, precision, annee, mois, nomFichier,
            })
          }
          onClose={onClose}
        />

        <div className="document-imprimable">
          <article
            className="mx-auto my-6 bg-white shadow-xl print:my-0 print:shadow-none"
            style={{
              width: '210mm', minHeight: '297mm', padding: '12mm 14mm',
              color: '#000', fontFamily: 'Arial, Helvetica, sans-serif',
            }}
          >
            <header style={{ fontSize: '9pt', lineHeight: 1.3 }}>
              <p style={{ fontWeight: 700 }}>{(societe?.raisonSociale ?? entreprise).toUpperCase()}</p>
              {societe?.siege && <p style={{ fontWeight: 700 }}>{societe.siege.toUpperCase()}</p>}
            </header>

            <div className="flex items-end justify-between" style={{ margin: '5mm 0 2mm' }}>
              <div>
                <p style={{ fontSize: '12pt' }}>Liste des Versement</p>
                <p style={{ fontSize: '10pt', marginTop: '2mm' }}>Periode {periode}</p>
              </div>
              {precision && (
                <p style={{ fontSize: '9pt', fontWeight: 700 }}>{precision.toUpperCase()}</p>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ display: 'table-header-group' }}>
                <tr>
                  {[['MAT', '10%'], ['Nom & Prénom', '29%'], ['Site', '17%'],
                    ['RIB', '29%'], ['Salaire', '15%']].map(([c, w]) => (
                    <th key={c} style={{ ...cell, width: w, textAlign: 'center', fontWeight: 400 }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              {groupes.map(([banque, gens]) => (
                <tbody key={banque} style={{ breakInside: 'avoid' }}>
                  <tr>
                    <td colSpan={5} style={{ ...cell, fontWeight: 700, fontSize: '11pt' }}>
                      {banque}
                    </td>
                  </tr>
                  {gens.map((l) => (
                    <tr key={l.id}>
                      <td style={cell}>{l.matricule ?? ''}</td>
                      <td style={{ ...cell, textTransform: 'uppercase' }}>{l.nom_prenom}</td>
                      <td style={{ ...cell, textTransform: 'uppercase', whiteSpace: 'nowrap',
                                   overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 }}>
                        {l.site_nom ?? ''}
                      </td>
                      <td style={{ ...cell, fontFamily: 'monospace', fontSize: '8pt', whiteSpace: 'nowrap' }}>
                        {l.rib?.replace(/\s/g, '') ?? ''}
                      </td>
                      <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {n2(l.net_a_payer)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: '2mm 1mm', fontWeight: 700, fontSize: '10pt' }}>Total</td>
                    <td colSpan={3} style={{ padding: '2mm 1mm', fontWeight: 700, fontSize: '10pt' }}>
                      {banque}
                    </td>
                    <td style={{ padding: '2mm 1.8mm', fontWeight: 700, fontSize: '10pt',
                                 textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {n2(gens.reduce((t, l) => t + Number(l.net_a_payer), 0))}
                    </td>
                  </tr>
                </tbody>
              ))}
              <tfoot style={{ display: 'table-row-group' }}>
                <tr style={{ background: '#e4e4e4', printColorAdjust: 'exact',
                             WebkitPrintColorAdjust: 'exact' }}>
                  <td colSpan={4} style={{ ...cell, fontWeight: 700, fontSize: '10pt' }}>
                    TOTAL GÉNÉRAL — {lignes.length} versement(s)
                  </td>
                  <td style={{ ...cell, fontWeight: 700, fontSize: '10pt', textAlign: 'right',
                               fontVariantNumeric: 'tabular-nums' }}>
                    {n2(totalGeneral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </article>
        </div>

        <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>
      </div>
    </PortailImpression>
  )
}
