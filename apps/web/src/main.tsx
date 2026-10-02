import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from './i18n/useTranslation'
import { AnnounceProvider } from './lib/announce'
import { initObservability } from './lib/observability'
import { registrarServiceWorker } from './lib/pwa'
import { getRouter } from './router'
import './styles.css'

initObservability()

const router = getRouter()

const contenedor = document.getElementById('root')
if (!contenedor) throw new Error('Falta #root en index.html')

// `navigator.serviceWorker` es `undefined` fuera de un contexto seguro (http
// que no sea localhost): ahí la app anda igual, sin PWA.
registrarServiceWorker(import.meta.env.PROD, navigator.serviceWorker)

createRoot(contenedor).render(
  <StrictMode>
    <LocaleProvider>
      <AnnounceProvider>
        <RouterProvider router={router} />
      </AnnounceProvider>
    </LocaleProvider>
  </StrictMode>
)
