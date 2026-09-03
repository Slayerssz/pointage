import { enteteDe } from '../lib/entetes'
import { MOIS_FR } from '../lib/paie'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import type { Bulletin } from '../lib/bulletin'

/**
 * ÉTAT RÉCAPITULATIF DE PAIE — tout le monde sur un seul document.
 *
 * Le bulletin individuel se remet à l'employé ; celui-ci se garde, se
 * porte à la banque et se montre au comptable. Une ligne par personne,
 * les mêmes retenues que sur son bulletin, et les totaux en bas — la
 * somme des lignes doit tomber sur ce qui sortira du compte.
 *
 * Regroupé par lieu de travail : c'est ainsi qu'on vérifie une paie,
 * site par site, plutôt qu'en parcourant 400 noms d'affilée.
 */
export default function RecapPaiePrint({
  bulletins,
  entreprise,
  modeleDocument,
  onClose,
}: {
  bulletins: Bulletin[]
  entreprise: string
  /** Clé de modèle de la société : elle prime sur son nom. */
  modeleDocument?: string | null
  onClose: () => void
}) {
  useFermerSurEchap(onClose)
  useModeImpression()

  const entete = enteteDe(entreprise, modeleDocument)
  const { pret, imprimer } = useImpression(entete.logo ? 1 : 0)

  const b0 = bulletins[0]
  const periode = b0 ? `${MOIS_FR[b0.periode.mois - 1]} ${b0.periode.annee}` : ''
  const devise = b0?.periode.devise ?? 'DH'

  const n2 = (v: number | null | undefined) =>
    v == null ? '' : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  /** Les quatre montants d'un bulletin, lus à la même source que lui. */
  const montants = (b: Bulletin) => {
    const l = (code: string) => b.lignes.find((x) => x.code === code)
    return {
      brut: l('001')?.gain ?? 0,
      cnss: l('068')?.retenue ?? 0,
      amo: l('069')?.retenue ?? 0,
      igr: l('070')?.retenue ?? 0,
      net: b.pied.net_a_payer,
      jours: b.pied.jours_travailles,
    }
  }

  // Regroupement par lieu de travail, sites dans l'ordre alphabétique
  const parSite = new Map<string, Bulletin[]>()
  for (const b of bulletins) {
    const k = b.employe.site_nom || '(sans site)'
    parSite.set(k, [...(parSite.get(k) ?? []), b])
  }
  const groupes = [...parSite.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'))

  const cumul = (liste: Bulletin[]) =>
    liste.reduce(
      (s, b) => {
        const m = montants(b)
        return {
          brut: s.brut + m.brut, cnss: s.cnss + m.cnss, amo: s.amo + m.amo,
          igr: s.igr + m.igr, net: s.net + m.net,
        }
      },
      { brut: 0, cnss: 0, amo: 0, igr: 0, net: 0 },
    )
  const total = cumul(bulletins)
  const baremeManquant = bulletins.some((b) => b.bareme_igr_absent)

  const COLONNES = ['N°', 'Mat.', 'Nom & Prénom', 'C.I.N.', 'N° C.N.S.S.', 'J.Trav',
                    'Salaire brut', 'C.N.S.S.', 'A.M.O.', 'I.G.R.', 'Net à payer', 'Banque']

  let rang = 0

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={`État de paie — ${periode} · ${bulletins.length} employé(s) par virement`}
          pret={pret}
          imprimer={imprimer}
          nomFichier={`Etat_paie_${entreprise.replace(/\s+/g, '_')}_${periode.replace(/\s+/g, '_')}`}
          orientation="landscape"
          onClose={onClose}
        />

        {/* A4 paysage : douze colonnes ont besoin de largeur */}
        <article
          className="document-imprimable mx-auto my-6 bg-white shadow-xl print:my-0 print:shadow-none"
          style={{
            width: '273mm', padding: '10mm 12mm', color: '#111', fontSize: '8pt',
          }}
        >
          <header
            className="flex items-start justify-between gap-4 pb-2"
            style={{ borderBottom: `2px solid ${entete.accent}` }}
          >
            {entete.logo ? (
              <img src={entete.logo} alt={entreprise} style={{ height: '17mm', objectFit: 'contain' }} />
            ) : (
              <p className="font-bold uppercase" style={{ color: entete.accent, fontSize: '13pt' }}>
                {entreprise}
              </p>
            )}
            <div className="text-right">
              <p
                className="font-bold uppercase tracking-wide"
                style={{ color: entete.accent, fontSize: '12pt' }}
              >
                État récapitulatif de paie
              </p>
              <p className="mt-0.5 font-semibold uppercase" style={{ fontSize: '10pt' }}>
                {periode}
              </p>
              <p className="mt-0.5" style={{ fontSize: '7.5pt', color: '#555' }}>
                {bulletins.length} employé(s) payé(s) par virement · {groupes.length} site(s)
              </p>
            </div>
          </header>

          <table className="mt-3 w-full border-collapse">
            <thead style={{ display: 'table-header-group' }}>
              <tr
                style={{
                  background: entete.accent, color: '#fff',
                  printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact',
                }}
              >
                {COLONNES.map((c, i) => (
                  <th
                    key={c}
                    className="px-1 py-1 font-bold uppercase"
                    style={{
                      border: '1px solid #444', fontSize: '6.5pt',
                      textAlign: i <= 4 || i === 11 ? 'left' : 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>

            {groupes.map(([site, liste]) => {
              const st = cumul(liste)
              return (
                <tbody key={site} style={{ breakInside: 'avoid' }}>
                  <tr>
                    <td
                      colSpan={12}
                      className="px-1 py-1 font-bold uppercase"
                      style={{
                        border: '1px solid #444', background: '#eee', fontSize: '7.5pt',
                        printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact',
                      }}
                    >
                      {site} — {liste.length} employé(s)
                    </td>
                  </tr>

                  {liste.map((b) => {
                    const m = montants(b)
                    rang += 1
                    return (
                      <tr key={b.ligne_id}>
                        <C>{rang}</C>
                        <C>{b.employe.matricule ?? '—'}</C>
                        <C large>{b.employe.nom_prenom}</C>
                        <C>{b.employe.cin || '—'}</C>
                        <C>{b.employe.cnss || '—'}</C>
                        <C droite>{n2(m.jours)}</C>
                        <C droite>{n2(m.brut)}</C>
                        <C droite>{n2(m.cnss)}</C>
                        <C droite>{n2(m.amo)}</C>
                        <C droite>{n2(m.igr)}</C>
                        <C droite fort>{n2(m.net)}</C>
                        <C>{b.employe.banque || '—'}</C>
                      </tr>
                    )
                  })}

                  <tr style={{ fontWeight: 700 }}>
                    <C />
                    <C />
                    <C large>Sous-total {site}</C>
                    <C />
                    <C />
                    <C />
                    <C droite>{n2(st.brut)}</C>
                    <C droite>{n2(st.cnss)}</C>
                    <C droite>{n2(st.amo)}</C>
                    <C droite>{n2(st.igr)}</C>
                    <C droite>{n2(st.net)}</C>
                    <C />
                  </tr>
                </tbody>
              )
            })}

            <tfoot style={{ display: 'table-row-group' }}>
              <tr
                style={{
                  fontWeight: 700, fontSize: '9pt',
                  background: entete.accent, color: '#fff',
                  printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact',
                }}
              >
                <td colSpan={6} className="px-1 py-1.5 uppercase" style={{ border: '1px solid #444' }}>
                  Total général — {bulletins.length} employé(s)
                </td>
                <td className="px-1 py-1.5 text-right" style={{ border: '1px solid #444' }}>{n2(total.brut)}</td>
                <td className="px-1 py-1.5 text-right" style={{ border: '1px solid #444' }}>{n2(total.cnss)}</td>
                <td className="px-1 py-1.5 text-right" style={{ border: '1px solid #444' }}>{n2(total.amo)}</td>
                <td className="px-1 py-1.5 text-right" style={{ border: '1px solid #444' }}>{n2(total.igr)}</td>
                <td className="px-1 py-1.5 text-right" style={{ border: '1px solid #444' }}>
                  {n2(total.net)} {devise}
                </td>
                <td style={{ border: '1px solid #444' }} />
              </tr>
            </tfoot>
          </table>

          {baremeManquant && (
            <p
              className="mt-2 px-2 py-1 font-semibold"
              style={{
                border: '1px solid #444', fontSize: '7.5pt', background: '#f2f2f2',
                printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact',
              }}
            >
              Barème I.G.R. non renseigné : les retenues I.G.R. de cet état sont provisoires.
            </p>
          )}

          {/* Ce que la banque doit virer, isolé du reste */}
          <div className="mt-4 flex items-start justify-between gap-8">
            <p style={{ fontSize: '7.5pt', color: '#555', maxWidth: '120mm' }}>
              Cotisations salariales retenues : C.N.S.S. {n2(total.cnss)} · A.M.O. {n2(total.amo)}
              {total.igr > 0 && <> · I.G.R. {n2(total.igr)}</>} — soit{' '}
              {n2(total.cnss + total.amo + total.igr)} {devise} au total.
            </p>
            <div style={{ width: '75mm' }}>
              <p className="pb-10 text-right" style={{ fontSize: '8pt' }}>
                Pour {entreprise}, le {new Date().toLocaleDateString('fr-FR')}
              </p>
              <p style={{ borderTop: '1px solid #444' }} />
            </div>
          </div>
        </article>
      </div>
    </PortailImpression>
  )
}

function C({
  children, droite, large, fort,
}: { children?: React.ReactNode; droite?: boolean; large?: boolean; fort?: boolean }) {
  return (
    <td
      className="px-1 py-1"
      style={{
        border: '1px solid #444',
        textAlign: droite ? 'right' : 'left',
        whiteSpace: large ? 'normal' : 'nowrap',
        fontWeight: fort ? 600 : undefined,
      }}
    >
      {children}
    </td>
  )
}
