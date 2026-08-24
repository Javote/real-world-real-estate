# SPEC-011 — Login y los 4 paneles de rol

> **Transcripción de capturas.** Fuente normativa: `docs/milestone-2-diseno/M2-D2-Screenshots-catalog/`
> — `1-LOGIN.png`, `2-INVESTOR-HOME.png`, `33-DEVELOPER-HOME-A.png`, `51-NOTARY-PANEL.png`,
> `55-CERTIFIER-PANEL.png`. Tokens: `M2-D3` §Visual Language. Navegación y permisos: `M2-D1`.
> Endpoints: `M2-D5` §4-6.
>
> **Lo normativo de una captura es la estructura, no los valores** (M2-D1: *"the maquette uses mock
> blockchain interactions"*). Los números de abajo se transcriben para fijar el **formato**, no el dato.
>
> Reemplaza la versión anterior de SPEC-011, que se escribió desde la prosa sin abrir las capturas y
> produjo una superficie que no se parece al diseño.

---

## 0 · Tokens y primitivas comunes

Hex normativos de M2-D3. En shadcn/ui van como variables de tema; **ningún hex se escribe inline**.

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#6D4AFF` | botones, gradiente, nav activo, acentos |
| `primary-dark` | `#5538DD` | pressed, hover de links, tope del gradiente |
| `primary-light` | `#EEEAFF` | fondos teñidos, píldora de rol |
| `verified` | `#14B8A6` | badge de verificación, firmado, certificado |
| `verified-light` | `#D4F4EE` | fondo de píldora verificada |
| `pending` | `#F97316` | pendiente, observar, en disputa |
| `pending-light` | `#FFE8D6` | fondo de píldora pendiente |
| `info` | `#3B82F6` | pre-construcción, métricas de portfolio |
| `info-light` | `#DBEAFE` | fondo de píldora informativa |
| `people` | `#EC4899` | conteo de inversores |
| `danger` | `#EF4444` | log out, destructivo |
| `text-primary` | `#111827` | títulos, números de KPI |
| `text-secondary` | `#374151` | cuerpo |
| `text-muted` | `#6B7280` | labels, captions, metadata |
| `border` | `#E5E7EB` | bordes de input y card |
| `surface-alt` | `#F3F4F6` | filas dentro de una card |
| `background` | `#F4F1ED` | fondo de la app |
| `card` | `#FFFFFF` | superficie de card y modal |

Radios: `r-lg` 12 · `r-xl` 16 (stat tiles, sheets, **esquinas inferiores del header**). Touch target
mínimo 44×44. Foco: anillo violeta 2px + 2px offset, **nunca removido por el reset**.

### Logo (`<Logo />`)

Isotipo de 3 barras ascendentes blancas + wordmark **"Prop Nexus" en dos líneas**, bold. Aparece en
las 5 pantallas. Nunca se omite (M2-D3 §GradientHeader).

### `GradientHeader`

Gradiente `primary-dark → primary` en diagonal, **full-bleed**, esquinas inferiores `r-xl`. Dos
variantes en esta spec:

- **`page`** (los 4 paneles): banda superior. Slot izquierdo con identidad, slot derecho con
  utilidades (`NotificationBell`, `LanguageToggle`), luego título grande y línea de bienvenida.
- **`full`** (login): **la página entera es el gradiente**, sin banda. El contenido flota encima.

> ⚠️ La implementación anterior aplicó `page` al login porque M2-D3 dice *"use on every primary
> screen"*. `1-LOGIN.png` muestra que el login es `full`. **Gana la captura.**

### `StatCard`

Card blanca `r-xl`, padding ~16, sombra suave. De arriba a abajo:

1. **Badge de ícono**: cuadrado redondeado (~40×40, `r-lg`), **fill sólido** del color semántico,
   ícono Lucide **blanco** dentro.
2. **Número**: ~32px bold `text-primary`.
3. **Label**: ~15px `text-primary`.
4. **Helper** (opcional): ~13px `text-muted`.

Color del badge por semántica (M2-D3): verde/teal = financiero · violeta = entidad/inventario ·
naranja = tendencia/observación · azul = portfolio/actividad · rosa = personas · teal = verificación.

**Variante `highlighted`**: fondo `primary` completo, texto blanco, badge circular semitransparente.
Se usa solo para el tile "New project" del developer.

### `BottomNav` / sidebar

Mobile: barra fija al pie, blanca, borde superior. Desktop (≥768px): **sidebar izquierda con los
mismos items en el mismo orden** (M2-D1 §Responsive). Cada tab: ícono Lucide 24px stroke-only +
label debajo. Activo: ícono `primary` + label bold. Inactivo: `text-muted`.

> ⚠️ No uses la clase bare `hidden` de Tailwind para el switch responsive mientras exista CSS global
> con `.hidden` (ver `CLAUDE.md` §Trampas). Con shadcn/ui y el legado borrado, deja de aplicar.

### Fila de trabajo pendiente (`WorkItemRow`)

Usada por notary y certifier. Bloque `surface-alt` `r-lg` dentro de una card blanca:

- Título bold `text-primary` — `<Proyecto> - <Unidad>`
- Subtítulo `text-muted` — nombre de persona (NOT) o `Stage N: <nombre>` (CER)
- Opcional: barra de progreso `primary` + porcentaje bold a la derecha (solo NOT)
- Derecha: **píldora de acción**: borde `pending`, texto `pending`, fondo transparente,
  `rounded-full`, ~13px bold

---

## 1 · `/login` — `1-LOGIN.png`

**Layout `full`.** Toda la página es el gradiente; el contenido está centrado en una columna de
~380px.

```
┌─ página: gradiente primary-dark → primary, 100dvh ────────┐
│                                     [LanguageToggle] ▸ top-right
│                                                           │
│                    [Logo]  (centrado)                     │
│         "Exclusive portal for investors and developers."  │  ← blanco 70%, centrado
│                                                           │
│   ┌─ card blanca r-xl ─────────────────────────────────┐  │
│   │  [ Investor │ Developer │ Notary │ Certifier ]     │  │  ← segmented control
│   │                                                     │  │
│   │  Investor Portal                                    │  │  ← 28-32px bold, cambia por tab
│   │  Exclusive portal for investors and developers.     │  │  ← text-muted
│   │                                                     │  │
│   │  Username                                           │  │
│   │  [ Enter your username                            ] │  │
│   │                                                     │  │
│   │  Password                                           │  │
│   │  [ Enter your password                        👁 ] │  │
│   │                                                     │  │
│   │  [        Sign in as Investor                    ] │  │  ← full width, primary
│   └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

**Segmented control** (no es una grilla de botones): track `surface-alt` `rounded-full`, 4 segmentos
de igual ancho. Activo = píldora `primary` con texto blanco. Inactivo = texto `text-muted`, sin
fondo. Es `role="tablist"` con 4 `role="tab"`.

**Inputs**: fill muy claro, borde `border`, `r-lg`, label bold arriba, **placeholder visible** (no
valor precargado). El de password tiene adorno derecho de ojo que alterna `type`.

**Botón**: `PrimaryButton` full-width, `primary`, blanco, bold. El label **incluye el rol de la
solapa activa**: "Sign in as Investor" / "Ingresá como Inversor".

**Lo que la pantalla NO tiene** (y la versión anterior agregaba): banda de header, texto de "usuarios
del seed demo", credenciales precargadas, link "Verificar documento sin cuenta", `BottomNav`.

### Comportamiento

| | |
|---|---|
| Tab activa | Cambia título, subtítulo y label del botón. **No** cambia el endpoint ni precarga credenciales. |
| Submit | `POST /api/v1/auth/login` con `{email, password}`. |
| Ruteo | **Siempre por `user.role` de la respuesta**, nunca por la solapa tocada. `buyer→/investor/buy` · `developer→/developer` · `notary→/notary` · `verifier→/certifier`. |
| 401 | Mensaje de credenciales inválidas. No distingue inexistente / inactivo / password mala. |
| 429 | Mensaje propio de rate limit, distinto del de red. |
| Red caída | Mensaje accionable. **En dev el 401 llega como 502** por el proxy de nitro (ver Trampas). |
| Locale | `LanguageToggle` visible **antes** de autenticar. Cambiarlo no pierde lo tipeado. |

### Strings

| Clave | es-AR (voseo) | en-US |
|---|---|---|
| `login.tagline` | Portal exclusivo para inversores y desarrolladores. | Exclusive portal for investors and developers. |
| `login.tabs.investor` | Inversor | Investor |
| `login.tabs.developer` | Desarrollador | Developer |
| `login.tabs.notary` | Escribano | Notary |
| `login.tabs.certifier` | Certificador | Certifier |
| `login.portal.investor` | Portal del inversor | Investor Portal |
| `login.portal.developer` | Portal del desarrollador | Developer Portal |
| `login.portal.notary` | Portal del escribano | Notary Portal |
| `login.portal.certifier` | Portal del certificador | Certifier Portal |
| `login.usernameLabel` | Usuario | Username |
| `login.usernamePlaceholder` | Ingresá tu usuario | Enter your username |
| `login.passwordLabel` | Contraseña | Password |
| `login.passwordPlaceholder` | Ingresá tu contraseña | Enter your password |
| `login.passwordShow` / `Hide` | Mostrar / Ocultar contraseña | Show / Hide password |
| `login.submit.investor` | Ingresá como inversor | Sign in as Investor |
| `login.submit.developer` | Ingresá como desarrollador | Sign in as Developer |
| `login.submit.notary` | Ingresá como escribano | Sign in as Notary |
| `login.submit.certifier` | Ingresá como certificador | Sign in as Certifier |
| `login.submitting` | Ingresando… | Signing in… |
| `login.errors.invalidCredentials` | Credenciales inválidas | Invalid credentials |
| `login.errors.rateLimited` | Demasiados intentos. Esperá unos minutos y volvé a probar. | Too many attempts. Wait a few minutes and try again. |
| `login.errors.network` | No se pudo conectar con el servidor. | Couldn't reach the server. |
| `languageToggle.label` | Idioma | Language |

> **`escribano`, no `notario`.** M2-D1 §6 documenta el audit log con role pill **"escribano"**. Es el
> término argentino correcto y ya está en un entregable.

---

## 2 · `/investor/buy` — `2-INVESTOR-HOME.png`

**Header `page`**: `[Logo]` a la izquierda · `NotificationBell` a la derecha (círculo blanco
semitransparente, badge `verified` con el conteo, "9+" si >9). **Sin título grande ni bienvenida.**
Debajo, fila de 3 píldoras blancas con ícono Lucide + label: **Map** (`map-pin`) · **Search**
(`search`) · **Filters** (`sliders-horizontal`).

**Cuerpo**: fondo `background`, lista de una columna de `ProjectCard`.

**`ProjectCard`**:
- Imagen de portada 16:9, `r-xl` arriba. Sobre ella, abajo a la derecha: **chip de developer** —
  píldora `primary`, ícono `building-2` + nombre.
- Cuerpo blanco:
  - "From" (`text-muted`, ~13px) · **precio** ~28px bold + "per apartment" (`text-muted`, inline)
  - Ícono `heart` outline arriba a la derecha (favorito; relleno `primary` si está marcado)
  - `map-pin` + ubicación (`text-primary`)
  - Rango de superficie (`text-muted`) — "90 m² to 200 m²"
  - Fila inferior: `StatusPill` de estado (ej. Pre-construction, azul) … porcentaje bold a la derecha
  - Barra de progreso: relleno `primary` sobre track claro

**`BottomNav` INV** (5 tabs, `Buy` al centro): Menu (`menu`) · Favorites (`heart`) · **Buy — FAB
circular verde `#10B981`/`verified`, elevado, ícono `dollar-sign` blanco** · Units (`key-round`) ·
User (`user`).

> El tab central es el único FAB del sistema (M2-D3 §BottomNav: *"green circle with $"*). No es un
> tab más pintado de verde: sobresale del borde superior de la barra.

**Formato**: precio con `Intl.NumberFormat(locale, {style:'currency', currency:'USD'})` y sufijo
`US$` según M2-D1 §Localization. Superficie con `Intl.NumberFormat` + `m²`.

**Datos**: `GET /api/v1/projects` (listado público de browse). Campos por card: portada, developer,
precio desde, ubicación, rango m², estado, % de avance.

---

## 3 · `/developer` — `33-DEVELOPER-HOME-A.png`

**Header `page`**, variante con identidad de organización:
- Badge cuadrado `r-lg` semitransparente con ícono `building-2`
- **"Grupo Alpine"** — ~24px bold blanco (nombre de la organización)
- **"Developer Panel"** — debajo, blanco 80%
- **"Welcome, Admin Alpine"** — más abajo, blanco 60%
- Slot derecho: `LanguageToggle`

**Cuerpo**: grilla de **2 columnas** (3-4 en desktop), gap ~16.

| # | Tipo | Badge | Valor | Label | Helper |
|---|---|---|---|---|---|
| 1 | `highlighted` | círculo `plus` | **New project** | Create a new development | — |
| 2 | StatCard | violeta `building-2` | 2 | Active Projects | 3 total |
| 3 | StatCard | teal `dollar-sign` | 4.0M | Capital Raised | US$ total invested |
| 4 | StatCard | azul `home` | 400 | Total Units | 12 sold |
| 5 | StatCard | naranja `trending-up` | 40% | Average Progress | of construction completed |
| 6 | StatCard | verde `file-check-2` | 6 | Verified Documents | on blockchain |

El tile 1 navega a "New project" (`34b-DEVELOPER-NEW-PROJECT-A.png`, fuera de esta spec).

**`BottomNav` DEV** (5): Panel (`bar-chart-3`) · Projects (`building-2`) · Capital (`dollar-sign`) ·
Units (`home`) · Progress (`trending-up`). Activo en esta pantalla: **Panel**.

**Datos**: `GET /api/v1/developer/kpis` → `{activeProjects, totalProjects, capitalRaisedMinor,
totalUnits, soldUnits, averageProgressPct, verifiedDocuments}`. Capital en **unidades enteras
mínimas** (regla 1) y se formatea en el cliente; "4.0M" es abreviación de presentación.

---

## 4 · `/notary` — `51-NOTARY-PANEL.png`

**Header `page`**: `[Logo]` · **"Notary Panel"** ~28px bold blanco · **"Welcome, Esc. Ana Torres"**
blanco 70%. Slot derecho: `LanguageToggle`.

**Grilla 2×2 de StatCards** (sin helper):

| Badge | Valor | Label |
|---|---|---|
| violeta `clock` | 2 | Pending dossiers |
| teal `shield-check` | 1 | Verified |
| azul `file-check-2` | 3 | Signed |
| naranja `building-2` | 1 | Units under review |

**Card "Dossiers pending review"**: título bold, luego N `WorkItemRow`:
- `Torres del Palermo - Unidad 5A` / `Maria Lopez` / barra `primary` + `88%` / píldora **Review**

**`BottomNav` NOT** (4): Panel (`bar-chart-3`) · Dossiers (`clipboard-check`) · Signed
(`shield-check`) · Profile (`user`). Activo: **Panel**.

**Datos**: `GET /api/v1/notary/kpis` + `GET /api/v1/notary/dossiers?status=pending`. El nombre de la
persona es PII: viaja en el body de un endpoint autenticado y **nunca** a logs ni on-chain (regla 2).

---

## 5 · `/certifier` — `55-CERTIFIER-PANEL.png`

Idéntico al de notary salvo contenido. Header: **"Certifier Panel"** / **"Welcome, Ing. Mariano Diaz"**.

| Badge | Valor | Label |
|---|---|---|
| violeta `clock` | 3 | Assigned |
| teal `shield-check` | 1 | Certified |
| naranja `alert-circle` | 1 | Observed |
| azul `activity` | 5 | Total stages |

**Card "Assigned stages"**, filas **sin** barra de progreso:
- `Torres del Palermo - Unidad 7B` / `Stage 5: Ground floor structure` / píldora **Certify**

**`BottomNav` CER** (4): Panel (`bar-chart-3`) · Assigned (`activity`) · Issued (`shield-check`) ·
Profile (`user`). Activo: **Panel**.

**Datos**: `GET /api/v1/certifier/kpis` + `GET /api/v1/certifier/stages?status=assigned`.

> El nombre del stage sale de una **clave de traducción**, no de copy del backend (regla 15). La
> captura mezcla inglés y español entre filas ("Ground floor structure" / "Estructura niveles
> superiores") porque son datos mock — no es un patrón a replicar.

---

## Invariantes

1. **Ninguna pantalla de esta spec muestra señal de prueba criptográfica.** No hay `HashChip`, TXID,
   Merkle ni badge "Verified" sobre un artefacto. "Verified Documents: 6" es un **conteo**, no una
   afirmación sobre un artefacto puntual (regla 17).
2. **El ruteo post-login usa `user.role` de la respuesta**, nunca la solapa activa.
3. **Cada landing valida el rol** contra su grupo de M2-D1 (`INVESTOR_ROLES`, `DEV_ROLES`,
   `NOTARY_ROLES`, `CERTIFIER_ROLES`): con rol `developer` no se entra a `/certifier` cambiando la URL.
4. **Cada endpoint de KPI está scopeado al actor**: el developer ve su organización, el escribano sus
   dossiers asignados, el certificador sus stages asignados (M2-D1 §Cross-role data isolation). Dos
   capas, siempre (regla 5).
5. **`passwordHash` nunca llega al cliente.**
6. **Cero strings hardcodeados**, `aria-label` incluidos. Todo sale del diccionario.
7. **`propnexus.lang` es la única fuente del locale**; default `es-AR`; togglear re-renderiza sin
   recargar y sin perder estado de formulario.
8. **es-AR usa voseo** en todo el copy.
9. **Todo funciona en una columna de ~380px sin scroll horizontal**; en ≥768px el `BottomNav` se
   reemplaza por sidebar con los mismos items en el mismo orden.
10. **Todo monto viaja en unidades enteras mínimas** y se formatea con `Intl.*` en el cliente.
11. **Recargar con sesión válida no vuelve a `/login`**; token inválido o expirado sí, conservando el
    locale.
12. **Ningún hex inline**: los colores salen de los tokens del tema.

## Casos borde

- Credenciales inválidas / usuario inexistente / cuenta inactiva → misma 401, mismo mensaje, **mismo
  tiempo de respuesta** (el hash dummy ya lo garantiza; hay test).
- Rate limit 429 → mensaje propio.
- Solapa de un rol + credenciales de otro → entra y va al panel del rol **real**.
- Rol `admin` → no tiene solapa ni panel en esta spec. Definir: ¿se rechaza en el login con mensaje,
  o se le da un destino? Hoy vuelve a `/login` en silencio, que es un callejón sin salida.
- KPI en cero → se muestra `0`, no `—` ni el tile oculto.
- Lista de trabajo pendiente vacía → **la captura no muestra este estado**. Definir copy de vacío
  ("No tenés dossiers pendientes") antes de implementar, y anotarlo acá.
- Conteo de notificaciones >9 → "9+".
- Nombre de organización o de persona largo → truncar con ellipsis, no romper el header.
- Sin conexión al cargar el panel → estado de error, no una grilla de ceros (un cero es una
  afirmación).

## Definición de terminado

- Las 5 credenciales del seed entran y aterrizan cada una en su panel, en mobile y desktop.
- Cada pantalla es **comparable con su captura**: mismo layout, mismos componentes, misma jerarquía.
- ES/EN cambia las 5 pantallas sin recargar y persiste al navegar.
- Los KPIs y las listas salen de endpoints reales, scopeados al actor, con test de camino feliz y de
  cada rechazo.
- `pnpm e2e` ejercita `AUTH-LOGIN-001` y `AUTH-ME-001` y deja capturas de las 5 pantallas en ambos
  viewports.

## Corte de rebanada — decisión pendiente

Transcribir las capturas dejó a la vista que **los paneles no son shells**: son grillas de KPI más una
lista de trabajo con acción. Eso mete 5 endpoints nuevos (`developer/kpis`, `notary/kpis`,
`notary/dossiers`, `certifier/kpis`, `certifier/stages`) y sus schemas en `packages/shared`.

Dos cortes posibles:

- **(a) Una sola rebanada.** Login + 4 paneles completos con datos. Es la que deja la app realmente
  demostrable, y es más grande.
- **(b) Dos rebanadas.** **1A**: login correcto + los 4 headers/nav conformes con **estado de carga**
  explícito en la grilla (no ceros inventados). **1B**: los 5 endpoints y los KPIs reales.

**Recomendación: (b).** 1A es puramente de front, se verifica contra las capturas y no toca
autorización; 1B es backend con dos capas de auth en cada endpoint, que es donde conviene mirar
despacio. Partirlo evita mezclar una rebanada visual con una de permisos.

## Preguntas abiertas

| Pregunta | Default | Quién la cierra |
|---|---|---|
| El endpoint usa `email` pero el diseño dice "Username". ¿Campo nuevo o label? | Sigue siendo `email`; "Usuario"/"Username" es copy. Si un revisor objeta, se abre `D-0XX`. | Implementador |
| El enum de roles dice `buyer`/`verifier` y el dominio dice investor/certifier. | **No se renombra en esta spec.** Los labels salen del diccionario, así que no bloquea. Deuda de la familia D-023. | Sesión de rename |
| ¿Qué ve `admin` al entrar? | Hoy: nada, vuelve a `/login`. Hay que darle destino o rechazarlo con mensaje. | Dueño del producto |
| Copy de listas vacías | No inventado todavía: la captura no lo muestra. | Se define acá antes de implementar |
| "New project" como tile `highlighted` — ¿navega o abre modal? | Navega a la pantalla de `34b`. | Al implementar esa rebanada |
