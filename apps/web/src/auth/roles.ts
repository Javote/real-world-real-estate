import type { UserRole } from '../api/types'

export const INVESTOR_ROLES: readonly UserRole[] = ['buyer']
export const DEV_ROLES: readonly UserRole[] = ['developer']
export const NOTARY_ROLES: readonly UserRole[] = ['notary']
export const CERTIFIER_ROLES: readonly UserRole[] = ['verifier']
export const ADMIN_ROLES: readonly UserRole[] = ['admin']

export const ROLE_LANDING: Record<UserRole, string> = {
  buyer: '/investor/buy',
  developer: '/developer',
  notary: '/notary',
  verifier: '/certifier',
  // Sin solapa en /login: el admin entra tipeando el usuario.
  admin: '/admin'
}
