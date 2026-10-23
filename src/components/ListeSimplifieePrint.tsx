import type React from 'react'
import { enteteDe } from '../lib/entetes'
import { papierDe } from '../lib/ordreVirementPdf'
import { formatDateFr } from '../lib/dates'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import { enregistrerListeSimplifieePdf } from '../lib/listeSimplifieePdf'
import {
  decouperListeSimplifiee, titreSurUneLigne, type MesuresPage,
} from '../lib/listeSimplifieeMiseEnPage'
import type { Employee } from '../lib/types'

/**
 * LISTE SIMPLIFIÉE — la version courte, celle qui sort de l'entreprise.
 *
 * Rien d'autre que le numéro, le nom, le C.I.N. et le numéro C.N.S.S. :
 * c'est ce que le client a le droit de voir. Ni salaire, ni adresse, ni
 * téléphone, contrairement à la liste complète qui, elle, reste interne.
 *
 * Elle s'imprime sur le papier à en-tête de la société, comme l'ordre de
 * virement : le bandeau et les mentions légales viennent du papier, on
 * n'écrit que dans la bande qu'il laisse libre. La fiche d'une seule
 * personne, elle, garde son propre en-tête — c'est un autre document.
 *
 * Une page par feuille, découpée ici plutôt que laissée au navigateur :
 * chaque feuille doit reposer sur le papier, et une page que le
 * navigateur coupe où il veut déborderait sur le pied imprimé.
 */
