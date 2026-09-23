import { MOIS_FR } from '../lib/paie'
import { societeDe } from '../lib/societes'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import type { LignePaie } from '../lib/types'

/**
 * LA LISTE DES VERSEMENTS — ce qu'on porte à chaque banque.
 *
 * Reproduit la liste papier du groupe : la société et son siège en
 * tête, « Liste des Versements », la période, puis MAT / Nom & Prénom /
 * Site / RIB / Salaire, avec un total par banque.
 *
 * Ce qui est imprimé est ce que la paie affiche : le site choisi, ou une
 * liste par site quand on n'en a choisi aucun. Chaque liste a ses pages
 * et son total ; au-delà d'une page, la suite reprend l'en-tête et
 * numérote.
 */

const LIGNES_PAR_PAGE = 34

export interface VersementsDeBanque {
  /** Ce qui identifie la liste : le site, ou « TOUS LES VERSEMENTS ». */
  intitule: string
  lignes: LignePaie[]
}

export default function ListeVersementsPrint({
  groupes,
  entreprise,
  modeleDocument,
  annee,
  mois,
  onClose,
}: {
  groupes: VersementsDeBanque[]
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

  const titre =
    groupes.length === 1
      ? `Liste des versements — ${groupes[0].intitule}`
      : `Listes des versements — ${groupes.length} sites`

  const B = '1px solid #000'
  const cell: React.CSSProperties = { border: B, padding: '1.2mm 1.8mm', fontSize: '9pt' }

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={titre}
          pret={pret}
          imprimer={imprimer}
          nomFichier={
            groupes.length === 1
              ? `Versements_${groupes[0].intitule.replace(/\s+/g, '_')}_${MOIS_FR[mois - 1]}_${annee}`
              : `Versements_${MOIS_FR[mois - 1]}_${annee}`
          }
          onClose={onClose}
        />

        <div className="document-imprimable">
          {groupes.map((g) => {
            const total = g.lignes.reduce((s, l) => s + Number(l.net_a_payer), 0)
            const pages: LignePaie[][] = []
            for (let i = 0; i < g.lignes.length; i += LIGNES_PAR_PAGE) {
              pages.push(g.lignes.slice(i, i + LIGNES_PAR_PAGE))
            }
            if (pages.length === 0) pages.push([])

            return pages.map((page, p) => {
              const derniere = p === pages.length - 1
              return (
                <article
                  key={`${g.intitule}-${p}`}
                  className="mx-auto my-6 bg-white shadow-xl print:my-0 print:shadow-none"
                  style={{
                    width: '210mm', minHeight: '297mm', padding: '12mm 14mm',
                    color: '#000', breakAfter: 'page', fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {/* La société et son siège, comme sur le papier */}
                  <header style={{ fontSize: '9pt', lineHeight: 1.3 }}>
                    <p style={{ fontWeight: 700 }}>{(societe?.raisonSociale ?? entreprise).toUpperCase()}</p>
                    {societe?.siege && <p style={{ fontWeight: 700 }}>{societe.siege.toUpperCase()}</p>}
                  </header>

                  <div className="flex items-end justify-between" style={{ margin: '5mm 0 2mm' }}>
                    <div>
                      <p style={{ fontSize: '12pt' }}>Liste des Versements</p>
                      <p style={{ fontSize: '10pt', marginTop: '2mm' }}>Periode {periode}</p>
                    </div>
                    <p style={{ fontSize: '10pt', fontWeight: 700 }}>
                      Page&nbsp;&nbsp;&nbsp;&nbsp;{p + 1}/{pages.length}
                    </p>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#e4e4e4', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                        <th style={{ ...cell, width: '11%', textAlign: 'center', fontWeight: 400 }}>MAT</th>
                        <th style={{ ...cell, width: '33%', textAlign: 'center', fontWeight: 400 }}>Nom &amp; Prénom</th>
                        <th style={{ ...cell, width: '17%', textAlign: 'center', fontWeight: 400 }}>Site</th>
                        <th style={{ ...cell, width: '26%', textAlign: 'center', fontWeight: 400 }}>RIB</th>
                        <th style={{ ...cell, textAlign: 'center', fontWeight: 400 }}>Salaire</th>
                      </tr>
                      {/* Le site, en titre de la liste */}
                      <tr>
                        <td colSpan={5} style={{ padding: '2.5mm 1mm 1mm', fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>
                          {g.intitule}
                        </td>
                      </tr>
                    </thead>
                    <tbody>
                      {page.map((l) => (
                        <tr key={l.id}>
                          <td style={cell}>{l.matricule ?? ''}</td>
                          <td style={{ ...cell, textTransform: 'uppercase' }}>{l.nom_prenom}</td>
                          <td style={{ ...cell, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 }}>
                            {l.site_nom ?? ''}
                          </td>
                          <td style={{ ...cell, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {l.rib?.replace(/\s/g, '') ?? ''}
                          </td>
                          <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {n2(l.net_a_payer)}
                          </td>
                        </tr>
                      ))}
                      {derniere && (
                        <tr>
                          <td style={{ padding: '2mm 1mm', fontWeight: 700, fontSize: '10pt' }}>Total</td>
                          <td colSpan={3} style={{ padding: '2mm 1mm', fontWeight: 700, fontSize: '10pt', textTransform: 'uppercase' }}>
                            {g.intitule}
                          </td>
                          <td style={{ padding: '2mm 1.8mm', fontWeight: 700, fontSize: '10pt', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {n2(total)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {!derniere && (
                    <p style={{ fontSize: '8pt', textAlign: 'right', marginTop: '2mm' }}>suite page suivante</p>
                  )}
                </article>
              )
            })
          })}
        </div>

        <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>
      </div>
    </PortailImpression>
  )
}
