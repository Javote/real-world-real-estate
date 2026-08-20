# SPEC-008 — Cimientos verificables

> **Rebanada 0.** No es una rebanada vertical y es a propósito: no agrega superficie, **habilita
> que la puerta verifique**. Sin esto, cada rebanada siguiente se construye sobre una verificación
> que no existe. Es la única spec del plan que puede no dejar nada nuevo en pantalla.

## Propósito

Cerrar los tres huecos medidos el 2026-08-20 (`specs/README.md` §Auditoría): `packages/api` no
tiene tests y `pnpm -r test` lo saltea **en silencio**, `packages/shared` está vacío —lo que
desactiva la regla 6, la única defensa real contra el drift API↔web— y el skew TypeScript 5.8/6.0
bloquea poblarlo.

## Alcance / NO-alcance

- **Cubre:** unificar la versión de TypeScript · convertir `packages/shared` en un package real del
  workspace con el primer contrato Zod (auth) · infraestructura de tests en `packages/api` con la
  suite de auth · eliminar el placeholder `packages/db`.
- **NO cubre:** el rename `Milestone → ConstructionStage` (D-023) — es `SPEC-009`, y meterlo acá
  mezcla dos cambios de alto radio en un commit. Tampoco cubre superficie de UI, contratos, ni
  migrar el resto de los endpoints a schemas compartidos: entra el de auth como patrón, los demás
  migran cuando su rebanada los toque.

## Interfaz

`packages/shared` pasa a ser `@plataforma/shared`, package del workspace, consumido por
`packages/api` y `apps/web`:

| Export | Qué es |
|---|---|
| `loginRequestSchema` | Zod del body de `POST /auth/login` |
| `loginResponseSchema` | Zod de la respuesta — **sin `passwordHash`, nunca** |
| `meResponseSchema` | Zod de `GET /auth/me` |
| `LoginRequest`, `LoginResponse`, `MeResponse` | los tipos inferidos, importados por ambos lados |

La API valida con `safeParse` y responde 400 con `error.flatten()`. El front importa **el mismo
tipo**, no una copia: `apps/web/src/api/types.ts` deja de declarar los suyos para auth.

## Invariantes

1. `pnpm test` **falla** si falla el test de cualquier package del workspace. Ningún package se
   saltea en silencio.
2. El contrato de auth existe **una sola vez**, en `packages/shared`. Si la API cambia la forma de
   la respuesta y no actualiza el schema, **el typecheck del front falla**.
3. Todos los packages compilan con **la misma versión** de TypeScript.
4. `scripts/gate.sh` deja de bloquear por "packages/api fue modificado y NO tiene script `test`".
5. Ninguna respuesta de la API contiene `passwordHash`, en ningún camino, ni de error.
6. `packages/db/` no existe: el esquema vive en `packages/api/prisma` (D-016) y un placeholder
   reservado-que-nunca-se-usó es una afirmación falsa sobre el repo.

## Casos borde (definen los tests)

`packages/api`, con vitest + supertest:

| Caso | Esperado |
|---|---|
| login con credenciales válidas | 200 · token · usuario **sin** `passwordHash` |
| login con password incorrecta | 401 · sin filtrar si el email existe |
| login con email inexistente | 401 · **misma** respuesta que el caso anterior |
| login con body vacío o email malformado | 400 con `error.flatten()` |
| login de un usuario con `isActive = false` | 401 (revalidación por request, D-016) |
| `GET /auth/me` sin token | 401 |
| `GET /auth/me` con token válido | 200 · usuario sin `passwordHash` |
| `GET /auth/me` con token de un usuario desactivado después de emitido | 401 — el token no alcanza |

`packages/shared`, con vitest:

| Caso | Esperado |
|---|---|
| `loginRequestSchema` con email no-email | falla |
| `loginResponseSchema` con `passwordHash` presente | **falla** — el schema es la defensa, no el código |

## Preguntas abiertas

- **¿A qué versión de TypeScript se unifica?** *Default: 6.0*, la que ya usa la web, por ser la más
  nueva y porque `packages/shared` tipa a ambos. **Refutación:** si `packages/api` rompe de un modo
  no trivial contra `@types/express` 4 (que está pineado y **no se sube**, ver prohibiciones), se
  unifica a 5.8 para los dos y se registra por qué. Spike ≤ medio día.
- **¿Runner de tests de la API?** *Default: vitest + supertest*, que es lo que el propio CI dejó
  anotado como default y evita meter un segundo runner en el workspace.
- **¿El adaptador `mock` de `ApiPort` entra acá?** *Default: no.* Entra cuando una rebanada lo
  necesite para trabajar sin API. Meterlo ahora es superficie especulativa (principio 5).

## Definición de terminado

- [ ] `scripts/gate.sh` abre tocando `packages/api` y `packages/shared`
- [ ] `pnpm test` corre y reporta tests de web, api y shared
- [ ] cambiar a mano la forma de `loginResponse` en la API **rompe el typecheck del front**
      (verificalo de verdad, es el invariante 2)
- [ ] `packages/db/` eliminado y las referencias en `README.md` y `CLAUDE.md` actualizadas
