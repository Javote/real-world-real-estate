# SPEC-011 — Login de 4 roles

> Rebanada 1 de `specs/README.md` §Orden de trabajo. Primera rebanada vertical real de M3 (después
> de los cimientos 0/0b/0c/0d). Backlog: `M2-D5` fila 01 (login) + filas 02, 33-34, 51, 55 (landing
> de cada rol). IDs `AUTH-LOGIN-001`, `AUTH-ME-001`, `INV-BUY-LIST-001`, `DEV-PANEL-KPIS-001`,
> `NOT-PANEL-001`, `CER-PANEL-001`. Refs `M3-BE-01`, `M3-FE-01`, `M3-FE-02`, `M3-FE-14`, `M3-FE-25`,
> `M3-FE-26`. Fuente: `M2-D1` §System Overview, §Authentication and Role Gating, §Navigation Map
> (las 4), `M2-D3` §Foundation (GradientHeader, BottomNav, LanguageToggle) y §Localization.

## Propósito

Hoy solo 2 de ~80 endpoints y 1 de 53 pantallas conforman, y esa única pantalla (`/login`) no
conforma tampoco. Esta rebanada reemplaza `/login` por la superficie de `M2-D1` (4 solapas de rol +
`LanguageToggle` + `GradientHeader`) y deja **un shell mínimo pero conforme** para cada uno de los
4 paneles de aterrizaje, de forma que entrar como cada rol sea demostrable de punta a punta, en
ambos idiomas, en mobile. Es también donde nace la infraestructura de i18n (D-025): hoy es 0%.

## Alcance / NO-alcance

**Cubre:**
- Reemplazo de `/login`: 4 solapas (Investor / Developer / Notary / Certifier), `GradientHeader`,
  `LanguageToggle` en el header, formulario único (credencial + password) por solapa.
- El diccionario i18n mínimo (D-025) y su mecanismo de persistencia (`localStorage.propnexus.lang`,
  default `es-AR` voseo) — solo con las claves que esta rebanada usa. `Intl.*` para lo que esta
  pantalla formatee (no hay montos ni fechas en login).
- Ruteo post-login al landing de cada rol, usando `AuthGuard` con los 4 grupos de `M2-D1`
  (`INVESTOR_ROLES` → `/investor/buy`, `DEV_ROLES` → `/developer`, `NOTARY_ROLES` → `/notary`,
  `CERTIFIER_ROLES` → `/certifier`).
- Shell de cada panel de aterrizaje: `GradientHeader` + `BottomNav` con las tabs y el orden exactos
  de `M2-D1` por rol, sin desincronía de nombres (nunca "Milestone" donde va "Stage").
- Delta de modelo: agregar el rol `notary` al enum de roles (hoy faltante — ver §Delta).
- Sembrar un usuario demo de rol `notary` en el seed, con las mismas reglas de D-047.
- Persistencia de sesión: recargar la página autenticado no vuelve a mostrar `/login`.

**NO cubre (explícito):**
- Contenido de datos de los 4 paneles: KPIs (`GET /developer/kpis`, `/notary/kpis`,
  `/certifier/kpis`) y el listado de `/investor/buy` (`GET /projects`) **no se implementan acá**.
  Sus test IDs (`INV-BUY-LIST-001`, `DEV-PANEL-KPIS-001`, `NOT-PANEL-001`, `CER-PANEL-001`) no
  cierran en esta rebanada — dependen de `M3-BE-02/11/17/18`, que son rebanadas posteriores. El
  panel muestra su estructura (grid de `StatCard`, `BottomNav`, `GradientHeader`) en estado vacío o
  con placeholders de layout, nunca con datos mock que parezcan reales (regla del catálogo de
  capturas: lo normativo es la estructura, no el valor).
- `Menu`, `Favorites`, `Profile`, `Notifications`, `Dossiers`, `Signed`, `Assigned`, `Issued` y
  cualquier pantalla más allá del landing de cada rol.
- Logout. No hay endpoint ni botón en esta rebanada; la sesión se limpia manualmente (dev tools) si
  hace falta para probar.
- Cambio de password / recuperación de cuenta.
- Renombrar los valores del enum de roles (`buyer`→`investor`, `verifier`→`certifier`) — ver
  §Preguntas abiertas. Solo se **agrega** `notary`.
- Cualquier endpoint nuevo de negocio. El único endpoint que esta rebanada toca es el login
  existente (sin cambios de contrato) más lo que agregar `notary` requiera en `requireRole`.

## Interfaz

