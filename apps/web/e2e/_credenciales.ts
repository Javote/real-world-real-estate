import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const ENV_API = fileURLToPath(new URL('../../api/.env', import.meta.url))

function delEntorno(variable: 'SEED_DEMO_PASSWORD' | 'SEED_ADMIN_PASSWORD'): string | undefined {
  const delProceso = process.env[variable]?.trim()
  if (delProceso) return delProceso
  if (!existsSync(ENV_API)) return undefined
  return parseEnv(readFileSync(ENV_API, 'utf8'))[variable]?.trim() || undefined
}

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

export const SOLAPA_ES: Record<string, string> = {
  Investor: 'Inversor',
  Developer: 'Desarrollador',
  Notary: 'Escribano',
  Certifier: 'Certificador'
}

export const ROL_DE_SOLAPA: Record<string, RolSembrado> = {
  Investor: 'buyer',
  Developer: 'developer',
  Notary: 'notary',
  Certifier: 'verifier'
}
