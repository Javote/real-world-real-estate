# ROADMAP.md

> Precedencia: este documento es histórico/direccional. Ante conflicto, mandan DECISIONS.md y CLAUDE.md. El detalle tarea-por-tarea vive en `docs/05-backlog-tareas.md` (este roadmap no lo duplica; linkea).
>
> **Estado 2026-07-15 (consolidación):** Sprint 0 (bootstrap) ejecutado en este repo. Del Sprint 1, el Frente B (API demo) quedó cubierto por el backend adoptado (D-016) y el Frente A tiene las pantallas portadas de la maqueta conectadas a la API real; quedan el adaptador mock (SPEC-004), el Frente C (walking skeleton, SPEC-001 — sigue siendo el spike de D-005) y los tests. Donde abajo dice "Hono+Drizzle", leer "la API existente" (D-016).

## Mandato (una frase)

Entregar la plataforma de milestones con evidencia anclada en Cardano correspondiente al Milestone 3 aprobado: backend, smart contracts y las 4 superficies por rol, verificable públicamente por TXID.

## Qué controlamos y qué no

- **Controlamos:** todo el código, el deploy, la red Preprod (faucet libre), el alcance de cada sprint.
- **No controlamos:** aprobación de gobernanza para mainnet, disponibilidad de Blockfrost, tiempos de confirmación de la red, adopción de wallets CIP-30 por los profesionales (notarios/certificadores).
- **Consecuencia (principio 8):** "listo" se define como **listo para activar**: todo lo que depende de terceros queda detrás de configuración (`CARDANO_NETWORK`, `ANCHOR_MODE`, D-014), activable en días.

## "Listo" (binario, verificable)

El proyecto está listo cuando **todas** estas afirmaciones son verificables por un tercero sin ayuda del equipo:

0. **Demo local (hito temprano, fin Sprint 1):** `pnpm demo` levanta el front en modo mock sin backend; `pnpm demo:full` levanta front + API + Docker, y el flujo login → crear proyecto (dirección, pisos) → subir documentación → ver hashes funciona de punta a punta (SPEC-004/005).
1. `pnpm skeleton ./sample.pdf` (modo real) imprime `VERIFIED` y un TXID visible en cardanoscan Preprod.
2. Un developer sube evidencia desde la UI y recibe Merkle root + TXID; un investor ve esa evidencia con su prueba de inclusión y el link al explorer funciona.
3. Un certificador certifica una etapa → la etapa queda `Certified` con `certified_at` y TXID de commit; el flujo de observación (`Observed` → reapertura) funciona.
4. Un notario firma un dossier → TXID de firma; el dossier compartido por token público es visible sin login y sin PII de terceros.
5. `aiken check` verde; `plutus.json` commiteado coincide con el código (CI lo verifica).
6. Los E2E por rol (Test IDs del backlog) pasan en CI con `ANCHOR_MODE=simulated`.
7. Push a `main` despliega solo (migraciones incluidas) y `GET /health` responde en producción.

## Decisiones abiertas (con default — detalle en DECISIONS.md)

| Decisión | Default | Spike que la refuta | Cierra en |
|---|---|---|---|
| D-005 Lucid vs Mesh | Lucid Evolution | El walking skeleton mismo (≤2 días) | Fin Sprint 1 |
| D-009 Custodia de firmas profesionales | Co-firma CIP-30 | Prototipo con un certificador real (≤3 días) | Sprint de Fase B (4) |
| D-010 Railway vs Coolify | Railway | Ninguno — reversión barata documentada | Ya operativa |

## Sprints (criterios de salida binarios; la fecha no se mueve, el alcance sí)

**Sprint 0 — Bootstrap (≤2 días).** Orden del playbook: commit 1 = docs (CLAUDE.md, DECISIONS.md, ROADMAP.md, specs/, docs/, .gitignore) · commit 2 = scaffold auditado · commit 3 = CI + protección de rama.
*Salida:* CI verde en un PR de prueba; `main` protegida; deploy conectado (aunque despliegue un hello-API con `/health`).

