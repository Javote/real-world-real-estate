# SPEC-202 — Una unidad, un dossier: el índice único que falta

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md) §B-02.
> Nivel 🟡 — **es una migración sobre una base desplegada**, la segunda desde que Turso está vivo
> (D-063). **Independiente.** No toca ningún criterio del SOM, **pero es corrupción de datos
> reproducida y vale antes de mainnet**.

## El problema, reproducido

`compileDossier` (`domain/dossier.ts:153`) hace *leer, y si no está, insertar* sobre `Dossier`. La
tabla tiene `Dossier_unitId_idx` — un índice **común**, no único (`migrations/0000_init.sql:413`).
Dos compilaciones concurrentes de la misma unidad crean dos filas:

```
await Promise.all([compileDossier(u), compileDossier(u)])

ids devueltos : kpccox25uy3h1870bnznmzs5   tnm4xd97fg53ddirthecijtv   (DISTINTOS)
filas Dossier : 2
```

El dossier es justamente la entidad cuyo trabajo es **tener una identidad estable**: el `shareToken`
del link público, el `masterHash` congelado al firmar y el `signedById` del escribano cuelgan de esa
fila, y `OnChainEvent.referenceId` apunta a ese id. Con dos filas, `executeTakeFirst` elige
cualquiera:

- `POST /investor/units/:id/dossier/share` puede escribir el token en una fila y
  `GET /public/dossier/:shareToken` resolver por `unitId` a la otra;
- `POST /notary/dossiers/:id/sign` puede firmar y congelar una fila mientras `compileDossier` sigue
  recompilando la otra, **que nunca se entera de que hay una firma**. La regla 17 dice que sin TXID el
  estado es "Pendiente"; acá habría un TXID **real** apuntando a una fila que la pantalla no lee.

No hace falta concurrencia adversarial: una pantalla que pide el detalle y el export en paralelo, un
doble click en "Compartir", o un reintento del cliente alcanzan.

## Qué se cambia

1. **Antes de nada, medir producción.** La migración falla si ya hay duplicados:
   ```sql
   SELECT unitId, count(*) FROM Dossier GROUP BY unitId HAVING count(*) > 1;
   ```
   Si hay filas, **se decide cuál sobrevive antes de escribir la migración**, y el criterio es
   explícito: gana la que tenga `shareToken` o firma; si ninguna la tiene, la de `compiledAt` más
   viejo (conserva la identidad que ya pudo haberse compartido). Se anota en el archivo de migración.
2. `migrations/0006_*.sql`: `CREATE UNIQUE INDEX Dossier_unitId_key ON Dossier (unitId)`.
3. `compileDossier`: `onConflict().doNothing()` y **releer** — la fila que gana la carrera es la que
   vale para los dos requests.

## Por qué el índice y no un chequeo previo

El argumento **ya está escrito en la casa**, en `middlewares/errorHandler.ts`:

> *"Un chequeo previo por ruta además no cierra la ventana de carrera —dos requests simultáneos pasan
> los dos el `select` y uno choca igual—, así que la restricción de la base es la única respuesta
> verdadera."*

La conclusión ya estaba tomada; falta aplicarla acá.

## Invariantes

1. **Una unidad tiene como máximo un `Dossier`**, garantizado por la base y no por el orden de las
   llamadas.
2. **`compileDossier` es idempotente y seguro bajo concurrencia** (regla 8): N llamadas simultáneas
   devuelven el **mismo** id.
3. **Ninguna firma queda huérfana**: el `signedById`/`signedAt` y el `OnChainEvent.referenceId`
   apuntan a la única fila que las lecturas resuelven.
4. La migración es idempotente y **no destruye datos sin dejar escrito el criterio**.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| `Promise.all([compileDossier(u), compileDossier(u)])` | un solo id, una sola fila |
| Compilar una unidad que ya tiene dossier firmado | devuelve la firmada; **no** recompila el `masterHash` congelado |
| Compartir y compilar en paralelo | el `shareToken` queda en la fila que las dos lecturas ven |
| La migración corre dos veces | segunda vez sin efecto (regla 8) |
| Producción con un duplicado preexistente | la migración lo resuelve por el criterio escrito, o **no corre** y avisa |
