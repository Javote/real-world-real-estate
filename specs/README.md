# specs/ — el mapa del desarrollo

Qué hay que entregar, en qué estado está, y en qué orden se construye. **Estado medido, no
estimado**: cada número de acá salió de un `grep` o de una suite, no de una impresión.

- Las **obligaciones** están en `docs/` (inmutable) y mapeadas en [`entregables.md`](entregables.md).
- Las **restricciones vigentes**, en [`../DECISIONS.md`](../DECISIONS.md).
- El **cómo se trabaja**, en [`../CLAUDE.md`](../CLAUDE.md).
- El **argumento largo** de decisiones pasadas, en [`archive/`](archive/).

## Mandato

Entregar **Milestone 3 — Core Backend, Smart-Contract Development & Integration**: el backlog
completo de `M2-D5`, corriendo de punta a punta en pre-producción pública, con anclaje real en
Preprod y verificable por cualquier tercero vía TXID.

## Alcance

| | |
|---|---|
| Red | **Preprod**, en todos los entornos (D-013) |
| Entorno | Pre-producción pública |
| Datos | Semilla + piloto con 3 participantes |
| Contratos | Escritos, testeados, desplegados en testnet |
| Custodia de valor | **Ninguna** (D-021) |

Mainnet y producción quedan fuera y no se planifican acá: requieren entorno nuevo, wallet nueva y
aprobación explícita.

## Qué controlamos y qué no

- **Controlamos:** el código, el deploy, la red Preprod (faucet libre), el alcance de cada rebanada.
- **No controlamos:** disponibilidad de Blockfrost, tiempos de confirmación, adopción de wallets
  CIP-30 por profesionales, y la **disponibilidad de los 3 pilotos** que el SOM exige.
- **Consecuencia (principio 8):** "listo" es *listo para activar* — lo que depende de terceros queda
  detrás de configuración, activable en días.
- **La relación con los pilotos ya existe desde M1:** `M1-D3-PilotPlan.pdf` trae cartas de
  conformidad de un notario y dos developers, con timeline y métricas. Hay que releerlo antes de
  planificar la validación; probablemente ya conteste parte del criterio 4. Lo nuestro es
  **recontactarlos temprano**, no en la última rebanada.

## "Listo" — los 16 criterios del SOM

| # | Criterio | Evidencia | Estado |
|---|---|---|---|
| 1 | Los contratos compilan | `aiken check` verde en CI; `plutus.json` al día | ✅ |
| 2 | Unit tests **≥95% coverage** | **73 tests**; `aiken` no mide coverage de líneas, así que la evidencia es la tabla punto de rechazo → test de `contracts/CLAUDE.md` | ✅ |
| 3 | **≥8 stages** con signers/percentages configurables | Tests parametrizados; plantilla de 10 stages | ⬜ |
| 4 | **3 pilotos** confirman | Carta firmada | ⬜ externo |
| 5 | Endpoints documentados | OpenAPI — sale solo del contrato oRPC (D-066) | ◐ |
| 6 | Proof objects validados | Tests por patrón P1–P10 contra M2-D4 §8.1 | ⬜ |
| 7 | **Rechaza evidencia sin firmar** | Test de rechazo. Definido en D-028; implementado el piso | ◐ |
| 8 | Flujos de UI end-to-end en pre-prod | Test IDs de M2-D5 verdes + walkthrough | ⬜ |
| 9 | Mediana **reserva → escrow < 12 min** | Telemetría + capturas | ⬜ |
| 10 | Audit logs persistidos | Ledger append-only paginable (M2-D4 P6) | ◐ tabla sí, superficie no |
| 11 | **Sin hallazgos P1** de seguridad | Reporte de security review | ◐ el P1 conocido está cerrado; falta correr el review |
| 12 | Pre-prod en **URL pública** | La URL, viva | ⬜ |
| 13 | **Video walkthrough** | El video | ⬜ |
| 14 | **Runbook** deploy / rollback | [`RUNBOOK-deploy.md`](RUNBOOK-deploy.md) | ✅ |
| 15 | Lista de **TXIDs** de prueba | Publicada y resoluble en un explorador | ⬜ |
| 16 | README marca carpetas públicas vs privadas | En `README.md` | ✅ |

## Estado medido (2026-08-24)

**Backend y cadena: la mitad difícil está hecha.**

| | |
|---|---|
| Contratos | validador con thread token y `mint` validado, datum alineado con M1-D2, **73 tests** |
| Anclaje | `AnchorPort` con adaptador simulado y real; probado contra el `Emulator` y contra un devnet local |
| API | autorización en dos capas, FSM aplicada, bundles con Merkle root, audit log, **138 tests** |
| Storage | port S3 probado contra MinIO real; el hash cubre los bytes guardados |

