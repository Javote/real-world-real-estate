import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from './i18n/useTranslation'
import { getRouter } from './router'
import './styles.css'

// Punto de entrada del SPA (D-065). Lo que antes hacía el `shellComponent` de
// TanStack Start —html, head, providers— vive acá y en `index.html`.
const router = getRouter()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
})

const contenedor = document.getElementById('root')
if (!contenedor) throw new Error('Falta #root en index.html')

createRoot(contenedor).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <RouterProvider router={router} />
      </LocaleProvider>
    </QueryClientProvider>
  </StrictMode>
)
