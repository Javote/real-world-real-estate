import {
  detectarTipoDeEvidencia,
  EVIDENCE_ALLOWED_MIME,
  EVIDENCE_MAX_FILE_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_SIGNATURE_BYTES
} from '@plataforma/shared/evidence-rules'

export type MotivoLocal = 'type' | 'size' | 'duplicate' | 'tooMany'
export interface RechazoLocal {
  file: File
  motivo: MotivoLocal
}

const hashes = new WeakMap<File, string | null>()

export async function sha256DeArchivo(file: File): Promise<string | null> {
  if (hashes.has(file)) return hashes.get(file) ?? null
  let hex: string | null = null
  try {
    if (globalThis.crypto?.subtle && typeof file.arrayBuffer === 'function') {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    hex = null
  }
  hashes.set(file, hex)
  return hex
}

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
  allowedMime?: readonly string[]
}

export async function clasificarEntrantes(
  entrantes: readonly File[],
  actuales: readonly File[],
  {
    maxBytes = EVIDENCE_MAX_FILE_BYTES,
    maxFiles = EVIDENCE_MAX_FILES,
    allowedMime = EVIDENCE_ALLOWED_MIME
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
    if (!allowedMime.includes(file.type)) {
      rechazados.push({ file, motivo: 'type' })
      continue
    }
    const real = await tipoReal(file)
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
