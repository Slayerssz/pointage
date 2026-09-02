import type { ModeleContrat } from '../lib/contratsModeles'

/**
 * LE CONTRAT, TEL QU'IL S'IMPRIME.
 *
 * Ni logo ni en-tête : ces contrats partent chez le notaire, et c'est la
 * signature légalisée qui les authentifie, pas un bandeau de couleur.
 *
 * Un champ non rempli reste en pointillés — le document sort alors comme
 * le formulaire papier, prêt à être complété à la main.
 */
export default function ContratDocument({
  modele,
  valeurs,
  echelle = 1,
}: {
  modele: ModeleContrat
  valeurs: Record<string, string>
  /** Réduction pour l'aperçu à l'écran ; l'impression reste à 1. */
  echelle?: number
}) {
  const arabe = modele.langue === 'ar'
  const t = (s: string) => rendre(s, valeurs, arabe)

  return (
    <article
      className="contrat-imprimable bg-white"
      dir={arabe ? 'rtl' : 'ltr'}
      lang={arabe ? 'ar' : 'fr'}
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm 18mm',
        color: '#000',
        fontSize: arabe ? '11.5pt' : '10.5pt',
        lineHeight: arabe ? 1.9 : 1.55,
        fontFamily: arabe
          ? '"Noto Naskh Arabic", "Geeza Pro", "Times New Roman", serif'
          : '"Times New Roman", Times, serif',
        textAlign: 'justify',
        transform: echelle === 1 ? undefined : `scale(${echelle})`,
        transformOrigin: 'top left',
      }}
    >
      <h1
        className="font-bold"
        style={{
          textAlign: 'center',
          fontSize: arabe ? '14pt' : '13pt',
          textDecoration: 'underline',
          marginBottom: '10mm',
        }}
      >
        {modele.titre}
      </h1>

      {modele.blocs.map((b, i) => {
        if (b.type === 'espace') return <div key={i} style={{ height: '4mm' }} />
        if (b.type === 'titre') {
          return (
            <h2 key={i} className="font-bold" style={{ textAlign: 'center', margin: '4mm 0' }}>
              {t(b.texte)}
            </h2>
          )
        }
        if (b.type === 'section') {
          return (
            <h3 key={i} className="font-bold" style={{ margin: '4mm 0 1.5mm', textAlign: 'start' }}>
              {t(b.texte)}
            </h3>
          )
        }
        if (b.type === 'puces') {
          return (
            <ul key={i} style={{ margin: '1.5mm 0', paddingInlineStart: '8mm', listStyle: 'disc' }}>
              {b.items.map((it, j) => (
                <li key={j} style={{ marginBottom: '1mm' }}>{t(it)}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} style={{ margin: '0 0 2mm' }}>
            {t(b.texte)}
          </p>
        )
      })}

      {/* Les deux signatures, en pied de la dernière page */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '20mm',
          marginTop: '16mm',
          breakInside: 'avoid',
        }}
      >
        <div style={{ width: '70mm' }}>
          <p className="font-bold">{modele.gauche}</p>
        </div>
        <div style={{ width: '70mm', textAlign: 'end' }}>
          <p className="font-bold">{modele.droite}</p>
          {modele.mentionSignature && (
            <p style={{ fontSize: '9pt', marginTop: '2mm' }}>{modele.mentionSignature}</p>
          )}
        </div>
      </div>
    </article>
  )
}

/**
 * Remplace chaque jeton par sa valeur, en isolant les valeurs UNE À UNE.
 *
 * L'isolement compte sur le contrat arabe : le C.I.N., les dates et les
 * montants y restent en caractères latins, et sans <bdi> autour de chacun
 * le navigateur les recompose au mauvais bout de la ligne. Encadrer le
 * paragraphe entier ne servirait à rien — c'est la valeur qu'il faut
 * isoler de son voisinage, pas la phrase.
 *
 * Un champ vide ressort en pointillés, comme sur le formulaire vierge.
 */
function rendre(texte: string, valeurs: Record<string, string>, arabe: boolean) {
  return texte.split(/(\{\{\w+\}\})/g).map((morceau, i) => {
    const jeton = /^\{\{(\w+)\}\}$/.exec(morceau)
    if (!jeton) return <span key={i}>{morceau}</span>

    const valeur = (valeurs[jeton[1]] ?? '').trim()
    if (!valeur) {
      return (
        <span key={i} style={{ letterSpacing: '0.05em', color: '#555' }}>
          ……………………
        </span>
      )
    }
    return arabe ? <bdi key={i}>{valeur}</bdi> : <span key={i}>{valeur}</span>
  })
}
