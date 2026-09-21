import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

// Las passwords con las que entra la suite: **las mismas que usó el seed**, no
// un literal.
//
// El seed (`apps/api/src/db/credentials.ts` → `passwordDeDemo`) toma
// `SEED_DEMO_PASSWORD` / `SEED_ADMIN_PASSWORD` del entorno —que carga de
// `apps/api/.env`— y solo si no están cae en `buyer123` y compañía. Con los
// literales escritos acá, una base local sembrada con el `.env` de siempre (el
// mismo que se usa para entrar a pre-prod) rechazaba todos los logins de la
// suite, mientras en CI —sin `.env`— pasaba. Se leen de los mismos dos
// lugares, en el mismo orden: el entorno del proceso y después `apps/api/.env`.
//
// Del `.env` se leen SOLO estas dos variables: no se vuelca el archivo entero
// en `process.env` del runner.

const ENV_API = fileURLToPath(new URL('../../api/.env', import.meta.url))

function delEntorno(variable: 'SEED_DEMO_PASSWORD' | 'SEED_ADMIN_PASSWORD'): string | undefined {
  const delProceso = process.env[variable]?.trim()
  if (delProceso) return delProceso
  if (!existsSync(ENV_API)) return undefined
  return parseEnv(readFileSync(ENV_API, 'utf8'))[variable]?.trim() || undefined
}

// Los defaults son los `defaultLocal` de `apps/api/src/db/seed.ts`.
const DEFAULTS = {
  admin: 'admin123',
  buyer: 'buyer123',
  developer: 'developer123',
  notary: 'notary123',
  verifier: 'verifier123'
} as const

export type RolSembrado = keyof typeof DEFAULTS

export function passwordDe(rol: RolSembrado): string {
  const variable = rol === 'admin' ? 'SEED_ADMIN_PASSWORD' : 'SEED_DEMO_PASSWORD'
  return delEntorno(variable) ?? DEFAULTS[rol]
}

/** La solapa del login → el rol del seed que prefilla. */
export const ROL_DE_SOLAPA: Record<string, RolSembrado> = {
  Investor: 'buyer',
  Developer: 'developer',
  Notary: 'notary',
  Certifier: 'verifier'
}