| Pantalla | Componentes (M2-D3) | Endpoint(s) | Test ID | Build ref |
|---|---|---|---|---|
| `/login` | `GradientHeader`, `LanguageToggle`, `TextInput`, `PrimaryButton` | `POST /auth/login`<br>`GET /auth/me` | `AUTH-LOGIN-001`<br>`AUTH-ME-001` | `M3-BE-01`, `M3-FE-01` |
| `/investor/buy` (shell) | `GradientHeader`, `NotificationBell`, `BottomNav` | — (datos: rebanada posterior) | `INV-BUY-LIST-001` *(no cierra acá)* | `M3-FE-02` |
| `/developer` (shell) | `GradientHeader`, `StatCard` (grid vacío), `BottomNav` | — | `DEV-PANEL-KPIS-001` *(no cierra acá)* | `M3-FE-14` |
| `/notary` (shell) | `GradientHeader`, `StatCard` (grid vacío), `BottomNav` | — | `NOT-PANEL-001` *(no cierra acá)* | `M3-FE-25` |
| `/certifier` (shell) | `GradientHeader`, `StatCard` (grid vacío), `BottomNav` | — | `CER-PANEL-001` *(no cierra acá)* | `M3-FE-26` |

`POST /auth/login` y `GET /auth/me` **no cambian de contrato** (`packages/shared/src/auth.ts`, ya
conforme). Solo cambia quién los consume y cómo enruta la respuesta.

## Delta del modelo de datos

- **Agregar `"notary"` a `userRoleSchema`** (`packages/shared/src/auth.ts`) y a cualquier lista de
  roles cerrada que lo excluya (p. ej. `ANY_MEMBERSHIP` si aplica a `User.role` y no solo a
  `MembershipRole` — verificar cuál de las dos enums es la relevante para AuthGuard de login).
- **`User.role` en SQLite es `text` sin `CHECK`** (`drizzle/0000_kind_vulcan.sql`): agregar un valor
  al enum de Zod no requiere migración de esquema, solo el cambio de contrato + el seed. Si en el
  futuro se agrega un `CHECK` a esta columna, **esa** migración tiene que declarar los 5 valores
  vigentes (`admin`, `developer`, `buyer`, `verifier`, `notary`) o rompe el login de todos los roles
  de un saque.
- **Seed** (`packages/api/src/db/seed.ts`): agregar un usuario demo `notary` (p. ej.
  `notary@example.com`), sujeto a las mismas reglas D-047 (password vía
  `SEED_DEMO_PASSWORD` fuera de una base local con `DATABASE_URL=file:`).

## Invariantes

1. **La segunda capa de autorización sigue existiendo para cada ruta de rol**: cada landing usa
   `requireRole`-equivalente (o el `AuthGuard` del front) con el grupo correcto de `M2-D1`
   (`INVESTOR_ROLES`, `DEV_ROLES`, `NOTARY_ROLES`, `CERTIFIER_ROLES`) — nadie con rol `developer`
   puede aterrizar en `/certifier` cambiando la URL a mano.
2. **El ruteo post-login usa `user.role` de la respuesta de `POST /auth/login`, nunca la solapa que
   el usuario tocó antes de enviar el formulario.** La solapa es una conveniencia de UI (puede
   precargar un usuario demo), no una promesa de autorización.
3. **`passwordHash` nunca llega al cliente** en ninguna respuesta tocada por esta rebanada (ya
   verificado por `sessionUserSchema`/`meResponseSchema` con `strictObject` — esta rebanada no
   debe romper eso).
4. **Passwords se comparan con bcrypt cost 10** vía el endpoint existente; esta rebanada no toca
   `auth.routes.ts` salvo lo estrictamente necesario para el rol `notary`.
5. **Cero strings hardcodeados en `/login` y en los 4 shells de panel.** Todo texto visible —labels,
   nombres de tab, mensajes de error 401/429/500— sale de una clave del diccionario i18n. Si un
   texto no tiene clave, no se muestra hasta que la tenga.
6. **`propnexus.lang` es la única fuente de la locale activa**, persiste en `localStorage`, default
   `es-AR` si no hay valor, y togglear `LanguageToggle` re-renderiza sincrónicamente todos los
   strings visibles sin recargar la página.
7. **es-AR usa voseo** en todo el copy nuevo de esta rebanada ("Ingresá tu usuario", no "Ingresa" ni
   "Ingrese").
8. **`GradientHeader` está presente en las 5 pantallas de esta rebanada** (login + 4 shells) y nunca
   omite el logo.
9. **`BottomNav` de cada shell tiene exactamente las tabs y el orden de `M2-D1`** por rol (INV:
   Menu·Favorites·Buy·Units·User: se muestran las 5 aunque solo Buy tenga contenido; DEV:
   Panel·Projects·Capital·Units·Progress; NOT: Panel·Dossiers·Signed·Profile; CER:
   Panel·Assigned·Issued·Profile) — las tabs sin pantalla implementada todavía son visibles pero no
   navegables a una pantalla real (pueden ir a un placeholder, nunca a un 404 sin estilo).
10. **Todo el flujo funciona en una columna de ~380px** sin scroll horizontal: las 4 solapas de rol,
    el formulario y el `BottomNav` de cada shell.
11. **Recargar la página con una sesión válida no vuelve a mostrar `/login`**: redirige al landing
    del rol de la sesión.
