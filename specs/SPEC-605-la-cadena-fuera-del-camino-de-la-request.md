# SPEC-605 — La cadena fuera del camino de la request

> Serie `6xx`, refactor post-M3 ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).
> **Condicional, y es decisión del dueño.** Contradice a propósito **D-077** ("la reconciliación la
> dispara la lectura, no un cron") y el criterio con el que el dueño revirtió el cron del
> 2026-08-31: no agregar infraestructura ni secretos permanentes para un problema que todavía no
> duele. **Esta spec no se implementa porque exista.** Se implementa cuando se cumpla uno de sus
> disparadores (§Cuándo), y mientras tanto deja el diseño pensado. Nivel 🟡: `packages/cardano`,
> deploy, y un proceso nuevo.

## Lo que hay hoy, medido el 2026-09-30

- **El anclaje ocurre adentro de la request que lo causa.** Llaman a `anchorCommitmentEvent` o
  a `anchorPort()` directamente: `developer-evidencia.routes.ts` (la subida: M2-D5 §2.2 pide *"client
  awaits success with TXID/Merkle root in the same response"*), `developer.routes.ts`,
  `developer-comercial.routes.ts`, `investor.routes.ts`, `evidence.routes.ts`, `notary.routes.ts` y
  `domain/stage-transition.ts`.
- **La reconciliación ocurre adentro de las lecturas:** `reconciliarParaLectura` se llama en 10
  lugares de 8 routers, con `TOPE_POR_LECTURA = 5` consultas a Blockfrost por request.
- **Así, la latencia de una pantalla depende de Blockfrost**, y una caída de Blockfrost se nota como
  lentitud de la app. D-075 ya garantiza que la declaración off-chain se escriba igual si el
  anclaje falla (`Failed`); lo que no hay es una forma de que *no* espere.

## Cuándo (los disparadores)

Se abre esta spec si pasa **uno** de estos, medido y no supuesto:

1. **El servicio sale del free tier** y existe un proceso de fondo que no se duerme. Con eso cae
   el argumento central de D-077 (D-003 · D-040: un `setInterval` o un worker mueren con el
   servicio dormido).
2. **Mainnet.** Una confirmación real tarda más y cuesta ADA; reintentar dentro de una request de
   usuario deja de ser razonable.
3. **Una pantalla medida en producción** cuya latencia la domina Blockfrost (p95 de la ruta menos el
   de su lectura sin reconciliar) por encima de un umbral que fije el dueño.

Antes de proponer el proceso, pasa las tres preguntas del criterio del dueño: **(a)** ¿el problema
existe hoy o es anticipado? **(b)** ¿qué secreto permanente pide? **(c)** ¿despierta al servicio en
el free tier?

## Diseño (cuando se abra)

1. **Outbox en la base.** El handler escribe la declaración off-chain y una fila `AnchorJob`
   (commitment, referencia, intentos, estado) **en la misma transacción**, y responde con el
   evento en `Pending` sin TXID. Nada se ancla sin haberse registrado antes, y nada registrado queda
   sin su job.
2. **Un worker** (un Background Worker de Render, u otro proceso con el mismo código de
   `packages/cardano`) toma jobs con un lock por fila, ancla, escribe el TXID, y en una segunda
   pasada reconcilia `Pending → Confirmed`. `reconciliarParaLectura` se borra.
   `POST /evidence/reconcile` se queda para barridos a mano.
3. **La idempotencia no cambia de dueño** (regla 8, `SPEC-206`): el worker llama a la misma
   `anchorCommitmentEvent`, que sigue garantizando un solo anclaje por commitment.
4. **La subida de evidencia es el caso difícil.** M2-D5 §2.2 obliga a devolver TXID y Merkle root
   **en la misma respuesta**, y el `AnchoringSuccessModal` depende de eso. `docs/` es inmutable
   (D-022), así que esa ruta **se queda sincrónica** o se abre un desvío con su D-NNN. La spec no
   lo decide.

## Invariantes

1. **Regla 17:** sin TXID, `Pending`. Pasar a asincrónico no puede mostrar nada más optimista que
   hoy.
2. **Ningún commitment se ancla dos veces** por un reintento del worker (lo fija un test con dos
   workers concurrentes).
3. **D-075 se conserva:** si el worker no puede anclar, la declaración off-chain sigue válida y el
   evento termina en `Failed`, con el mismo `retry-anchor` de hoy.
4. **Ningún secreto nuevo en un tercero.** El worker vive donde vive la API, con las mismas env vars.

## Fuera de alcance

Fusionar anclaje y transición en una sola transacción (`PROPUESTA-2026-09-09-fusionar-anclaje-…`):
es otra decisión, sobre el costo on-chain y no sobre la latencia.
