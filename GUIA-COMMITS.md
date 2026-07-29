# Guía de commits, ramas y PRs

## Convención: Conventional Commits + ID de backlog

Formato:

```
<tipo>(<scope>): <descripción en imperativo, minúscula, sin punto final> [<REF>]
```

### Tipos

| Tipo | Uso |
|---|---|
| `feat` | Nueva funcionalidad visible (endpoint, pantalla, validador) |
| `fix` | Corrección de bug |
| `refactor` | Cambio interno sin alterar comportamiento |
| `test` | Solo tests |
| `docs` | Solo documentación |
| `chore` | Tooling, deps, config, CI |
| `perf` | Mejora de rendimiento |
| `db` | Migraciones o cambios de esquema |

### Scopes válidos

`web`, `api`, `db`, `shared`, `cardano`, `contracts`, `ci`, `repo`

### Ejemplos

```
feat(api): endpoint de subida de evidencia con merkle y anclaje [M3-BE-13]
feat(contracts): validador de commit de certificación de etapa [M3-SC-05]
feat(web): modal AnchoringSuccess con merkle root y txid [M3-FE-18]
fix(cardano): calcular merkle root con orden determinístico de hojas
db(db): tabla audit_log append-only con índice por categoría [M3-BE-16]
test(web): e2e DEV-EVIDENCE-UPLOAD-001
chore(repo): configurar pnpm workspace y tsconfig base
```

### Reglas

1. Un commit = un cambio lógico. No mezclar refactor con feature.
2. Referenciar el ID del backlog entre corchetes cuando aplique.
3. Cuerpo del commit (opcional) explica el *por qué*, no el *qué*.
4. `BREAKING CHANGE:` en el footer si rompe contrato de API o esquema on-chain.
5. Nunca commitear `.env`, seeds de wallet, keys ni archivos de evidencia real.

## Ramas

```
main                    # siempre deployable; protegida, merge solo por PR
feat/M3-BE-13-evidence-anchoring
feat/M3-FE-18-evidence-upload
fix/api-merkle-orden-hojas
```

Formato: `<tipo>/<REF-en-kebab>-<descripción-corta>`.

## Pull Requests

- Título = mensaje de commit principal.
- Descripción obligatoria: **qué**, **por qué**, **cómo probarlo** (comandos), y checklist:
  - [ ] `pnpm typecheck` y `pnpm test` pasan
  - [ ] Schema Zod en `shared` actualizado (si toca API)
  - [ ] Evento de `audit_log` agregado (si es mutación relevante)
  - [ ] `aiken check` pasa (si toca contratos)
  - [ ] Sin datos sensibles on-chain ni en logs
- Un PR por tarea de backlog. PRs > ~500 líneas: dividir.
- Squash merge a `main` conservando el mensaje convencional.

## Niveles de autonomía LLM (por riesgo del código)

| Nivel | Qué cubre | Cómo se trabaja |
|---|---|---|
| 🟢 Verde | Componentes UI según M2-D3, endpoints CRUD según M2-D5, tests, docs, seeds, prompts | El LLM implementa directo; revisión de PR normal |
| 🟡 Amarillo | Migraciones de DB, auth/permisos/guards, pipeline de anclaje (`packages/cardano`), manejo de archivos/S3, config de CI/deploy, validadores Aiken sin fondos | El LLM propone; revisión humana línea por línea antes de merge |
| 🔴 Rojo | `stage_release.ak` (custodia fondos), manejo de seeds/keys/firmas, todo lo que toque `SERVICE_WALLET_SEED`, checklist de mainnet | El humano lidera y escribe; el LLM asiste. El revisor debe poder explicar cada línea sin mirar el chat |

Regla: si dudás del nivel, es el nivel más alto de los dos.

## Versionado (por tipo de artefacto — D-015)

- **Servicios desplegados (web, api):** CalVer en tags de release: `vYYYY.MM.N` (ej. `v2026.07.1`). El deploy continuo hace que el tag sea marcador, no gate.
- **Contratos on-chain:** versión **entera** en `aiken.toml`, se incrementa con cualquier cambio de validador. Un script distinto ES otra versión — sin grises. El blueprint commiteado acompaña.
- **Packages internos del workspace:** sin versionado; viven y mueren con el repo.

## Versionado de milestone de gobernanza

SemVer por milestone: `0.x` durante M3. Tags: `v0.3.0-m3`.
