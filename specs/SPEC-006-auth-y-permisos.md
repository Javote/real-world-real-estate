# SPEC-006 — Autenticación y permisos

> Adoptada del repo backend en la consolidación (2026-07-15), donde era su SPEC-003. Describe código **ya escrito y verificado** en `packages/api`. Referencias de decisión: D-016 (absorbe ex ADR-004 y ex ADR-006).

## Propósito

Controlar quién entra a la API (login con JWT) y qué puede hacer en cada proyecto (roles globales + membresías por proyecto).

## Alcance / NO-alcance

- **Cubre:** login, verificación de token, roles globales, membresías por proyecto, gestión de usuarios (solo admin).
- **NO cubre:** registro self-service (los usuarios los crea un admin), refresh tokens, recuperación de contraseña, rate limiting.

## Interfaz

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `POST /api/v1/auth/login` | público | `{email, password}` → `{token, user}` |
| `GET /api/v1/auth/me` | autenticado | Perfil del usuario del token |
| `GET/POST /api/v1/users`, `GET/PATCH/DELETE /api/v1/users/:id` | solo admin | CRUD de usuarios |
| `GET /api/v1/audit-logs` | solo admin | Últimos 200 logs |

- **Roles globales** (`UserRole`): `admin`, `developer`, `buyer`, `verifier`.
- **Roles de membresía** (`MembershipRole`): `developer`, `buyer`, `verifier` — un usuario puede tener varias membresías (unique por `[userId, projectId, membershipRole]`).
- **JWT:** HS256 con `JWT_SECRET`, payload `{userId, role, email}`, expiración 7 días, header `Authorization: Bearer <token>`.

### Capas de autorización

1. `authenticate`: valida el token **y revalida contra DB** (`isActive`) en cada request.
2. `requireRole(...roles)`: corta por rol global.
3. `canAccessProject(userId, role, projectId, allowedMemberships?)`: `admin` → siempre true; resto → requiere membresía en el proyecto (restringida a `allowedMemberships` si se pasa; las escrituras exigen `["developer"]`).

## Invariantes

1. `passwordHash` jamás sale en una respuesta (todos los queries usan `select` explícito).
2. Passwords con bcrypt cost 10; mínimo 6 caracteres al crear/cambiar.
3. Un usuario con `isActive: false` recibe 401 en cualquier endpoint autenticado, aunque su token siga vigente.
4. El login no distingue "email inexistente" de "password incorrecta" (ambos → 401 "Invalid credentials").
5. Login exitoso y toda mutación de usuarios escriben `AuditLog`.
6. Sin membresía y sin rol admin, un proyecto es invisible: listados filtran por membresía y accesos directos dan 403.

## Casos borde (definen los tests)

- Token válido de usuario luego desactivado → 401 "User not active".
- Token expirado o firmado con otro secreto → 401 "Invalid token".
- Header sin prefijo `Bearer ` → 401.
- Developer con membresía `buyer` (no `developer`) en un proyecto intenta crear milestone → 403.
- Buyer miembro lista evidencia → 200; sube evidencia → 403.
- Admin sin ninguna membresía accede a cualquier proyecto → 200.
- `GET /users` con rol developer → 403.

## Preguntas abiertas

- Sin rate limiting en `/login` (aceptable en PoC; obligatorio antes de exponer públicamente).
- El rol viaja en el JWT pero la fuente de verdad es la DB en cada request; si se cambia el rol de un usuario, el token viejo actúa con el rol nuevo (comportamiento deseado — documentado para no "arreglarlo" por error).
