# Milestone 4 — lo que dice Catalyst, y el cruce contra el repo

> Fuente: [`milestones.projectcatalyst.io/projects/1400106/milestones/4`](https://milestones.projectcatalyst.io/projects/1400106/milestones/4),
> copiado el 2026-09-22. **No es un entregable de `docs/`** (D-022 solo protege lo que ya se
> hasheó y entregó) — es la página pública del Milestone Module, transcripta acá para no tener que
> volver a abrir el navegador cada vez que se planifica M4. Si Catalyst edita la página, esta copia
> queda desactualizada y hay que releerla.
>
> M4 **no se planifica todavía en `specs/README.md`** — esa tabla sigue siendo el mandato de M3, que
> no está cerrado (faltan 3.12, 3.14, 3.15 — `3.13`, recontacto de pilotos, se cerró el 2026-09-22 —
> ver `CLAUDE.md` raíz §Lo que queda del plan). Este
> documento es el punto de partida para cuando M3 se entregue y M4 se convierta en el mandato activo,
> y el inventario de specs nuevas que hace falta escribir antes de eso.

## La tabla, tal como la publica Catalyst

**Milestone Title:** Pilot Testing & Mainnet Deployment + Closeout

### Outputs

| # | Output |
|---|---|
| 1 | Pilot execution with one notary and two developers; real data; ≥2 releases per pilot; fallback/drill scenarios (e.g., failed inspection → re-inspection/refund). |
| 2 | Mainnet deployment with published mainnet URL & contract addresses; operational dashboards; governance/ops playbooks. |
| 3 | Documentation update incorporating pilot feedback (Whitepaper v1.1, API, user guides) and a notary-verified dossier for at least one unit. |
| 4 | Project Closeout delivering the Final Closeout Report and the Final Closeout Video. |

### Acceptance criteria

| # | Criterio |
|---|---|
| 1 | Pilot metrics: at least two development pilots successfully onboarded; ≥10 signed contracts, ≥20 evidence bundles hashed, ≥15 releases, document completeness ≥95%, disputes ≤3%, buyer NPS ≥70, ≥120 unique wallets across pilots; ≥800.000 USDM in value for real estate developments within the platform. |
| 2 | Mainnet deployed with URL & addresses published; ≥350 on-chain events and ≥100 document hashes; simulated escrow value reported; legal greenlight for mainnet from counsel/notary. |
| 3 | Updated documentation package published; dossier verified by notary. |
| 4 | Closeout Report and Closeout Video publicly available. |

### Evidence of milestone completion

| # | Evidencia |
|---|---|
| 1 | Pilot report (metrics, successes, incidents) + notary attestation on data integrity. |
| 2 | Mainnet URL & contract addresses, list of mainnet TXIDs (public explorer), and screenshots/dashboards of events, wallets, releases. |
| 3 | Updated documentation package (Whitepaper v1.1, user manual, API, runbooks) + dossier (evidence index + hashes + signatures). |
| 4 | Project Closeout Report (PDF) and Project Closeout Video (public link). |

**El ítem 4 (Closeout Report + Video) queda de menor prioridad por decisión del dueño, 2026-09-22:
los otros tres dependen enteramente de nosotros; el 4 es una consecuencia casi automática de haber
cerrado los otros tres, y se arma al final.**

## Nota sobre "simulated escrow value" y "USDM"

**No cambia D-021.** El criterio 2 dice explícitamente *"simulated escrow value reported"* — la
plataforma sigue sin custodiar valor ni tocar una wallet de escrow real, igual que hoy. Lo que hay
que reportar es un número agregado, no una función nueva de custodia.

Los **USDM** del criterio 1 (≥800.000 en valor) tampoco implican integrar un stablecoin: hoy
`Contract.totalMinorUnits`/`currency` y `Unit.priceMinorUnits`/`currency` son fiat en centavos
(regla 1), en la moneda que cada proyecto declare. Falta decidir si "en USDM" es (a) una conversión
de reporte al armar la evidencia del milestone —sin tocar el dominio— o (b) el pedido implícito de
que los pilotos reales denominen sus contratos en USDM. Es una **pregunta abierta**, no una decisión
tomada; ver §Preguntas abiertas de `SPEC-501`.

## Cruce contra lo que ya existe en el repo

| Output/criterio de M4 | Qué ya cubre el repo | Qué falta |
|---|---|---|
| Mainnet: red, direcciones, URL | Nada — D-013 lo hace imposible por configuración a propósito | Los 7 ítems de `CLAUDE.md` raíz §Antes de mainnet, todos con spec propia salvo el 1 y el 7 (ver tabla abajo) |
| Mainnet: dashboards operacionales | Sentry + OTel→Grafana Cloud + PostHog ya instrumentados y verificados en Preprod (criterio 14 de M3) | Repetir el encendido contra los proyectos/tokens de mainnet; no es código nuevo |
| Mainnet: governance/ops playbooks | `specs/RUNBOOK-deploy.md` (deploy/rollback de Preprod) | Un runbook de **cutover** a mainnet (este documento lo empieza a resolver, ver `RUNBOOK-mainnet-cutover.md`) + un playbook de incident response para valor en juego real (aunque sea "simulado", hay reputación y legal de por medio) |
| Pilotos: ≥2 developers, 1 notary, datos reales | `M1-D3-PilotPlan.pdf` ya trae cartas de conformidad de M1 (1 notary + 2 developers) — es el ítem 3.13 de M3, recontactar | Ejecutarlo de verdad, con datos reales y en mainnet, no Preprod |
| Pilotos: fallback/drill (inspección fallida → re-inspección/reembolso) | La FSM ya tiene `Observed` como camino de remediación (D-020) — una etapa que no pasa la evidencia vuelve a `InProgress` sin perder historial | El "reembolso" es dominio nuevo: hoy `PaymentAttestation` solo registra liberaciones, no reversiones. Ver `SPEC-502` (disputas) — un reembolso es el desenlace de una disputa, no un estado de stage |
| Pilotos: métricas (contratos, bundles, releases, wallets, valor) | Todo derivable de tablas existentes (`Contract`, `EvidenceBundle`, `PaymentAttestation`, `Unit.investorId`) salvo lo de abajo | `SPEC-501` — el panel que agrega estos números para el reporte |
| Pilotos: document completeness ≥95% | No hay métrica de completitud hoy — solo se sabe si una etapa exige evidencia (D-028) | `SPEC-504` |
| Pilotos: disputes ≤3% | No existe el concepto de disputa en el dominio | `SPEC-502` |
| Pilotos: buyer NPS ≥70 | No existe encuesta ni campo de satisfacción | `SPEC-503` |
| Docs: Whitepaper v1.1, API, user guides | El API ya se autodocumenta (OpenAPI, criterio 5 de M3) — la actualización es de contenido, no de mecanismo | Reescribir con feedback real de los pilotos, después de correrlos — no antes |
| Docs: dossier verificado por notario, ≥1 unidad | El dossier y su firma por notario ya existen y están testeados (M2-D4 P8, `notary.dossier.$dossierId.tsx`) | Ejecutarlo con un notario real sobre una unidad real en mainnet — no es código nuevo |
| Closeout report + video | Ninguno | Baja prioridad (ver arriba); se arma al final con las capturas y métricas ya recolectadas |

## Las specs nuevas que hace falta escribir para M4

**Los 7 ítems de `CLAUDE.md` raíz §Antes de mainnet ya tienen spec o decisión propia — no se
repiten acá.** Lo nuevo es dominio de producto que M3 nunca necesitó (disputas, satisfacción,
completitud, agregación de métricas de piloto):

| Spec | Título | Por qué es nueva |
|---|---|---|
| [`SPEC-501`](SPEC-501-panel-de-metricas-del-piloto.md) | Panel de métricas del piloto | Agregación de datos que ya existen — bajo riesgo, sin schema nuevo |
| [`SPEC-502`](SPEC-502-registro-de-disputas.md) | Registro de disputas | Entidad `Dispute` nueva — el dominio nunca tuvo desacuerdo modelado |
| [`SPEC-503`](SPEC-503-encuesta-nps-del-buyer.md) | Encuesta NPS del buyer | Campo/tabla nueva, superficie nueva del investor |
| [`SPEC-504`](SPEC-504-completitud-de-documentacion.md) | Completitud de documentación por unidad | Métrica nueva sobre datos existentes — define qué significa "completo" |

**El runbook de cutover a mainnet vive aparte, no como spec**, porque no es código: es la secuencia
operativa que asume que estas cuatro specs y los 7 ítems de "antes de mainnet" ya están cerrados.
Ver [`RUNBOOK-mainnet-cutover.md`](RUNBOOK-mainnet-cutover.md).

### Orden de ataque, y por qué

**`504 → 502 → 503 → 501`, no el orden numérico.** El criterio de corte es "¿qué bloquea a los
pilotos reales del runbook §5?", no facilidad de implementación:

1. **`SPEC-504` primero.** Cero schema nuevo — lee `Stage`/`validationCritical`, que ya existen.
   Es el más rápido de cerrar y no tiene preguntas abiertas de producto (la única, el promedio
   simple vs. ponderado, no bloquea empezar). Se cierra en días, no en una decisión del dueño.
2. **`SPEC-502` segundo, y es el que manda la fecha del resto.** El output 1 de M4 exige
   *ejercitar a propósito* el drill de fallback (inspección fallida → re-inspección/reembolso) — sin
   `Dispute` no hay forma de demostrarlo, y el runbook de cutover (§Riesgos) ya dice explícito que
   los pilotos reales no arrancan hasta que esta spec tenga sus tests de rechazo en verde. Además
   define el `outcome` que `disputeRate` necesita — sin esto, `SPEC-501` no tiene qué mostrar en esa
   columna.
3. **`SPEC-503` tercero.** No bloquea el arranque del piloto — un investor recién puede tener una
   opinión después de su primera liberación (§Preguntas abiertas), así que puede construirse **en
   paralelo** a que corran los primeros contratos, mientras se resuelve la decisión pendiente de
   *qué evento la dispara*. Tiene que estar lista antes de la primera liberación real, no antes de
   abrir el piloto.
4. **`SPEC-501` último, y a propósito.** Es la que menos importa cuándo se escribe: agrega datos que
   las otras tres ya definen, y escribirla antes obligaría a retocarla cuando `SPEC-502`/`SPEC-503`
   asienten su forma final (el `outcome` de una disputa, el shape de una respuesta NPS). Antes de
   empezarla, además, conviene resolver la pregunta abierta de `uniqueWalletsCount` (si hace falta
   sumarle una columna a `OnChainEvent` o aproximar con `User.id`) — es la única de las cuatro con
   una decisión de schema pendiente que puede cambiar el resto de la spec.

**Lo que no cambia el orden:** los 7 ítems de "antes de mainnet" (`CLAUDE.md` raíz) y el resto del
runbook de cutover no dependen de estas cuatro specs — pueden avanzar en paralelo, los está
bloqueando M3 (3.12-3.15), no esto.

## Lo que sigue postergado de M3 y M4 hereda

Estos tres ítems de `CLAUDE.md` raíz §Lo que queda del plan **no son de M4**, son deuda de M3 que
M4 no puede heredar sin cerrar primero — correr pilotos reales en mainnet sin ellos sería repetir el
mismo hueco a mayor escala:

- **3.14 — Muestras de "reserva → escrow"** (≥5 compras reales en Preprod): es el ensayo general de
  lo que M4 pide en mainnet a escala de ≥15 releases. Cerrar esto en Preprod primero, no directo en
  mainnet con plata/reputación real de un piloto.
- **3.15 — Cobertura ≥95%** (`SPEC-017`): el dominio nuevo de M4 (disputas, NPS, completitud) suma
  código nuevo sobre una base que hoy no llega al piso que el propio SOM pide. Cerrar `SPEC-017`
  antes de sumar más superficie sin cubrir, no después.
- **3.13 — Recontacto de los 3 pilotos**: es el mismo contacto que M4 output 1 necesita para
  arrancar. No hay dos gestiones separadas.
