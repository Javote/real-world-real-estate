# SPEC-501 — Panel de métricas del piloto

> Milestone 4, criterio 1 del SOM (ver [`ESTADO-2026-09-22-catalyst-milestone-4.md`](ESTADO-2026-09-22-catalyst-milestone-4.md)).

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

## Preguntas abiertas

- **¿Qué es una "wallet única"?** Hoy `OnChainEvent` no guarda qué dirección firmó — sabe el
  `txid` y el `stageId`, no el signer. Antes de construir `uniqueWalletsCount` hay que decidir si se
  suma esa columna (cambia el shape del evento, no el validador) o si "wallet" se aproxima con
  `User.id` de quien disparó la acción (más simple, pero no es lo que el criterio pide — un
  developer puede operar con la misma cuenta y distintas wallets CIP-30 entre sesiones).
- **¿"≥800.000 USDM" es una conversión de reporte o un pedido de denominar los contratos reales en
  USDM?** Ver `ESTADO-2026-09-22-catalyst-milestone-4.md` §Nota sobre "simulated escrow value" y
  "USDM". Si es lo segundo, `Contract.currency` necesita aceptar `"USDM"` como valor válido — hoy es
  un `string` libre (deuda ya señalada por `SPEC-402`), así que no hace falta migración, solo que los
  pilotos reales lo declaren así al firmar.
