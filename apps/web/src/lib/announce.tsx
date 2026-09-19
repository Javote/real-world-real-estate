import { createContext, useCallback, useContext, useRef, useState } from 'react'

// SPEC-104 (F-03) — dos live regions permanentes, montadas una sola vez en la
// raíz de la app (ver main.tsx), y el hook que escribe en ellas.
//
// **Por qué dos regiones y no un componente por caso de uso:** `assertive`
// interrumpe al usuario (se reserva para lo que invalida la acción en curso,
// como un error de submit) y `polite` espera su turno (todo lo demás —
// "anclaje enviado", "3 novedades confirmadas"). Mezclarlas en una sola
// región les quita la semántica que un lector de pantalla ya sabe leer.
//
// **Por qué las regiones nunca se desmontan:** inyectar el nodo junto con el
// texto es el modo de falla clásico — el lector no anuncia lo que ya estaba
// en el DOM cuando llegó. `AnnounceProvider` las monta vacías, siempre, en
// `main.tsx`, antes que cualquier ruta.

type Urgencia = 'polite' | 'assertive'

interface AnnounceContextValue {
  announce: (texto: string, urgencia?: Urgencia) => void
}

// Default no-op, a propósito: a diferencia de `LocaleContext` (sin traducción
// no hay nada que mostrar), anunciar es un canal lateral — un componente
// montado fuera de `AnnounceProvider` (la mayoría de los tests, que no
// ejercitan accesibilidad) tiene que poder renderizar igual, no reventar.
const AnnounceContext = createContext<AnnounceContextValue>({ announce: () => {} })

export function AnnounceProvider({ children }: { children: React.ReactNode }) {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  // Un lector de pantalla no re-anuncia un nodo cuyo texto no cambió. "Falló
  // otra vez" es información igual que la primera vez, así que el mismo
  // mensaje dos veces seguidas alterna un caracter invisible al final para
  // forzar el cambio de nodo sin alterar lo que se escucha.
  const toggle = useRef(false)

  const announce = useCallback((texto: string, urgencia: Urgencia = 'polite') => {
    toggle.current = !toggle.current
    const mensaje = toggle.current ? texto : `${texto}​`
    if (urgencia === 'assertive') setAssertive(mensaje)
    else setPolite(mensaje)
  }, [])

  return (
    <AnnounceContext.Provider value={{ announce }}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
    </AnnounceContext.Provider>
  )
}

/** Anuncia `texto` a lectores de pantalla. `assertive` solo para errores que bloquean la acción en curso. */
export function useAnnounce() {
  return useContext(AnnounceContext).announce
}
