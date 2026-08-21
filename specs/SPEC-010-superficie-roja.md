# SPEC-010 — Endurecer la superficie 🔴

> **Rebanada 0c.** Como `SPEC-008`, no es vertical y no agrega pantalla: cierra los hallazgos de la
> auditoría del 2026-08-20 sobre el código 🔴, que hoy vive entero en `packages/api`. El inventario
> con el detalle de cada uno está en `packages/api/CLAUDE.md` §Superficie 🔴 y **no se repite acá**:
> esta spec aporta las invariantes y los casos borde, que es de donde salen los tests.

## Propósito

El código 🔴 —claves de firma, hashing, membresías— es el que no puede fallar en silencio, y es
justamente donde estaban los tres hallazgos: un default inseguro que se activaba por omisión, un
oráculo de tiempos que el comentario del código decía haber cerrado, y un parámetro opcional que al
omitirse **abre** en vez de cerrar. Ninguno era explotable el 2026-08-20 porque no hay deploy; los
tres se arman solos el día que haya URL pública. Se arreglan **antes** de que exista (criterio 11
del SOM: sin hallazgos P1 abiertos).

## Alcance / NO-alcance

- **Cubre:** `lib/jwt.ts` (P1 · la clave de firma) · `routes/auth.routes.ts` (el oráculo de tiempos
  del login) · `middlewares/auth.ts` (`canAccessProject` fail-open).
- **NO cubre:**
  - **Mover el SHA-256 a R2.** `utils/hashing.ts` es correcto hoy; se rehace cuando exista el object
    storage, porque el hash tiene que cubrir los bytes que terminan en R2 y no un temporal (D-040).
  - **`bcrypt` → `bcryptjs`.** Cerrado: se queda nativo (`packages/api/CLAUDE.md` §Superficie 🔴).
  - **Convertir `canAccessProject` en middleware obligatorio.** Sigue siendo una función que hay que
    acordarse de llamar; eso es un refactor de los 27 endpoints y va aparte. Acá solo se cierra el
    default que abre.

## Interfaz

| Símbolo | Antes | Después |
|---|---|---|
| `requireJwtSecret(env?)` | no existía; `JWT_SECRET \|\| "dev-secret"` en el módulo | exportada; devuelve el secreto recortado o **lanza** |
| `POST /api/v1/auth/login` | corta antes de `bcrypt.compare` si el usuario no existe | siempre compara: hash real o dummy |
| `canAccessProject(userId, role, projectId, allowedMemberships)` | 4º parámetro **opcional**; omitirlo acepta cualquier membresía | 4º parámetro **obligatorio** |

Ningún cambio toca el contrato API↔web: los tres son de comportamiento interno, no de forma de
request ni de respuesta. `packages/shared` no cambia.

## Invariantes

1. La API **no arranca** si `JWT_SECRET` falta, está vacío o es solo espacios. No hay valor por
   defecto, en ningún entorno (D-042).
2. Ninguna firma ajena abre una sesión: `/auth/me` valida la firma, no solo la forma del token.
3. `POST /auth/login` responde en el **mismo orden de magnitud** exista o no el email. El costo de
   `bcrypt` se paga siempre.
4. Los cuerpos de respuesta de "usuario inexistente" y "password incorrecta" siguen siendo
   idénticos (ya era invariante de `SPEC-008`; no se rompe al arreglar el tiempo).
5. `canAccessProject` no puede invocarse sin decir **qué** membresías acepta: omitirlo es un error
   de compilación, no un permiso más ancho.
6. Ningún mensaje de error revela el valor de un secreto ni si un email existe.

## Casos borde (definen los tests)

**`lib/jwt.ts`** — `test/jwt.test.ts`

| Caso | Esperado |
|---|---|
| `JWT_SECRET` no definida | lanza, mencionando la variable |
| `JWT_SECRET=""` — lo que trae `.env.example` | lanza |
| `JWT_SECRET` con solo espacios y saltos | lanza |
| `JWT_SECRET` con espacios o salto de línea al final | devuelve el valor **recortado** |
| importar `lib/jwt` sin la variable | el import **rechaza**: el proceso no llega a escuchar |
| token firmado con el viejo literal `dev-secret` en `/auth/me` | 401 |
| rol `admin` forjado y firmado con `dev-secret` | 401 |
| el **mismo** payload firmado con la clave real | 200 — el control: el 401 es por firma, no por payload |

**`routes/auth.routes.ts`** — `test/auth-timing.test.ts`

| Caso | Esperado |
|---|---|
| login con email inexistente vs. password incorrecta | tiempos del mismo orden; sin corte temprano |
| login con email inexistente | sigue devolviendo 401 con el mismo body |
| el hash dummy nunca valida | ninguna password abre sesión de un usuario que no existe |

**`middlewares/auth.ts`** — `test/project-access.test.ts`

| Caso | Esperado |
|---|---|
| miembro con la membresía pedida | `true` |
| miembro con **otra** membresía que la pedida | `false` |
| usuario sin membresía en el proyecto | `false` |
| `admin` sin membresía | `true` (bypass, matriz de M2-D1 §4) |
| llamar sin `allowedMemberships` | **no compila** |

## Preguntas abiertas

- **`canAccessProject` como middleware.** Hoy es una función que hay que acordarse de llamar y nada
  detecta al que se la olvide: ni el compilador, ni un test, ni la puerta. Con 27 endpoints se
  auditó a mano; con los ~80 del backlog no escala. Default: un `requireProjectAccess(...)` de
  Express que lea `req.params.projectId`. Dueño: humano (es 🔴). **Antes** de la tanda grande de
  endpoints, no después.

## Definición de terminado

- [x] P1 cerrado: `JWT_SECRET` sin fallback, con test de arranque
- [x] el login paga el costo de `bcrypt` exista o no el usuario — de ~81 ms de diferencia a 0.7 ms
- [ ] `allowedMemberships` obligatorio en los 27 call sites
- [ ] `packages/api/CLAUDE.md` §Superficie 🔴 sin ⚠️ abiertos
