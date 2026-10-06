import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { cargarDiccionario } from './i18n/dictionary'
import { getStoredLocale } from './i18n/locale'
import { LocaleProvider } from './i18n/useTranslation'
import { AnnounceProvider } from './lib/announce'
import { erroresDeReact, programarObservabilidad } from './lib/observability'
import { getRouter } from './router'
import './styles.css'

const router = getRouter()
programarObservabilidad(router)

const contenedor = document.getElementById('root')
if (!contenedor) throw new Error('Falta #root en index.html')

function montar(raiz: HTMLElement) {
  createRoot(raiz, erroresDeReact).render(
    <StrictMode>
      <LocaleProvider>
        <AnnounceProvider>
          <RouterProvider router={router} />
        </AnnounceProvider>
      </LocaleProvider>
    </StrictMode>
  )
}

cargarDiccionario(getStoredLocale())
  .catch(() => {})
  .then(() => montar(contenedor))
