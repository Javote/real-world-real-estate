# Mapa de los entregables oficiales

> **Esto es un mapa, no una transcripción.** Dice **dónde** está cada cosa y **qué** contiene, no
> qué dice. Ante cualquier duda sobre el contenido, **abrí el entregable**: en este proyecto ya
> pasó que un artefacto derivado contradijera al original y nos hiciera decidir mal durante una
> sesión entera (ver `CLAUDE.md` §Trampas transversales).
>
> Vive acá y no en `docs/` porque **`docs/` contiene únicamente entregables** — este índice lo
> escribimos nosotros, nunca se entregó y nunca se hasheó (D-033). Las reglas de la carpeta están
> en `DECISIONS.md` (D-022) y los desvíos vigentes en `DECISIONS.md` §Desvíos vigentes.

Catalyst Fund Project **1400106** — *Real-World Real Estate Pre-Sale with Proof & Release*.

## `milestone-1-fundamentos/` — Whitepaper y arquitectura de datos

| Archivo | Entregable | Contenido |
|---|---|---|
| `M1-D1a-WhitePaper.pdf` | **M1-D1** | El whitepaper v1.0 aprobado. Documento fuente del proyecto. |
| `M1-D1b-resumen-whitepaper-castellano.md` | *(derivado)* | Resumen en castellano, sección por sección. Cómodo para trabajar; **no reemplaza al PDF** ante una duda. |
| **`M1-D2-Architecture-and-Data-Models/`** | **M1-D2 — canónico** | El paquete tal como se entregó y hasheó. Detalle abajo. |
| `M1-D2{a,b,c,d}-*.pdf` | M1-D2 (presentación) | Versiones en Illustrator de los cuatro diagramas, agregadas para facilitarle la lectura a los reviewers. Aprobadas y **coincidentes** con los `.puml` originales. |
| `M1-D3-PilotPlan.pdf` | M1-D3 | Plan del piloto: roadmap de tiempos por milestone, más las **cartas de conformidad** de un notario y dos developers. **No define métricas de tiempo ni umbrales numéricos** (verificado). Es el punto de partida del criterio 4 de M3. |
| `M1-D4-Blockchain-Anchoring-Index.md` | M1-D4 | Los tres entregables de M1 con su SHA-256, su TXID y el link a cardanoscan. |

### `M1-D2-Architecture-and-Data-Models/` — el paquete canónico

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
| `README.md` | Resumen de cortesía redactado después. **Menor precedencia** que los artefactos especificados — ver D-022. **Ojo: este README sí es parte del paquete hasheado**, a diferencia de este índice. |

## `milestone-2-diseno/` — Sistema de diseño UX/producto

| Archivo | Entregable | Contenido |
|---|---|---|
| `M2-D1-Information-architecture-and-navigation-map.md` | M2-D1 | Roles (INV/DEV/NOT/CER), matriz de permisos, mapa de navegación por rol, árboles de pantallas, flujos cross-rol, gating de autenticación, i18n, notificaciones. |
| `M2-D2-Screenshots-catalog/` | M2-D2 | Catálogo visual de las ~70 pantallas. Los IDs (`06-07`, `44d`, `52v`…) que el backlog de M2-D5 referencia salen de acá. **Los datos son mock**: lo normativo es la estructura, no los valores. |
| `M2-D3-Design-principles-and-component-library.md` | M2-D3 | 6 principios de diseño, lenguaje visual (color normativo, tipografía, iconografía, espaciado, elevación), 36 componentes, estados de interacción, accesibilidad WCAG 2.1 AA, localización. |
| `M2-D4-UX-docs-and-proof-rendering-patterns.md` | M2-D4 | Los 10 patrones canónicos de renderizado de prueba (P1–P10), principios cross-patrón y los contratos de datos que le imponen al backend. |

## `milestone-3-implementacion/` — Alcance de construcción

| Archivo | Entregable | Contenido |
|---|---|---|
| `Milestone-3-info.md` | SOM M3 | Outputs, criterios de aceptación y evidencia de completitud exigidos para aprobar Milestone 3. |
| `UI-implementation-plan.md` | **M2-D5** | Backlog de 53 entradas: cada pantalla → componentes → endpoints → test IDs → work stream M3. Glosario de refs `M3-BE-01..18`, `M3-SC-01..06`, `M3-FE-01..26`. |
| `Backend-and-smart-contracts-design-and-implementation-plan.md` | **M2-D6** | Baseline arquitectónico: dominios funcionales del backend, modelo de responsabilidad off-chain/on-chain, manejo de evidencia e integridad, dirección de contratos. Apéndice A: trazabilidad D5 → D6. |

> **M2-D5 y M2-D6 son entregables de Milestone 2**, aunque vivan en la carpeta de M3: son los planes
> *de* M3 escritos *en* M2, y en la práctica se leen junto al SOM.

## Qué se eliminó del árbol, y por qué

Solo lo entregado es canónico. Estos existieron y **se eliminaron** el 2026-07-29:

- `M1-D2{a,b,c,d}-*.puml` — regenerados a posteriori desde los PDF, nunca formaron parte de la
  entrega. Contradecían a los originales: flechas invertidas en la FSM, multiplicidades invertidas
  en el modelo de dominio, y componentes perdidos en la arquitectura (`Document Storage`,
  `Milestone State Anchors`). Siguen en el historial de git.

## El proyecto ya ancló sus propios entregables

`M1-D4` es, en la práctica, una versión manual del producto: los tres entregables de M1 fueron
hasheados con SHA-256, anclados en Cardano y publicados con su TXID y su link al explorador —
**en mainnet**. Dos contextos de anclaje que no hay que mezclar:

| Qué se ancla | Quién | Red |
|---|---|---|
| Evidencia y stages de un proyecto inmobiliario | La plataforma | **Preprod** en M3 (D-013) |
| Los entregables de cada milestone Catalyst | El equipo, a mano | **Mainnet**, siguiendo el precedente de M1-D4 |
