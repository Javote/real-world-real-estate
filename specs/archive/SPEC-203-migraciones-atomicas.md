# SPEC-203 — Una migración que se corta a la mitad tiene que poder volver

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md) §B-03.
> Nivel 🟡 — toca el runner de migraciones. **Independiente.** No toca ningún criterio del SOM.
> **Es una línea**, y el modo de falla que evita deja la API abajo sin shell para diagnosticar.

## El problema, en una frase

`applyPendingMigrations` (`db/migrate.ts:69`) aplica los statements de cada archivo **uno por uno** y
escribe la fila en `_migrations` recién cuando terminaron todos:

```ts
for (const statement of statements) {
  await client.execute(statement);
}
await client.execute({ sql: "INSERT INTO _migrations …" });
```

`0000_init.sql` tiene **43 statements**. Si el número 20 falla —un corte contra Turso, un timeout, un
deploy que se reinicia— los 19 anteriores ya están aplicados y el archivo **sigue figurando como
pendiente**. El próximo arranque vuelve a empezar por `CREATE TABLE User` y muere con *table already
exists*. **Para siempre, sin intervención manual.**

El docstring dice *"Idempotente: re-ejecutarla no duplica efectos (regla 8)"*. Lo es **por archivo**,
no por statement, y la diferencia solo se nota el día que falla.

## Por qué importa más acá que en otro repo

Corre en el `startCommand` de Render, **en un free tier que no da shell** (D-040) — que es la razón
declarada de media docena de decisiones de este código, incluida la línea `[arranque] migraciones
listas` que existe justamente para distinguir estos dos casos desde los logs. Un esquema a medio
aplicar ahí no se arregla: se reconstruye.

## Qué se cambia

```ts
await client.batch(statements, "write");
```

`@libsql/client` lo corre **transaccional**, SQLite soporta DDL transaccional, y reemplaza el `for`
por una línea. La fila de `_migrations` entra en el mismo batch, o inmediatamente después con el
esquema ya garantizado.

Las migraciones de datos (0004, 0005) son de un solo statement y **ya están cubiertas** por sus
propias guardas de idempotencia: no cambian.

## Invariantes

1. **Un archivo de migración se aplica entero o no se aplica.** No existe el estado "19 de 43".
2. **`_migrations` no miente**: si el archivo figura aplicado, sus 43 statements corrieron.
3. El techo de tiempo de la migración (el que se agregó tras el cuelgue del 2026-09-04) **sigue
   cubriendo la operación entera**, `batch` incluido.
4. Re-ejecutar el runner no duplica efectos (regla 8), ahora también por statement.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| El statement N de un archivo falla | **cero** statements de ese archivo quedan aplicados; el arranque falla con el error real en el log |
| Reintento después de esa falla | el archivo se aplica limpio desde cero |
| Archivo ya aplicado | se saltea, como hoy |
| Dos instancias arrancando a la vez | no queda esquema a medias (era lo que el `for` no garantizaba) |
| El batch excede el techo de tiempo | falla con el timeout existente, no cuelga |

## Verificación

Un test que inyecte un statement inválido en el medio de un archivo temporal y afirme que la base
quedó **sin ninguna** de las tablas de ese archivo.
