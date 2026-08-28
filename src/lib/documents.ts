/** Dépôt et consultation des pièces signées (engagements, contrats légalisés)
 *  et des photos de profil.
 *
 *  Les fichiers vivent dans deux buckets privés Supabase :
 *    « documents » → PDF ou scan de la feuille signée
 *    « photos »    → photo de profil de l'employé
 *  On n'y accède jamais par URL publique : toujours par URL signée, valable 1 h.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Document } from './types'

export const TAILLE_MAX_DOCUMENT = 10 * 1024 * 1024 // 10 Mo
export const TAILLE_MAX_PHOTO = 5 * 1024 * 1024 // 5 Mo

const TYPES_DOCUMENT_OK = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
]

/** Nom de fichier sans accent ni espace, préfixé par l'horodatage. */
function nomSur(nom: string): string {
  const propre = nom
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-60)
  return `${Date.now()}_${propre || 'fichier'}`
}

export function formatTaille(octets: number | null): string {
  if (octets == null) return ''
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

// --- Documents signés ---------------------------------------------------------

export function useDocuments(opts: {
  employeeId?: string
  congeId?: string
  contratId?: string
}) {
  const { employeeId, congeId, contratId } = opts
  return useQuery({
    queryKey: ['documents', employeeId, congeId, contratId],
    enabled: Boolean(employeeId || congeId || contratId),
    queryFn: async (): Promise<Document[]> => {
      let q = supabase.from('documents').select('*').order('created_at', { ascending: false })
      if (congeId) q = q.eq('conge_id', congeId)
      else if (contratId) q = q.eq('contrat_id', contratId)
      else if (employeeId) q = q.eq('employee_id', employeeId)
      const { data, error } = await q
      if (error) throw error
      return data as Document[]
    },
  })
}

export function useDeposerDocument(opts: {
  companyId: string
  employeeId: string
  type: Document['type']
  congeId?: string
  contratId?: string
}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fichier: File) => {
      if (fichier.size > TAILLE_MAX_DOCUMENT) {
        throw new Error(
          `Fichier trop lourd (${formatTaille(fichier.size)}). Maximum : 10 Mo.`,
        )
      }
      if (fichier.type && !TYPES_DOCUMENT_OK.includes(fichier.type)) {
        throw new Error('Formats acceptés : PDF, JPG, PNG.')
      }

      const chemin = `${opts.companyId}/${opts.employeeId}/${nomSur(fichier.name)}`
      const { error: up } = await supabase.storage
        .from('documents')
        .upload(chemin, fichier, { contentType: fichier.type || 'application/octet-stream' })
      if (up) throw new Error(`Envoi impossible : ${up.message}`)

      const { error } = await supabase.from('documents').insert({
        company_id: opts.companyId,
        employee_id: opts.employeeId,
        type: opts.type,
        conge_id: opts.congeId ?? null,
        contrat_id: opts.contratId ?? null,
        chemin,
        nom_fichier: fichier.name,
        mime: fichier.type || null,
        taille: fichier.size,
      })
      if (error) {
        // Ne pas laisser de fichier orphelin si l'enregistrement échoue
        await supabase.storage.from('documents').remove([chemin])
        throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useSupprimerDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (doc: Document) => {
      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error
      await supabase.storage.from('documents').remove([doc.chemin])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

/** Ouvre un document dans un nouvel onglet, via une URL signée temporaire. */
export async function ouvrirDocument(chemin: string): Promise<void> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(chemin, 3600)
  if (error) throw error
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

// --- Photo de profil -----------------------------------------------------------

/** URL signée de la photo de profil (1 h), ou null s'il n'y en a pas. */
export function usePhotoProfil(cheminPhoto: string | null | undefined) {
  return useQuery({
    queryKey: ['photo-profil', cheminPhoto],
    enabled: Boolean(cheminPhoto),
    staleTime: 55 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from('photos')
        .createSignedUrl(cheminPhoto!, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
}

export function useDeposerPhoto(companyId: string, employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fichier: File) => {
      if (fichier.size > TAILLE_MAX_PHOTO) {
        throw new Error(`Photo trop lourde (${formatTaille(fichier.size)}). Maximum : 5 Mo.`)
      }
      if (!fichier.type.startsWith('image/')) {
        throw new Error('Choisissez une image (JPG ou PNG).')
      }

      const chemin = `${companyId}/${employeeId}/${nomSur(fichier.name)}`
      const { error: up } = await supabase.storage
        .from('photos')
        .upload(chemin, fichier, { contentType: fichier.type })
      if (up) throw new Error(`Envoi impossible : ${up.message}`)

      // Remplacer l'ancienne photo, puis la supprimer du stockage
      const { data: avant } = await supabase
        .from('employees').select('photo_path').eq('id', employeeId).single()
      const { error } = await supabase
        .from('employees').update({ photo_path: chemin }).eq('id', employeeId)
      if (error) {
        await supabase.storage.from('photos').remove([chemin])
        throw error
      }
      const ancienne = (avant as { photo_path: string | null } | null)?.photo_path
      if (ancienne && ancienne !== chemin) {
        await supabase.storage.from('photos').remove([ancienne])
      }
      return chemin
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['photo-profil'] })
    },
  })
}

export function useSupprimerPhoto(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (chemin: string) => {
      const { error } = await supabase
        .from('employees').update({ photo_path: null }).eq('id', employeeId)
      if (error) throw error
      await supabase.storage.from('photos').remove([chemin])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['photo-profil'] })
    },
  })
}
