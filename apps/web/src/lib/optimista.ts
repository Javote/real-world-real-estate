import type { QueryClient, QueryKey } from '@tanstack/react-query'

type Anteriores = { anteriores: [QueryKey, unknown][] }

// Opciones de `useMutation` para un cambio que la pantalla muestra antes de que conteste la API.
// `aplicar` escribe la caché bajo `clave`; si la API falla, vuelve a la de antes. Los pedidos de la
// misma clave salen de a uno y en orden (`scope`), y solo el último en vuelo refresca contra el
// servidor: con otro todavía pendiente, la respuesta no lo refleja y lo pisaría.
export function optimista<V>(
  queryClient: QueryClient,
  clave: QueryKey,
  aplicar: (variables: V) => void
) {
  return {
    mutationKey: clave,
    scope: { id: JSON.stringify(clave) },
    onMutate: async (variables: V): Promise<Anteriores> => {
      await queryClient.cancelQueries({ queryKey: clave })
      const anteriores = queryClient.getQueriesData({ queryKey: clave })
      aplicar(variables)
      return { anteriores }
    },
    onError: (_error: unknown, _variables: V, contexto: Anteriores | undefined) => {
      contexto?.anteriores.forEach(([k, datos]) => {
        queryClient.setQueryData(k, datos)
      })
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: clave }) === 1) {
        void queryClient.invalidateQueries({ queryKey: clave })
      }
    }
  }
}
