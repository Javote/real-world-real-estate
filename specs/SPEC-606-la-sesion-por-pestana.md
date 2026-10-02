# SPEC-606 — La sesión: por pestaña, legible por JS, y un logout que el servidor no se entera

> Serie `6xx`, refactor post-M3 ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).
> **Condicional, y es decisión del dueño**: hoy nada está roto. Nivel 🟡: auth. Esta spec escribe
> las opciones con su costo real para que la decisión se tome sobre números, no sobre
> "las cookies son más seguras".

## Lo que hay hoy, medido el 2026-09-30

| Qué | Cómo |
|---|---|
| Token | JWT HS256, `expiresIn: "7d"`, sin refresh (`apps/api/src/lib/jwt.ts`) |
| Dónde vive | `sessionStorage['proptrust.session']`, con token y usuario (`apps/web/src/auth/session.ts`) |
| Cómo viaja | `Authorization: Bearer`. CORS con lista blanca y `credentials` en false (`app.ts`) |
| Revocación | **Solo por usuario**: `authenticate` relee `User` en cada request y corta si `isActive` es false |
| Logout | **Solo del cliente**: `ProfileScreen` llama a `clearSession()`. No hay `POST /auth/logout` |
| Orígenes | `propnexus-web.onrender.com` y `propnexus-api.onrender.com`. `onrender.com` está en la Public Suffix List, así que **son sitios distintos**, no solo orígenes distintos |

Consecuencias:

1. **Una pestaña abierta desde cero** (URL tipeada, marcador, link desde un mail) arranca sin
   sesión: `sessionStorage` es por pestaña.
2. **El token es legible por cualquier script de la página.** Un XSS lo lee. Es el mismo riesgo que
   tendría `localStorage`. Lo mitiga que la app no renderiza HTML de usuarios (React escapa) y que
   el único código de terceros en la página son dependencias del bundle (Sentry, PostHog, Leaflet),
   sin `<script>` de otros orígenes en `index.html`.
3. **"Cerrar sesión" no invalida el token.** Si alguien lo copió antes, le sirve hasta 7 días.

## Opciones

| | Qué | Arregla | Costo | Riesgo |
|---|---|---|---|---|
| **A** | Dejarlo así | — | 0 | El de hoy |
| **B** | `localStorage` + evento `storage` para cerrar la sesión en todas las pestañas | 1 | Chico: `session.ts` y un listener | Igual que hoy frente a XSS. Una sesión dura más en un equipo compartido: se compensa con un `expiresIn` menor |
| **C** | Token de vida corta (~15 min) + `POST /auth/logout` que agrega el `jti` a una denylist hasta que expire | 3 | Mediano: una tabla, un chequeo en `authenticate` (ya hace una query, así que puede ir en la misma), refresh silencioso en el front | Bajo. No cambia el transporte |
| **D** | Cookie `httpOnly` `Secure` para el refresh token, y access token en memoria | 2 y 3 | **Alto.** Con web y API en sitios distintos, la cookie es de terceros: necesita `SameSite=None`, `credentials: 'include'` en CORS y protección CSRF. **Safari bloquea cookies de terceros por defecto**, y en ese navegador la sesión no sobreviviría. Solo es viable con un **dominio propio** que ponga web y API en el mismo sitio (`app.` / `api.` de un dominio) | Medio: cambio de transporte + dominio |

**Recomendación:** A hasta que un piloto real (M4) reporte el problema 1, y ahí **B**. **C** si el
dueño quiere que "cerrar sesión" signifique algo del lado del servidor, antes de mainnet. **D** solo
junto con un dominio propio, que es una decisión de otro orden (y la tocan también `SPEC-603` y la
URL que cita la evidencia de M3).

## Invariantes (para cualquier opción que se elija)

1. **`authenticate` sigue releyendo `User`**: desactivar a un usuario corta su acceso en la
   request siguiente.
2. **Ningún token, `jti` ni hash de password en logs** (regla 2, regla 4).
3. **`/login` sigue en tiempo constante** (`auth-timing.test.ts`).
4. El guard del front ([`SPEC-601`](SPEC-601-el-guard-de-rol-vive-en-el-router.md), si ya está)
   lee la sesión de un solo lugar. El cambio de storage toca `session.ts` y nada más.

## Qué se toca en el mismo commit

La decisión nueva en `DECISIONS.md` (D-NNN), `apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`, y el
`SECURITY-REVIEW` si la opción cambia el modelo de amenaza.
