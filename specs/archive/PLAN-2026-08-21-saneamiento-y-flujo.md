# Plan de saneamiento y flujo de trabajo — 2026-08-21

> **Empezá por acá si volvés al proyecto.** Este archivo reemplaza en la práctica al arranque que
> describían `specs/README.md` y el skill `slice`: resume qué se descubrió el 2026-08-21, qué deuda
> hay que resolver y con qué flujo se trabaja después. Los dos borradores que produjo la sesión son
> `specs/propuesta-CLAUDE.md` y `specs/propuesta-SPEC-011.md`.

---

## 1 · Qué pasó en esta sesión

Se implementó la rebanada 1 (login de 4 roles + 4 paneles), se pusheó como `75ff427`… y después se
descubrió que **está construida contra el documento equivocado**. El resumen honesto:

- Se leyó la **prosa** de M2-D1 y M2-D3 y se implementó desde ahí.
- **Nunca se abrieron las 70 capturas de `docs/milestone-2-diseno/M2-D2-Screenshots-catalog/`**, que
  son la especificación visual de mayor fidelidad del repo.
- **Nunca se abrió `docs/milestone-3-implementacion/UI-implementation-plan.md` (M2-D5)**, que es el
  índice maestro: 53 filas de backlog con path, componentes, endpoints, test IDs y patrón de prueba
  por superficie.
- Un subagente `conformance` corrió **dos veces**, gastó **157k tokens** y dictaminó **"conforme"** —
  porque también leyó solo la prosa. **Un control que mira el lugar equivocado da garantía falsa,
  que es peor que no tener control.**

### Qué tan lejos quedó (comparado con `1-LOGIN.png`)

| El diseño | Lo implementado en `75ff427` |
|---|---|
| Gradiente **full-page**, logo centrado con isotipo | Gradiente como banda de header |
| Tarjeta blanca flotante con todo adentro | Sin tarjeta |
| **Segmented control** de 4 solapas | Grilla 2×2 de botones con borde |
| Título por rol: "Investor Portal" | Sin título |
| Placeholders "Enter your username" | Credenciales del seed precargadas |
| Password con ojo de revelar | Sin ojo |
| Botón "Sign in as Investor" (cambia por rol) | "Ingresar" genérico |

Y los **4 paneles no son shells vacíos**: son grillas de KPI (6 tiles en developer, 4 en
notary/certifier) más una card de trabajo pendiente con acción (*Review* / *Certify*). El spec
recortó justo lo que hace que la pantalla sea una pantalla.

### Lo que sí quedó bien y se conserva

`75ff427` no se revierte entero: el rol `notary` en el modelo, la infraestructura de i18n
(`propnexus.lang`, diccionario, voseo), `useRoleGuard` con las dos capas, y dos bugs reales
encontrados y arreglados —el hoisting de `dotenv` en `app.ts` y la colisión de `.hidden` entre el CSS
legado y Tailwind— son valor real. **Lo que se rehace es la superficie visual.**

### Mediciones de la sesión (por si se vuelve a discutir)

| | |
|---|---|
| Tests unitarios | **15.7 s** (web 3.3 · api 10.6 · shared 1.8) — **no son lentos** |
| Puerta completa | 26 s |
| Subagentes | spec 93k + conformance 102k + re-conformance 55k = **250k tokens** |
| Doc normativo propio | **5316 líneas** repartidas en 4 `CLAUDE.md`, 2 skills, 3 agentes, 4 archivos de `specs/` |
| shadcn/ui | **no está instalado** — ni shadcn, ni Radix, ni cva/clsx, ni `components.json` |
| CSS legado | **1036 líneas** en `apps/web/src/styles.css` |

Los `pnpm dev` en rojo fueron: un bug real (dotenv) y el resto, procesos matados y relanzados a mano.

---

## 2 · El hallazgo central: el spec ya está, y es un join mecánico

`docs/milestone-3-implementacion/UI-implementation-plan.md` (**M2-D5**) §4-6 tiene **53 filas**, una
por superficie, con seis columnas fijas. **La columna `ID` es el número de la captura.** Cada fila se
resuelve sola contra el resto de los entregables:

