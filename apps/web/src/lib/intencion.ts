import { type NavigateOptions, type RegisteredRouter, useRouter } from '@tanstack/react-router'
import { type FocusEvent, type PointerEvent, type TouchEvent, useEffect, useRef } from 'react'

// La misma demora que usa el router en un `<Link>` con `preload: 'intent'`: pasar el puntero de
// largo por una lista no precarga cada elemento.
export const DEMORA_DE_INTENCION_MS = 50

type Manejadores = {
  onPointerEnter?: (e: PointerEvent) => void
  onPointerLeave?: (e: PointerEvent) => void
  onFocus?: (e: FocusEvent) => void
  onTouchStart?: (e: TouchEvent) => void
}

// Dispara `alIntentar` cuando el usuario muestra que va a abrir algo: el puntero se queda encima,
// llega el foco o el dedo toca. Es lo que hace un `<Link>`, para lo que navega con un botón.
export function useIntencion(alIntentar?: () => void): Manejadores {
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(espera.current), [])

  if (!alIntentar) return {}
  const cancelar = () => clearTimeout(espera.current)
  return {
    onPointerEnter: () => {
      cancelar()
      espera.current = setTimeout(alIntentar, DEMORA_DE_INTENCION_MS)
    },
    onPointerLeave: cancelar,
    onFocus: alIntentar,
    onTouchStart: alIntentar
  }
}

// `onOpen` navega y `onIntent` precarga la misma ruta: corre su loader antes del click.
export function useAbrirConPrecarga() {
  const router = useRouter()
  return <TTo extends string>(destino: NavigateOptions<RegisteredRouter, string, TTo>) => ({
    onOpen: () => void router.navigate(destino),
    // El mismo destino que ya tipó `navigate`: `preloadRoute` lo declara sobre los genéricos internos
    // del router, que el tipo registrado no expone igual.
    onIntent: () => void router.preloadRoute(destino as Parameters<typeof router.preloadRoute>[0])
  })
}
