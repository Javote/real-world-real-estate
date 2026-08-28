import { useEffect, useRef } from 'react'

/**
 * Object URLs con dueño: viven mientras viva la pantalla que los creó.
 *
 * `URL.createObjectURL` retiene el blob hasta que alguien lo revoca. Una
 * galería de obra son varios MB por pantalla y el navegador no los libera al
 * desmontar el componente: hay que decírselo.
 *
 * Se usa junto con `gcTime: 0` en la query que lo llama — si React Query
 * conservara la URL después del desmontaje, al volver entregaría una ya
 * revocada y la imagen quedaría rota.
 */
export function useObjectUrls() {
  const creadas = useRef<string[]>([])

  useEffect(
    () => () => {
      for (const url of creadas.current) URL.revokeObjectURL(url)
      creadas.current = []
    },
    []
  )

  return (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    creadas.current.push(url)
    return url
  }
}
