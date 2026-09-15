import { MOIS_FR } from '../lib/paie'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import type { LignePaie } from '../lib/types'

/**
 * L'ORDRE DE VIREMENT — le formulaire que la banque reçoit.
 *
 * Reproduit le modèle papier du groupe : le cartouche (date, raison
 * sociale, R.I.B. de la société, nombre et montant des opérations,
 * libellé), le tableau des bénéficiaires, puis le cadre des signatures.
 * Pas de logo, pas d'en-tête : la banque veut le formulaire, rien d'autre.
 *
 * Un ordre par site : chaque site reçoit ses pages, avec son propre
 * total. Au-delà de dix-huit bénéficiaires, le tableau continue sur une
 * page suivante qui reprend le cartouche — les totaux, eux, restent ceux
 * de l'ordre entier, et les signatures ferment la dernière page.
 */

const LIGNES_PAR_PAGE = 18

export interface OrdreDeSite {
  site: string
  lignes: LignePaie[]
}

export default function OrdreVirementPrint({
  ordres,
  entreprise,
  ribOrdinateur,
  annee,
  mois,
  devise = 'DH',
  onClose,
}: {
  ordres: OrdreDeSite[]
  entreprise: string
  ribOrdinateur: string | null
  annee: number
  mois: number
  devise?: string
  onClose: () => void
}) {
  useFermerSurEchap(onClose)
  useModeImpression()
  const { pret, imprimer } = useImpression(0)

  const n2 = (v: number | null | undefined) =>
    v == null ? '' : Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const rib = (v: string | null) => (v ? v.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim() : '')
  const aujourdhui = new Date().toLocaleDateString('fr-FR')
  const libelle = `Virement Salaire mois ${MOIS_FR[mois - 1]} ${annee}`
  const nbTotal = ordres.reduce((s, o) => s + o.lignes.length, 0)

  const titre =
    ordres.length === 1
      ? `Ordre de virement — ${ordres[0].site}`
      : `Ordres de virement — ${ordres.length} sites`

  // Bordures épaisses du modèle : un trait franc, noir, partout.
  const B = '1.4px solid #000'
  const cell: React.CSSProperties = { border: B, padding: '1.6mm 2.2mm', fontSize: '9.5pt' }
  const gras: React.CSSProperties = { ...cell, fontWeight: 700 }

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={titre}
          pret={pret}
          imprimer={imprimer}
          nomFichier={
            ordres.length === 1
              ? `Ordre_virement_${ordres[0].site.replace(/\s+/g, '_')}_${MOIS_FR[mois - 1]}_${annee}`
              : `Ordres_virement_${MOIS_FR[mois - 1]}_${annee}`
          }
          onClose={onClose}
        />

        <div className="document-imprimable">
          {ordres.map((o) => {
            const total = o.lignes.reduce((s, l) => s + Number(l.net_a_payer), 0)
            const pages: LignePaie[][] = []
            for (let i = 0; i < o.lignes.length; i += LIGNES_PAR_PAGE) {
              pages.push(o.lignes.slice(i, i + LIGNES_PAR_PAGE))
            }
            if (pages.length === 0) pages.push([])

            return pages.map((page, p) => {
              const derniere = p === pages.length - 1
              // Le tableau garde ses dix-huit lignes, même vides, pour que
              // chaque page ait la hauteur du modèle.
              const vides = Math.max(0, LIGNES_PAR_PAGE - page.length)

              return (
                <article
                  key={`${o.site}-${p}`}
                  className="mx-auto my-6 bg-white shadow-xl print:my-0 print:shadow-none"
                  style={{
                    width: '210mm', minHeight: '297mm', padding: '14mm 16mm',
                    color: '#000', breakAfter: 'page', fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {/* Cartouche */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3mm' }}>
                    <tbody>
                      <tr>
                        <td style={{ ...gras, width: '42%' }}>Date&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp; {aujourdhui}</td>
                        <td style={{ border: 'none' }} />
                      </tr>
                      <tr>
                        <td style={gras}>RAISON SOCIAL</td>
                        <td style={cell}>{entreprise.toUpperCase()}</td>
                      </tr>
                      <tr>
                        <td style={gras}>RIB ORDINATEUR</td>
                        <td style={{ ...cell, fontFamily: 'monospace', letterSpacing: '.04em' }}>
                          {rib(ribOrdinateur)}
                        </td>
                      </tr>
                      <tr>
                        <td style={gras}>SITE</td>
                        <td style={{ ...cell, fontWeight: 700 }}>{o.site.toUpperCase()}</td>
                      </tr>
                      <tr>
                        <td style={gras}>NOMBRE TOTAL D'OPERATIONS</td>
                        <td style={cell}>{o.lignes.length}</td>
                      </tr>
                      <tr>
                        <td style={gras}>MONTANT TOTAL D'OPERATIONS</td>
                        <td style={{ ...cell, fontWeight: 700 }}>{n2(total)}</td>
                      </tr>
                      <tr>
                        <td style={gras}>LIBELLE OPERATIONS</td>
                        <td style={{ ...cell, fontWeight: 700 }}>{libelle}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Bénéficiaires */}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#d9d9d9', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                        <th style={{ ...gras, width: '42%', textAlign: 'center', padding: '2.6mm' }}>Nom Bénéficiare</th>
                        <th style={{ ...gras, width: '35%', textAlign: 'center', padding: '2.6mm' }}>RIB Bénéficiare</th>
                        <th style={{ ...gras, textAlign: 'center', padding: '2.6mm' }}>Montant Virement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.map((l) => (
                        <tr key={l.id} style={{ height: '7.6mm' }}>
                          <td style={{ ...cell, textTransform: 'uppercase' }}>{l.nom_prenom}</td>
                          <td style={{ ...cell, fontFamily: 'monospace', letterSpacing: '.03em', whiteSpace: 'nowrap' }}>
                            {rib(l.rib) || <span style={{ color: '#b00', fontFamily: 'inherit' }}>R.I.B. MANQUANT</span>}
                          </td>
                          <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {n2(l.net_a_payer)}
                          </td>
                        </tr>
                      ))}
                      {Array.from({ length: vides }).map((_, i) => (
                        <tr key={`v${i}`} style={{ height: '7.6mm' }}>
                          <td style={cell} /><td style={cell} /><td style={cell} />
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {pages.length > 1 && (
                    <p style={{ fontSize: '8pt', textAlign: 'right', marginTop: '1.5mm' }}>
                      {o.site} — page {p + 1} / {pages.length}
                      {!derniere && ' — suite au verso ou page suivante'}
                    </p>
                  )}

                  {/* Signatures : ferment l'ordre, sur sa dernière page */}
                  {derniere && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5mm' }}>
                      <tbody>
                        <tr style={{ background: '#d9d9d9', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                          <td colSpan={2} style={gras}>
                            Partie réservée aux personnes habilitées à transmettre les ordres de virements
                          </td>
                        </tr>
                        <tr>
                          <td style={{ ...gras, borderRight: 'none', height: '42mm', verticalAlign: 'top', width: '50%' }}>
                            Signatures&nbsp; autorisées :
                          </td>
                          <td style={{ ...gras, borderLeft: 'none', verticalAlign: 'top', textAlign: 'right' }}>
                            Autentification Signatures "Cachet Agence":
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </article>
              )
            })
          })}
        </div>

        <p className="sr-only">{nbTotal} virement(s), {devise}</p>
        <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>
      </div>
    </PortailImpression>
  )
}
