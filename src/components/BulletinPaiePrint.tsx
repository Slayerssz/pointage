import { Fragment, type ReactNode } from 'react'
import { enteteDe } from '../lib/entetes'
import { formatDateFr } from '../lib/dates'
import { MOIS_FR } from '../lib/paie'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import type { Bulletin } from '../lib/bulletin'

/**
 * BULLETIN DE PAIE — un par employé, une page chacun.
 *
 * Réservé aux employés payés par virement : ce sont eux qui sont
 * déclarés à la C.N.S.S., et le bulletin n'a de sens que pour eux.
 *
 * La mise en page suit le modèle papier de la société : le pavé
 * d'identité en haut, le corps CODE / LIBELLE / BASE / TAUX / GAIN /
 * RETENUE au milieu, le récapitulatif en pied.
 */
export default function BulletinPaiePrint({
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
  const { pret, imprimer } = useImpression(entete.logo ? bulletins.length : 0)

  const b0 = bulletins[0]
  const periodeLabel = b0
    ? `${MOIS_FR[b0.periode.mois - 1]} ${b0.periode.annee}`
    : ''
  const devise = b0?.periode.devise ?? 'DH'

  const n2 = (v: number | null | undefined) =>
    v == null ? '' : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={`Bulletins de paie — ${periodeLabel} · ${bulletins.length} employé(s) par virement`}
          pret={pret}
          imprimer={imprimer}
          nomFichier={`Bulletins_${entreprise.replace(/\s+/g, '_')}_${periodeLabel.replace(/\s+/g, '_')}`}
          onClose={onClose}
        />

        <div className="document-imprimable">
          {bulletins.map((b, i) => {
            const brut = b.lignes.find((l) => l.code === '001')
            const net = b.lignes.find((l) => l.libelle === 'GAIN NET')
            const totalRetenues = b.lignes.reduce((s, l) => s + (l.retenue ?? 0), 0)

            return (
              <article
                key={b.ligne_id}
                className="mx-auto my-6 bg-white shadow-xl print:my-0 print:shadow-none"
                style={{
                  width: '186mm',
                  padding: '10mm 12mm',
                  color: '#111',
                  fontSize: '8.5pt',
                  breakAfter: i === bulletins.length - 1 ? 'auto' : 'page',
                }}
              >
                {/* En-tête de la société */}
                <header
                  className="flex items-start justify-between gap-4 pb-2"
                  style={{ borderBottom: `2px solid ${entete.accent}` }}
                >
                  {entete.logo ? (
                    <img
                      src={entete.logo}
                      alt={entreprise}
                      style={{ height: '18mm', objectFit: 'contain' }}
                    />
                  ) : (
                    <p
                      className="font-bold uppercase"
                      style={{ color: entete.accent, fontSize: '13pt' }}
                    >
                      {entreprise}
                    </p>
                  )}
                  <div className="text-right">
                    <p
                      className="font-bold uppercase tracking-wide"
                      style={{ color: entete.accent, fontSize: '12pt' }}
                    >
                      Bulletin de paie
                    </p>
                    <p className="mt-0.5 font-semibold uppercase" style={{ fontSize: '10pt' }}>
                      {periodeLabel}
                    </p>
                  </div>
                </header>

                {/* Pavé d'identité : l'employé et son rattachement */}
                <table
                  className="mt-4 w-full border-collapse"
                  style={{ border: '1px solid #444' }}
                >
                  <tbody>
                    <Paire
                      cases={[
                        ['Matricule', b.employe.matricule != null ? String(b.employe.matricule) : '—'],
                        ['Nom & Prénom', b.employe.nom_prenom],
                        ['Qualification', b.employe.qualification || '—'],
                      ]}
                      accent={entete.accent}
                    />
                    <Paire
                      cases={[
                        ['C.I.N.', b.employe.cin || '—'],
                        ['N° C.N.S.S.', b.employe.cnss || '—'],
                        ['Date d’embauche', b.employe.date_embauche ? formatDateFr(b.employe.date_embauche) : '—'],
                      ]}
                      accent={entete.accent}
                    />
                    <Paire
                      cases={[
                        ['Situation', b.employe.situation_familiale || '—'],
                        ['Enfants', String(b.employe.nombre_enfants ?? 0)],
                        ['Lieu de travail', b.employe.site_nom || '—'],
                      ]}
                      accent={entete.accent}
                    />
                    <Paire
                      cases={[
                        ['Mode de règlement', 'Virement'],
                        ['Banque', b.employe.banque || '—'],
                      ]}
                      accent={entete.accent}
                    />
                    <tr>
                      <Libelle accent={entete.accent}>R.I.B.</Libelle>
                      <td
                        colSpan={5}
                        className="px-1.5 py-1"
                        style={{ border: '1px solid #444', fontSize: '8.5pt', letterSpacing: '0.02em' }}
                      >
                        {b.employe.rib || '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Corps du bulletin */}
                <table
                  className="mt-4 w-full border-collapse"
                  style={{ border: '1px solid #444' }}
                >
                  <thead>
                    <tr
                      style={{
                        background: entete.accent,
                        color: '#fff',
                        printColorAdjust: 'exact',
                        WebkitPrintColorAdjust: 'exact',
                      }}
                    >
                      {['CODE', 'LIBELLE', 'BASE', 'TAUX', 'GAIN', 'RETENUE'].map((c, j) => (
                        <th
                          key={c}
                          className="px-1.5 py-1 font-bold uppercase"
                          style={{
                            border: '1px solid #444',
                            fontSize: '7.5pt',
                            textAlign: j <= 1 ? 'left' : 'right',
                            width: j === 0 ? '10mm' : j === 1 ? undefined : '24mm',
                          }}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.lignes.map((l, j) => {
                      const total = l.libelle === 'GAIN NET'
                      return (
                        <tr
                          key={j}
                          style={{
                            fontWeight: total ? 700 : 400,
                            background: total ? '#eee' : undefined,
                            printColorAdjust: 'exact',
                            WebkitPrintColorAdjust: 'exact',
                          }}
                        >
                          <Case>{l.code}</Case>
                          <Case>{l.libelle}</Case>
                          <Case droite>{n2(l.base)}</Case>
                          <Case droite>
                            {l.code === '001'
                              ? l.taux != null ? `${n2(l.taux)} j` : ''
                              : l.taux != null ? `${n2(l.taux)} %` : ''}
                          </Case>
                          <Case droite>{n2(l.gain)}</Case>
                          <Case droite>{n2(l.retenue)}</Case>
                        </tr>
                      )
                    })}
                    <tr style={{ fontSize: '7.5pt' }}>
                      <Case />
                      <Case>TOTAUX</Case>
                      <Case />
                      <Case />
                      <Case droite>{n2(brut?.gain ?? 0)}</Case>
                      <Case droite>{n2(totalRetenues)}</Case>
                    </tr>
                  </tbody>
                </table>

                {b.bareme_igr_absent && (
                  <p
                    className="mt-2 px-2 py-1 font-semibold"
                    style={{
                      border: '1px solid #444',
                      fontSize: '7.5pt',
                      background: '#f2f2f2',
                      printColorAdjust: 'exact',
                      WebkitPrintColorAdjust: 'exact',
                    }}
                  >
                    Barème I.G.R. non renseigné : la retenue affichée est provisoire.
                  </p>
                )}

                {/* Récapitulatif de pied */}
                <table
                  className="mt-4 w-full border-collapse"
                  style={{ border: '1px solid #444' }}
                >
                  <thead>
                    <tr style={{ background: '#eee', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                      {['J. Trav.', 'Cumul I.G.R.', 'Cum. C.N.S.S.', 'Hr. Sal.', 'Net à Payer'].map((c) => (
                        <th
                          key={c}
                          className="px-1.5 py-1 font-bold uppercase"
                          style={{ border: '1px solid #444', fontSize: '7.5pt', textAlign: 'center' }}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {[
                        n2(b.pied.jours_travailles),
                        n2(b.pied.cumul_igr),
                        n2(b.pied.cumul_cnss),
                        b.pied.heures_salariales.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                        `${n2(b.pied.net_a_payer)} ${devise}`,
                      ].map((v, j) => (
                        <td
                          key={j}
                          className="px-1.5 py-1.5"
                          style={{
                            border: '1px solid #444',
                            textAlign: 'center',
                            fontWeight: j === 4 ? 700 : 400,
                            fontSize: j === 4 ? '10pt' : '9pt',
                          }}
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>

                {/* Ce qui a été réellement viré, quand primes ou retenues
                    internes font diverger le versement du net fiscal. */}
                {(b.prime > 0 || b.retenues_internes > 0) && (
                  <table className="mt-3 w-full border-collapse" style={{ border: '1px solid #444' }}>
                    <tbody>
                      <tr style={{ fontSize: '8pt' }}>
                        <Case>Prime</Case>
                        <Case droite>{n2(b.prime)}</Case>
                        <Case>Retenues internes</Case>
                        <Case droite>{n2(b.retenues_internes)}</Case>
                        <Case>
                          <strong>Montant viré</strong>
                        </Case>
                        <Case droite>
                          <strong>{n2(b.net_verse)} {devise}</strong>
                        </Case>
                      </tr>
                    </tbody>
                  </table>
                )}

                <div className="mt-8 flex justify-between" style={{ fontSize: '8pt' }}>
                  <div style={{ width: '60mm' }}>
                    <p className="pb-8">Signature de l’employé</p>
                    <p style={{ borderTop: '1px solid #444' }} />
                  </div>
                  <div style={{ width: '60mm', textAlign: 'right' }}>
                    <p className="pb-8">Pour {entreprise}</p>
                    <p style={{ borderTop: '1px solid #444' }} />
                  </div>
                </div>

                <p className="mt-4 text-center" style={{ fontSize: '7pt', color: '#666' }}>
                  Net calculé sur {n2(brut?.taux)} jours travaillés · Édité le{' '}
                  {new Date().toLocaleDateString('fr-FR')} · Gain net {n2(net?.gain)} {devise}
                </p>
              </article>
            )
          })}
        </div>
      </div>
    </PortailImpression>
  )
}

function Case({ children, droite }: { children?: ReactNode; droite?: boolean }) {
  return (
    <td
      className="px-1.5 py-1"
      style={{ border: '1px solid #444', textAlign: droite ? 'right' : 'left' }}
    >
      {children}
    </td>
  )
}

/** L'intitulé d'une case du pavé d'identité, aux couleurs de la société. */
function Libelle({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <td
      className="px-1.5 py-1 font-semibold uppercase"
      style={{
        border: '1px solid #444',
        fontSize: '7pt',
        color: accent,
        whiteSpace: 'nowrap',
        background: '#fafafa',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      {children}
    </td>
  )
}

/** Une rangée de couples « libellé / valeur » dans le pavé d'identité. */
function Paire({ cases, accent }: { cases: [string, string][]; accent: string }) {
  return (
    <tr>
      {cases.map(([k, v], i) => (
        <Fragment key={k}>
          <Libelle accent={accent}>{k}</Libelle>
          <td
            // La dernière valeur d'une rangée courte occupe la place restante,
            // pour ne pas laisser de cases vides au milieu du pavé.
            colSpan={i === cases.length - 1 ? 1 + 2 * (3 - cases.length) : 1}
            className="px-1.5 py-1"
            style={{ border: '1px solid #444', fontSize: '8.5pt' }}
          >
            {v}
          </td>
        </Fragment>
      ))}
    </tr>
  )
}
