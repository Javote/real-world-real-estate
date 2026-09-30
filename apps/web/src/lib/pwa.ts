// El registro del service worker (D-065, SPEC-222). La política de caché vive
// en `public/sw.js`; acá solo se decide si registrarlo.
//
// Solo en producción: en `vite dev` (y por eso en los e2e, que corren sobre
// `pnpm dev`) un worker serviría assets viejos por encima del HMR.
//
// Un registro que falla no rompe nada: la app sigue exactamente como sin PWA.
// Se reporta a Sentry, que es donde se ve un error del cliente en producción.

import * as Sentry from '@sentry/react'

export function registrarServiceWorker(
  produccion: boolean,
  contenedor: ServiceWorkerContainer | undefined
): void {
  if (!produccion || !contenedor) return
  window.addEventListener('load', () => {
    contenedor.register('/sw.js').catch((error: unknown) => Sentry.captureException(error))
  })
}
