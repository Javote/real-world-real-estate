import { createContext, useCallback, useContext, useRef, useState } from 'react'

type Urgencia = 'polite' | 'assertive'

interface AnnounceContextValue {
  announce: (texto: string, urgencia?: Urgencia) => void
}

// No-op por defecto: un componente fuera de `AnnounceProvider` tiene que renderizar igual.
const AnnounceContext = createContext<AnnounceContextValue>({ announce: () => {} })

export function AnnounceProvider({ children }: { children: React.ReactNode }) {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
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

export function useAnnounce() {
  return useContext(AnnounceContext).announce
}