**Sprint 1 — Tres frentes en paralelo (mapa completo en `specs/README.md`).**
Día 1, **T0 (bloquea a todos, medio día):** contrato Zod del dominio demo en `packages/shared` (SPEC-005 §1), escrito en conjunto por los dueños de los frentes A y B.
Después, en paralelo y sin pisarse:
- **Frente A — Demo frontend (SPEC-004):** login demo, listado/creación de proyecto (dirección, pisos, unidades), subida y listado de documentación con `HashChip` + estado de anclaje. Corre 100% en modo mock, sin backend (`pnpm demo`). Estética Airbnb provisional.
- **Frente B — API demo (SPEC-005):** los 7 endpoints del contrato con Hono+Drizzle+MinIO; documentos con sha256 real y `anchorStatus:"pending"`; `anchorQueue` noop dejando el costurón para el anclaje.
- **Frente C — Walking skeleton (SPEC-001):** `scripts/skeleton.ts` archivo → hash → Merkle → anchor Preprod → `VERIFIED`. Es el spike de D-005; no depende de A ni B.
Cierre del sprint = **Integración 1:** `VITE_API_MODE=real` y el front habla con la API sin cambios (el contrato compartido lo garantiza).
*Salida (binaria):* (a) `pnpm demo` muestra el flujo completo en mock; (b) `pnpm demo:full` lo muestra contra la API real con hashes reales; (c) criterio 1 de "listo" cumplido por el skeleton; (d) D-005 cerrada en DECISIONS.md.

**Sprint 2 — Integración 2 + engordar el hilo.** Conectar `anchorQueue` real → `AnchorPort` (los documentos pasan de `pending` a `anchored`+txid **sin tocar el front**); esquema Drizzle completo + seed; auth/guards definitivos (M3-BE-01); projects/stages (M3-BE-03/04); endpoint de evidencia por milestone (M3-BE-13) sobre el mismo AnchorPort; audit log (M3-BE-16). SPEC-002 (máquina de estados) se escribe este sprint porque su código llega en el 3.
*Salida:* un documento subido desde la UI de la demo termina `anchored` con TXID verificable en cardanoscan; transiciones inválidas de milestone devuelven 409/422 con test.

**Sprint 3 — Superficie developer + componentes de dominio.** Login, panel, projects, units, **upload + AnchoringSuccessModal**, invitaciones, contratos, dashboards, audit log. Detalle: docs/05 §Sprint 2 (tareas 2.1–2.10).
*Salida:* criterio 2 de "listo" cumplido vía UI, E2E `DEV-EVIDENCE-UPLOAD-001` verde en CI (simulado).

**Sprint 4 — Superficie investor.** Browse/buy, detalle, stage detail con pruebas Merkle, units, contratos, dossier + share, notificaciones. Detalle: docs/05 §Sprint 3.
*Salida:* dossier público por token accesible sin login, sin PII de terceros (revisión manual + test).

**Sprint 5 — Fase B on-chain + notary/certifier.** Validadores `certification` y `notary_commit` + spike D-009; workflows y superficies de ambos roles; validador de milestones para `validation_critical` si D-009 lo habilita; `stage_release` al final con tests exhaustivos (autonomía ROJA — ver COMMITS).
*Salida:* criterios 3, 4 y 5 de "listo" cumplidos.

**Sprint 6 — Cierre.** E2E completos por rol, hardening (rate limiting, TTLs, logs sin PII), pase de coherencia documental, guion de demo E2E como script + staging presentable.
*Salida:* los 7 criterios de "listo" verdes; demo ejecutada de punta a punta frente a alguien externo al equipo.

## Riesgos, señal temprana y plan B

| Riesgo | Señal temprana | Plan B |
|---|---|---|
| Lib web3 bloquea (D-005) | El skeleton no ancla en día 2 | Repetir skeleton con Mesh; decidir con evidencia |
| Fricción CIP-30 con profesionales reales (D-009) | Spike del Sprint 5 | Custodia delegada documentada con controles |
| Blockfrost caído/limitado | Errores 402/429 en logs del adaptador | `ANCHOR_MODE=simulated` mantiene el producto usable; cola de re-anclaje al volver |
| Confirmaciones lentas rompen UX | AnchoringSuccessModal tarda >30s en demo | Modal en dos tiempos: "enviado" (txid) → "confirmado" (webhook/poll) |
| Sintaxis Aiken difiere de lo escrito | `aiken check` rojo en Sprint 0/1 | Gotcha documentada; ajustar contra `aiken --version` pineada en CI |
| Scope creep de UI | Sprint 3/4 no cierran su criterio | Cortar superficies secundarias (docs/05 marca P1/P2); la fecha no se mueve |
