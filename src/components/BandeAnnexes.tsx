import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { estAdministrateur } from '../lib/roles'
import { useAuth } from '../contexts/AuthContext'
import type { Employee, Site } from '../lib/types'
import { ErrorNote } from './ui'

/**
 * LES ANNEXES, SOUS LA GRILLE.
 *
 * Elles ne figurent plus dans la liste générale des sites : on les tient
 * là où elles servent, avec le monde qu'elles portent sous les yeux.
 *
 * Ajouter une annexe et y affecter quelqu'un restent au bureau.
 * Renommer et supprimer passent à l'administrateur : les deux touchent
 * l'historique de tout le monde — un nom change sur des états de paie
 * déjà sortis, une suppression déplace les journées d'un site à l'autre.
 */
export default function BandeAnnexes({
  principalId,
  annexes,
  choisie,
  onChoisir,
  employes,
}: {
  /** Le site principal ouvert. Nul pour une annexe sans rattachement. */
  principalId: string | null
  annexes: Site[]
  /** L'annexe dont on ne montre que le monde ; nulle = toutes. */
  choisie: string | null
  onChoisir: (siteId: string | null) => void
  /** Le monde affiché : de quoi proposer qui affecter. */
  employes: Employee[]
}) {
  const { profile } = useAuth()
  const estAdmin = estAdministrateur(profile?.role)
  const qc = useQueryClient()

  const [ajout, setAjout] = useState(false)
  const [nouveau, setNouveau] = useState('')
  const [renomme, setRenomme] = useState<Site | null>(null)
  const [nomRenomme, setNomRenomme] = useState('')
  const [supprime, setSupprime] = useState<Site | null>(null)
  const [cible, setCible] = useState('')
  const [affecte, setAffecte] = useState<string | null>(null)
  const [versAnnexe, setVersAnnexe] = useState('')

  const rafraichir = () => {
    for (const cle of ['sites', 'sites-principaux', 'employes-des-annexes',
                       'pointages-des-annexes', 'employees', 'site-employes-tous']) {
      qc.invalidateQueries({ queryKey: [cle] })
    }
  }

  const creer = useMutation({
    mutationFn: async (nom: string) => {
      if (!principalId) throw new Error('Ce site n’a pas de site principal.')
      const { error } = await supabase.rpc('creer_annexe', {
        p_principal: principalId, p_nom: nom,
      })
      if (error) throw error
    },
    onSuccess: () => { rafraichir(); setAjout(false); setNouveau('') },
  })

  const renommer = useMutation({
    mutationFn: async (v: { id: string; nom: string }) => {
      const { error } = await supabase.rpc('maj_site', { p_site: v.id, p_nom: v.nom })
      if (error) throw error
    },
    onSuccess: () => { rafraichir(); setRenomme(null) },
  })

  const supprimer = useMutation({
    mutationFn: async (v: { id: string; cible: string | null }) => {
      const { error } = await supabase.rpc('supprimer_site', {
        p_site: v.id, p_site_cible: v.cible || null,
      })
      if (error) throw error
    },
    onSuccess: () => { rafraichir(); setSupprime(null); setCible(''); onChoisir(null) },
  })

  const affecter = useMutation({
    mutationFn: async (v: { employee: string; site: string }) => {
      const { error } = await supabase.rpc('affecter_employe_annexe', {
        p_employee: v.employee, p_site: v.site,
      })
      if (error) throw error
    },
    onSuccess: () => { rafraichir(); setAffecte(null); setVersAnnexe('') },
  })

  const erreur = creer.error ?? renommer.error ?? supprimer.error ?? affecter.error
  const compte = (siteId: string) => employes.filter((e) => e.site_id === siteId).length

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          Annexes
        </span>

        <button
          onClick={() => onChoisir(null)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
            choisie === null
              ? 'bg-slate-900 text-white'
              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Toutes ({employes.length})
        </button>

        {annexes.map((a) => (
          <span key={a.id} className="flex items-center">
            <button
              onClick={() => onChoisir(a.id)}
              className={`rounded-l-lg px-2.5 py-1 text-xs font-medium transition ${
                choisie === a.id
                  ? 'bg-slate-900 text-white'
                  : 'border border-r-0 border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {a.name} ({compte(a.id)})
            </button>
            {estAdmin ? (
              <span className="flex">
                <button
                  onClick={() => { setRenomme(a); setNomRenomme(a.name) }}
                  title="Renommer"
                  className="border border-r-0 border-slate-300 px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
                >
                  ✎
                </button>
                <button
                  onClick={() => { setSupprime(a); setCible('') }}
                  title="Supprimer"
                  className="rounded-r-lg border border-slate-300 px-1.5 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  ✕
                </button>
              </span>
            ) : (
              <span className="w-0" />
            )}
          </span>
        ))}

        {principalId && (
          <button
            onClick={() => setAjout(true)}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            + Annexe
          </button>
        )}

        {annexes.length > 1 && employes.length > 0 && (
          <button
            onClick={() => setAffecte('')}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Affecter quelqu’un
          </button>
        )}
      </div>

      {erreur && (
        <div className="mt-2">
          <ErrorNote>{(erreur as Error).message}</ErrorNote>
        </div>
      )}

      {/* ── Ajouter ── */}
      {ajout && (
        <Fenetre titre="Nouvelle annexe" onFermer={() => setAjout(false)}>
          <input
            autoFocus
            value={nouveau}
            onChange={(e) => setNouveau(e.target.value)}
            placeholder="ex. QUAI NORD"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <Boutons
            onAnnuler={() => setAjout(false)}
            onValider={() => creer.mutate(nouveau)}
            valide={Boolean(nouveau.trim())}
            enCours={creer.isPending}
            libelle="Créer"
          />
        </Fenetre>
      )}

      {/* ── Renommer ── */}
      {renomme && (
        <Fenetre titre={`Renommer « ${renomme.name} »`} onFermer={() => setRenomme(null)}>
          <input
            autoFocus
            value={nomRenomme}
            onChange={(e) => setNomRenomme(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-2 text-xs text-slate-500">
            Ce nom paraît sur les états de paie déjà sortis : les anciens porteront
            désormais le nouveau.
          </p>
          <Boutons
            onAnnuler={() => setRenomme(null)}
            onValider={() => renommer.mutate({ id: renomme.id, nom: nomRenomme })}
            valide={Boolean(nomRenomme.trim()) && nomRenomme !== renomme.name}
            enCours={renommer.isPending}
            libelle="Renommer"
          />
        </Fenetre>
      )}

      {/* ── Supprimer ── */}
      {supprime && (
        <Fenetre titre={`Supprimer « ${supprime.name} »`} onFermer={() => setSupprime(null)}>
          {compte(supprime.id) > 0 ? (
            <>
              <p className="mb-2 text-sm text-slate-600">
                {compte(supprime.id)} personne(s) y travaillent. Où les déplacer ?
                Leurs journées suivront.
              </p>
              <select
                value={cible}
                onChange={(e) => setCible(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Choisir une annexe —</option>
                {annexes.filter((a) => a.id !== supprime.id).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Cette annexe est vide. Elle sera supprimée.
            </p>
          )}
          <Boutons
            onAnnuler={() => setSupprime(null)}
            onValider={() => supprimer.mutate({ id: supprime.id, cible })}
            valide={compte(supprime.id) === 0 || Boolean(cible)}
            enCours={supprimer.isPending}
            libelle="Supprimer"
            danger
          />
        </Fenetre>
      )}

      {/* ── Affecter ── */}
      {affecte !== null && (
        <Fenetre titre="Affecter quelqu’un à une annexe" onFermer={() => setAffecte(null)}>
          <select
            value={affecte}
            onChange={(e) => setAffecte(e.target.value)}
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— Choisir la personne —</option>
            {employes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.matricule != null ? `${e.matricule} — ` : ''}{e.nom_prenom}
              </option>
            ))}
          </select>
          <select
            value={versAnnexe}
            onChange={(e) => setVersAnnexe(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— Vers quelle annexe —</option>
            {annexes.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Ses journées du mois ouvert suivent. Les mois déjà clos restent où ils
            ont été payés.
          </p>
          <Boutons
            onAnnuler={() => setAffecte(null)}
            onValider={() => affecter.mutate({ employee: affecte, site: versAnnexe })}
            valide={Boolean(affecte && versAnnexe)}
            enCours={affecter.isPending}
            libelle="Affecter"
          />
        </Fenetre>
      )}
    </div>
  )
}

function Fenetre({
  titre, onFermer, children,
}: { titre: string; onFermer: () => void; children: React.ReactNode }) {
  return (
    <div className="modale fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
         onClick={onFermer}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-base font-semibold text-slate-900">{titre}</h2>
        {children}
      </div>
    </div>
  )
}

function Boutons({
  onAnnuler, onValider, valide, enCours, libelle, danger,
}: {
  onAnnuler: () => void
  onValider: () => void
  valide: boolean
  enCours: boolean
  libelle: string
  danger?: boolean
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button
        onClick={onAnnuler}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Annuler
      </button>
      <button
        onClick={onValider}
        disabled={!valide || enCours}
        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
          danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
        }`}
      >
        {enCours ? '…' : libelle}
      </button>
    </div>
  )
}
