// El service worker de PropNexus: D-065 ("PWA desde el arranque") y SPEC-222.
//
// Hace tres cosas y ninguna más:
//
//   1. Navegaciones: primero la red. Sin red, el último `index.html` que se
//      guardó. Ese es el shell offline: la app carga y cada pantalla muestra el
//      error de red que ya tiene. No hay datos "de la última vez".
//   2. `/assets/*`: primero la caché. Vite les pone el hash del contenido en el
//      nombre, así que un archivo guardado nunca queda viejo.
//   3. Todo lo demás pasa de largo, sin `respondWith`: la API (que en producción
//      vive en otro origen, y en dev va por `/api`), `/health`, cualquier otro
//      origen y cualquier método que no sea GET.
//
// **Ninguna respuesta de la API se guarda, nunca.** Una respuesta vieja podría
// mostrar como `Pending` un stage que ya está `Confirmed`, o al revés. Eso va
// contra la regla dura 17 y contra la reconciliación de lectura de D-077. Lo
// fija `src/lib/sw.test.ts`.
//
// **No hay `skipWaiting`.** Una versión nueva de este archivo espera a que se
// cierren todas las pestañas de la app antes de tomar el control, así que nunca
// cambia debajo de una sesión abierta (con un anclaje a medias, por ejemplo).
//
// **Si esto sale mal, revertir el commit no alcanza:** el worker ya quedó
// instalado en los navegadores. El rollback es publicar `sw-baja.js` en este
// mismo path. Ver `specs/RUNBOOK-deploy.md` §El service worker.

const VERSION = 'v1'
const CACHE = `propnexus-${VERSION}`
const SHELL = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter((clave) => clave.startsWith('propnexus-') && clave !== CACHE)
            .map((clave) => caches.delete(clave))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const pedido = event.request
  if (pedido.method !== 'GET') return

  const url = new URL(pedido.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') return

  if (pedido.mode === 'navigate') {
    event.respondWith(navegacion(pedido))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(pedido))
  }
})

// Toda navegación de la SPA devuelve el mismo `index.html` (el rewrite de
// `render.yaml`), así que la respuesta buena más reciente se guarda como el
// shell. Solo si es HTML: un 404 o una página de error no reemplazan al shell.
async function navegacion(pedido) {
  try {
    const respuesta = await fetch(pedido)
    const tipo = respuesta.headers.get('content-type') ?? ''
    if (respuesta.ok && tipo.includes('text/html')) {
      const cache = await caches.open(CACHE)
      await cache.put(SHELL, respuesta.clone())
    }
    return respuesta
  } catch {
    const guardado = await caches.match(SHELL)
    return guardado ?? Response.error()
  }
}

async function asset(pedido) {
  const guardado = await caches.match(pedido)
  if (guardado) return guardado
  const respuesta = await fetch(pedido)
  if (respuesta.ok) {
    const cache = await caches.open(CACHE)
    await cache.put(pedido, respuesta.clone())
  }
  return respuesta
}
