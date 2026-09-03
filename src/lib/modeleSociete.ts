import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

/**
 * La clé de modèle d'une société : quel jeu de documents lui répondre.
 *
 * Elle est écrite une fois en base et ne dépend pas du nom d'affichage.
 * Renommer « Groupe Triple A » en « GROUPE TRIPLE AAA » ne fait donc plus
 * disparaître son contrat — c'est arrivé, sans le moindre message.
 *
 * Quand la colonne n'est pas encore renseignée, on rend null et les
 * fonctions de recherche retombent sur le nom, comme avant.
 */
export function useModeleSociete(companyId: string | undefined) {
  return useQuery({
    queryKey: ['modele-societe', companyId],
    enabled: Boolean(companyId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('companies')
        .select('modele_document')
        .eq('id', companyId!)
        .single()
      if (error) return null
      return (data?.modele_document as string | null) ?? null
    },
  })
}

/** Toutes les clés d'un coup, pour la vue « toutes les entreprises ». */
export function useModelesSocietes(actif: boolean) {
  return useQuery({
    queryKey: ['modeles-societes'],
    enabled: actif,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, string | null>> => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, modele_document')
      if (error) return {}
      return Object.fromEntries(
        (data ?? []).map((c) => [c.id as string, (c.modele_document as string | null) ?? null]),
      )
    },
  })
}
