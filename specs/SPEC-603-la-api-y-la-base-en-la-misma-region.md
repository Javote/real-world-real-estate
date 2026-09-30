# SPEC-603 — La API y la base en la misma región

> Serie `6xx`, refactor post-M3 ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).
> **No es mandato hasta entregar M3.** Nivel 🟡: deploy e infra. **Es la spec más barata de la
> serie y la de mayor efecto por unidad de trabajo**: no cambia código de la app.

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

Una de dos, **a elegir por el dueño**. Las dos terminan en el mismo lugar:

| | Qué | Costo | Riesgo |
|---|---|---|---|
| **A** | Mover `propnexus-api` a `region: virginia` (la región de Render más cerca de us-east-1) | Render no migra un servicio de región: hay que **crear uno nuevo** y cambiar `VITE_API_ORIGIN` / `WEB_ORIGIN`. La URL de la API cambia, y la cita el material de la entrega (OpenAPI, Postman, video) | Bajo. La base no se toca |
| **B** | Crear la base Turso en una región del oeste y migrar los datos | `turso db create --from-dump` o equivalente, más cambiar `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | **Medio.** Es la base de producción, con los 180 eventos anclados de la prueba de volumen: un error pierde registro que la cadena sí tiene |

**Recomendación: A**, hecha después de la entrega de M3, para no cambiar una URL que la evidencia
cita. Si el cambio de URL molesta, se evalúa un dominio propio en ese momento; la decisión no entra
en esta spec.

## Invariantes

1. **Ni un dato se pierde ni se duplica.** Con A no se toca la base. Con B, antes de cortar: conteo
   por tabla de origen contra destino, y `OnChainEvent` fila por fila.
2. **`CARDANO_NETWORK=Preprod`** y el resto de `render.yaml` quedan iguales (D-013).
   `apps/api/test/render-config.test.ts` sigue en verde.
3. **Rollback escrito antes de cortar**: con A, el servicio viejo sigue vivo hasta verificar el
   nuevo. Con B, la base vieja no se borra en la misma sesión.

## Verificación

Repetir la medición de arriba después del cambio, con el mismo comando (6 × `/health` contra 6 ×
404, en caliente). **Éxito:** la diferencia de medianas baja de ~100 ms a un dígito o pocas decenas.
El número medido va a esta spec y a `specs/RUNBOOK-deploy.md`.

## Qué se toca en el mismo commit

`render.yaml`, `specs/RUNBOOK-deploy.md` y `specs/stack.md` (la región). La memoria de
infraestructura desplegada del agente se actualiza aparte.
