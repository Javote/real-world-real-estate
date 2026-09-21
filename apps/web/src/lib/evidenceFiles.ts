import {
  detectarTipoDeEvidencia,
  EVIDENCE_ALLOWED_MIME,
  EVIDENCE_MAX_FILE_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_SIGNATURE_BYTES
} from '@plataforma/shared/evidence-rules'

// SPEC-218 — la validación de los archivos de evidencia ANTES de mandarlos.
//
// **Es un control de experiencia de usuario, no una barrera.** Le ahorra al
// usuario subir 50 MB para que se los rechacen; el que decide es el backend, con
// las MISMAS reglas (`packages/shared/evidence-rules`, importadas por los dos
// lados) y la misma detección por magic bytes. Por eso todo lo que acá pueda
// fallar por una limitación del navegador **falla abierto**: si no se puede leer
// el archivo o no hay `crypto.subtle`, no se bloquea nada y se deja que el
// backend conteste con su `rejected`.

export type MotivoLocal = 'type' | 'size' | 'duplicate' | 'tooMany'
export interface RechazoLocal {
  file: File
  motivo: MotivoLocal
}

// El SHA-256 de un archivo se calcula una vez: el dropzone vuelve a mirar los ya
// elegidos cada vez que se suma uno. `null` = no se pudo (falla abierto).
const hashes = new WeakMap<File, string | null>()

/** SHA-256 hex del contenido, o `null` si el navegador no puede calcularlo. */
export async function sha256DeArchivo(file: File): Promise<string | null> {
  if (hashes.has(file)) return hashes.get(file) ?? null
  let hex: string | null = null
  try {
    // `crypto.subtle` solo existe en contextos seguros (https o localhost): en
    // una IP de red local por http no está, y ahí no se avisa de repetidos.
    if (globalThis.crypto?.subtle && typeof file.arrayBuffer === 'function') {
      // De a un archivo por vez: el peor caso es UN archivo de 50 MB en memoria.
      const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    hex = null
  }
  hashes.set(file, hex)
  return hex
}

/** El tipo real por los primeros bytes; `undefined` si el navegador no dejó leerlos. */
async function tipoReal(file: File): Promise<string | null | undefined> {
  try {
    if (typeof file.slice !== 'function') return undefined
    const parte = file.slice(0, EVIDENCE_SIGNATURE_BYTES)
    if (typeof parte.arrayBuffer !== 'function') return undefined
    return detectarTipoDeEvidencia(new Uint8Array(await parte.arrayBuffer()))
  } catch {
    return undefined
  }
}

export interface OpcionesDeClasificacion {
  maxBytes?: number
  maxFiles?: number
}

/**
 * Separa lo que entra a la lista de lo que se rechaza, y por qué. Orden de las
 * comprobaciones: tamaño, tipo declarado, tipo real (magic bytes), cupo del lote y
 * repetido (contra los ya elegidos y contra los que entran en esta misma tanda).
 */
export async function clasificarEntrantes(
  entrantes: readonly File[],
  actuales: readonly File[],
  {
    maxBytes = EVIDENCE_MAX_FILE_BYTES,
    maxFiles = EVIDENCE_MAX_FILES
  }: OpcionesDeClasificacion = {}
): Promise<{ aceptados: File[]; rechazados: RechazoLocal[] }> {
  const aceptados: File[] = []
  const rechazados: RechazoLocal[] = []

  const vistos = new Set<string>()
  for (const actual of actuales) {
    const h = await sha256DeArchivo(actual)
    if (h) vistos.add(h)
  }

  for (const file of entrantes) {
    if (file.size > maxBytes) {
      rechazados.push({ file, motivo: 'size' })
      continue
    }
    if (!(EVIDENCE_ALLOWED_MIME as readonly string[]).includes(file.type)) {
      rechazados.push({ file, motivo: 'type' })
      continue
    }
    const real = await tipoReal(file)
    // `undefined` = no se pudo leer: falla abierto. `null` o distinto del
    // declarado = un ejecutable renombrado, o un PNG etiquetado JPEG.
    if (real !== undefined && real !== file.type) {
      rechazados.push({ file, motivo: 'type' })
      continue
    }
    if (actuales.length + aceptados.length >= maxFiles) {
      rechazados.push({ file, motivo: 'tooMany' })
      continue
    }
    const h = await sha256DeArchivo(file)
    if (h && vistos.has(h)) {
      rechazados.push({ file, motivo: 'duplicate' })
      continue
    }
    if (h) vistos.add(h)
    aceptados.push(file)
  }

  return { aceptados, rechazados }
}