export default function ListeSimplifieePrint({
  employees,
  entreprise,
  modeleDocument,
  marche,
  intitule,
  etablissement,
  du,
  au,
  onClose,
}: {
  employees: Employee[]
  entreprise: string
  /** Clé de modèle de la société : elle prime sur son nom. */
  modeleDocument?: string | null
  /** « 04/ECIB/2024 » */
  marche: string
  /** « Liste Des Agents De Gardiennage » */
  intitule: string
  /** « Etablissement de Cooperation Intercommunale Al Boughaz » */
  etablissement: string
  du: string
  au: string
  onClose: () => void
}) {
  useFermerSurEchap(onClose)
  useModeImpression()

  const entete = enteteDe(entreprise, modeleDocument)
  // Le papier de la société et la bande qu'il laisse libre : l'aperçu se
  // cale exactement sur ce que dessinera le PDF.
  const { papier, haut, bas } = papierDe(entreprise, modeleDocument)
  const { pret, imprimer } = useImpression(!papier && entete.logo ? 1 : 0)
  const pied = papier ? null : entete.pied

  const surUneLigne = titreSurUneLigne(intitule, etablissement)
  const mesures: MesuresPage = {
    haut, bas,
    avecMarche: Boolean(marche.trim()),
    lignesDeTitre: surUneLigne ? 1 : 2,
  }
  const pages = decouperListeSimplifiee(employees, mesures)

  // Le bandeau et l'en-tête du tableau reprennent la couleur de la société,
  // très éclaircie : le document reste lisible en noir et blanc.
  const teinte = `color-mix(in srgb, ${entete.accent} 22%, white)`
  const aplat = { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as const
  // L'interligne est fixé : celui du reste de l'application est à 1,5,
  // ce qui donnait des rangées d'un millimètre plus hautes qu'au PDF —
  // de quoi faire déborder la dernière de la bande libre du papier.
  const cellule: React.CSSProperties = {
    border: '1px solid #000', padding: '0.9mm 2mm', lineHeight: 1.15,
  }

  const nomFichier =
    `Liste_${marche.replace(/[^\w]+/g, '-') || 'marche'}_${entreprise.replace(/\s+/g, '_')}`

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={`${intitule} — ${employees.length} agent(s), ${pages.length} page(s)`}
          pret={pret}
          imprimer={imprimer}
          nomFichier={nomFichier}
          genererPdf={() =>
            enregistrerListeSimplifieePdf({
              employees, entreprise, modeleDocument, marche, intitule, etablissement,
              du, au, nomFichier,
            })
          }
          onClose={onClose}
        />

        <div className="document-imprimable">
          {pages.map((liste, p) => (
            <article
              key={p}
              className="mx-auto my-6 bg-white shadow-xl print:my-0 print:shadow-none"
              style={{
                width: '210mm', minHeight: '297mm',
                padding: `${haut}mm 12mm ${297 - bas}mm`,
                backgroundImage: papier ? `url(${papier.image})` : undefined,
                backgroundSize: '210mm 297mm',
                backgroundRepeat: 'no-repeat',
                color: '#000', fontSize: '10pt', breakAfter: 'page',
              }}
            >
              {/* Le titre n'est porté que par la première feuille ; les
                  suivantes reprennent seulement l'en-tête des colonnes. */}
              {p === 0 && (
                <>
                  {!papier && (
                    <header className="text-center">
                      {entete.logo ? (
                        <img
                          src={entete.logo}
                          alt={entreprise}
                          style={{ height: '26mm', margin: '0 auto', objectFit: 'contain' }}
                        />
                      ) : (
                        <p className="text-lg font-bold uppercase" style={{ color: entete.accent }}>
                          {entreprise}
                        </p>
                      )}
                    </header>
                  )}

                  {marche.trim() && (
                    <p className="font-semibold" style={{ fontSize: '11pt', marginBottom: '2mm' }}>
                      MARCHE N°: {marche}
                    </p>
                  )}

                  {/* L'établissement tient sur la ligne du titre quand il
                      est court ; un nom long passe en dessous plutôt que
                      de déborder. */}
                  <div className="text-center" style={{ marginBottom: '4mm' }}>
                    <h1 className="font-bold underline" style={{ fontSize: '13pt' }}>
                      {intitule}
                      {surUneLigne && etablissement.trim() && <> — {etablissement}</>}
                    </h1>
                    {!surUneLigne && etablissement.trim() && (
                      <h2 className="font-bold underline" style={{ fontSize: '12pt' }}>
                        {etablissement}
                      </h2>
                    )}
                  </div>

                  <p
                    className="text-center font-semibold italic"
                    style={{
                      background: teinte, border: '1px solid #000', borderBottom: 'none',
                      fontSize: '11pt', padding: '1.4mm 0', ...aplat,
                    }}
                  >
                    Période Du {formatDateFr(du)} Au {formatDateFr(au)}
                  </p>
                </>
              )}

              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: teinte, ...aplat }}>
                    {['N°', 'NOM ET PRENOM', 'N°CIN', 'N° DE CNSS'].map((c, i) => (
                      <th
                        key={c}
                        className="font-bold italic"
                        style={{
                          ...cellule, fontSize: '10pt',
                          width: i === 0 ? '12%' : i === 1 ? '46%' : '21%',
                        }}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liste.map((e, i) => (
                    <tr key={e.id}>
                      <td style={{ ...cellule, textAlign: 'center' }}>
                        {pages.slice(0, p).reduce((t, l) => t + l.length, 0) + i + 1}
                      </td>
                      <td className="italic" style={cellule}>{e.nom_prenom}</td>
                      <td style={{ ...cellule, textAlign: 'center' }}>{e.cin || '—'}</td>
                      <td
                        className="tabular-nums"
                        style={{ ...cellule, textAlign: 'center' }}
                      >
                        {e.cnss || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Sans papier à en-tête, les mentions légales ferment la
                  dernière feuille — c'est le papier qui les porte sinon. */}
              {pied && p === pages.length - 1 && (
                <footer style={{ marginTop: '8mm' }}>
                  <div style={{ height: '2.5mm', background: entete.accent, ...aplat }} />
                  <div className="pt-1.5 text-center leading-snug" style={{ fontSize: '7pt' }}>
                    <p className="font-semibold">Siège Social : {pied.siegeSocial}</p>
                    <p>
                      {[
                        pied.if && `IF : ${pied.if}`,
                        pied.rc && `RC : ${pied.rc}`,
                        pied.patente && `PATENTE : ${pied.patente}`,
                        pied.cnss && `CNSS : ${pied.cnss}`,
                        pied.ice && `ICE : ${pied.ice}`,
                      ].filter(Boolean).join('   ')}
                    </p>
                    <p>
                      {[
                        pied.rib && `${pied.banque ?? 'RIB'} : ${pied.rib}`,
                        pied.tel && `TEL : ${pied.tel}`,
                        pied.mail && `MAIL : ${pied.mail}`,
                      ].filter(Boolean).join('   ')}
                    </p>
                  </div>
                </footer>
              )}
            </article>
          ))}
        </div>

        <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>
      </div>
    </PortailImpression>
  )
}
