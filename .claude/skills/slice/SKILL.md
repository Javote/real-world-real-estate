---
name: slice
description: Protocolo de una sesión de desarrollo de M3 — abrir una rebanada, implementarla, pasar la puerta, documentarla, commitear y pushear. Usar al empezar cualquier trabajo de código en este repo.
---

# Una rebanada, de punta a punta

El ciclo es **planificar → implementar → testear → documentar → commitear → pushear** (D-030).
Pushear es parte del ciclo: un commit sin pushear no pasó por CI y no existe para nadie más.

Invocación típica: `/slice 3` (número de rebanada) o `/slice SPEC-009`. Sin argumento, mirá el
§Orden de trabajo de `specs/README.md` y proponé la primera rebanada no cerrada.

---

## 1 · Ubicarse (30 segundos, no se saltea)

```bash
scripts/worktree.sh list          # dónde estoy, qué ramas hay, qué puertos me tocan
git status --short && git log --oneline -3
```

**¿Necesitás un árbol propio?** Sí, si el trabajo es de un track que va a convivir con otro
(D-031). Los tracks son `web`, `api`, `contracts`:

```bash
scripts/worktree.sh create contracts    # rama, deps, base sembrada y puertos propios
cd ../pn-contracts && claude
```

El track de **contratos siempre puede correr en paralelo**: está aislado del workspace pnpm y no
bloquea a nadie. `web` y `api` están acoplados por `packages/shared` — si la rebanada toca el
contrato de datos, hacela en un solo árbol, no en dos.

## 2 · Tener la spec delante

Cada rebanada tiene su `specs/SPEC-NNN`. **Si no existe, no improvises**: despachá el subagente
`spec`, que lee los entregables y devuelve 2 páginas con invariantes y casos borde.

Leé la spec entera antes de escribir una línea. De ahí salen los tests: **si un caso borde no
está en la spec, el test no existe.**

Después abrí solo lo que el frente pide — la tabla de §Documentación oficial de `CLAUDE.md` dice
cuál. No leas los cuatro entregables por costumbre: son ~25k tokens.

## 3 · Planificar en voz alta

Antes de tocar código, decí: qué archivos vas a crear o modificar, qué migración hace falta, qué
tests vas a escribir (uno por invariante y uno por caso borde), y qué queda explícitamente fuera.

Chequeá el **nivel de autonomía** de lo que vas a tocar (§Niveles de `CLAUDE.md`):
🟢 implementás directo · 🟡 proponés y el humano revisa línea por línea · 🔴 lo lidera el humano.
**Si dudás, es el más alto de los dos.**

## 4 · Implementar

Orden que evita retrabajo:

1. **Schema Zod en `packages/shared`** si la rebanada toca el contrato API↔web. Va **antes** que
   el endpoint, y el front importa el mismo tipo (regla 6). Es lo único que vuelve imposible el
   drift.
2. **Migración** si cambia el modelo. Nunca editar una aplicada: siempre una nueva.
3. **API**, con `AuditLog` en cada mutación relevante.
4. **UI**, contra `ApiPort`, con los textos del diccionario i18n.
5. **Tests**, en el mismo commit que el código que verifican.

**La rebanada completa es el cambio lógico — no cada archivo.** Código, tests y la documentación
del paso 6 van en **un solo commit** al cerrar la rebanada. No dividas "código" en un commit y
"docs" en otro: partirlos deja un commit que no compila sin el otro, o uno que documenta algo que
el otro todavía no hizo — ninguno de los dos es revisable solo. La única excepción legítima es una
sesión que **no toca código en absoluto** (ej. una decisión pura, o corregir un `CLAUDE.md`): ahí
sí, un commit `docs`/`chore` aparte, porque no hay nada más con qué agruparlo.
**El mensaje de commit es la única revisión que va a existir**: si un cambio no se puede explicar
en un mensaje, es demasiado grande — pero la solución es cortar la rebanada en rebanadas más
chicas, no partir una rebanada en commits de código y de documentación.

## 5 · Verificar — las tres capas

```bash
scripts/gate.sh        # 1. la puerta: typecheck, tests del frente tocado, prohibiciones
```

**2. Conformidad.** Despachá el subagente `conformance` sobre el diff. Existe porque el agente
que escribió el código es el peor juez de si cumple la spec. Es obligatorio en cualquier rebanada
que toque una superficie con prueba criptográfica (hash, TXID, Merkle, badge).

**3. La app corriendo.** Los tests verdes no son la app funcionando — usá el skill `run-app`.
**Mirá las capturas**: un frame en blanco es una falla de arranque, no un test que pasó.

## 6 · Documentar antes de commitear (este es el paso que se saltea)

El repo es la memoria; los chats son descartables (principio 4). En el **mismo commit**:

| Si en la sesión… | Va a |
|---|---|
| decidiste algo con alternativas y consecuencias | **`DECISIONS.md`** — D-0XX nueva, con contexto, alternativas descartadas, trigger de revisión y reversión |
| te mordió algo que va a volver a morder | §Trampas del `CLAUDE.md` **del frente** (`apps/web/`, `packages/api/`, `contracts/`), fechado |
| cerraste o abriste una pregunta de la spec | la spec, y el registro de `specs/README.md` |
| cambió el estado de la rebanada | la fila en `specs/README.md` |
| apareció deuda nueva | §Deuda del `CLAUDE.md` del frente |

La puerta **advierte** si cambió código y no cambió ninguna spec, decisión ni `CLAUDE.md`. Esa
advertencia casi siempre tiene razón.

**Y lo que NO va: no dupliques.** Si algo ya está escrito en otro lado, linkealo. La jerarquía de
precedencia llegó a estar escrita cuatro veces en este repo antes de que lo corrigiéramos.

## 7 · Commitear y pushear

```
<tipo>(<scope>): <descripción en imperativo, minúscula, sin punto final> [<REF>]
```

`feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `db` — sobre
`web` · `api` · `db` · `shared` · `cardano` · `contracts` · `ci` · `repo`.
El REF es el ID de M2-D5 entre corchetes cuando aplique: `[M3-BE-13]`, `[M3-FE-18]`.

El **cuerpo explica el porqué, no el qué**. `BREAKING CHANGE:` en el footer si rompe contrato de
API o esquema on-chain.

Al pushear, el hook corre la puerta solo y bloquea si falla. Si estás en un árbol de track,
integrá al terminar la rebanada:

```
push de la rama del track  →  merge --ff-only a main  →  push de main  →  worktree remove
```

Los comandos exactos los imprime `scripts/worktree.sh create` al terminar.

## Terminado significa

- [ ] la puerta abierta (`scripts/gate.sh`)
- [ ] cada invariante de la spec tiene su test, cada caso borde el suyo
- [ ] `conformance` sin hallazgos GRAVES
- [ ] la app corre y **la viste** — no solo los tests
- [ ] lo que emergió está persistido en el repo
- [ ] commiteado y **pusheado**

Una rebanada terminada deja la app **corriendo y demostrable**. Ese es el criterio de corte, no
la cantidad de archivos tocados.