**Front: hay que reconstruirlo** — ver [`SPEC-014`](SPEC-014-reconstruccion-del-front.md).

| Dimensión | Especificado | Existe | Conforme |
|---|---:|---:|---:|
| Superficies (M2-D5) | 53 | **27** | 27 (51%) — una superficie cuenta cuando TODOS sus test IDs están reclamados |
| Componentes (M2-D3) | 36 | **36** | 36 |
| Patrones de prueba (M2-D4) | 10 | 8 | 8 |
| Test IDs | **75** | 31 | 31 (41%) — medido por `pnpm testids` |
| Paleta normativa | — | — | **0 coincidencias** |

**API contra M2-D5:** de los **64** endpoints especificados coinciden **5** exactos —
`POST /auth/login`, `GET /auth/me`, `GET /projects`, `GET /projects/:id` y
`GET /projects/:id/stages`, que entró con el rename de D-067—. Contra **M2-D6** —la guía de
arquitectura— el backend **sí** está alineado: sus seis dominios funcionales existen. M2-D6 es prosa
arquitectónica; M2-D5 es el contrato.

*(La medición anterior decía "2 de ~56": el extractor se comía los endpoints con anotaciones. Con el
parser corregido son 5 de 64.)*

## Orden de trabajo

| # | Qué | Estado |
|---|---|---|
| 1 | **Reset documental**: memoria partida, `CLAUDE.md` con el flujo, `SPEC-014` | hecho |
| 2 | **Borrado + tokens + shadcn/ui + rename D-067** | hecho |
| 3 | **Los ~12 componentes transversales** de M2-D3 | hecho — 36/36 (ver tabla de arriba) |
| 4 | **Los patrones P1–P10** de M2-D4 | **en curso** — 8/10 |
| 5+ | **Verticales**, en el orden del flujo cross-rol de M2-D1 §6: `evidencia → certificar → liberar` | **en curso** — 27/53 superficies (51%), Notary y Certifier completos |
| — | `AnchorPort` §C: reconciliación y `verify()` público ([`SPEC-013`](SPEC-013-anchorport.md)) | pendiente |
| — | Preprod: cuenta Blockfrost + wallet de servicio 🔴 | pendiente, externo |

Cada vertical trae sus endpoints (con paths scopeados por rol, D-066) y sus test IDs. **El criterio
de corte de una rebanada es que la app quede corriendo y demostrable.**

## Riesgos, señal temprana y plan B

| Riesgo | Señal temprana | Plan B |
|---|---|---|
| **Los 3 pilotos no responden a tiempo** | Sin contacto al cerrar la vertical de evidencia | Escalar a los developers socios; es su compromiso elegirlos |
| **Scope creep de UI**: 53 superficies, 33 componentes | Una vertical no cierra | Cortar superficies secundarias antes que mover la fecha. **Dossier y audit log no son cortables**: son la tesis del producto |
| Blockfrost caído o limitado | 402/429 en el adaptador | `ANCHOR_MODE=simulated` mantiene el producto usable; cola de re-anclaje |
| Confirmaciones lentas rompen la UX | `AnchoringSuccessModal` tarda >30s | Modal en dos tiempos: "enviado" (TXID) → "confirmado" (poll) |
| Fricción CIP-30 con profesionales | Rechazo de los pilotos | Sin alcance en el validador (D-058); si vuelve, es decisión nueva |
| La métrica de 12 minutos se descubre tarde | No hay telemetría al llegar a la vertical de invitación | Instrumentarla cuando nazca ese flujo, no después |
| El free tier duerme el servicio en una demo | Primera demo con la URL fría | El web pasa a static site (D-065) y no duerme; queda la API. Si molesta, el disparador para mirar edge |

## Registro de specs

| Spec | Título | Estado |
|---|---|---|
| [`SPEC-010`](SPEC-010-superficie-roja.md) | Endurecer la superficie 🔴 | cerrada 2026-08-21 |
| [`SPEC-012`](SPEC-012-segunda-capa-como-middleware.md) | `requireProjectAccess`: la segunda capa como middleware | cerrada 2026-08-23 |
| [`SPEC-013`](SPEC-013-anchorport.md) | `AnchorPort`: conectar el registro con la cadena | §A y §B cerradas · §C pendiente |
| [`SPEC-014`](SPEC-014-reconstruccion-del-front.md) | Reconstrucción del front desde los entregables | **en curso** |
| [`SPEC-015`](SPEC-015-saneamiento-de-la-instrumentacion.md) | Saneamiento de la instrumentación: tests, fixtures, coverage, CI | **en curso** |

**La numeración no se recicla.** `SPEC-008`, `SPEC-011` y los planes anteriores están en
[`archive/`](archive/): describen trabajo cerrado o código que se borró.
