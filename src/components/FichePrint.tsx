import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatDateFr } from '../lib/dates'
import { enteteDe } from '../lib/entetes'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import { genererFichePdf } from '../lib/fichePdf'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import type { Employee } from '../lib/types'

/**
 * FICHE D'INFORMATIONS PERSONNELLES
 *
 * Reprend le modèle officiel : en-tête et couleur de l'entreprise,
 * emplacement photo, matricule, les neuf champs, puis la liste des
 * pièces administratives à fournir. Une fiche par page.
 */

const PIECES = [
  'COPIE DE LA CIN',
  'CERTIFICAT DE BONNE CONDUITE',
  'CERTIFICAT MÉDICAL D’APTITUDE AU TRAVAIL',
]

/** Le département : saisi, sinon déduit de la qualification. */
function departementDe(e: Employee): string {
  if (e.departement) return e.departement
  if (!e.qualification) return ''
  return e.qualification.toUpperCase().replace(/^AGENT(\s+D['’]|\s+DE\s+|\s+)?/i, '').trim()
}

export default function FichePrint({
  employees,
  entreprise,
  sites,
  onClose,
}: {
  employees: Employee[]
  entreprise: string
  sites: { id: string; name: string }[]
  onClose: () => void
}) {
  const entete = enteteDe(entreprise)
  useFermerSurEchap(onClose)
  useModeImpression()

  // Les photos sont téléchargées puis converties en données locales :
  // ainsi elles s'impriment et s'exportent en PDF sans dépendre d'une
  // URL distante, qui bloquerait la capture.
  const chemins = employees.map((e) => e.photo_path).filter((p): p is string => Boolean(p))
  const { data: photos, isLoading: photosEnCours } = useQuery({
    queryKey: ['photos-fiches', chemins],
    enabled: chemins.length > 0,
    queryFn: async (): Promise<Map<string, string>> => {
      const m = new Map<string, string>()
      await Promise.all(chemins.map(async (chemin) => {
        const { data, error } = await supabase.storage.from('photos').download(chemin)
        if (error || !data) return
        const b64 = await new Promise<string>((r) => {
          const fr = new FileReader()
          fr.onload = () => r(String(fr.result))
          fr.readAsDataURL(data)
        })
        m.set(chemin, b64)
      }))
      return m
    },
  })

  // Le logo, plus une photo par fiche qui en possède une
  const nbImages = (entete.logo ? employees.length : 0) +
    (photosEnCours ? 0 : employees.filter((e) => e.photo_path && photos?.get(e.photo_path)).length)
  const { pret, imprimer } = useImpression(photosEnCours ? 0 : nbImages)

  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? ''

  return (
    <PortailImpression>
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
      <BarreImpression
        titre={
          employees.length === 1
            ? `Fiche — ${employees[0].nom_prenom}`
            : `${employees.length} fiches d’informations personnelles`
        }
        pret={pret && !photosEnCours}
        imprimer={imprimer}
        nomFichier={
          employees.length === 1
            ? `Fiche_${employees[0].nom_prenom.replace(/\s+/g, '_')}`
            : `Fiches_${entreprise.replace(/\s+/g, '_')}`
        }
        genererPdf={() =>
          genererFichePdf({
            employees,
            entreprise,
            sites,
            photos,
            nomFichier:
              employees.length === 1
                ? `Fiche_${employees[0].nom_prenom.replace(/\s+/g, '_')}`
                : `Fiches_${entreprise.replace(/\s+/g, '_')}`,
          })
        }
        onClose={onClose}
      />

      <div className="document-imprimable">
        {employees.map((e) => {
          const photo = e.photo_path ? photos?.get(e.photo_path) : undefined
          const champs: [string, string][] = [
            ['Nom et Prénom', e.nom_prenom],
            ['N° Carte Nationale', e.cin ?? ''],
            ['Adresse', e.adresse ?? ''],
            ['Ville', e.ville ?? ''],
            ['Date de Naissance', e.date_naissance ? formatDateFr(e.date_naissance) : ''],
            ['Département', departementDe(e)],
            ['Qualification', e.qualification ?? ''],
            ['Site', siteName(e.site_id)],
            ['Date d’embauche', e.date_embauche ? formatDateFr(e.date_embauche) : ''],
          ]

          return (
            <article
              key={e.id}
              className="fiche mx-auto my-6 bg-white shadow-xl print:my-0 print:shadow-none"
              style={{ width: '186mm', padding: '10mm 12mm', color: '#1a1a1a' }}
            >
              {/* En-tête de l'entreprise */}
              <header className="text-center">
                {entete.logo ? (
                  <img
                    src={entete.logo}
                    alt={entreprise}
                    style={{ height: '26mm', margin: '0 auto', objectFit: 'contain' }}
                  />
                ) : (
                  <p
                    className="font-bold uppercase tracking-wide"
                    style={{ color: entete.accent, fontSize: '15pt' }}
                  >
                    {entreprise}
                  </p>
                )}
              </header>

              {/* Bandeau du titre, encadré de deux filets */}
              <div className="flex items-center" style={{ margin: '7mm 0 6mm' }}>
                <span style={{ flex: 1, height: 1, background: entete.accent, opacity: 0.45 }} />
                <span
                  className="font-bold uppercase"
                  style={{
                    background: entete.accent, color: '#fff',
                    padding: '2.6mm 7mm', fontSize: '12.5pt', letterSpacing: '.02em',
                    margin: '0 4mm', whiteSpace: 'nowrap',
                  }}
                >
                  Fiche d’informations personnelles
                </span>
                <span style={{ flex: 1, height: 1, background: entete.accent, opacity: 0.45 }} />
              </div>

              {/* Photo à gauche, matricule au centre */}
              <div className="flex items-start" style={{ gap: '10mm', marginBottom: '9mm' }}>
                <div
                  className="flex shrink-0 flex-col items-center justify-center"
                  style={{
                    width: '32mm', height: '40mm', border: '1px solid #d4d4d4',
                    borderRadius: '3mm', overflow: 'hidden',
                  }}
                >
                  {photo ? (
                    <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#c9c9c9" strokeWidth="1.5"
                           style={{ width: '9mm', height: '9mm' }}>
                        <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
                        <circle cx="12" cy="12.5" r="3.2" />
                      </svg>
                      <span style={{ color: entete.accent, fontSize: '8pt', letterSpacing: '.08em',
                                     marginTop: '3mm', fontWeight: 600 }}>
                        PHOTO
                      </span>
                    </>
                  )}
                </div>

                <div className="flex-1 text-center" style={{ paddingTop: '6mm' }}>
                  <p className="uppercase" style={{ color: entete.accent, fontSize: '13pt',
                                                    letterSpacing: '.05em', fontWeight: 600 }}>
                    Matricule N°{' '}
                    <span style={{ fontWeight: 700 }}>
                      {e.matricule != null ? String(e.matricule).padStart(3, '0') : '—'}
                    </span>
                  </p>
                  <span style={{ display: 'block', height: 2, background: entete.accent,
                                 opacity: 0.75, margin: '2mm auto 0', width: '58mm' }} />
                </div>
              </div>

              {/* Les neuf champs */}
              <dl>
                {champs.map(([label, valeur]) => (
                  <div key={label} className="flex items-baseline" style={{ marginBottom: '4.6mm' }}>
                    <dt style={{ width: '52mm', color: entete.accent, fontWeight: 600, fontSize: '10.5pt' }}>
                      {label}
                    </dt>
                    <dd style={{ width: '6mm', color: entete.accent }}>:</dd>
                    <dd className="uppercase" style={{ fontWeight: 700, fontSize: '10.5pt', flex: 1 }}>
                      {valeur || ' '}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Pièces à fournir */}
              <p
                className="text-center uppercase"
                style={{
                  color: entete.accent, fontWeight: 600, fontSize: '12pt',
                  letterSpacing: '.03em', textDecoration: 'underline',
                  textUnderlineOffset: '2mm', margin: '10mm 0 6mm',
                }}
              >
                Pièces administratives à fournir
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {PIECES.map((p) => (
                  <li key={p} className="flex items-baseline" style={{ marginBottom: '3.5mm' }}>
                    <span style={{ color: entete.accent, marginRight: '4mm', fontSize: '11pt' }}>•</span>
                    <span className="uppercase" style={{ color: entete.accent, fontWeight: 600, fontSize: '10pt' }}>
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } }`}</style>
    </div>
    </PortailImpression>
  )
}
