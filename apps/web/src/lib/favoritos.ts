import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api/port'
import type { Project } from '#/api/types'

const CLAVE = ['investor', 'favorites'] as const

type Cambio = { proyecto: Project; agregar: boolean }

// La lista se actualiza antes de que conteste la API; si falla, vuelve a la de antes.
export function useFavoritos() {
  const queryClient = useQueryClient()

  const { data: favoritos, isPending } = useQuery({
    queryKey: CLAVE,
    queryFn: api.listFavorites
  })

  const cambio = useMutation({
    mutationKey: CLAVE,
    mutationFn: ({ proyecto, agregar }: Cambio) =>
      agregar ? api.addFavorite(proyecto.id) : api.removeFavorite(proyecto.id),
    onMutate: async ({ proyecto, agregar }: Cambio) => {
      await queryClient.cancelQueries({ queryKey: CLAVE })
      const anterior = queryClient.getQueryData<Project[]>(CLAVE)
      queryClient.setQueryData<Project[]>(CLAVE, (lista = []) => {
        const sin = lista.filter((p) => p.id !== proyecto.id)
        return agregar ? [proyecto, ...sin] : sin
      })
      return { anterior }
    },
    onError: (_error, _cambio, contexto) => {
      queryClient.setQueryData(CLAVE, contexto?.anterior)
    },
    // Con otro cambio en vuelo, la lista del servidor todavía no lo refleja y lo pisaría.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: CLAVE }) === 1) {
        void queryClient.invalidateQueries({ queryKey: CLAVE })
      }
    }
  })

  const ids = new Set((favoritos ?? []).map((p) => p.id))

  return {
    favoritos,
    isPending,
    esFavorito: (id: string) => ids.has(id),
    alternar: (proyecto: Project) => cambio.mutate({ proyecto, agregar: !ids.has(proyecto.id) })
  }
}