```
fila de M2-D5 §4-6
  ├─ ID          → docs/milestone-2-diseno/M2-D2-Screenshots-catalog/<ID>-*.png
  ├─ Components  → M2-D3 §Component Library      anatomía + hex normativos
  ├─ Endpoint(s) → M2-D6 Apéndice A.3            responsabilidad del backend
  │                M2-D6 Apéndice A.4            forma exacta de la respuesta
  ├─ Test ID(s)  → el nombre del test e2e, literal
  ├─ Pat         → M2-D4 §5                      patrones P1–P10, normativos
  └─ path + rol  → M2-D1 §7.2 AuthGuard + §4     matriz de permisos
```

**Ejemplo, fila `51`:** `/notary` · StatCard + ProgressTimeline + PrimaryButton ·
`GET /notary/kpis` + `GET /notary/dossiers/pending` · `NOT-PANEL-001`, `NOT-PENDING-002` ·
`M3-BE-17`, `M3-FE-25`. La pantalla entera, decidida.

**`M2-D6` Apéndice A.4 fija la forma de cada respuesta** — qué devuelve un anclaje (Merkle root +
TXID + fecha + file count, en la *misma* respuesta de la mutación), qué devuelve certificar
(certificate hash + TXID), qué devuelve firmar, qué campos tiene un evento de audit log. **Eso es el
contrato Zod, ya escrito en prosa.**

**Conclusión: ~85% está decidido.** Lo único que se inventa por pantalla son **tres huecos**: copy
es-AR con voseo, estados vacíos y estados de error.

### Regla que sale de acá

> **No se implementa una pantalla sin abrir su captura y su fila de M2-D5.** Cuando la prosa de
> M2-D3 y la captura difieren, **gana la captura**. La precisión va adelante, en el spec — no atrás,
> en la auditoría.

---

## 3 · La deuda, medida

| # | Deuda | Tamaño real | Por qué bloquea |
|---|---|---|---|
| 1 | **Falta la entidad `Unit`** | Existen 6 tablas (`User`, `Project`, `ProjectMember`, `Milestone`, `Evidence`, `AuditLog`); `Unit` no | Sobre `Unit` giran contrato, releases, dossier, My Units y la asignación de inversor. **La entidad más citada del backlog no existe.** |
| 2 | **`Milestone` → `Stage`** (D-023) | **230 ocurrencias en 16 archivos** — SQL, rutas API, web, validadores Aiken | Encarece con cada pantalla nueva |
| 3 | **CSS legado sin shadcn/ui** (D-024) | 1036 líneas; 0 shadcn/Radix/cva | Ya costó el bug de `.hidden` (~12 llamadas de debug) |
| 4 | **Superficie web muerta** | `dashboard.tsx`, `verify.tsx`, `projects.$projectId.tsx`, `AppHeader`, `MilestoneStateBadge`, `ProjectCard` viejo, `StatusPill` booleano (M2-D3 pide matriz de 5), `HashChip` sin truncar 6+4 | Infla el rename y confunde el contexto |
| 5 | **Roles con vocabulario viejo** | `buyer`/`verifier` en vez de investor/certifier | Contradice M2-D1 en cada spec |
| 6 | **`contracts/`** | naming de scaffold (`j/milestone-fsm`, `version = "0.0.0"`, incumple D-015), `milestone.ak` + `milestone2.ak` duplicados (D-017), **0 tests** | Único criterio duro del SOM (≥95% coverage) **sin plan B** |
| 7 | **`canAccessProject` es función, no middleware** (D-044) | 27 endpoints hoy, ~80 en el backlog | El momento barato de cambiar la forma es **antes** de la tanda grande |
| 8 | **`packages/cardano` vacío** | solo `.gitkeep` | Bloquea todos los patrones P1–P10 |

### El orden importa y no es obvio

**Borrar la superficie muerta primero achica el rename de 16 archivos a 9.** Hacerlo al revés cuesta
el doble.

---

## 4 · Los 4 commits de saneamiento

| # | Commit | Contenido |
|---|---|---|
| 1 | **Borrar** | Superficie web muerta · `milestone2.ak` · `styles.css` · el harness entero (3 agentes, 2 skills, `worktree.sh`) · colapsar 4 `CLAUDE.md` + `specs/README` + `stack` + `entregables` en **un solo `CLAUDE.md`** (ver `specs/propuesta-CLAUDE.md`) · adelgazar `gate.sh` a **3 controles** (prohibiciones → typecheck → tests; los builds se van a CI; fuera las advertencias decorativas) |
| 2 | **Renombrar** | `Milestone → Stage` y `buyer/verifier → investor/certifier`, con migración nueva. Sobre la superficie ya reducida. |
| 3 | **Modelo completo** | `Unit` y las entidades que el backlog exige, derivadas de M1-D2b + la matriz de M2-D1 §4 + los endpoints de M2-D5. **← pregunta abierta, ver §6** |
| 4 | **Fundación visual** | shadcn/ui + los hex de M2-D3 como tokens del tema · `requireProjectAccess` como middleware de Express · naming de `contracts/` según D-015 |

