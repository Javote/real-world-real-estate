# Reporte de tests — 2026-09-21 (actualizado 2026-09-24)

> Evidencia del Milestone 3 de Catalyst: *"Public GitHub repo(s) … with **CI logs, coverage
> report** …"* y *"API docs + **test reports with coverage/outcomes**"*
> (`docs/milestone-3-implementacion/Milestone-3-info.md`, Evidence of milestone completion).
>
> Todos los resultados de coverage salen de la corrida de CI del commit
> [`831d9d8`](https://github.com/Javote/real-world-real-estate/commit/831d9d85042ad83d4fe277d477c619b3b47f5359),
> que cerró [`SPEC-019`](SPEC-019-cobertura-de-apps-web.md): **desde este commit CI mide coverage
> con umbral en las cuatro partes TypeScript** (api, web, shared, cardano), no solo en la API como
> hasta el 2026-09-21.

## La corrida de CI

**[Run 36004503722](https://github.com/Javote/real-world-real-estate/actions/runs/36004503722)**,
2026-09-24 13:16 UTC.

GitHub borra los logs de Actions a los 90 días, así que hay una **copia completa en el repo**:
[`specs/evidencia-m3/1-repo-ci-tests/ci-run-36004503722.log`](evidencia-m3/1-repo-ci-tests/ci-run-36004503722.log). Es el log crudo de
`gh run view 36004503722 --log`, sin los códigos de color. Los únicos secretos que aparecen son
valores de prueba de CI (`JWT_SECRET: ci-secret-jamas-en-produccion`).

| Job | Qué corre | Resultado |
|---|---|---|
| App TS | lint (Biome) · typecheck · trazabilidad de test IDs · **tests + coverage de las cuatro partes TypeScript** (api, web, shared, cardano) · dependency scan · build · smoke test del arranque compilado | ✅ |
| Contratos Aiken | `aiken fmt --check` · `aiken check` · `aiken build` y que `plutus.json` commiteado esté al día | ✅ |
| Static analysis | Semgrep, rulesets `p/security-audit` + `p/owasp-top-ten` | ✅ 128 reglas, 536 archivos, **0 hallazgos** |
| E2E Playwright | la app entera contra una base migrada y sembrada, en mobile (390 px) y desktop (1440 px) — job **no bloqueante** (`continue-on-error`) | ⚠️ intermitente, ver abajo |

## Resultados por paquete

| Paquete | Qué cubre | Tests | Resultado |
|---|---|---|---|
| `contracts/` (Aiken) | el validador on-chain: FSM de la etapa, thread token, reglas de evidencia | 102 (100 unit + 2 property) | ✅ 102/102 |
| `apps/api` | la API: rutas, autorización, anclaje, FSM, migraciones | 712 | ✅ 709 passed · 3 skipped |
| `packages/cardano` | el puerto de anclaje (simulado y real) | 115 | ✅ 115/115 |
| `packages/shared` | el contrato Zod compartido, la FSM, Merkle | 210 | ✅ 210/210 |
| `apps/web` (unit) | componentes, i18n, `ApiPort` contra el OpenAPI | 1.593 | ✅ 1.592 passed · 1 `it.fails` esperado (ver abajo) |
| `apps/web` (E2E) | los flujos de los cuatro roles + admin, en dos viewports | 90 | ⚠️ intermitente, ver abajo |
| **Total (sin E2E)** | | **2.732** | **2.728 passed · 3 skipped · 1 expected fail · 0 failed** |

**Los 3 skipped son a propósito:** son `apps/api/test/storage-s3.test.ts`, que corre contra un S3
real (MinIO). Lo mismo pasa con `packages/cardano/src/yaci.test.ts`, contra un nodo Cardano local,
que el script de tests de ese paquete directamente excluye. CI no levanta esa infraestructura; se
corren a mano con `pnpm --filter @plataforma/api test:s3` y
`pnpm --filter @plataforma/cardano test:yaci`.

**El 1 `it.fails` es a propósito, no una regresión:** fija un bug conocido y sin arreglar de
`LocationMapModal` (`modals-mapa.test.tsx`), documentado en
[`SPEC-019`](SPEC-019-cobertura-de-apps-web.md) §Resultado final y en
[`apps/web/CLAUDE.md`](../apps/web/CLAUDE.md) §Trampas verificadas — falta reproducirlo en el
navegador real antes de decidir si se arregla el componente o el test.

**Desde este reporte, CI mide coverage con umbral en las cuatro partes TypeScript.** Hasta el
2026-09-21 solo cubría la API; web, shared y cardano corrían `test` pelado, sin coverage ni gate —
se cerró en [`SPEC-019`](SPEC-019-cobertura-de-apps-web.md) §Consolidación, en el mismo commit que
esta corrida verifica (`831d9d8`).

## Coverage

| Paquete | Statements | Branches | Funciones | Líneas | Umbral | Fuente |
|---|---|---|---|---|---|---|
| `apps/api` | **100%** (2070/2070) | **100%** (838/838) | **100%** (424/424) | **100%** (1900/1900) | 99/99/99/99 | CI (`pnpm test:coverage`) |
| `apps/web` | **100%** (1955/1955) | **100%** (1854/1854) | **100%** (766/766) | **100%** (1740/1740) | 100/100/100/100 | CI (`pnpm test:coverage`) |
| `packages/shared` | **100%** (247/247) | **100%** (56/56) | **100%** (19/19) | **100%** (231/231) | 100/100/100/100 | CI (`pnpm test:coverage`) |
| `packages/cardano` | **100%** (295/295) | **100%** (149/149) | **100%** (90/90) | **100%** (273/273) | 95/95/95/95 | CI (`pnpm test:coverage`) |

**Las cuatro partes TypeScript miden 100% en las cuatro métricas, todo medido en CI** (antes tres de
cuatro se medían local, sin umbral que fallara el build). El criterio 2 del SOM —*"unit tests ≥95%
coverage"*, releído por el dueño el 2026-09-21 como de toda la app— cierra ✅. El detalle de cómo se
llegó ahí, archivo por archivo, está en [`SPEC-017`](SPEC-017-cobertura-95-en-toda-la-app.md)
(shared, cardano), [`SPEC-018`](SPEC-018-cobertura-de-apps-api.md) (api) y
[`SPEC-019`](SPEC-019-cobertura-de-apps-web.md) (web + esta consolidación).

**Los contratos (`contracts/`) no tienen porcentaje de líneas**: Aiken no mide coverage de líneas.
La evidencia de cobertura del validador es la tabla *punto de rechazo → test que lo ejercita* de
[`contracts/CLAUDE.md`](../contracts/CLAUDE.md): cada condición por la que el validador rechaza una
transacción tiene al menos un test que la dispara.

## Seguridad en la misma corrida

- **Semgrep**: 0 hallazgos (ver arriba).
- **Dependency scan (`pnpm audit`)**: 0 críticas, que es el umbral que bloquea el build. El reporte
  completo lista 12 (4 altas, 8 moderadas), **todas en herramientas de build y de test**, ninguna
  en lo que corre en producción: `vitest` y sus dependencias (`undici`, `nanoid`, `postcss`,
  `@vitest/mocker`) y la cadena de `@tanstack/router-plugin` (`browserslist`,
  `baseline-browser-mapping`). El triage está en
  [`SECURITY-REVIEW-2026-09.md`](SECURITY-REVIEW-2026-09.md).

## El E2E, intermitente bajo carga de CI (no bloqueante)

Job separado y explícitamente **no bloqueante** (`continue-on-error: true` en `ci.yml`) desde antes
de este cierre — la pregunta de cuándo volverlo bloqueante es de `SPEC-015` §5, no de este ítem.
Corriendo esta misma suite dos veces sobre el mismo commit (`831d9d8`): la primera vez fallaron 4 de
90 (86 passed), la segunda 5 de 90 (85 passed), con **tests distintos** cayendo cada vez
(`admin-certifier-invite`, `panels-DEV-INVESTORS-LIST`, y en la segunda corrida también
`walkthrough-Walkthrough`) — todos por timeout de Playwright (`Test timeout of 30000ms exceeded` /
`expect(locator).toBeVisible() failed`), no por un assert de negocio equivocado. Es contención de
recursos del runner compartido de GitHub Actions (dos navegadores, mobile y desktop, corriendo la
app entera), no una regresión de este commit: ninguno de los cambios de `SPEC-019` toca `e2e/` ni el
código que esos specs ejercitan. **Localmente, sobre el mismo código, la suite corre completa**
(criterio de cierre de `SPEC-019` verificado con `pnpm verify:all` en verde antes de este push).

## Un test intermitente, declarado

Al preparar el reporte del 2026-09-21, una de tres corridas locales de `pnpm test:coverage` falló en
`apps/api/test/spec-213-un-bundle-por-stage.test.ts` con `SQLITE_BUSY: database is locked`. Las
otras dos pasaron completas, y la corrida de CI también. Es una contención de la base SQLite del
test cuando el coverage hace más lenta la ejecución, no un fallo de lo que el test verifica.

## Cómo reproducirlo

```bash
pnpm install
pnpm verify:all                 # lint + typecheck + tests + build + Aiken
pnpm test:coverage              # coverage de las cuatro partes TS, con sus umbrales
pnpm --filter web e2e           # la suite E2E (levanta web + api)
```
