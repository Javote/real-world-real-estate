# SPEC-618 — Las transacciones interactivas y `SQLITE_BUSY`

> Fuera de la Fase 2 y antes que A3 (dueño, 2026-10-07): es lo único de lo que encontró A1 que puede
> romper algo en producción hoy. El estado, en [`specs/README.md`](README.md). Nivel 🟡: toca
> escrituras de seis rutas. Nace en [`SPEC-613`](SPEC-613-los-cimientos-de-los-modulos.md) §A1.

## Lo que hay hoy, medido el 2026-10-07

Con cinco `db.transaction()` simultáneas sobre la misma base libSQL local, las que pierden no
esperan: tiran `SQLITE_BUSY: database is locked`. Lo encontró el test de `anclarConReclamo`, que por
eso quedó como una sola escritura condicional. **No se midió contra Turso.**

Seis rutas usan hoy una transacción interactiva, y cada una puede dar 500 si le llegan dos pedidos a
la vez:

| Ruta | Archivo | Qué hace adentro |
|---|---|---|
| Portada del proyecto | `project-cover.routes.ts` | INSERT `ProjectCover` + UPDATE `Project` |
| Crear proyecto (developer) | `developer.routes.ts` | INSERT `Project` + `ProjectMember` |
| Subir evidencia | `developer-evidencia.routes.ts` | INSERT de cada `Evidence` |
| Aceptar invitación de certifier | `certifier.routes.ts` | lee la invitación, UPDATE si sigue `pending`, INSERT del miembro |
| Liberar pago | `developer-comercial.routes.ts` | suma lo liberado y después inserta la `PaymentAttestation` |
| Aceptar invitación del investor | `investor.routes.ts` | invitación `pending` + unidad disponible, y lo que sigue |

Además del riesgo, una transacción interactiva sobre Turso cuesta un viaje por sentencia más el
COMMIT (`apps/api/CLAUDE.md`, `enLote`).

## Paso 1 — medir contra Turso

Los mismos cinco reclamos simultáneos del test, contra una **base Turso de prueba** (una rama de la de
producción con el CLI de Turso, o una base nueva), **nunca contra la de producción**. Se anota qué
pasa:

- si falla igual, el riesgo es de producción y este paso va primero de todo;
- si Turso encola las escrituras, es de la base local y de los tests, y el paso 2 sigue valiendo por
  el costo de los viajes.

La base de prueba se borra al terminar (lo que se enciende, se apaga).

### Medido el 2026-10-07

Un script descartable con Kysely y el mismo adaptador de la API (`supportsMultipleConnections`, sin el
mutex global): N `db.transaction()` simultáneas que leen una fila, la reclaman si sigue libre y la
escriben. Sin el adaptador de la API, Kysely las pone en fila y no se reproduce nada.

| Base | Resultado |
|---|---|
| libSQL local (archivo) | En cada ronda, una gana y las otras cuatro tiran `SQLITE_BUSY`, con o sin pausa entre leer y escribir |
| Turso (`propnexus-prueba-618`, grupo `propnexus`, `aws-us-west-2`) | **Encola**: en 10 rondas de 5, siempre una gana y cuatro ven la fila tomada; ningún `SQLITE_BUSY`. Cada ronda tarda 1,8–3,9 s desde Buenos Aires, porque las cinco se serializan y cada una son varios viajes |

**El riesgo no es de producción: es de la base local y de los tests.** El Paso 2 sigue valiendo por
el costo de los viajes: sobre Turso, una transacción interactiva retiene la escritura durante todos
sus viajes, y las otras esperan.

**Además, en la base local un `SQLITE_BUSY` deja el cliente roto**: después de la carrera, un INSERT
del mismo cliente lo ve ese cliente pero no otro, y al cerrar se pierde. Su conexión queda adentro de
una transacción que nunca se confirma. En Turso, lo mismo no pierde nada. Toca a dev y a los tests:
una carrera en un test puede hacer desaparecer escrituras posteriores del mismo proceso.

**La base de prueba no se pudo borrar**: el grupo `propnexus` (el de producción) está protegido
contra borrado. Está vacía. Borrarla pide sacarle la protección al grupo, y eso lo decide el dueño.

## Paso 2 — sacar las transacciones interactivas

