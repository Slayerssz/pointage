import { MOIS_FR } from '../lib/paie'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import { colonnesEtat, grouperParSite, n2, totalDe } from '../lib/etatSalaires'
import { enregistrerEtatSalairesPdf } from '../lib/etatSalairesPdf'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import { EmptyState } from './ui'
import type { LignePaie } from '../lib/types'

/**
 * L'ÉTAT DES SALAIRES — la liste de paie du mois.
 *
 * Reprend la liste papier du groupe : le nom de la société en tête, les
 * salariés rangés par site, chaque site précédé de son effectif et suivi
 * de ses totaux, puis le total de la société.
 *
 * La liste est continue : elle coule de page en page, et l'en-tête des
 * colonnes se répète en haut de chacune. Ce qui s'imprime est ce que la
 * paie affiche — le mode de règlement choisi, le site choisi, ou tout.
 *
 * Le R.I.B. ne paraît que si l'argent part en banque : une liste
 * d'espèces n'en a pas l'usage.
 */
export default function EtatSalairesPrint({
  lignes,
  entreprise,
  annee,
  mois,
  detaillee,
  mode,
  onClose,
}: {
  lignes: LignePaie[]
  entreprise: string
  annee: number
  mois: number
  /** La forme détaillée ouvre prime, indemnités, dette et retenues. */
  detaillee: boolean
  /** Le mode de règlement affiché, s'il y en a un. */
  mode?: string | null
  onClose: () => void
}) {
  useFermerSurEchap(onClose)
  useModeImpression()
  const { pret, imprimer } = useImpression(0)

  const avecRib = !(mode ?? '').toLowerCase().startsWith('esp')
  const colonnes = colonnesEtat({ detaillee, avecRib })
  const groupes = grouperParSite(lignes)
  const periode = `${MOIS_FR[mois - 1]} ${annee}`
  const nomFichier =
    `Etat_salaires_${entreprise.replace(/\s+/g, '_')}_${MOIS_FR[mois - 1]}_${annee}`

  const bordure = '1px solid #555'
  const cellule: React.CSSProperties = {
    border: bordure, padding: '1.1mm 1.6mm', fontSize: detaillee ? '7.5pt' : '8.5pt',
  }

  /** Une rangée de sous-total : effectif, intitulé, puis les sommes. */
  const rangeeTotal = (intitule: string, nombre: number | null, ensemble: LignePaie[]) => (
    <tr style={{ background: '#e6e6e6', printColorAdjust: 'exact',
                 WebkitPrintColorAdjust: 'exact', fontWeight: 700 }}>
      {colonnes.map((c, i) => {
        if (i === 0) {
          return (
            <td key={c.cle} style={{ ...cellule, whiteSpace: 'nowrap' }}>
              {nombre == null ? '' : `Nb= ${nombre}`}
            </td>
          )
        }
        if (i === 1) return <td key={c.cle} style={cellule}>{intitule}</td>
        const t = totalDe(c, ensemble)
        return (
          <td key={c.cle} style={{ ...cellule, textAlign: c.aligne }}>
            {t == null ? '' : n2(t)}
          </td>
        )
      })}
    </tr>
  )

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={`État des salaires — ${entreprise} · ${periode} · ${lignes.length} salarié(s)`}
          pret={pret}
          imprimer={imprimer}
          orientation={detaillee ? 'landscape' : 'portrait'}
          nomFichier={nomFichier}
          genererPdf={() =>
            enregistrerEtatSalairesPdf({
              lignes, entreprise, annee, mois, detaillee, avecRib, mode, nomFichier,
            })
          }
          onClose={onClose}
        />

        {lignes.length === 0 ? (
          <div className="p-8">
            <EmptyState>Aucun salarié dans ce que la paie affiche.</EmptyState>
          </div>
        ) : (
          <div
            style={{ '--zoom-apercu': detaillee ? 0.34 : 0.46 } as React.CSSProperties}
            className="document-imprimable mx-auto my-6 bg-white p-[10mm] text-black shadow-xl print:my-0 print:p-0 print:shadow-none"
          >
            <header className="text-center">
              <h1 style={{ fontSize: '14pt', fontWeight: 700 }}>
                {entreprise.toUpperCase()} — {periode}
              </h1>
              <p style={{ fontSize: '10pt', marginTop: '1mm' }}>
                Salariés {mode ? mode.toLowerCase() : 'tous'}
              </p>
            </header>

            <p style={{
              fontWeight: 700, fontSize: '11pt', textDecoration: 'underline',
              margin: '6mm 0 2mm',
            }}>
              {entreprise.toUpperCase()}
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ display: 'table-header-group' }}>
                <tr style={{ background: '#d9d9d9', printColorAdjust: 'exact',
                             WebkitPrintColorAdjust: 'exact' }}>
                  {colonnes.map((c) => (
                    <th key={c.cle} style={{ ...cellule, fontWeight: 700, textAlign: 'center',
                                             width: `${c.largeur}mm` }}>
                      {c.titre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupes.map((g) => (
                  <>
                    {rangeeTotal(g.site, g.lignes.length, g.lignes)}
                    {g.lignes.map((l) => (
                      <tr key={l.id} style={{ breakInside: 'avoid' }}>
                        {colonnes.map((c) => (
                          <td
                            key={c.cle}
                            style={{
                              ...cellule, textAlign: c.aligne,
                              whiteSpace: c.mono ? 'nowrap' : undefined,
                              fontFamily: c.mono ? 'monospace' : undefined,
                              fontWeight: c.mono ? 700 : undefined,
                            }}
                          >
                            {c.texte(l)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
                {rangeeTotal(`TOTAL ${entreprise.toUpperCase()}`, lignes.length, lignes)}
              </tbody>
            </table>
          </div>
        )}

        <style>{`@media print { @page { size: A4 ${detaillee ? 'landscape' : 'portrait'}; margin: 10mm; } }`}</style>
      </div>
    </PortailImpression>
  )
}
