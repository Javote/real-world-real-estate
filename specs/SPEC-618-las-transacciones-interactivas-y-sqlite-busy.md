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

## Paso 2 — sacar las transacciones interactivas

| Ruta | Arreglo |
|---|---|
| Portada del proyecto | `enLote` |
| Crear proyecto (developer) | `enLote` |
| Subir evidencia | `enLote` |
| Aceptar invitación de certifier | UPDATE condicional con `RETURNING`: sin fila, 409; con fila, el INSERT del miembro en lote con el audit |
| Liberar pago | un solo `INSERT … SELECT … WHERE <suma> + <monto> <= <total>`: la regla queda en la sentencia y no hay ventana entre leer y escribir |
| Aceptar invitación del investor | dos UPDATE condicionales en orden; si el segundo pierde, se compensa el primero. Si la compensación no cierra, queda como **la única transacción**, con reintento ante `SQLITE_BUSY` |

## Paso 3 — que no vuelva

- **Un test de concurrencia por ruta que escribe con una condición**: dos pedidos a la vez, un
  ganador, ningún 500.
- **La regla de `apps/api/CLAUDE.md`** que hoy cubre los reclamos ("un reclamo es una sola escritura
  condicional, nunca un `db.transaction()`") se extiende a toda escritura: `db.transaction()` solo con
  su motivo escrito al lado.

## Invariantes

1. **Ni una respuesta cambia** en el camino feliz ni en los rechazos que ya existen (404, 409): los
   tests de cada ruta pasan sin cambiar expectativas.
2. **Ninguna escritura queda a medias**: lo que hoy es atómico por la transacción sigue siéndolo por el
   lote o por la sentencia.
3. La cobertura de `apps/api` no baja.

## Verificación

El test del paso 1 contra Turso (resultado anotado acá), los tests de concurrencia del paso 3,
`pnpm verify:all` y `pnpm e2e` completo.
