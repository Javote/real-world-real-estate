# Documentación oficial — PropNexus

Catalyst Fund Project **1400106** — *Real-World Real Estate Pre-Sale with Proof & Release*.

Esta carpeta contiene **únicamente los entregables oficiales del proyecto**, tal como fueron
presentados. Es material de referencia, no documentación de trabajo.

## Reglas de esta carpeta

1. **Los archivos de `docs/` no se editan.** Son entregables **aprobados por reviewers**;
   modificarlos desincroniza el repo de lo que el revisor tiene. Un error detectado en un
   entregable **no se corrige acá**.
2. **`docs/` es ley sobre las obligaciones** — el *qué* y la vara de aceptación. Nada en
   `DECISIONS.md` puede reducir lo que debemos. `DECISIONS.md` manda sobre la implementación: el
   *cómo*, incluido dónde la letra se interpreta en vez de seguirse literal.
3. **Un desvío solo es legítimo si** (a) el entregable se contradice internamente, (b) es un error
   de redacción, o (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño.
   **Nunca por conveniencia.** Todo desvío se registra en `DECISIONS.md` citando el párrafo, se
   lista abajo, y se comunica en la entrega.
4. **Solo lo entregado es canónico.** Los artefactos derivados (transcripciones, re-renders) no
   tienen autoridad y se eliminan si contradicen al original. Ver §Artefactos derivados.
5. **Los entregables son agnósticos de stack.** El único requisito técnico oficial es que los smart
   contracts sean en **Aiken**. Todo lo demás vive en `CLAUDE.md` §Stack.
6. Nada derivado vive acá: specs en `specs/`, decisiones en `DECISIONS.md`, reglas de trabajo en
   `CLAUDE.md`, mapa de desarrollo en `specs/README.md`.

## Índice

### `milestone-1-fundamentos/` — Whitepaper y arquitectura de datos

| Archivo | Entregable | Contenido |
|---|---|---|
| `M1-D1a-WhitePaper.pdf` | **M1-D1** | El whitepaper v1.0 aprobado. Documento fuente del proyecto. |
| `M1-D1b-resumen-whitepaper-castellano.md` | *(derivado)* | Resumen en castellano, sección por sección. Cómodo para trabajar; **no reemplaza al PDF** ante una duda. |
| **`M1-D2-Architecture-and-Data-Models/`** | **M1-D2 — canónico** | El paquete tal como se entregó y hasheó. Ver detalle abajo. |
| `M1-D2{a,b,c,d}-*.pdf` | M1-D2 (presentación) | Versiones en Illustrator de los cuatro diagramas, agregadas para facilitar la lectura a los reviewers. Aprobadas y **coincidentes** con los `.puml` originales. |
| `M1-D3-PilotPlan.pdf` | M1-D3 | Plan del piloto: timeline, alcance, métricas y tests, más las cartas de conformidad del notario y dos developers. **Relevante para el criterio 4 de M3.** |
| `M1-D4-Blockchain-Anchoring-Index.md` | M1-D4 | Los tres entregables de M1 con su SHA-256, su TXID y el link a cardanoscan. |

#### `M1-D2-Architecture-and-Data-Models/` — el paquete canónico

Los seis archivos que `Instructions.txt` especifica, tal como se comprimieron y entregaron. **El
`.rar` que los contenía fue hasheado con SHA-256 y ese hash es parte de la Proof of Achievement de
M1** (ver `M1-D4`): el contenido está comprometido criptográficamente.

| Archivo | Contenido |
|---|---|
| `1-system-architecture.puml` | Capa de usuario, servicios off-chain, almacenamiento (incluye `Document Storage`) y capa on-chain con **dos** componentes: `Evidence Anchor Transactions` y `Milestone State Anchors`. |
| `2-core-domain-model.puml` | Entidades y relaciones. `UnitForSale "1" -- "1..*" Milestone`; `EvidenceBundle "1" -- "1" OnChainEvent`. |
| `3-milestone-lifecycle.puml` | La FSM canónica, con sus transiciones etiquetadas. Ver D-020. |
| `4-evidence-anchoring-flow.puml` | Secuencia: upload → SHA-256 → anclaje → TXID → registro de la referencia. |
| `5-evidence-taxonomy.csv` | **Taxonomía normativa de evidencia**: seis categorías con ejemplos, fuente típica y propósito. Incluye `Governance Sign-Offs`, cuya fuente es el Council of Experts. |
| `README.md` | Resumen de cortesía redactado después. **Menor precedencia** que los artefactos especificados — ver D-022. |

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
| `D2` | Architecture & Data Models | Screen Catalog |
| `D3` | Pilot Plan | Design Principles & Component Library |
| `D4` | Blockchain Anchoring Index | UX Docs & Proof-Rendering Patterns |

Dentro de los documentos de M2, una referencia suelta a "D1 §5" o "D3 §5" significa **siempre
M2-D1 / M2-D3**. Los nombres de archivo llevan el prefijo del milestone para desambiguar; al citar
en specs, commits o código, usar siempre la forma completa (`M2-D1 §4`, no `D1 §4`).

## Desvíos registrados

Cada uno cae en uno de los tres casos legítimos de la regla 3. **Ninguno se resuelve editando el
entregable**, y todos se comunican en la entrega:

| Qué dice el entregable | Resolución | Caso | Decisión |
|---|---|---|---|
| M3 SOM: "Plutus **V2** state machine"; M2-D5 §3 repite el supuesto. | El proyecto Aiken es v1.1.21 y compila **Plutus V3** (`contracts/plutus.json`). V3 es estrictamente posterior y es lo que Aiken 1.1.x emite nativamente. Ningún entregable fija versión de Aiken. | (b) error de redacción | D-019 |
| M3 SOM: "signers/**percentages** configurables", "reserva → creación de **escrow** < 12 min". | **La plataforma nunca custodia ni transfiere valor**, en ninguna fase. Los porcentajes son cronograma registrado como dato; el "escrow" es el contrato creado y anclado. | (c) contradice una verdad del producto | D-021 |
| M1 §README lista los estados como "…**Certified**…"; el `.puml` dice `Completed`. | Gana `Completed`: precedencia interna de M1 (artefactos especificados > README de cortesía), y además `Certified` implicaría que la plataforma certifica. | (a) contradicción interna | D-020, D-026 |
| M1-D2b: `UnitForSale "1" -- "1..*" Milestone` — los stages cuelgan de la unidad. | M2-D1 los trata como stages del **proyecto** y ata contrato, releases y dossier a la unidad. Gana M2: posterior, más específico, y es lo que muestra la maqueta aprobada. | (a) contradicción entre entregables | D-022 |
| M1 §README promete que la taxonomía indica "authoritative" y "anchored on-chain". | El CSV entregado no tiene esas columnas. El README prometió de más; el hueco lo llenan D-027 (qué se ancla) y D-028 (qué es autoritativo). | (a) contradicción interna | D-027, D-028 |
| M2-D5 §2.1 usa notación de rutas Wouter. | Las rutas se leen como **paths**, no como elección de router. Los entregables son agnósticos de stack. | (b) error de redacción | D-022 |

## Artefactos derivados

Solo lo entregado es canónico. Estos existieron y **se eliminaron** el 2026-07-29:

- `M1-D2{a,b,c,d}-*.puml` — regenerados a posteriori desde los PDF, nunca formaron parte de la
  entrega. Contradecían a los originales: flechas invertidas en la FSM (lo que llevó a creer,
  durante un tiempo, que el entregable estaba mal), multiplicidades invertidas en el modelo de
  dominio, y componentes perdidos en la arquitectura (`Document Storage`, `Milestone State Anchors`).

**La lección:** un artefacto derivado que contradice al original produce decisiones equivocadas
aguas abajo. Verificar siempre contra lo entregado.

## El proyecto ya ancló sus propios entregables

`M1-D4` es, en la práctica, una versión manual del producto: los tres entregables de M1 fueron
hasheados con SHA-256, anclados en Cardano y publicados con su TXID y su link al explorador —
**en mainnet**. Vale distinguir dos contextos de anclaje que no hay que mezclar:

| Qué se ancla | Quién | Red |
|---|---|---|
| Evidencia y stages de un proyecto inmobiliario | La plataforma | **Preprod** en M3 (D-013) |
| Los entregables de cada milestone Catalyst | El equipo, a mano | **Mainnet**, siguiendo el precedente de M1-D4 |
