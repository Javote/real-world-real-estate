// Puertos del árbol de trabajo (D-031).
//
// Sin `apps/web/.env` esto da 3000/8787 — el árbol principal, comportamiento
// idéntico al de siempre. `scripts/worktree.sh create <track>` escribe ese
// archivo con puertos propios para que dos árboles puedan correr la app a la
// vez sin pisarse. No se importa desde src/: es configuración de build.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function fromDotEnv(key: string): string | undefined {
  try {
    const raw = readFileSync(fileURLToPath(new URL('./.env', import.meta.url)), 'utf8')
    const line = raw.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm'))?.[1]
    return line?.trim().replace(/^["']|["']$/g, '') || undefined
  } catch {
    return undefined
  }
}

const read = (key: string) => process.env[key] ?? fromDotEnv(key)

export const WEB_PORT = Number(read('WEB_PORT') ?? 3000)
export const API_ORIGIN = read('API_ORIGIN') ?? 'http://localhost:8787'
