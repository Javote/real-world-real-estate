# SPEC-412 — El constructor de diez parámetros posicionales

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §T-02. Nivel 🟢. **Independiente.** Cero cambio de comportamiento. No toca ningún criterio del SOM.
> Es la más chica de la serie 4xx y probablemente la de mejor relación valor/riesgo.

## El problema, en una frase

`LucidAnchorAdapter` tiene un constructor privado con **10 parámetros posicionales**, tres de ellos
`number` consecutivos, y el compilador no puede distinguirlos.

```ts
private constructor(
  lucid, refs, walletAddress, network, now,
  validityWindowMs, tipLagMarginMs, pendingUtxoTtlMs,   // ← tres number seguidos
  blockfrost, referenceUtxo
)
```

## Por qué no es estética

Intercambiar `tipLagMarginMs` y `pendingUtxoTtlMs` en la llamada de `create()`:

- **compila**;
- **pasa los tests del `Emulator`**, que inyectan un reloj fijo y no ejercitan la ventana real;
- y produce, contra Preprod, una ventana de validez mal calculada — el modo de falla que
  `TIP_LAG_MARGIN_MS` documenta con la medición del bloque 5123377 y que costó un rodeo entero
  encontrar.

Los tres números son de la misma unidad (ms), del mismo orden de magnitud (2-3 minutos) y el
significado de cada uno está explicado en tres comentarios largos **arriba**, lejos de la línea donde
se pasan. `walletAddress` y `network` son dos strings adyacentes con el mismo problema, más leve.

El único llamador es `create()`, que **ya recibe un objeto de opciones** (`LucidAnchorOptions`) y lo
desarma para volver a armarlo posicionalmente. El objeto ya existe: se desarma para nada.

## Qué se cambia

El constructor toma **un objeto**, con los defaults ya resueltos por `create()`:

```ts
interface ConfigResuelta {
  lucid: LucidEvolution; refs: StageScriptRefs; walletAddress: string;
  network: AnchorNetwork; now: () => number;
  validityWindowMs: number; tipLagMarginMs: number; pendingUtxoTtlMs: number;
  blockfrost: { url: string; apiKey: string } | undefined;
  referenceUtxo: UTxO | null;
}
```

Nada más. Mismos campos, mismo orden de resolución de defaults, mismas asignaciones — solo que
nombradas en el sitio de la llamada, que es donde el error se cometería.

## Alcance / NO-alcance

- **Cubre:** el constructor privado de `LucidAnchorAdapter` y su único llamador, `create()`.
- **NO cubre:** `LucidAnchorOptions`, la API pública. No cambia.
- **NO cubre:** ningún comportamiento. Si algún test cambia, el refactor está mal hecho.
- **NO cubre: partir `real.ts`.** Ver abajo.

## Invariantes

1. **Ningún constructor del package toma más de tres parámetros posicionales.**
2. Los defaults se resuelven **en un solo lugar** (`create()`), como hoy.
3. Los campos siguen siendo `readonly` donde hoy lo son.
4. `pnpm verify` pasa **sin tocar un solo test**.

## Preguntas abiertas — lo que esta spec decide NO hacer

**¿Se parte `real.ts`?** Son 704 líneas con cinco responsabilidades identificables: construcción de
transacciones, la cola, la vista local de UTxOs, el HTTP a Blockfrost, y la publicación del reference
script. Separarlas se defiende sola en abstracto.

En concreto, **la recomendación de la auditoría es no hacerlo, al menos no ahora**:

- Es el archivo de más riesgo del repo (🟡) y el que la prueba de volumen del 2026-09-10 ejercitó
  entero, incluidas las tres capas de autocura que salieron de ahí.
- Sus partes están **acopladas por el estado que la cola protege**: `enCola` vence la vista local,
  `enviar` la escribe, `utxoAt` la lee, y el orden entre las tres es la corrección del encadenamiento
  (D-082). Una frontera mal puesta reintroduce la condición de carrera que ese diseño resuelve, y los
  tests que la cubren dependen de que el `Emulator` **no** vea su propio mempool — una sutileza que
  sobrevive mal a una mudanza.
- No hay un cambio pendiente que lo empuje. Partirlo hoy es mover el código mejor probado que tenemos
  para que quede más lindo.

**Cuándo reconsiderarlo:** si se toma la fusión de anclaje y transición
([`PROPUESTA-2026-09-09`](PROPUESTA-2026-09-09-fusionar-anclaje-evidencia-transicion.md)), que agrega
un camino de transacción más. Ahí la separación deja de ser estética y pasa a ser lo que hace
revisable el cambio — y conviene que venga **junto** con él, no antes.