Después de los 4, se rehace la superficie de `75ff427` contra las capturas usando el flujo de §5.

---

## 5 · El flujo de rebanada (después del saneamiento)

**Una rebanada = un grupo de filas de M2-D5 que comparten `M3-BE-XX`.** Las 53 filas dan ~15
rebanadas.

1. **Elegir filas** (1 min) — grupo con backend común, ≤4 pantallas.
2. **Generar el spec por join** (~10 min, mecánico) — abrir las capturas del `ID`, copiar la fila,
   resolver componentes contra M2-D3, la respuesta contra A.4, el patrón contra M2-D4.
   **No se escribe nada original salvo los 3 huecos.**
3. **Cerrar los 3 huecos** con default explícito: copy es-AR (voseo), estados vacíos, estados de error.
4. **Implementar en orden fijo**: schema Zod en `packages/shared` → migración si toca modelo →
   endpoint con las dos capas de auth → componentes shadcn → pantalla → tests.
5. **Verificar** — `scripts/gate.sh` (3 controles, ~20 s) + `pnpm e2e -g "<TEST-ID>"` con **solo los
   test IDs de esas filas** (segundos, no 52 s).
6. **Commitear** con el REF de M2-D5 entre corchetes (`[M3-FE-25]`).

**Un solo agente. Sin subagentes, sin skills, sin `conformance`.** El control de conformidad se mueve
adelante: si el spec es la transcripción de la captura y los test IDs salen de la fila, no queda nada
que auditar después.

**El walkthrough visual completo (`pnpm e2e` entero) se corre en momentos específicos** —antes de una
demo, al cerrar un bloque de rebanadas—, no en cada rebanada. Produce tres cosas que el SOM pide como
evidencia: test IDs ejecutándose, capturas y el video (criterio 13).

### Dos mejoras baratas que compran velocidad

- **`LOGIN_RATE_LIMIT_MAX` alto en el entorno de e2e.** Dos corridas fallaron hoy por el rate limiter
  de D-045 (20 intentos / 15 min) y parecía un bug de la app. No bajar el limiter en producción.
- **`scripts/surface.sh <ID>`** (~20 líneas): imprime la fila de M2-D5 y las rutas de sus capturas.
  El mapeo ID→archivo **no es 1:1** (`06-07`, `25v`/`25m`, `34b`/`34c`, `dev-prof`), y adivinarlo es
  una clase de error evitable.

---

## 6 · Pregunta abierta que bloquea el commit 3

**¿Hasta dónde se lleva el modelo de datos?**

- **(a) Completo ahora** — derivarlo de M1-D2b + la matriz de permisos de M2-D1 §4 + los endpoints de
  M2-D5, y crear todo lo que el backlog exige: `Unit`, `Invitation`, `Contract`, `Release`,
  `Certification`, `Observation`, `Dossier`, `Notification`, `Favorite`… Más trabajo de una vez, pero
  deja de haber una migración en cada rebanada.
- **(b) Solo `Unit` ahora** — el resto entra con la rebanada que lo necesite. Arranca antes, migra más
  seguido.

**Sin decidir.** Es del dueño del producto.

---

## 7 · Estado del repo al cerrar la sesión

| | |
|---|---|
| Rama | `main`, limpia y pusheada |
| Último commit | `75ff427` — `feat(web): login de 4 roles con i18n y shells de panel [SPEC-011]` |
| Anterior | `f354891` — cierre documental de la rebanada 0d (migración de ORM a Kysely) |
| Puerta | abierta |
| Tests | 16 web · 76 api · 16 shared · **0 contratos** |
| e2e | 18/18 (2 son `test.fail()` esperado por el proxy de nitro) |

**Ojo:** `specs/SPEC-011-login-4-roles.md` (el commiteado) está **obsoleto** — se escribió desde la
prosa. Lo reemplaza `specs/propuesta-SPEC-011.md`, que transcribe las capturas; y a su vez esa
propuesta hay que completarla con las filas `01`, `02`, `33-34`, `51` y `55` de M2-D5, que se leyeron
después de escribirla.
