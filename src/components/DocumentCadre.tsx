import type { ReactNode } from 'react'
import { numero, type Modele } from '../lib/modeles'

/** Une clause : un intitulé et son texte. */
export interface Bloc {
  titre: string
  corps: ReactNode
}

const NOIR = '#000'

/**
 * La mise en page d'un document officiel, déclinée en cinq variantes.
 * Le contenu est fourni par l'appelant : seul l'agencement change.
 *
 *   prose    — articles numérotés, titres au fil du texte
 *   tableau  — les conditions dans un tableau en tête, clauses ensuite
 *   marge    — intitulés dans une colonne de gauche, texte à droite
 *   bandeau  — titre en bandeau noir plein, sections en capitales
 *   cadre    — document entièrement encadré, clauses séparées de filets
 */
export default function DocumentCadre({
  modele,
  entreprise,
  titre,
  sousTitre,
  reference,
  preambule,
  identite,
  titreIdentite,
  conditions,
  titreConditions,
  blocs,
  conclusion,
  signatures,
}: {
  modele: Modele
  entreprise: string
  titre: string
  sousTitre?: string
  reference?: string
  preambule?: ReactNode
  identite?: [string, string][]
  titreIdentite?: string
  conditions?: [string, string][]
  titreConditions?: string
  blocs: Bloc[]
  conclusion?: ReactNode
  signatures?: ReactNode
}) {
  const { mise, police } = modele
  const encadre = mise === 'cadre'

  return (
    <article
      className="fiche mx-auto my-6 bg-white shadow-xl print:my-0 print:shadow-none"
      style={{
        width: '182mm',
        padding: encadre ? '8mm' : '4mm 0',
        color: NOIR,
        fontFamily: police,
        fontSize: mise === 'marge' ? '10pt' : '10.5pt',
        lineHeight: mise === 'prose' ? 1.62 : 1.5,
      }}
    >
      <div style={encadre ? { border: `1.5pt solid ${NOIR}`, padding: '8mm' } : undefined}>
        <Entete
          mise={mise}
          entreprise={entreprise}
          titre={titre}
          sousTitre={sousTitre}
          reference={reference}
        />

        {preambule && <section style={{ marginBottom: '6mm' }}>{preambule}</section>}

        {identite && identite.length > 0 && (
          <Encadre mise={mise} titre={titreIdentite ?? 'Identité'}>
            <Paires paires={identite} mise={mise} />
          </Encadre>
        )}

        {mise === 'tableau' && conditions && conditions.length > 0 && (
          <Encadre mise={mise} titre={titreConditions ?? 'Conditions'}>
            <Tableau paires={conditions} />
          </Encadre>
        )}

        <Clauses modele={modele} blocs={blocs} />

        {conclusion && (
          <p style={{ marginTop: '7mm', textAlign: 'justify' }}>{conclusion}</p>
        )}

        {signatures}
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────── En-tête ─────

function Entete({
  mise, entreprise, titre, sousTitre, reference,
}: {
  mise: Modele['mise']; entreprise: string; titre: string
  sousTitre?: string; reference?: string
}) {
  const nom = (
    <p style={{ fontSize: '12pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
      {entreprise}
    </p>
  )

  if (mise === 'bandeau') {
    return (
      <header style={{ marginBottom: '7mm' }}>
        {nom}
        <div style={{
          background: NOIR, color: '#fff', padding: '3mm 5mm', marginTop: '3mm',
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '4mm',
        }}>
          <span style={{ fontSize: '14pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {titre}
          </span>
          {(sousTitre || reference) && (
            <span style={{ fontSize: '9.5pt', letterSpacing: '.06em' }}>
              {[sousTitre, reference].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </header>
    )
  }

  if (mise === 'marge') {
    return (
      <header style={{
        marginBottom: '7mm', display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-end', borderBottom: `2pt solid ${NOIR}`, paddingBottom: '3mm',
      }}>
        <div>
          {nom}
          <p style={{ fontSize: '15pt', fontWeight: 700, textTransform: 'uppercase', marginTop: '2mm' }}>
            {titre}
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9pt' }}>
          {sousTitre && <p style={{ fontWeight: 700 }}>{sousTitre}</p>}
          {reference && <p>Réf. {reference}</p>}
        </div>
      </header>
    )
  }

  if (mise === 'tableau') {
    return (
      <header style={{ marginBottom: '6mm' }}>
        <div style={{ borderBottom: `1pt solid ${NOIR}`, paddingBottom: '2mm', marginBottom: '4mm' }}>
          {nom}
        </div>
        <p style={{
          fontSize: '14pt', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.08em', textAlign: 'center',
        }}>
          {titre}{sousTitre ? ` — ${sousTitre}` : ''}
        </p>
        {reference && (
          <p style={{ textAlign: 'center', fontSize: '9pt', marginTop: '1.5mm' }}>N° {reference}</p>
        )}
      </header>
    )
  }

  if (mise === 'cadre') {
    return (
      <header style={{ textAlign: 'center', marginBottom: '7mm' }}>
        {nom}
        <div style={{
          border: `1pt solid ${NOIR}`, display: 'inline-block',
          padding: '2.5mm 8mm', marginTop: '4mm',
        }}>
          <span style={{ fontSize: '13pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em' }}>
            {titre}
          </span>
        </div>
        {(sousTitre || reference) && (
          <p style={{ fontSize: '9pt', marginTop: '2.5mm', letterSpacing: '.05em' }}>
            {[sousTitre, reference && `N° ${reference}`].filter(Boolean).join('  ·  ')}
          </p>
        )}
      </header>
    )
  }

  // prose : titre centré entre deux filets
  return (
    <header style={{ textAlign: 'center', marginBottom: '8mm' }}>
      {nom}
      <div style={{ borderTop: `1pt solid ${NOIR}`, borderBottom: `3pt double ${NOIR}`, padding: '3mm 0', marginTop: '4mm' }}>
        <span style={{ fontSize: '14pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>
          {titre}
        </span>
        {sousTitre && <span style={{ fontSize: '11pt' }}> — {sousTitre}</span>}
      </div>
      {reference && <p style={{ fontSize: '9pt', marginTop: '2mm' }}>N° {reference}</p>}
    </header>
  )
}

// ────────────────────────────────────────────────────────── Sections ─────

function Encadre({
  mise, titre, children,
}: { mise: Modele['mise']; titre: string; children: ReactNode }) {
  const style: React.CSSProperties =
    mise === 'bandeau'
      ? { borderLeft: `3pt solid ${NOIR}`, paddingLeft: '4mm', marginBottom: '6mm' }
      : mise === 'cadre'
        ? { border: `0.8pt solid ${NOIR}`, padding: '4mm', marginBottom: '6mm' }
        : { marginBottom: '6mm' }

  return (
    <section style={style}>
      <h2 style={{
        fontSize: '10pt', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.1em', marginBottom: '3mm',
        borderBottom: mise === 'prose' || mise === 'marge' ? `0.8pt solid ${NOIR}` : undefined,
        paddingBottom: mise === 'prose' || mise === 'marge' ? '1.5mm' : undefined,
      }}>
        {titre}
      </h2>
      {children}
    </section>
  )
}

function Paires({ paires, mise }: { paires: [string, string][]; mise: Modele['mise'] }) {
  // Deux colonnes quand la place le permet, une seule en mise « marge »
  const colonnes = mise === 'marge' ? 1 : 2
  return (
    <dl style={{
      display: 'grid',
      gridTemplateColumns: colonnes === 2 ? '1fr 1fr' : '1fr',
      columnGap: '8mm', rowGap: '1.8mm',
    }}>
      {paires.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: '2mm', alignItems: 'baseline' }}>
          <dt style={{ minWidth: '34mm', fontSize: '9.5pt' }}>{k}</dt>
          <dd style={{ fontWeight: 700 }}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Tableau({ paires }: { paires: [string, string][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {paires.map(([k, v], i) => (
          <tr key={k} style={{ background: i % 2 ? '#f2f2f2' : '#fff' }}>
            <td style={{ border: `0.8pt solid ${NOIR}`, padding: '1.8mm 3mm', width: '46%', fontSize: '9.5pt' }}>
              {k}
            </td>
            <td style={{ border: `0.8pt solid ${NOIR}`, padding: '1.8mm 3mm', fontWeight: 700 }}>
              {v}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Clauses({ modele, blocs }: { modele: Modele; blocs: Bloc[] }) {
  const { mise, numerotation } = modele

  if (mise === 'marge') {
    return (
      <div>
        {blocs.map((b, i) => (
          <section key={b.titre} style={{
            display: 'grid', gridTemplateColumns: '40mm 1fr', gap: '5mm',
            marginBottom: '4.5mm', breakInside: 'avoid',
          }}>
            <div style={{ textAlign: 'right', borderRight: `0.8pt solid ${NOIR}`, paddingRight: '4mm' }}>
              <p style={{ fontSize: '8.5pt', letterSpacing: '.06em' }}>{numero(i + 1, numerotation)}</p>
              <p style={{ fontWeight: 700, fontSize: '9.5pt', textTransform: 'uppercase' }}>{b.titre}</p>
            </div>
            <p style={{ textAlign: 'justify' }}>{b.corps}</p>
          </section>
        ))}
      </div>
    )
  }

  if (mise === 'cadre') {
    return (
      <div style={{ borderTop: `0.8pt solid ${NOIR}` }}>
        {blocs.map((b, i) => (
          <section key={b.titre} style={{
            borderBottom: `0.8pt solid ${NOIR}`, padding: '3mm 0', breakInside: 'avoid',
          }}>
            <p style={{ fontWeight: 700, fontSize: '9.5pt', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {numero(i + 1, numerotation)} — {b.titre}
            </p>
            <p style={{ textAlign: 'justify', marginTop: '1.5mm' }}>{b.corps}</p>
          </section>
        ))}
      </div>
    )
  }

  if (mise === 'bandeau') {
    return (
      <div>
        {blocs.map((b, i) => (
          <section key={b.titre} style={{ marginBottom: '5mm', breakInside: 'avoid' }}>
            <p style={{
              fontWeight: 700, fontSize: '9.5pt', textTransform: 'uppercase',
              letterSpacing: '.1em', borderBottom: `2pt solid ${NOIR}`,
              paddingBottom: '1mm', marginBottom: '2mm',
            }}>
              {numero(i + 1, numerotation)}  {b.titre}
            </p>
            <p style={{ textAlign: 'justify' }}>{b.corps}</p>
          </section>
        ))}
      </div>
    )
  }

  if (mise === 'tableau') {
    return (
      <div>
        {blocs.map((b, i) => (
          <section key={b.titre} style={{ marginBottom: '4mm', breakInside: 'avoid' }}>
            <p style={{ textAlign: 'justify' }}>
              <strong style={{ textTransform: 'uppercase', fontSize: '9.5pt', letterSpacing: '.04em' }}>
                {numero(i + 1, numerotation)} {b.titre} —{' '}
              </strong>
              {b.corps}
            </p>
          </section>
        ))}
      </div>
    )
  }

  // prose
  return (
    <div>
      {blocs.map((b, i) => (
        <section key={b.titre} style={{ marginBottom: '4.5mm', breakInside: 'avoid' }}>
          <p style={{ fontWeight: 700, marginBottom: '1mm' }}>
            {numero(i + 1, numerotation)} — {b.titre}
          </p>
          <p style={{ textAlign: 'justify' }}>{b.corps}</p>
        </section>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────── Signatures ─────

export function Signatures({
  modele, gauche, droite,
}: {
  modele: Modele
  gauche: { role: string; nom: string; mention?: string }
  droite: { role: string; nom: string; mention?: string }
}) {
  const encadrees = modele.mise === 'cadre' || modele.mise === 'tableau'
  const bloc = (s: { role: string; nom: string; mention?: string }) => (
    <div style={{
      width: '48%', textAlign: 'center',
      border: encadrees ? `0.8pt solid ${NOIR}` : undefined,
      padding: encadrees ? '3mm' : undefined,
    }}>
      <p style={{ fontWeight: 700, fontSize: '10pt' }}>{s.role}</p>
      <div style={{ height: '20mm' }} />
      <p style={{
        borderTop: encadrees ? undefined : `0.8pt solid ${NOIR}`,
        paddingTop: '1.5mm', fontSize: '9pt',
      }}>
        {s.nom}
        {s.mention && <><br /><span style={{ fontSize: '8pt' }}>({s.mention})</span></>}
      </p>
    </div>
  )
  return (
    <div style={{
      marginTop: '10mm', display: 'flex', justifyContent: 'space-between',
      breakInside: 'avoid',
    }}>
      {bloc(gauche)}
      {bloc(droite)}
    </div>
  )
}
