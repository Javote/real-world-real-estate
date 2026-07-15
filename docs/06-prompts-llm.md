# 06 — Prompts plantilla para desarrollo con LLMs

Cómo trabajar: cada dev abre Claude Code (u otro agente) en la raíz del repo — el `CLAUDE.md` ya le da el contexto global. Para cada tarea del backlog, usar el prompt correspondiente **rellenando los corchetes** y pegando/refiriendo los docs indicados. Regla: una tarea por sesión; revisar el diff antes de commitear; el LLM no decide arquitectura, la ejecuta.

---

## Plantilla general (cualquier tarea)

```
Tarea: [REF del backlog, ej. M3-BE-13] — [título].
Leé primero: CLAUDE.md, la spec correspondiente en specs/, las D-0XX relevantes de DECISIONS.md y docs/[NN]-... (precedencia: DECISIONS > CLAUDE > specs > docs).
Alcance exacto: [copiar la fila del backlog + endpoints/componentes de docs/03 o 05].
Fuera de alcance: [lo que NO debe tocar].
Criterios de aceptación:
- [ ] Schema Zod en packages/shared exportado y usado por la API
- [ ] Tests: caso feliz + [errores específicos]
- [ ] audit_log en mutaciones
- [ ] pnpm typecheck && pnpm test en verde
Al terminar: mostrame el diff resumido y proponé el mensaje de commit según docs/GUIA-COMMITS.md.
No inventes endpoints, campos ni dependencias nuevas; si falta algo en la spec, preguntá.
Si durante la tarea surge una decisión o un gotcha, incluí su persistencia (DECISIONS.md / sección Gotchas de CLAUDE.md / la spec) EN EL MISMO PR.
```

## Backend — endpoint nuevo

```
Implementá [MÉTODO RUTA] según docs/03-api-spec.md sección [X].
1. Definí [Nombre]Request/[Nombre]Response en packages/shared/src/schemas/[dominio].ts (Zod).
2. Router Hono en packages/api/src/routes/[dominio].ts con middleware authJwt + requireRole("[rol]").
3. Persistencia con Drizzle usando el esquema existente de packages/db (no modifiques el esquema sin avisar).
4. Escribí audit("[categoria]", "[accion]", actor, entidad).
5. Tests con vitest: 200 feliz, 401 sin token, 403 rol incorrecto, [caso 422 de negocio].
Errores en formato { error: { code, message } } con código estable.
```

## Backend — pipeline de anclaje de evidencia (M3-BE-13)

```
Implementá POST /developer/projects/:id/stages/:stageId/evidence (docs/03, sección M3-BE-13):
multipart → validar MIME/tamaño (whitelist en docs/02) → subir a S3 → sha256 por archivo →
merkle root (packages/cardano/src/merkle.ts, orden lexicográfico de hojas) →
anchorCommitment({type:"evidence_bundle", hashHex: root, ref: bundleId}) →
persistir evidence_items, evidence_bundles, onchain_events → responder
{bundleId, files[], merkleRoot, txid, explorerUrl}.
Mockeá el submit a Cardano en tests (inyectá el cliente); un test de integración real
queda detrás de la env CARDANO_E2E=1.
```

## Frontend — pantalla nueva

```
Implementá la superficie [ruta, ej. /developer/project/:projectId/upload] según docs/05
([REF FE]) usando TanStack Start + shadcn.
Componentes del sistema de diseño a usar: [de la tabla del backlog, ej. SelectDropdown(stage),
FileDropzone, TextArea, PrimaryButton, StageChip 1-10].
Datos: TanStack Query contra [endpoints], tipos importados de @plataforma/shared.
Estados: loading (skeleton), vacío, error (toast), éxito ([ej. AnchoringSuccessModal con
HashChip del Merkle root y TXID linkeado a $EXPLORER_BASE/tx/:txid]).
data-testid: [Test IDs de la tabla, ej. DEV-EVIDENCE-UPLOAD-001].
Reusá los componentes de dominio de src/components/domain/; no crees variantes nuevas
de HashChip/StatusPill/TxidModal.
Textos en español vía el helper de i18n existente.
```

## Aiken — validador nuevo

```
En contracts/, implementá el validador [nombre] ([REF SC]) según docs/04-smart-contracts-aiken.md.
Datum/Redeemer en lib/plataforma/types.ak.
Condición: [ej. gastar el UTxO exige que extra_signatories contenga authorized_signer].
Tests aiken: caso válido, firma ausente, firmante incorrecto[, double-satisfaction si custodia fondos].
Después de `aiken build`, actualizá packages/cardano/src/blueprint.ts para exponer la
dirección del script y helpers tipados de datum. No hardcodees direcciones.
Verificá la sintaxis contra la versión instalada (aiken --version) antes de asumir stdlib.
```

## Revisión de PR (segundo LLM como reviewer)

```
Revisá este diff contra CLAUDE.md y docs/[relevantes]. Buscá específicamente:
1. PII o URLs en metadata on-chain, datums o logs.
2. Endpoints/campos que no están en docs/03.
3. Mutaciones sin audit_log.
4. storage_key expuesta o URLs prefirmadas sin TTL.
5. Transiciones de milestone que salteen las reglas de docs/02.
6. En Aiken: dependencia del orden de inputs, falta de test negativo, todo/fail sueltos.
Devolvé: lista de bloqueantes, lista de sugerencias, veredicto.
```

## Debugging guiado

```
Contexto: [tarea REF]. Síntoma: [error exacto / output].
Reproducción: [comando].
Restricción: no cambies contratos de API ni esquema de DB para "hacer pasar" el test;
si el test está mal, explicá por qué antes de tocarlo.
```