| Ruta | Arreglo |
|---|---|
| Portada del proyecto | `enLote` |
| Crear proyecto (developer) | `enLote` |
| Subir evidencia | `enLote` |
| Aceptar invitación de certifier | UPDATE condicional con `RETURNING`: sin fila, 409; con fila, el INSERT del miembro en lote con el audit |
| Liberar pago | un solo `INSERT … SELECT … WHERE <suma> + <monto> <= <total>`: la regla queda en la sentencia y no hay ventana entre leer y escribir |
| Aceptar invitación del investor | dos UPDATE condicionales en orden; si el segundo pierde, se compensa el primero. Si la compensación no cierra, queda como **la única transacción**, con reintento ante `SQLITE_BUSY` |

### Hecho el 2026-10-07

Ninguna ruta usa ya una transacción interactiva. Donde la spec pedía una compensación (aceptar la
invitación del investor) y un UPDATE seguido de un lote aparte (la del certifier), las dos quedaban a
medias si fallaba el segundo viaje. Por eso van en **un solo lote** que se condiciona por dentro:
`changes()` es el de la sentencia anterior del lote, probado en libSQL local y en Turso (cinco lotes
simultáneos: uno escribe, ningún error).

| Ruta | Cómo quedó |
|---|---|
| Portada del proyecto | `enLote(upsert de ProjectCover, UPDATE de Project)` |
| Crear proyecto (developer) | `enLote` de los tres INSERT, con el id del proyecto generado antes |
| Subir evidencia | un solo INSERT de varias filas |
| Responder la invitación de certifier | un lote: UPDATE `WHERE status = 'pending'`; el audit, `INSERT … SELECT … WHERE changes() = 1`; al aceptar, el miembro, `WHERE EXISTS` del audit por su id. Sin fila reclamada, 409 con el estado leído después |
| Liberar pago | una sola sentencia: `INSERT … SELECT … WHERE <suma> + <monto> <= <total> ON CONFLICT (contractId, stageNumber) DO NOTHING`. Sin fila: si la etapa ya tenía liberación, 200 con esa; si no, 409 `RELEASE_EXCEEDS_CONTRACT` |
| Aceptar la invitación del investor | un lote: UPDATE de la invitación `WHERE pending` y sin unidad vendida ni contrato; el contrato, `WHERE changes() = 1`; la unidad vendida y la membresía, `WHERE EXISTS` del contrato por su id. Sin fila reclamada, el mismo 409 de antes, con la misma precedencia |

No quedó ninguna transacción "con reintento": no hizo falta.

## Paso 3 — que no vuelva

- **Un test de concurrencia por ruta que escribe con una condición**: dos pedidos a la vez, un
  ganador, ningún 500.
- **La regla de `apps/api/CLAUDE.md`** que hoy cubre los reclamos ("un reclamo es una sola escritura
  condicional, nunca un `db.transaction()`") se extiende a toda escritura: `db.transaction()` solo con
  su motivo escrito al lado.

**Hecho el 2026-10-07:** dos liberaciones de la misma etapa a la vez (201 y 200, una fila), dos que
juntas pasan el total (201 y 409, la suma no se pasa) en `developer-comercial-routes-coverage.test.ts`;
dos respuestas a la misma invitación de certifier (`spec-618-invitacion-certifier-concurrente.test.ts`);
la del investor ya existía (`accept-invitation-atomic.test.ts`). Con las transacciones de antes, en
local, la que perdía era un 500. La regla está en `apps/api/CLAUDE.md` y la fija
`sin-transacciones-interactivas.test.ts`, probado en rojo con la portada vieja. Los tests que
simulaban una caída con `spyOn(db, "transaction")` ahora hacen fallar el lote o el INSERT de verdad;
el de la portada verifica además que el upsert se deshace con el lote.

## Invariantes

1. **Ni una respuesta cambia** en el camino feliz ni en los rechazos que ya existen (404, 409): los
   tests de cada ruta pasan sin cambiar expectativas.
2. **Ninguna escritura queda a medias**: lo que hoy es atómico por la transacción sigue siéndolo por el
   lote o por la sentencia.
3. La cobertura de `apps/api` no baja.

## Verificación

El test del paso 1 contra Turso (resultado anotado acá), los tests de concurrencia del paso 3,
`pnpm verify:all` y `pnpm e2e` completo.
