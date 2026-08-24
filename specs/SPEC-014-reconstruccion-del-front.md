# SPEC-014 — Reconstrucción del front desde los entregables

> **Esta spec no lista pantallas.** El backlog ya existe y está aprobado: son las 53 filas de
> `docs/milestone-3-implementacion/UI-implementation-plan.md` (M2-D5). Duplicarlo acá crearía una
> segunda fuente que se desactualiza (principio 1). Lo que sigue son las **invariantes** del
> trabajo: lo que tiene que ser verdad en cada commit, sin importar qué pantalla toque.

## Propósito

El front tiene ~2% de conformidad con el diseño aprobado. Esta spec fija cómo se reconstruye: qué se
conserva, qué se borra, y qué invariante hace que una superficie esté terminada.

**La medición que la origina** (2026-08-23):

| Dimensión | Especificado | Existe | Conforme |
|---|---:|---:|---:|
| Superficies (M2-D5) | 53 | 6 | 0 |
| Componentes (M2-D3) | 33 | 10 | — |
| Patrones de prueba (M2-D4) | 10 | 1 | **0** |
| Test IDs (M2-D5 §2.3) | 53 filas | **0** | 0 |
| Colores de la paleta normativa | — | — | **0 coincidencias** |

Dos superficies existentes —`/dashboard` y `/verify`— **no aparecen en ningún entregable**.

## Alcance / NO-alcance

- **Cubre:** el borrado, el sistema de tokens, los 33 componentes de M2-D3, los 10 patrones de
  M2-D4, y las superficies de M2-D5 en verticales sucesivas. Incluye crear los endpoints que cada
  fila pide, con la forma que pide.
- **NO cubre:** rediseñar nada. Si una decisión visual no está en `docs/`, no se toma acá: se
  registra como decisión o se pregunta.
- **NO cubre:** app nativa (D-065). PWA sí, desde el arranque.

## Qué se conserva y qué se borra

**Se conserva** (es decisión, no superficie):

| | Por qué |
|---|---|
| `api/port.ts` | Único lugar del front que hace `fetch`. Su cliente pasa a derivarse del contrato (D-066) |
| `auth/session.ts` · `roles.ts` · `useRoleGuard.ts` + test | Implementa los AuthGuard role groups de M2-D1 §7.2 |
| `i18n/*` | La maquinaria es correcta; el diccionario crece con cada pantalla |
| `router.tsx` · configs | Plomería |
| La lógica de `login.tsx` | Único path correcto; se le cambia la piel |

**Se borra:** `styles.css` entero (1064 líneas, sistema visual equivocado), las superficies que no
están en los entregables (`/dashboard`, `/verify`), las que tienen path o composición equivocados, y
`AppHeader`/`PanelShell`/`MilestoneStateBadge`, que M2-D3 no define. `api/types.ts` desaparece: los
tipos vienen del contrato.

Los 10 componentes de dominio que existen **se reescriben**, no se borran: los nombres son correctos,
el contenido no.

## Invariantes

Cada una tiene que poder verificarse mirando un diff.

1. **Ningún componente fuera de M2-D3 §Component Library.** Uno nuevo es una decisión, no un archivo.
2. **Ningún estado fuera de la matriz de status pills.** *"Never invent new statuses."*
3. **Ningún color, tamaño, radio o espaciado literal en un componente.** Todo sale de un token, y el
   token sale del hex normativo de M2-D3.
4. **Toda superficie lleva los `data-testid` de su fila**, literales — incluso cuando el ID diga
   `MILESTONE`.
5. **Cero strings visibles fuera del diccionario** (D-025), y cero copy viniendo del backend (regla 15).
6. **Los paths son los de M2-D5, carácter por carácter.** `/project/:projectId`, no `/projects/`.
7. **Ninguna superficie de prueba se abre sola** (M2-D4 §6.3). Excepción única:
   `AnchoringSuccessModal`.
8. **Ningún `fetch` fuera del `ApiPort`.**
9. **Mobile-first de verdad:** la captura es un teléfono. El desktop es la adaptación, no al revés.
10. **Sin TXID no hay "Verificado"** (regla 17). El estado es "Pendiente".

## Orden de trabajo

El orden no es negociable porque cada paso es prerequisito del siguiente:

| # | Commit | Por qué va acá |
|---|---|---|
| 1 | Borrado + tokens (`@theme`) + shadcn/ui | Construir pantallas antes de los tokens es construirlas dos veces |
| 2 | Los ~12 componentes transversales | Los usan todas las superficies |
| 3 | Los patrones P1–P10 | Son transversales y son lo que distingue al producto de un CRUD con fotos |
| — | *(1 a 3 hechos: reset · demolición + tokens · componentes · patrones)* | |
| 4+ | Verticales, en el orden del flujo cross-rol de M2-D1 §6 | `evidencia → certificar → liberar`. Empieza por developer subiendo evidencia: es la única vertical con backend y contrato ya funcionando |

Cada vertical trae **sus** endpoints (creándolos con paths scopeados por rol, D-066) y **sus** test
IDs. El rename de D-067 viaja en el commit 1, porque toca todo igual.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Un rol entra a la landing de otro cambiando la URL | Redirige a su propia landing (`useRoleGuard`) |
| Hash sin anclaje confirmado | Pill "Pendiente", nunca "Verificado" |
| `HashChip` con hash completo | Muestra 6+4 con elipsis; copia el **completo** |
| Tap en `HashChip` | Abre `TxidModal` — nunca se abre solo |
| Locale `en-US` | Ninguna cadena en español visible, ni del backend |
| Stage sin evidencia en la vista del certifier | Empty-state definido en M2-D5 fila 56v, no una lista vacía |
| Pantalla en 320px de ancho | Legible sin scroll horizontal |

## Preguntas abiertas

1. **`/public/dossier/:shareToken` sin cuenta**: cómo se sirve el preview de link sin SSR (D-065).
   Se resuelve con prerender cuando llegue esa vertical; no bloquea nada antes.
2. **La otra mitad de D-028**: atribución de autoridad y atestación del revisor no tienen columnas.
   Bloquea la vertical del certifier, no las anteriores. **Dueño: producto.**
3. **PWA**: qué entra al shell offline. Se decide cuando existan las superficies, no antes.
4. **P6 (audit log) y P8 (dossier) son superficies, no componentes.** Los otros ocho patrones ya
   existen como componentes reutilizables; estos dos se transcriben con su vertical, porque son
   pantallas enteras con su propio backlog de M2-D5 (filas 49-50 y 26-29).
