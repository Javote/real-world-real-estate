# Reporte de tests — 2026-09-21

> Evidencia del Milestone 3 de Catalyst: *"Public GitHub repo(s) … with **CI logs, coverage
> report** …"* y *"API docs + **test reports with coverage/outcomes**"*
> (`docs/milestone-3-implementacion/Milestone-3-info.md`, Evidence of milestone completion).
>
> Todos los resultados salen de la corrida de CI del commit
> [`31fc854`](https://github.com/Javote/real-world-real-estate/commit/31fc854198bbf9de3b751d6edd27a3b8b716574e).
> La única excepción es el coverage de tres paquetes, marcado como **medido local**, porque CI solo
> mide el de la API.

## La corrida de CI

**[Run 35650018189](https://github.com/Javote/real-world-real-estate/actions/runs/35650018189)**,
2026-09-21 20:16 UTC, los cuatro jobs en verde.

GitHub borra los logs de Actions a los 90 días, así que hay una **copia completa en el repo**:
[`specs/evidencia-m3/1-repo-ci-tests/ci-run-35650018189.log`](evidencia-m3/1-repo-ci-tests/ci-run-35650018189.log). Es el log crudo de
`gh run view 35650018189 --log`, sin los códigos de color. Los únicos secretos que aparecen son
valores de prueba de CI (`JWT_SECRET: ci-secret-jamas-en-produccion`).

| Job | Qué corre | Resultado |
|---|---|---|
| App TS | lint (Biome) · typecheck · trazabilidad de test IDs · tests de la API con coverage · tests de web, shared y cardano · dependency scan · build · smoke test del arranque compilado | ✅ |
| Contratos Aiken | `aiken fmt --check` · `aiken check` · `aiken build` y que `plutus.json` commiteado esté al día | ✅ |
| Static analysis | Semgrep, rulesets `p/security-audit` + `p/owasp-top-ten` | ✅ 127 reglas, 434 archivos, **0 hallazgos** |
| E2E Playwright | la app entera contra una base migrada y sembrada, en mobile (390 px) y desktop (1440 px) | ✅ **90 passed** |

## Resultados por paquete

| Paquete | Qué cubre | Tests | Resultado |
|---|---|---|---|
| `contracts/` (Aiken) | el validador on-chain: FSM de la etapa, thread token, reglas de evidencia | 85 (83 unit + 2 property) | ✅ 85/85 |
| `apps/api` | la API: rutas, autorización, anclaje, FSM, migraciones | 544 | ✅ 541 passed · 3 skipped |
| `packages/cardano` | el puerto de anclaje (simulado y real) | 92 | ✅ 92/92 |
| `packages/shared` | el contrato Zod compartido, la FSM, Merkle | 101 | ✅ 101/101 |
| `apps/web` (unit) | componentes, i18n, `ApiPort` contra el OpenAPI | 936 | ✅ 936/936 |
| `apps/web` (E2E) | los flujos de los cuatro roles + admin, en dos viewports | 90 | ✅ 90/90 |
| **Total** | | **1.848** | **1.845 passed · 3 skipped · 0 failed** |

**Los 3 skipped son a propósito:** son `apps/api/test/storage-s3.test.ts`, que corre contra un S3
real (MinIO). Lo mismo pasa con `packages/cardano/src/yaci.test.ts`, contra un nodo Cardano local,
que el script de tests de ese paquete directamente excluye. CI no levanta esa infraestructura; se
corren a mano con `pnpm --filter @plataforma/api test:s3` y
`pnpm --filter @plataforma/cardano test:yaci`.

**Hasta este reporte, CI solo corría los tests de la API.** Los de web, shared y cardano corrían en
`pnpm verify` local y nunca en CI; se encontró armando este reporte y se corrigió en el mismo commit
que esta corrida verifica (`31fc854`).

## Coverage

| Paquete | Líneas | Statements | Branches | Funciones | Fuente |
|---|---|---|---|---|---|
| `apps/api` | **89,3%** | 83,2% | 71,1% | 86,7% | CI (`pnpm test:coverage`), con umbrales mínimos que fallan el build |
| `packages/cardano` | **90,1%** | 89,5% | 82,2% | 94,4% | medido local |
| `packages/shared` | 61,2% | 63,7% | 96,6% | 94,7% | medido local |
| `apps/web` (unit) | 27,6% | 27,1% | 22,0% | 29,1% | medido local |

Cómo leer los dos más bajos:

- **`packages/shared`** es sobre todo declaraciones de schemas Zod. Las ramas y funciones, que es
  donde hay lógica (la FSM, Merkle, las reglas de evidencia), están arriba del 94%.
- **`apps/web`** tiene cobertura unitaria baja porque las pantallas no se testean unitariamente:
  las cubre la suite E2E (90 tests: los flujos de los cuatro roles y del admin, en dos
  viewports). Los tests unitarios
  cubren los componentes compartidos, el diccionario i18n y el contrato de `ApiPort` contra el
  OpenAPI publicado.

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

## Un test intermitente, declarado

Al preparar este reporte, una de tres corridas locales de `pnpm test:coverage` falló en
`apps/api/test/spec-213-un-bundle-por-stage.test.ts` con `SQLITE_BUSY: database is locked`. Las
otras dos pasaron completas, y la corrida de CI también. Es una contención de la base SQLite del
test cuando el coverage hace más lenta la ejecución, no un fallo de lo que el test verifica.

## Cómo reproducirlo

```bash
pnpm install
pnpm verify:all                 # lint + typecheck + tests + build + Aiken
pnpm test:coverage              # coverage de la API, con sus umbrales
pnpm --filter web e2e           # la suite E2E (levanta web + api)
```
