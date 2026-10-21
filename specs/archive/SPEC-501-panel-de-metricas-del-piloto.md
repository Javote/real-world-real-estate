# SPEC-501 — Panel de métricas del piloto

> Milestone 4, criterio 1 del SOM (ver [`ESTADO-2026-09-22-catalyst-milestone-4.md`](ESTADO-2026-09-22-catalyst-milestone-4.md)).
>
> **Cerrada 2026-10-21.** `GET /admin/pilot-metrics` en `apps/api/src/modules/metricas/`, la sección
> `ADMIN-PILOT-METRICS-005` en `apps/web/src/routes/admin.index.tsx`; los casos borde son
> `apps/api/test/spec-501-metricas-del-piloto.test.ts` y `apps/web/src/routes/-admin.index.test.tsx`.

## Propósito

M4 exige reportar, con evidencia, ocho números agregados sobre los pilotos reales: contratos
firmados, evidence bundles hasheados, releases, completitud documental, tasa de disputas, NPS,
wallets únicas y valor total declarado. Siete de esos ocho ya son una consulta sobre tablas que
existen; hoy no hay ningún endpoint ni pantalla que los junte. Sin este panel, armar la evidencia
del milestone es escribir un script ad-hoc a mano cada vez — exactamente el patrón que
`docs:openapi`/`docs:api` ya evitan para la documentación de rutas.

## Alcance / NO-alcance

- **Cubre:** un endpoint admin-only (`GET /admin/pilot-metrics`) que agrega, por proyecto y total,
  los ocho números del criterio 1, con su fórmula explícita. Cubre también la superficie mínima para
  verlos (una pantalla o una sección de `/admin`, ya existente desde D-095/SPEC-221).
- **NO cubre:** la definición de "disputa" (`SPEC-502`), de "completitud documental" (`SPEC-504`) ni
  de NPS (`SPEC-503`) — este panel **consume** esas tres fuentes, no las define. No cubre el reporte
  final en PDF/CSV para Catalyst (eso es armado de evidencia, no código).

## Interfaz

```
GET /admin/pilot-metrics?projectIds=<csv opcional>
```

| Campo de la respuesta | Fórmula | Fuente |
|---|---|---|
| `signedContractsCount` | `count(Contract) where signedAt is not null` | `Contract` |
| `evidenceBundlesCount` | `count(EvidenceBundle)` | `EvidenceBundle` |
| `releasesCount` | `count(PaymentAttestation)` | `PaymentAttestation` |
| `uniqueWalletsCount` | wallets CIP-30 distintas que firmaron al menos una transacción anclada — **no** `count(distinct User.id)`, que cuenta cuentas, no wallets | `OnChainEvent` (requiere sumar la dirección firmante al evento; ver Preguntas abiertas) |
| `declaredValueTotal` | `sum(Contract.totalMinorUnits)` convertido a la unidad de reporte, agrupado por `currency` antes de sumar | `Contract` |
| `documentCompletenessRate` | delega en `SPEC-504` | `SPEC-504` |
| `disputeRate` | delega en `SPEC-502` | `SPEC-502` |
| `npsScore` | delega en `SPEC-503` | `SPEC-503` |

## Invariantes

- El endpoint es **admin-only** (`authorize({ roles: ["admin"], acceso: "soloRol" })`) — son números
  de negocio agregados de todos los proyectos, no algo que un developer/investor deba ver.
- Cada número se calcula, nunca se guarda — no hay tabla de métricas cacheadas ni cron. Si el cálculo
  es caro (todos lo son, sobre una base de piloto de pocos miles de filas), se mide antes de decidir
  que hace falta caché.
- `declaredValueTotal` nunca mezcla monedas sin decirlo: la respuesta lleva un desglose por
  `currency` además del total, para que "sumar antes de convertir" sea una decisión visible del
  cliente del endpoint, no un hecho escondido en un número único.

## Casos borde (definen los tests)

- Sin filtro de `projectIds`: agrega **todos** los proyectos (admin ve el total global).
- Un proyecto sin ningún contrato firmado: cuenta 0, no error.
- Dos contratos en monedas distintas: el desglose por moneda no los suma entre sí; el total
  "convertido" (si se implementa la conversión) declara la tasa usada y su fecha.
- Un usuario no-admin pide el endpoint: 403, antes de tocar cualquier query (mismo patrón que el
  resto de `/admin`).

## Lo que quedó decidido al implementar

- **La respuesta es `{ total, perProject }`**: `perProject` trae los ocho números de cada proyecto
  del filtro (o de todos), ordenados por nombre, y `total` se calcula **aparte** con el mismo
  filtro, no sumando los proyectos: una tasa no se suma.
- **`uniqueWalletsCount` es siempre `null`, y el schema lo fija así** (`z.null()`). Hoy toda
  transacción la firma la wallet de servicio (D-078) y `OnChainEvent` no guarda quién firmó; contar
  `User.id` contaría cuentas, no wallets, y la regla 17 no deja reportar un número que no se puede
  sustanciar. El día que haya firmantes propios (co-firma CIP-30, D-009), se suma la columna del
  firmante al evento y el schema pasa a `number`. La sección de `/admin` lo dice: *"No se mide"*.
- **Sin conversión de moneda**: `declaredValueByCurrency` desglosa la suma de `Contract.totalMinorUnits`
  por `currency`, sin total convertido. Convertir pide una tasa y su fecha, y eso es armado del
  reporte, no dominio. Si los pilotos firman en USDM, entra como una moneda más (`Contract.currency`
  es un string, `SPEC-402`).
- **Las tres métricas delegadas se reusan, no se reescriben**: `completitud` (`SPEC-504`),
  `tasaDeDisputas` (`SPEC-502`) y el `resumen` del NPS (`SPEC-503`), con el mismo filtro de
  proyectos. El NPS viaja entero (`nps`), con su `belowMinimum`, en vez de un `npsScore` suelto: un
  score sin su tamaño de muestra es lo que la regla 17 prohíbe.
- **Sin caché ni tabla**: son seis consultas por proyecto más las del total, en paralelo. Con los
  pilotos de M4 (dos o tres proyectos) no hay nada que medir todavía.
- **La superficie es una sección de `/admin`** (dueño, 2026-10-21, D-104), `ADMIN-PILOT-METRICS-005`,
  con ocho `StatCard` del total. Sin dato, la raya de `panel.emptyValue`, nunca un 0.
