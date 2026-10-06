import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api/port'
import type { Project } from '#/api/types'
import { optimista } from '#/lib/optimista'

const CLAVE = ['investor', 'favorites'] as const

type Cambio = { proyecto: Project; agregar: boolean }

export function useFavoritos() {
  const queryClient = useQueryClient()

  const { data: favoritos, isPending } = useQuery({
    queryKey: CLAVE,
    queryFn: api.listFavorites
  })

  const cambio = useMutation({
    mutationFn: ({ proyecto, agregar }: Cambio) =>
      agregar ? api.addFavorite(proyecto.id) : api.removeFavorite(proyecto.id),
    ...optimista(queryClient, CLAVE, ({ proyecto, agregar }: Cambio) => {
      queryClient.setQueryData<Project[]>(CLAVE, (lista = []) => {
        const sin = lista.filter((p) => p.id !== proyecto.id)
        return agregar ? [proyecto, ...sin] : sin
      })
    })
  })

  const ids = new Set((favoritos ?? []).map((p) => p.id))

  return {
    favoritos,
    isPending,
    esFavorito: (id: string) => ids.has(id),
    alternar: (proyecto: Project) => cambio.mutate({ proyecto, agregar: !ids.has(proyecto.id) })
  }
}
