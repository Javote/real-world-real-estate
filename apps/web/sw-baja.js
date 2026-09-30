// El rollback del service worker (SPEC-222). **No está en `public/` a
// propósito:** no se publica hasta que haga falta.
//
// Revertir el commit que trajo `public/sw.js` no borra el worker de los
// navegadores que ya lo instalaron: el navegador sigue usando el que tiene
// hasta que el mismo path sirva uno distinto. Este es ese distinto. Al activarse
// borra las cachés de PropNexus y se desregistra.
//
// **No recarga las pestañas, a propósito.** No tiene handler de `fetch`, así
// que desde que se activa todo pedido va directo a la red: no hace falta
// recargar nada. Y si recargara mientras la app todavía llama a
// `registrarServiceWorker`, cada carga lo volvería a instalar y a recargar: un
// bucle.
//
// Cómo se usa: `cp apps/web/sw-baja.js apps/web/public/sw.js`, commit y deploy.
// El paso a paso está en `specs/RUNBOOK-deploy.md` §El service worker.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves.filter((clave) => clave.startsWith('propnexus-')).map((c) => caches.delete(c))
        )
      )
      .then(() => self.registration.unregister())
  )
})
