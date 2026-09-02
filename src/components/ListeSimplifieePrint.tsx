import { enteteDe } from '../lib/entetes'
import { formatDateFr } from '../lib/dates'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import type { Employee } from '../lib/types'

/**
 * LISTE SIMPLIFIÉE — la version courte, celle qui sort de l'entreprise.
 *
 * Rien d'autre que le numéro, le nom, le C.I.N. et le numéro C.N.S.S. :
 * c'est ce que le client a le droit de voir. Ni salaire, ni adresse, ni
 * téléphone, contrairement à la liste complète qui, elle, reste interne.
 *
 * La mise en page suit le modèle papier : marché en haut à gauche, titre
 * et établissement centrés et soulignés, bandeau de période, tableau à
 * quatre colonnes, mentions légales en pied.
 */
export default function ListeSimplifieePrint({
  employees,
  entreprise,
  marche,
  intitule,
  etablissement,
  du,
  au,
  onClose,
}: {
  employees: Employee[]
  entreprise: string
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

  const entete = enteteDe(entreprise)
  const { pret, imprimer } = useImpression(entete.logo ? 1 : 0)
  const pied = entete.pied

  // Le bandeau et l'en-tête du tableau reprennent la couleur de la société,
  // très éclaircie : le document reste lisible en noir et blanc.
  const teinte = `color-mix(in srgb, ${entete.accent} 22%, white)`

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={`${intitule} — ${employees.length} agent(s)`}
          pret={pret}
          imprimer={imprimer}
          nomFichier={`Liste_${marche.replace(/[^\w]+/g, '-') || 'marche'}_${entreprise.replace(/\s+/g, '_')}`}
          onClose={onClose}
        />

        <article
          className="document-imprimable mx-auto my-6 flex min-h-[277mm] flex-col bg-white shadow-xl print:my-0 print:shadow-none"
          style={{ width: '186mm', padding: '10mm 12mm', color: '#000', fontSize: '10pt' }}
        >
          {/* En-tête de la société */}
          <header className="text-center">
            {entete.logo ? (
              <img
                src={entete.logo}
                alt={entreprise}
                style={{ height: '28mm', margin: '0 auto', objectFit: 'contain' }}
              />
            ) : (
              <p className="text-lg font-bold uppercase" style={{ color: entete.accent }}>
                {entreprise}
              </p>
            )}
          </header>

          {marche.trim() && (
            <p className="mt-6 font-semibold" style={{ fontSize: '11pt' }}>
              MARCHE N°: {marche}
            </p>
          )}

          <div className={`text-center ${marche.trim() ? 'mt-5' : 'mt-8'}`}>
            <h1 className="font-bold underline" style={{ fontSize: '13pt' }}>
              {intitule}
            </h1>
            <h2 className="mt-1 font-bold underline" style={{ fontSize: '12pt' }}>
              {etablissement}
            </h2>
          </div>

          {/* Bandeau de période, à la largeur du tableau */}
          <div className="mx-auto mt-6" style={{ width: '82%' }}>
            <p
              className="py-1.5 text-center font-semibold italic"
              style={{
                background: teinte,
                border: '1px solid #000',
                fontSize: '11pt',
                printColorAdjust: 'exact',
                WebkitPrintColorAdjust: 'exact',
              }}
            >
              Période Du {formatDateFr(du)} Au {formatDateFr(au)}
            </p>

            <table className="w-full border-collapse" style={{ borderTop: 'none' }}>
              <thead>
                <tr
                  style={{
                    background: teinte,
                    printColorAdjust: 'exact',
                    WebkitPrintColorAdjust: 'exact',
                  }}
                >
                  {['N°', 'NOM ET PRENOM', 'N°CIN', 'N° DE CNSS'].map((c, i) => (
                    <th
                      key={c}
                      className="px-2 py-1.5 font-bold italic"
                      style={{
                        border: '1px solid #000',
                        fontSize: '10pt',
                        width: i === 0 ? '12%' : i === 1 ? '46%' : '21%',
                      }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((e, i) => (
                  <tr key={e.id}>
                    <td
                      className="px-2 py-2 text-center"
                      style={{ border: '1px solid #000' }}
                    >
                      {i + 1}
                    </td>
                    <td className="px-2 py-2 italic" style={{ border: '1px solid #000' }}>
                      {e.nom_prenom}
                    </td>
                    <td
                      className="px-2 py-2 text-center"
                      style={{ border: '1px solid #000' }}
                    >
                      {e.cin || '—'}
                    </td>
                    <td
                      className="px-2 py-2 text-center tabular-nums"
                      style={{ border: '1px solid #000' }}
                    >
                      {e.cnss || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Les mentions légales, poussées en bas de page. Toutes les
              sociétés n'en impriment pas : sans elles, la page se termine
              simplement après le tableau. */}
          {pied && (
            <footer className="mt-auto pt-8">
                <div
                  style={{
                    height: '2.5mm',
                    background: entete.accent,
                    printColorAdjust: 'exact',
                    WebkitPrintColorAdjust: 'exact',
                  }}
                />
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
      </div>
    </PortailImpression>
  )
}
