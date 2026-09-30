import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from './i18n/useTranslation'
import { AnnounceProvider } from './lib/announce'
import { initObservability } from './lib/observability'
import { registrarServiceWorker } from './lib/pwa'
import { getRouter } from './router'
import './styles.css'

// Punto de entrada del SPA (D-065). Lo que antes hacía el `shellComponent` de
// TanStack Start —html, head, providers— vive acá y en `index.html`.
//
// Antes de armar el router: si algo en el arranque del router mismo tira,
// Sentry ya tiene que estar escuchando.
initObservability()

const router = getRouter()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
})

const contenedor = document.getElementById('root')
if (!contenedor) throw new Error('Falta #root en index.html')

// `navigator.serviceWorker` es `undefined` fuera de un contexto seguro (http
// que no sea localhost): ahí la app anda igual, sin PWA.
registrarServiceWorker(import.meta.env.PROD, navigator.serviceWorker)

createRoot(contenedor).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AnnounceProvider>
          <RouterProvider router={router} />
        </AnnounceProvider>
      </LocaleProvider>
    </QueryClientProvider>
  </StrictMode>
)
