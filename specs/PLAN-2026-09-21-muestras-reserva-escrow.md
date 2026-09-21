# Plan — muestras de "reserva → escrow" en Preprod, desde la extensión de Chrome

> **Estado: agendado, sin correr** (2026-09-21). Es el ítem 3.14 de `CLAUDE.md` §Lo que queda del
> plan. Cuando se corra, el resultado va a `specs/evidencia-m3/3-preprod/`: la nota de performance y
> sus capturas.

## Para retomarla

Se intentó correr el 2026-09-21 y quedó sin hacer: **la extensión de Chrome no estaba conectada**.
Antes de arrancar:

1. **La extensión de Claude en Chrome conectada**, logueada con la misma cuenta que Claude Code (si
   recién se instaló, reiniciar Chrome).
2. **Los dos logins los hace el dueño**, no la extensión: Claude no tipea contraseñas en el
   navegador. Claude abre dos pestañas en `/login`; el dueño entra como `developer@example.com` en
   una y como `buyer@example.com` en la otra, y a partir de ahí Claude maneja todo.
3. **Proyecto: Torre Volumen 3, unidades nuevas `7A`…`7E`**, con precio mayor a US$ 195.000 para no
   cambiar el "desde" que muestran las cards. El buyer ya es miembro, así que la pantalla "Buy" del
   video (T02) no cambia.

**Al terminar:** la nota de performance **en inglés** y sus capturas van a
`specs/evidencia-m3/3-preprod/`; se actualiza el índice (`specs/evidencia-m3/README.md`, ítem 3) y
la toma T13 del guion del video, porque el portfolio del buyer pasa de 2 a 7 unidades.

## Por qué hace falta

La evidencia del Milestone 3 pide *"screenshots of audit logs/latency confirming <12m median; short
performance note"*. Hoy hay **una sola muestra** en producción (la del 2026-09-11): un solo
`INVITATION_ACCEPTED` en toda la base, verificado con SELECT el 2026-09-21. Una mediana de n=1 no
sostiene nada. La prueba de volumen no aporta muestras: recorrió etapas, no compras.

## Qué dice exactamente el criterio, y cómo se va a reportar

> *"UI flows function end-to-end in pre-prod; median time from reservation to escrow creation <12
> minutes; audit logs persisted."* — `docs/milestone-3-implementacion/Milestone-3-info.md`

"Escrow" es el contrato creado y anclado, nunca fondos retenidos (D-021). **La medición va desde
que el investor acepta la invitación hasta que el TXID del contrato entra en un bloque**
(`specs/archive/DECISIONS-hasta-2026-08-23.md:319`, confirmada por el dueño el 2026-09-21). Es lo
que mide `GET /audit-logs/telemetry/reservation-to-escrow` (`blockTimestamp - createdAt` del
`INVITATION_ACCEPTED`, SPEC-214).

## El procedimiento

**Cuántas:** 5 muestras como mínimo. **Dónde:** producción
(`propnexus-web.onrender.com`, Cardano Preprod). **Quién maneja:** la extensión de Claude en Chrome,
en dos pestañas (developer y buyer), igual que el guion del video (§2.3).

**Sobre qué proyecto:** `Torre Volumen 3`, con unidades creadas para la prueba (`7A`…`7E`), así no
se toca ninguna existente.

Por cada muestra, `i` de 1 a 5:

1. **[DEV]** `/developer/project/:id/units` → "Add unit" → `7A`…`7E` (piso 7, m² cualquiera, precio
   mayor a US$ 195.000).
2. **[DEV]** `/developer/project/:id/invite` → email `buyer@example.com`, unidad de la muestra, monto →
   enviar.
3. **[INV]** campana → `/investor/notifications` → abrir la invitación de la unidad → **Aceptar**.
4. Esperar a que el anclaje confirme: en `/investor/unit/<unidad>` la novedad pasa de "Pendiente" a
   confirmada, sola, sin recargar (la pantalla consulta cada 10 s mientras haya algo pendiente).
5. Pasar a la siguiente. No hace falta esperar entre muestras.

## Qué se captura

1. **El audit log** — `/developer/audit-log` del developer, filtrado para que se vean los
   `CREATE_INVITATION` y `ACCEPT_INVITATION` de las 5 muestras con sus TXID. Es el *"screenshots of
   audit logs"* del criterio, y de paso muestra que los logs persisten.
2. **Un TXID en el explorador** — el TxidModal → "View in explorer", con la hora del bloque visible
   en cardanoscan (preprod).
3. **La telemetría** — `GET /audit-logs/telemetry/reservation-to-escrow` (admin; no tiene pantalla).
   Se guarda la respuesta JSON como archivo, con `sampleSize`, `medianMinutes` y
   `withBlockTimestampCount`.
4. **Los dos instantes por muestra**, para la tabla de la nota. Solo lectura contra Turso:

```sql
SELECT i.id, e.createdAt AS aceptada, e.blockTimestamp AS en_bloque, e.txid
FROM Invitation i
JOIN OnChainEvent e ON e.referenceId = i.id AND e.eventType = 'INVITATION_ACCEPTED'
WHERE e.status = 'Confirmed'
ORDER BY i.createdAt;
```

## Qué deja en producción

5 unidades vendidas, 5 contratos y 5 transacciones en Preprod (ADA de testnet, sin valor real).
Todo queda en el audit log. No se borra nada después: es la evidencia.
