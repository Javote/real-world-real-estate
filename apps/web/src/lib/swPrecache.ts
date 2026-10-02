// Completa `public/sw.js` con lo que solo el build sabe (SPEC-222): qué archivos de `/assets/`
// existen y una versión que cambia cuando cambian ellos. Lo llama el plugin de `vite.config.ts`
// sobre el `dist/sw.js` ya copiado.
//
// Sin la lista, la primera visita no deja nada offline: el worker se registra en el `load`, cuando
// el JS de entrada ya se bajó sin pasar por él, y las rutas se parten en chunks (`autoCodeSplitting`)
// que el worker nunca vio. Sin red, el `index.html` guardado carga sin su JS: pantalla en blanco.

const VERSION_FUENTE = "const VERSION = 'dev'"
const PRECACHE_FUENTE = 'const PRECACHE = []'

export function completarServiceWorker(fuente: string, archivos: readonly string[]): string {
  const assets = archivos
    .filter((archivo) => archivo.startsWith('assets/'))
    .map((archivo) => `/${archivo}`)
    .sort()
  return reemplazarUnaVez(
    reemplazarUnaVez(fuente, VERSION_FUENTE, `const VERSION = '${version(assets)}'`),
    PRECACHE_FUENTE,
    `const PRECACHE = ${JSON.stringify(assets)}`
  )
}

// Vite pone el hash del contenido en cada nombre, así que la lista ya identifica el build. FNV-1a
// alcanza: no es seguridad, es que un deploy con otros archivos cambie los bytes de `sw.js`.
function version(assets: readonly string[]): string {
  const texto = assets.join('\n')
  let hash = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    hash = Math.imul(hash ^ texto.charCodeAt(i), 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function reemplazarUnaVez(fuente: string, buscado: string, reemplazo: string): string {
  const partes = fuente.split(buscado)
  if (partes.length !== 2) {
    throw new Error(`sw.js tiene que tener "${buscado}" exactamente una vez`)
  }
  return partes.join(reemplazo)
}