12. **Un token inválido o expirado en `GET /auth/me` redirige a `/login`** conservando la locale
    activa (no resetea a `es-AR` por el solo hecho de deslogueo).

## Casos borde (definen los tests)

- Credenciales inválidas (email no existe, password incorrecta, o `isActive=false`): mismas 401,
  mismo mensaje al usuario (clave i18n única) — no hay forma de distinguir los tres casos desde la
  UI.
- Rate limit alcanzado (`429`): mensaje distinto vía clave i18n propia, no el genérico de "no se
  pudo conectar".
- Selección de una solapa de rol y envío de credenciales de **otro** rol: el login igual sucede
  (el backend no valida "rol esperado"), pero el ruteo va al panel del rol real devuelto por la API,
  no al de la solapa tocada (invariante 2).
- Rol `notary` login exitoso: aterriza en `/notary`, con `BottomNav` de notario, no el de developer.
- Viewport mobile (~380px, portrait): las 4 solapas caben sin overflow horizontal; en desktop se
  reemplaza `BottomNav` por sidebar en los 4 shells.
- Cambio de idioma en `/login` antes de autenticarse: los labels, el placeholder y los mensajes de
  error cambian sin perder lo tipeado en los inputs.
- Cambio de idioma ya logueado, dentro de un shell de panel: mismo comportamiento, sin perder la
  sesión.
- Refrescar el navegador ya logueado como cada uno de los 4 roles: aterriza directo en su panel, sin
  parpadeo de `/login`.
- Token corrupto/expirado en `localStorage`: `GET /auth/me` da 401 → redirige a `/login`, no a una
  pantalla en blanco ni a un error sin manejar.
- Tab de `BottomNav` sin pantalla implementada todavía (p. ej. "Favorites" en investor): tocarla no
  rompe la app ni navega a un 404 sin estilo.
- Usuario `admin` (rol fuera de los 4 de dominio): no tiene solapa ni landing en esta rebanada —
  fuera de alcance, documentarlo como tal si el seed lo sigue trayendo.

## Definición de terminado

- Las 4 credenciales demo del seed (una por rol, incluyendo el `notary` nuevo) loguean y aterrizan
  cada una en su panel correcto, navegable con `BottomNav` conforme, en mobile y desktop.
- El toggle ES/EN cambia el idioma de las 5 pantallas de esta rebanada sin recargar y persiste al
  navegar entre ellas.
- `pnpm e2e` puede ejercer `AUTH-LOGIN-001` y `AUTH-ME-001` de punta a punta y dejar capturas de los
  4 shells.
- Los KPI de cada panel **no** están implementados — es la definición explícita de "shell": layout y
  navegación conformes, no funcionalidad de negocio.

## Preguntas abiertas

| Pregunta | Default | Quién la cierra |
|---|---|---|
| `M2-D1` describe el login como "username + password", pero el endpoint conforme (`POST /auth/login`, ya auditado como uno de los 2/80 conformes) usa `email`. ¿Se agrega un campo `username` real o el label sigue siendo cosmético sobre un input `email`? | El campo sigue siendo `email` (no se toca el contrato ya conforme); la etiqueta visible usa una clave i18n cuyo texto es "Usuario"/"Username" — es una decisión de copy, no de dato. Si esto se prueba insuficiente (p. ej. un revisor externo objeta que pide un email disfrazado de username), se abre una `D-0XX`. | Implementador de esta rebanada; si se reabre, `DECISIONS.md` |
| El enum de roles usa `buyer`/`verifier` mientras M2/M3 y las rutas usan `investor`/`certifier` en todos lados. ¿Se renombra el enum en esta rebanada o queda como deuda, igual que el rename Stage/Milestone (`SPEC-009`, no escrita)? | **No se renombra acá.** Solo se agrega `notary` (bloqueante: sin él no hay 4to rol). El rename de `buyer`→`investor`/`verifier`→`certifier` queda como deuda de la misma familia que D-023, candidata a sumarse a `SPEC-009` o a una spec propia — no bloquea esta rebanada porque los labels de las 4 solapas salen del diccionario i18n, no del valor del enum. | Dueño de `SPEC-009` / próxima sesión que la toque |
| ¿Los shells de panel muestran algún placeholder de contenido (esqueleto de carga, `StatCard` con "—") o quedan directamente vacíos? | Placeholder de layout con valores en blanco/`—`, nunca un número inventado — para no repetir la trampa de "datos mock que parecen reales" de M2-D2. | Implementador de esta rebanada |
| `/verify` (verificación independiente sin cuenta) ya está en el mapa como hueco abierto entre M1-D1 y M2-D5 (`specs/README.md` §Decisiones abiertas). ¿Toca esta rebanada? | No. Es explícitamente rebanada 3 según el registro existente; esta rebanada no la adelanta ni la retrasa. | Ya resuelto en `specs/README.md` — solo lo recuerdo acá para que no se cuele por accidente |
