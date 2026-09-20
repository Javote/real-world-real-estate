# SPEC-410 — Tres asperezas del adaptador: `canonical()`, un `parseInt` y un `fetch`

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §C-05. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM. Tres cambios chicos, sin
> relación entre sí más que el tamaño.

## 1 · `canonical()` no ordena por clave

`simulated.ts`:

```ts
Object.fromEntries(Object.entries(v).sort())
```

`Object.entries` da pares `[clave, valor]`, y `.sort()` sin comparador ordena por la representación
en string del par: `"clave,valor"`. **No por clave.** Con dos claves donde una es prefijo de la otra
y el carácter siguiente cae por debajo de `,` (o sea `!"#$%&'()*+`), el orden sale distinto del
orden por clave — porque la coma entra en la comparación.

Con las claves de hoy —identificadores de `StageDatum`, `outputRef`, `sha256`, `reference`— no
cambia nada, y se dice por honestidad: **no hay un bug esperando**. Lo que hay es una trampa puesta
en la única función cuyo trabajo es canonicalizar, y de la que dependen dos cosas que importan:

- el **TXID determinístico** del simulador (`txidOf`), que es cómo los tests ven una doble escritura;
- el chequeo **`STALE_DATUM`**, que compara el datum declarado contra el que tiene el hilo.

El arreglo es un comparador: `.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))`. Una línea, y la
función pasa a hacer lo que su nombre dice.

## 2 · `utxoAt()` no guarda contra `NaN`

```ts
const [txHash, index] = outputRef.split("#");
if (!txHash || index === undefined) { /* BAD_OUTPUT_REF */ }
const [utxo] = await this.lucid.utxosByOutRef([{ txHash, outputIndex: Number.parseInt(index, 10) }]);
```

Chequea que las dos partes existan y después no mira el resultado del `parseInt`: `"abc#xyz"` pasa el
guard y sale a consultar al proveedor con `outputIndex: NaN`. El error que vuelve es de Lucid o del
proveedor, a varios frames de distancia del dato malo.

`BAD_OUTPUT_REF` ya existe y es el lugar donde debería caer. Se valida la forma entera —hex64 +
`#` + entero no negativo—, que es la misma que `outputRefSchema` de [`SPEC-402`](SPEC-402-los-hashes-y-txid-tienen-forma.md)
si esa ya se tomó (si no, se declara acá y aquella la reusa; son independientes en cualquier orden).

## 3 · `confirmedAt()` hace `fetch` sin timeout

```ts
const res = await fetch(`${this.blockfrost.url}/txs/${txid}`, { headers: { project_id: … } });
```

**Es el único `fetch` del repo que sale a una red que no controlamos.** Sin `AbortSignal`, un
Blockfrost que acepta la conexión y no contesta cuelga la llamada sin límite — y `confirmedAt` corre
adentro de `reconciliarAnclajes`, que recorre eventos en serie: un solo request colgado detiene la
tanda entera, y con el disparo por lectura (D-077) eso es un request HTTP de la API que nunca cierra.

Un `AbortSignal.timeout(…)` con un número explicado. **No se agrega retry**: la reconciliación ya es
reintentable por diseño —vuelve a correr en la próxima lectura— y un reintento acá solo multiplicaría
la espera.

## Alcance / NO-alcance

- **Cubre:** las tres, en `simulated.ts` y `real.ts`.
- **NO cubre:** el determinismo del TXID del simulador, que no cambia — ninguna de las claves de hoy
  se reordena, y hay un test que lo fija.
- **NO cubre:** meter un cliente HTTP. El comentario de `confirmedAt` explica por qué es `fetch`
  pelado y sigue teniendo razón: es un GET a un endpoint que devuelve un campo.
- **NO cubre:** timeouts en el resto de las llamadas a Lucid, que van por el provider y tienen su
  propia configuración.

## Invariantes

1. **`canonical()` ordena por clave**, y el TXID de un datum dado no cambia respecto de hoy.
2. **Un `outputRef` mal formado produce `BAD_OUTPUT_REF`**, antes de salir a la red.
3. **Ninguna llamada saliente espera para siempre.** El timeout es explícito y está explicado.
4. Un timeout es **un error de infraestructura**, no un `null`: `confirmedAt` no puede decir "no
   confirmó" porque no pudo preguntar (mismo criterio que `DisabledAnchorAdapter`, que rechaza en vez
   de devolver `null`).

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| `canonical` sobre un `StageDatum` | **el mismo string que hoy** — y por lo tanto el mismo txid |
| `canonical` sobre `{ "a!b": 1, "a": 2 }` | ordenado por clave: `a` antes que `a!b` |
| `txidOf` de un datum fijo | el mismo valor que antes del cambio (test de regresión) |
| `utxoAt("abc#xyz")` | `BAD_OUTPUT_REF` |
| `utxoAt("<hex64>#0")` | funciona, como hoy |
| `utxoAt("<hex64>#-1")` | `BAD_OUTPUT_REF` |
| `confirmedAt` con el servidor colgado | rechaza al vencer el timeout, con mensaje propio |
| `confirmedAt` con 404 | `null`, como hoy |

## Cerrada — 2026-09-20

Las tres, en `packages/cardano`:

1. **`canonical()`** (`simulated.ts`) ordena con `ordenarPorClave`, un comparador explícito sobre la
   clave del par — no más `.sort()` a secas sobre `[clave, valor]`. Exportada para que el test la
   ejercite directo, sin pasar por un txid.
2. **`utxoAt()`** (`real.ts`) valida la forma entera con `/^([0-9a-f]{64})#(\d+)$/` antes de tocar el
   proveedor: `BAD_OUTPUT_REF` para hash mal formado, índice no numérico o negativo — antes esos tres
   casos pasaban el guard y salían con `outputIndex: NaN`.
3. **`confirmedAt()`** (`real.ts`) pasa `signal: AbortSignal.timeout(BLOCKFROST_TIMEOUT_MS)` (10s,
   constante nueva junto a `PENDING_UTXO_TTL_MS`) y envuelve el `fetch` en `try/catch` para convertir
   el abort en un error propio (`"Blockfrost no contestó en Xms..."`) en vez de dejar salir el
   `AbortError` crudo.

**Verificado en rojo antes del fix** (`git stash` de `simulated.ts`+`real.ts`): 7 tests fallan —
2 de `canonical` (`canonical is not a function`, ni siquiera estaba exportada), 4 de `BAD_OUTPUT_REF`
(los 4 casos daban `UNKNOWN_THREAD`, confirmando que `NaN` llegaba hasta el proveedor y volvía como
"no existe" en vez de "está mal formado"), y el de timeout (`Cannot read properties of undefined
(reading 'addEventListener')`, porque sin `signal` no hay nada a lo que engancharse). Las 88 vuelven
a verde restaurando el fix.

**Una aspereza nueva, encontrada escribiendo el test del timeout, no en el alcance original:** los
fake timers de vitest no interceptan `AbortSignal.timeout()` — es un temporizador nativo, no pasa por
`setTimeout` global. El test corre con timers reales y una ventana de `BLOCKFROST_TIMEOUT_MS + 5s`;
documentado en el propio test para que no se "optimice" a fake timers después y quede colgado.

`pnpm --filter @plataforma/cardano test` (88, 9 nuevos) y `pnpm verify` completo, verdes. El
determinismo del TXID no se movió (test de regresión con el valor literal de antes del cambio).
