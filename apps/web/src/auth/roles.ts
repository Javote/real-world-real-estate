// Grupos canónicos de AuthGuard (M2-D1 §Authentication and Role Gating).
// El valor del enum de dominio no coincide con la etiqueta de UI todavía
// (`buyer`→Investor, `verifier`→Certifier: deuda del mismo tipo que D-023,
// ver SPEC-011 §Preguntas abiertas) — estos grupos son la única traducción.
import type { UserRole } from '../api/types'

export const INVESTOR_ROLES: readonly UserRole[] = ['buyer']
export const DEV_ROLES: readonly UserRole[] = ['developer']
export const NOTARY_ROLES: readonly UserRole[] = ['notary']
export const CERTIFIER_ROLES: readonly UserRole[] = ['verifier']

export const ROLE_LANDING: Record<UserRole, string | null> = {
  buyer: '/investor/buy',
  developer: '/developer',
  notary: '/notary',
  verifier: '/certifier',
  // admin queda fuera de alcance de esta rebanada (SPEC-011 §Casos borde):
  // no tiene solapa ni landing propio todavía.
  admin: null
}
