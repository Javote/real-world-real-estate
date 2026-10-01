# SPEC-603 — La API y la base en la misma región

> Serie `6xx`, refactor post-M3 ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).
> Adelantada a la Fase 1 (ítem 6 de [`specs/README.md`](README.md), que lleva su estado). Nivel 🟡:
> deploy e infra. No cambia código de la app.

## Lo que hay hoy, medido el 2026-09-30

- `render.yaml`: `propnexus-api` con `region: oregon`.
- Turso: la base `propnexus` vive en **AWS us-east-1** (`libsql://propnexus-javote.aws-us-east-1.turso.io`).
- Contra producción, 6 muestras de cada una en caliente:

| Request | Mediana | Rango |
|---|---|---|
| `GET /api/v1/no-existe` (404, no toca la base) | ~0.28 s | 0.26–0.32 s |
| `GET /health` (`SELECT 1` contra Turso) | ~0.40 s | 0.35–0.87 s |

  **Cada viaje a la base cuesta ~90–120 ms**, y cada request autenticada hace al menos uno
  (`authenticate` relee `User`) más los del handler. Del login a la primera pantalla hay ~6 en
  serie: **más de medio segundo solo en cruzar el continente.**
- **Arranque en frío:** la primera request con el servicio dormido tardó **95.9 s**. No lo resuelve
  esta spec (es el free tier, D-040), pero se anota porque ningún otro número de la serie se le
  acerca.

## Alcance

Dos caminos llegan al mismo lugar:

| | Qué | Costo | Riesgo |
|---|---|---|---|
| A | Mover `propnexus-api` a `region: virginia` | Render no migra un servicio de región: hay que **crear uno nuevo**, y la URL de la API cambia. La citan el README, la evidencia de M3 (OpenAPI, Postman, video) y los scripts del walkthrough | Bajo. La base no se toca |
| **B** | **Llevar la base a Turso `aws-us-west-2` (Oregon)**, al lado de Render | Una base nueva en un grupo nuevo, cargada con un dump, y cambiar `DATABASE_URL` / `DATABASE_AUTH_TOKEN` en el dashboard | Medio en teoría; la base pesa 590 kB y la copia se verifica byte a byte |

**Decisión del dueño (2026-10-01): B.** No cambia ninguna URL pública, así que se puede hacer antes
de entregar M3 sin tocar la evidencia.

## Los recursos en Turso

| Recurso Turso | Dónde | Delete protection |
|---|---|---|
| Base `propnexus` — **producción**, a la que apunta Render | grupo `default`, `aws-us-east-1` | sí |
| Base `propnexus-west` — `libsql://propnexus-west-javote.aws-us-west-2.turso.io` | grupo `propnexus`, `aws-us-west-2` | sí |

`propnexus-west` se cargó el 2026-10-01 y su `.dump` fue **idéntico byte a byte** al de producción
(1.300 líneas, 971 `INSERT`, 22 tablas, `integrity_check` ok en las dos). Desde entonces queda vieja
con cada escritura de producción: **antes del corte se recarga.** Backup verificado de ese día, fuera
del repo: `~/Backups/propnexus/2026-10-01_1716/` (`.db` + `.db-wal` de `turso db export`, y `.sql`).

## El corte

1. Backup nuevo de producción (`turso db shell propnexus .dump` y `turso db export`).
2. Recargar `propnexus-west` con ese dump (`turso db shell propnexus-west < dump.sql`; antes, vaciar
   sus tablas por SQL — la delete protection no deja destruir la base) y comparar los dos `.dump`
   con `cmp`.
3. Token nuevo, **generado por el dueño en su terminal**: `turso db tokens create propnexus-west`.
4. Dashboard de Render, `propnexus-api`: `DATABASE_URL` y `DATABASE_AUTH_TOKEN`. Redeploya solo.
5. Medir (§Verificación) y comparar otra vez las dos bases.
6. Rollback: volver a las dos variables viejas. La base de Virginia no se borra en la misma sesión.

## Lo que Turso no hace, medido el 2026-10-01

- **`turso db create --from-db` no copia entre grupos distintos**: falla con `record not found`.
- **`turso db create --from-dump` creó la base vacía sin error**, con "Uploaded data" en la salida.
  Lo que carga es `turso db shell <base> < dump.sql`.
- **No hay `db rename`**, y los nombres son únicos en toda la organización: la base de Oregon no
  puede llamarse `propnexus` mientras exista la de Virginia. El nombre solo vive en `DATABASE_URL`.
- **`turso plan show` no es confiable**: decía "groups 0/1" y "locations 3/3" con un grupo y una
  ubicación en uso, y el plan starter aceptó el segundo grupo.

## Invariantes

1. **Ni un dato se pierde ni se duplica.** Antes de cortar, los `.dump` de origen y destino son
   idénticos con `cmp`.
2. **`CARDANO_NETWORK=Preprod`** y el resto de `render.yaml` quedan iguales (D-013).
   `apps/api/test/render-config.test.ts` sigue en verde.
3. **Rollback escrito antes de cortar**: la base vieja no se borra en la misma sesión.

## Verificación

Repetir la medición de arriba después del cambio, con el mismo comando (6 × `/health` contra 6 ×
404, en caliente). **Éxito:** la diferencia de medianas baja de ~100 ms a un dígito o pocas decenas.
El número medido va a esta spec y a `specs/RUNBOOK-deploy.md`.

## Qué se toca en el mismo commit

`specs/RUNBOOK-deploy.md` (con su versión en inglés y su PDF), `specs/stack.md` §8 y esta spec.
`render.yaml` no cambia: las dos variables son `sync: false` y viven en el dashboard.
