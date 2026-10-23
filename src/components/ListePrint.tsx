import type React from 'react'
import { formatDateFr } from '../lib/dates'
import type { Employee, SitePrincipal } from '../lib/types'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import { formatDH } from '../lib/paie'
import { exporterListePersonnelExcel } from '../lib/exports'
import { enregistrerListePersonnelPdf } from '../lib/listePersonnelPdf'
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
        genererPdf={() =>
          enregistrerListePersonnelPdf({
            groupes: groupes.map(([siteId, liste]) => ({
              site: nomSite(siteId),
              principal: nomPrincipal(siteId),
              societe: nomEntreprise(siteId),
              employees: liste,
            })),
            titre: entreprises ? 'Toutes les entreprises' : entreprise,
            intitule,
            effectif: employees.length,
            total: employees.reduce((t, e) => t + Number(e.salaire ?? 0), 0),
            nomFichier: `Liste_${entreprise.replace(/\s+/g, '_')}`,
          })
        }
        exporterExcel={() => exporterListePersonnelExcel({ employees, entreprise, intitule, nomSite })}
        onClose={onClose}
      />

      {/* A4 paysage : le tableau a besoin de largeur */}
      <div
        style={{ '--zoom-apercu': 0.34 } as React.CSSProperties}
        className="document-imprimable mx-auto my-6 max-w-[297mm] bg-white p-[12mm] text-[9pt] leading-snug text-black shadow-xl print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {/* Le filtre — le plus souvent l'annexe — tient sur la ligne du
            titre : sur sa propre ligne, il coûtait une rangée du tableau. */}
        <header className="mb-2.5 border-b-2 border-black pb-1.5 text-center">
          <h1 className="text-base font-bold uppercase tracking-wide">
            {entreprises ? 'TOUTES LES ENTREPRISES' : entreprise}
          </h1>
          <p className="text-[13pt] font-bold uppercase">
            Liste du personnel
            {intitule && <span className="font-semibold"> — {intitule}</span>}
          </p>
          <p className="text-[8pt] text-slate-600">
            {employees.length} employé(s) · éditée le {new Date().toLocaleDateString('fr-FR')}
          </p>
        </header>

        {groupes.map(([siteId, liste]) => {
          const principal = nomPrincipal(siteId)
          const societe = nomEntreprise(siteId)
          // Le bloc d'un site peut couler sur deux pages : l'en
          // empêcher laissait des pages à moitié vides dès qu'un site
          // ne tenait plus dans ce qui restait.
          return (
            <section key={siteId} className="mb-3">
              <h2 className="titre-suivi mb-0.5 flex items-baseline justify-between gap-3 border-b border-black pb-0.5">
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

              <table className="tableau-long w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    {['N°', 'Nom & Prénom', 'Qualification', 'C.I.N.', 'N° CNSS',
                      'Naissance', 'Embauche', 'Téléphone', 'Ville', 'Règlement', 'Salaire'].map((c) => (
                      <th
                        key={c}
                        className={`border border-slate-400 px-1.5 py-0.5 text-[7.5pt] font-bold uppercase tracking-wide ${
                          c === 'Salaire' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liste.map((e) => (
                    <tr key={e.id} className={e.actif ? '' : 'text-slate-500'}>
                      <td className="border border-slate-400 px-1.5 py-0.5 text-right tabular-nums">
                        {e.matricule ?? '—'}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-0.5 font-semibold">
                        {e.nom_prenom}
                        {!e.actif && <span className="font-normal"> (sorti)</span>}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-0.5">{e.qualification ?? '—'}</td>
                      <td className="border border-slate-400 px-1.5 py-0.5">{e.cin ?? '—'}</td>
                      <td className="border border-slate-400 px-1.5 py-0.5">{e.cnss ?? '—'}</td>
                      <td className="border border-slate-400 px-1.5 py-0.5 whitespace-nowrap">
                        {formatDateFr(e.date_naissance)}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-0.5 whitespace-nowrap">
                        {formatDateFr(e.date_embauche)}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-0.5 whitespace-nowrap">
                        {e.telephone ?? '—'}
                      </td>
                      <td className="border border-slate-400 px-1.5 py-0.5">{e.ville ?? '—'}</td>
                      <td className="border border-slate-400 px-1.5 py-0.5">{e.mode_reglement ?? '—'}</td>
                      <td className="border border-slate-400 px-1.5 py-0.5 text-right tabular-nums whitespace-nowrap">
                        {e.salaire != null ? formatDH(e.salaire) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={10} className="border border-slate-400 px-1.5 py-0.5 text-right">
                      Total {nomSite(siteId)}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-0.5 text-right tabular-nums whitespace-nowrap">
                      {formatDH(liste.reduce((t, e) => t + Number(e.salaire ?? 0), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          )
        })}

        <p className="mt-3 border-t border-black pt-1.5 text-right text-[9pt] font-bold">
          TOTAL GÉNÉRAL : {employees.length} employé(s) —{' '}
          {formatDH(employees.reduce((t, e) => t + Number(e.salaire ?? 0), 0))}
        </p>
      </div>

      {/* Cette liste s'imprime en paysage, contrairement aux autres documents */}
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } }`}</style>
    </div>
    </PortailImpression>
  )
}
