import { useEffect, useRef } from 'react'

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
