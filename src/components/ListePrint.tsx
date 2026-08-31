import { formatDateFr } from '../lib/dates'
import type { Employee, SitePrincipal } from '../lib/types'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'

/**
 * LISTE DU PERSONNEL — un tableau, pas une fiche par personne.
 *
 * Tout le monde apparaît, regroupé par annexe : qui travaille où, avec
 * les informations du registre. C'est le document qu'on sort pour avoir
 * une vue d'ensemble d'un site ou de toute l'entreprise.
 */
export default function ListePrint({
  employees,
  entreprise,
  sites,
  principaux,
  entreprises,
  intitule,
  onClose,
}: {
  employees: Employee[]
  entreprise: string
  sites: { id: string; name: string; site_principal_id: string | null; company_id?: string }[]
  principaux: SitePrincipal[]
  /** Renseigné en vue « toutes les entreprises » : la société de chaque site
   *  est alors rappelée, sinon la liste mélangerait les sociétés en silence. */
  entreprises?: { id: string; name: string }[]
  /** Ce qui a été filtré, rappelé sous le titre. */
  intitule?: string
  onClose: () => void
}) {
  useFermerSurEchap(onClose)

  useModeImpression()
  const { pret, imprimer } = useImpression(0)

  // Regrouper par annexe, dans l'ordre alphabétique
  const parSite = new Map<string, Employee[]>()
  for (const e of employees) {
    const l = parSite.get(e.site_id) ?? []
    l.push(e)
    parSite.set(e.site_id, l)
  }
  const nomSite = (id: string) => sites.find((s) => s.id === id)?.name ?? '(site inconnu)'
  const nomPrincipal = (id: string) => {
    const sp = sites.find((s) => s.id === id)?.site_principal_id
    return sp ? (principaux.find((p) => p.id === sp)?.name ?? null) : null
  }
  const nomEntreprise = (siteId: string) => {
    if (!entreprises) return null
    const cid = sites.find((s) => s.id === siteId)?.company_id
    return cid ? (entreprises.find((c) => c.id === cid)?.name ?? null) : null
  }
  const groupes = [...parSite.entries()].sort((a, b) =>
    nomSite(a[0]).localeCompare(nomSite(b[0]), 'fr'),
  )

  return (
    <PortailImpression>
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
      <BarreImpression
        titre={`Liste du personnel — ${employees.length} employé(s), ${groupes.length} site(s)`}
        pret={pret}
        imprimer={imprimer}
        nomFichier={`Liste_${entreprise.replace(/\s+/g, '_')}`}
        orientation="landscape"
        onClose={onClose}
      />

      {/* A4 paysage : le tableau a besoin de largeur */}
      <div className="document-imprimable mx-auto my-6 max-w-[297mm] bg-white p-[12mm] text-[9pt] leading-snug text-black shadow-xl print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-5 border-b-2 border-black pb-3 text-center">
          <h1 className="text-base font-bold uppercase tracking-wide">
            {entreprises ? 'TOUTES LES ENTREPRISES' : entreprise}
          </h1>
          <p className="mt-1 text-lg font-bold uppercase">Liste du personnel</p>
          {intitule && <p className="mt-1 text-[10pt]">{intitule}</p>}
          <p className="mt-1 text-[8pt] text-slate-600">
            {employees.length} employé(s) · éditée le {new Date().toLocaleDateString('fr-FR')}
          </p>
        </header>

        {groupes.map(([siteId, liste]) => {
          const principal = nomPrincipal(siteId)
          const societe = nomEntreprise(siteId)
          return (
            <section key={siteId} className="mb-6 break-inside-avoid">
              <h2 className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-black pb-1">
                <span className="text-[11pt] font-bold uppercase">
                  {societe && (
                    <span className="mr-2 text-[9pt] font-normal">{societe} ·</span>
                  )}
                  {nomSite(siteId)}
                  {principal && (
                    <span className="ml-2 text-[9pt] font-normal normal-case text-slate-600">
                      — {principal}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[9pt] font-semibold">
                  {liste.length} employé(s)
                </span>
              </h2>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    {['N°', 'Nom & Prénom', 'Qualification', 'C.I.N.', 'N° CNSS',
                      'Naissance', 'Embauche', 'Téléphone', 'Ville', 'Règlement'].map((c) => (
                      <th
                        key={c}
                        className="border border-slate-400 px-1.5 py-1 text-left text-[7.5pt] font-bold uppercase tracking-wide"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liste.map((e) => (
                    <tr key={e.id} className={e.actif ? '' : 'text-slate-500'}>
                      <td className="border border-slate-400 px-1.5 py-1 text-right tabular-nums">
                        {e.matricule ?? '—'}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-1 font-semibold">
                        {e.nom_prenom}
                        {!e.actif && <span className="font-normal"> (sorti)</span>}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-1">{e.qualification ?? '—'}</td>
                      <td className="border border-slate-400 px-1.5 py-1">{e.cin ?? '—'}</td>
                      <td className="border border-slate-400 px-1.5 py-1">{e.cnss ?? '—'}</td>
                      <td className="border border-slate-400 px-1.5 py-1 whitespace-nowrap">
                        {formatDateFr(e.date_naissance)}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-1 whitespace-nowrap">
                        {formatDateFr(e.date_embauche)}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-1 whitespace-nowrap">
                        {e.telephone ?? '—'}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-1">{e.ville ?? '—'}</td>
                      <td className="border border-slate-400 px-1.5 py-1">{e.mode_reglement ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        })}

        <p className="mt-6 border-t border-black pt-2 text-right text-[9pt] font-bold">
          TOTAL GÉNÉRAL : {employees.length} employé(s)
        </p>
      </div>

      {/* Cette liste s'imprime en paysage, contrairement aux autres documents */}
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } }`}</style>
    </div>
    </PortailImpression>
  )
}
