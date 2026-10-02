# SPEC-616 — A4 + W4: el resto, un módulo de la API con las pantallas de su rol

> Fase 2, pasos A4 y W4 ([`SPEC-611`](SPEC-611-la-migracion-fase-2.md)); el estado, en
> [`specs/README.md`](README.md). Nivel 🟡 en `evidence`, `stage` y `project` (tocan la cadena); 🟢
> en el resto. **Arranca cuando el piloto ([`SPEC-615`](SPEC-615-el-piloto-dossier.md)) está
> aprobado**, y cada módulo repite su forma y su definición de terminado. Lo que el piloto enseñe
> se escribe acá antes del primer módulo.

## El orden

**API, de lo más simple a lo más acoplado a la cadena:**

| # | Módulo | Viene de |
|---|---|---|
| 1 | `notification` | `notifications.routes.ts`, `domain/notify.ts` |
| 2 | `profile` · `user` · `auth` | `profile.routes.ts`, `users.routes.ts`, `auth.routes.ts` |
| 3 | `unit` · `invitation` · `contract` · `payment` | `investor.routes.ts` (6 conceptos en un archivo), `developer-comercial.routes.ts`, `contracts.routes.ts`, `capital.routes.ts`, `domain/certifier-invitation.ts` |
| 4 | `evidence` | `evidence.routes.ts`, `developer-evidencia.routes.ts`, la subida multipart (sigue en Express, D-102) |
| 5 | `stage` | `stages.routes.ts`, `certifier.routes.ts`, `domain/stage-transition.ts`, `domain/reconcile.ts` |
| 6 | `project` | `projects.routes.ts`, `projects-obra.routes.ts`, `project-cover.routes.ts`, `developer.routes.ts`, `domain/project-aggregates.ts` |
| 7 | `audit` | `audit.routes.ts` |

Un módulo por commit, o por una serie corta. Los archivos se nombran **por concepto, no por
prefijo de path** (la regla de `SPEC-015` §6 que traía
[`SPEC-608`](archive/SPEC-608-los-archivos-por-concepto.md)): un concepto no importa los
procedimientos de otro; lo compartido va a su `rules.ts` o `queries.ts`. Las lecturas repetidas que
[`SPEC-604`](archive/SPEC-604-la-capa-de-datos-sale-de-los-routers.md) quería sacar (`Stage`: 20
queries en 10 routers) quedan en el `queries.ts` de su módulo.

**Web, por rol:** `certifier` → `investor` → `developer` → `admin`. Las pantallas de un rol se
migran cuando los módulos de la API que leen ya están migrados.

## Lo que entra en cada paso, además de la forma

**El `error` de cada pantalla.** De las 27 rutas que hoy dibujan una consulta fallida como su estado
vacío (auditoría §9), las que no son del piloto: `certifier.issued`; de `developer`: `audit-log`,
`capital`, `documentation`, `index`, `investors`, `progress`, `project.$projectId.contracts`,
`project.$projectId.index`, `projects`, `units`; de `investor`: `buy`, `favorites`, `notifications`,
`unit.$unitId.contract`, `unit.$unitId.index`, `unit.$unitId.notifications`, `units`; de
`project.$projectId`: `developer`, `index`, `progress`, `stage.$stageId`. **Ninguna pantalla con
datos termina W4 sin su `errorComponent`** (dueño, 2026-10-02).

**Endpoints de pantalla, solo donde hay cascada dependiente.** El primero: el detalle de unidad del
investor (`investor.unit.$unitId.index`), que hace 7 queries en dos olas porque la segunda espera el
`projectId` de la primera. Si las queries son independientes, los loaders las disparan en paralelo y
no hace falta endpoint. Un path nuevo sale de M2-D5 o de una decisión.

**El audit lee el TXID del `OnChainEvent`.** Con el audit escrito en la transacción, antes de que
exista el TXID (auditoría §2.3), la pantalla de audit deja de leerlo de `AuditLog.metadata.txid` y lo
busca en el `OnChainEvent` de la misma referencia. El join ya existe (`conTxidDeLaTransicion`, en
`developer.routes.ts`) y pasa a ser el único camino. Va con el módulo `audit` (7).

**Dos bugs de UX vistos grabando el video, cada uno con su pantalla:**

| Bug | Pantalla | Qué pide |
|---|---|---|
| El "Certify" de la cola del certifier navega a `/certifier/stage/:id` en vez de certificar (`AssignedStagesQueue.tsx`) | `certifier` | Que el botón diga lo que hace. Si cambia el texto, sale del diccionario y de M2-D3 |
| El chip *Evidence by stage* del investor solo se activa con el `txid` de la transición a `Completed` (`StageChips.tsx`, `investor.routes.ts`): una etapa `InProgress` con evidencia ya anclada queda deshabilitada | `investor` | **Decisión del dueño:** si el chip se activa con el anclaje de la evidencia |

**Una decisión de UX para el developer:** crear un proyecto tarda 18,5 s en Preprod (los 10 mints,
ya sin `awaitTx`). Decidir si hace falta UI de espera antes de migrar `developer.project.new`.

## Cuándo está terminado cada módulo

La misma lista que el piloto (`SPEC-615` §Cuándo está terminado): el arnés sin cambios, el router sin
`db`, los GET sin escrituras, las pantallas sin `enabled`/`return null`/`ApiError` a mano y con su
`errorComponent`, la `MATRIZ` intacta, cero comentarios con fecha, `pnpm verify:all` y el e2e del
rol en verde. **Al cerrar cada rol, `pnpm e2e` completo.**
