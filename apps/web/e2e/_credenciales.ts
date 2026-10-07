// Las del seed local (`apps/api/src/db/demo.ts`), que no lee `SEED_*`: esas son de producción.
const DEFAULTS = {
  admin: 'admin123',
  buyer: 'buyer123',
  developer: 'developer123',
  notary: 'notary123',
  verifier: 'verifier123'
} as const

export type RolSembrado = keyof typeof DEFAULTS

export function passwordDe(rol: RolSembrado): string {
  return DEFAULTS[rol]
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
