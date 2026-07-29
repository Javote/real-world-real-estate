# Documentación oficial — PropNexus

Catalyst Fund Project **1400106** — *Real-World Real Estate Pre-Sale with Proof & Release*.

Esta carpeta contiene **únicamente los entregables oficiales del proyecto**, tal como fueron
presentados. Es material de referencia, no documentación de trabajo.

## Reglas de esta carpeta

1. **Los archivos de `docs/` no se editan.** Son entregables enviados; modificarlos desincroniza
   el repo de lo que el revisor tiene. Un error detectado en un entregable **no se corrige acá**.
2. **Toda corrección, desvío o reinterpretación se registra en `DECISIONS.md`**, citando el
   documento y el párrafo que reinterpreta. Ver §Discrepancias conocidas.
3. **Los entregables son agnósticos de stack.** El único requisito técnico oficial del proyecto es
   que los smart contracts sean en **Aiken**. Todo lo demás (framework web, ORM, base de datos,
   hosting) es decisión de implementación nuestra y vive en la sección Stack de **`CLAUDE.md`**.
4. Nada derivado vive acá: specs en `specs/`, decisiones en `DECISIONS.md`, reglas de trabajo en
   `CLAUDE.md`, mapa de desarrollo en `specs/README.md`.

## Índice

### `milestone-1-fundamentos/` — Whitepaper y arquitectura de datos

| Archivo | Entregable | Contenido |
|---|---|---|
| `M1-D1-whitepaper.md` | M1-D1 | Abstract, problema, objetivos, roles y gobernanza, política de identidad y firmas, modelo de estados, modelo de evidencia, límites on-chain/off-chain, privacidad, memo legal registral. |
| `M1-D2a-system-architecture.{puml,pdf}` | M1-D2a | Arquitectura de alto nivel: capa de usuario, servicios off-chain, almacenamiento, capa de anclaje Cardano. |
| `M1-D2b-core-domain-model.{puml,pdf}` | M1-D2b | Entidades conceptuales: Account, Certifier, UnitForSale, Milestone, EvidenceBundle, EvidenceItem, OnChainEvent. |
| `M1-D2c-milestone-lifecycle.{puml,pdf}` | M1-D2c | Máquina de estados del ciclo de vida. **Ver discrepancia D-020.** |
| `M1-D2d-evidence-anchoring-flow.{puml,pdf}` | M1-D2d | Diagrama de secuencia: upload → SHA-256 → anclaje → TXID. |

### `milestone-2-diseno/` — Sistema de diseño UX/producto

| Archivo | Entregable | Contenido |
|---|---|---|
| `M2-D1-Information-architecture-and-navigation-map.md` | M2-D1 | Roles (INV/DEV/NOT/CER), matriz de permisos, mapa de navegación por rol, árboles de pantallas, flujos cross-rol, gating de autenticación, i18n, notificaciones. |
| `M2-D2-Screenshots-catalog/` | M2-D2a | Catálogo visual de las ~70 pantallas. Los IDs (`06-07`, `44d`, `52v`…) que el backlog de M2-D5 referencia en cada fila salen de acá. |
| `M2-D3-Design-principles-and-component-library.md` | M2-D3 | 6 principios de diseño, lenguaje visual (color normativo, tipografía, iconografía, espaciado, elevación), 36 componentes, estados de interacción, accesibilidad WCAG 2.1 AA, localización. |
| `M2-D4-UX-docs-and-proof-rendering-patterns.md` | M2-D4 | Los 10 patrones canónicos de renderizado de prueba (P1–P10), principios cross-patrón y los contratos de datos que le imponen al backend. |

### `milestone-3-implementacion/` — Alcance de construcción

| Archivo | Entregable | Contenido |
|---|---|---|
| `Milestone-3-info.md` | SOM M3 | Outputs, criterios de aceptación y evidencia de completitud exigidos para aprobar Milestone 3. |
| `UI-implementation-plan.md` | **M2-D5** | Backlog de 53 entradas: cada pantalla → componentes → endpoints → test IDs → work stream M3. Glosario de refs `M3-BE-01..18`, `M3-SC-01..06`, `M3-FE-01..26`. |
| `Backend-and-smart-contracts-design-and-implementation-plan.md` | **M2-D6** | Baseline arquitectónico: dominios funcionales del backend, modelo de responsabilidad off-chain/on-chain, manejo de evidencia e integridad, dirección de contratos. Apéndice A: trazabilidad D5 → D6. |

> **Nota de ubicación.** M2-D5 y M2-D6 son formalmente **entregables de Milestone 2** (D5 se
> autodescribe como "the fifth of six Milestone 2 deliverables"; D6 lleva el encabezado
> "Milestone 2 — UX & Product Design System"). Se archivan junto al SOM de M3 porque son los
> documentos que **especifican** el trabajo de M3 y en la práctica se leen juntos.

## Códigos de entregable: cuidado con la colisión

Los códigos `D1`, `D2a`… **se reinician en cada milestone y no significan lo mismo**:

| Código | En Milestone 1 | En Milestone 2 |
|---|---|---|
| `D1` | Whitepaper | Information Architecture & Navigation Map |
| `D2a` | System architecture (UML) | Screen Catalog |

Dentro de los documentos de M2, una referencia suelta a "D1 §5" o "D3 §5" significa **siempre
M2-D1 / M2-D3**. Los nombres de archivo llevan el prefijo del milestone para desambiguar; al citar
en specs, commits o código, usar siempre la forma completa (`M2-D1 §4`, no `D1 §4`).

## Discrepancias conocidas entre entregables y realidad

Detectadas al consolidar. **Ninguna se corrige editando el entregable**; cada una se resuelve en
`DECISIONS.md`:

| Qué dice el entregable | Realidad / resolución | Decisión |
|---|---|---|
| M3 SOM: "Plutus **V2** state machine". M2-D5 §3 repite el supuesto. | El proyecto Aiken es v1.1.21 y compila **Plutus V3** (`contracts/plutus.json` → `"plutusVersion": "v3"`). V3 es estrictamente posterior y es lo que Aiken 1.1.x emite nativamente. | D-019 |
| M1-D2c: `Pending → InProgress → Completed → Observed → [*]`, con `Observed` posterior a `Completed` y terminal. | Topología canónica: `Pending → InProgress → {Observed ⇄ InProgress, Completed}`, `Completed` terminal. `Observed` es un camino de remediación, no un estado final — consistente con M1-D1 §Workflow y con M2-D1 (el certifier observa para que el developer corrija). | D-020 |
| M3 SOM: "signers/**percentages** configurables", "reserva → creación de **escrow** < 12 min". | **La plataforma nunca custodia ni transfiere valor**, en ninguna fase. On-chain van solo commitments (hashes) y TXIDs; el dinero se mueve íntegramente fuera de la plataforma. Los porcentajes son cronograma de pagos registrado como dato; el "escrow" es el contrato creado y anclado. | D-021 |
| Todos los entregables son agnósticos de stack; M2-D5 §2.1 usa notación de rutas Wouter. | El stack canónico vive en `CLAUDE.md` §Stack. Las rutas de M2-D5 se leen como **paths**, no como elección de router. | D-022 |
