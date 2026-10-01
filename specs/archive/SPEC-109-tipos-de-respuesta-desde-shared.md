# SPEC-109 — `api/types.ts`: cerrar la garantía de "drift imposible"

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md) §F-13.
> Nivel 🟡 — toca el contrato que comparten los dos frentes. **Independiente**, pero es la más
> grande de la serie 1xx y **merece su propia sesión**. No toca ningún criterio del SOM.

## El problema, en una frase

`apps/web/src/api/types.ts` son **414 líneas de espejo manual**, y **20 de sus 31 tipos ya tienen
schema Zod en `packages/shared`**. Según `CLAUDE.md` §Estructura, `packages/shared` es *"lo único que
vuelve el drift **imposible** en vez de prohibido"* — hoy lo es para 11 tipos de 31.

El comentario del archivo dice *"cada uno migra a `packages/shared` cuando su rebanada lo toque"*.
**Las rebanadas ya pasaron y el espejo sigue.**

## Por qué no es desidia: el bloqueo es real

Los schemas usan `z.coerce.date()`, así que `StageResponse.createdAt` es **`Date`** mientras el cable
manda **`string`**. Reusar el tipo inferido tal cual **rompe**: el front recibiría un `string` tipado
como `Date` y `.toISOString()` explotaría en runtime.

**La salida no es copiar el schema: es derivar un tipo de respuesta serializada.**

```ts
// packages/shared — una vez, para todos
type Serializado<T> = T extends Date ? string : T extends object ? { [K in keyof T]: Serializado<T[K]> } : T;
export type StageResponse = Serializado<z.infer<typeof stageSchema>>;
```

Un tipo derivado no puede divergir del schema: si el schema gana un campo, el tipo lo gana; si lo
pierde, el front no compila. Es la diferencia entre prohibido e imposible, que es la tesis del
paquete.

## Alcance

- **Cubre:** los **20** tipos que ya tienen schema:
  `ProjectStatus` · `EvidenceType` · `Stage` · `Project` · `ProjectDetail` · `Evidence` ·
  `DeveloperProject` · `DeveloperProjectDetail` · `Invitation` · `DeveloperContract` ·
  `InvestorUnit` · `ProjectDocument` · `BuildingSchematicFloor` · `InvestorUnitStage` ·
  `InvestorUnitDetail` · `InvestorContract` · `ContractRelease` · `BundleFiles` ·
  `InvestorInvitation` · `PublicDossier`
- **NO cubre:** los **11 sin equivalente** hoy — `ProjectCreated`, `ProjectMemberUser`,
  `StageEvidenceAnchor`, `AuditEvent`, `DeveloperUnit`, `DeveloperProjectUnit`, `ProjectStageDetail`,
  `InvestorUnitNews`, `MerkleProof`, `InvitationAcceptResult`, `ProgressRow`. **Crearles un schema es
  trabajo de backend**, no de este archivo, y entra cuando su ruta lo toque. Quedan como espejo
  manual, con el comentario diciendo cuáles y por qué.
- **NO cubre:** cambiar un solo byte de lo que la API devuelve. **Esta spec no toca `apps/api`.**

## Invariantes

1. **Ningún tipo de `api/types.ts` que tenga schema en `shared` se escribe a mano.**
2. **El tipo que el front usa es el serializado**, no el inferido crudo: donde el cable manda
   `string`, el tipo dice `string`.
3. **La API no cambia.** Si al derivar aparece una diferencia entre el espejo y el schema, **el
   schema gana y la diferencia se anota** — es precisamente el drift que esta spec existe para
   encontrar, y puede ser un bug del front que hoy nadie ve.
4. El archivo que queda dice **explícitamente** cuáles de los 11 faltan y por qué, en una lista que
   se puede tachar.

## Casos borde

| Caso | Esperado |
|---|---|
| Campo `Date` anidado (array de objetos con fecha) | `Serializado<T>` lo recorre; se prueba con `InvestorUnitDetail`, que anida stages |
| Campo `nullable` u `optional` | el tipo derivado conserva la diferencia (`null` no es `undefined`) |
| El espejo tenía un campo que el schema no tiene | no compila, y **se investiga antes de borrarlo**: o el front lo usa y la API lo manda sin schema, o es un fantasma |
| Un `z.coerce.number()` | no se convierte a string: solo `Date` cambia de forma en el cable |

## Verificación

`pnpm verify` del front, y una pasada por las superficies que muestran fechas (`/developer/progress`,
dossier, audit log) para confirmar que **ninguna** pasó a mostrar `Invalid Date` — que es el síntoma
exacto que el tipo mentiroso venía escondiendo.

## Cerrada 2026-09-19

Los 20 tipos que la spec cubría se derivan con `Serialized<T>` (`packages/shared/src/serialize.ts`,
nuevo). Verificado **campo por campo contra el schema y contra el handler real** antes de derivar
cada uno — no alcanzaba con que los nombres coincidieran, dos veces la forma real difería de lo que
decía el espejo:

1. **Un bug de producción, real.** `DeveloperProjectDetail` heredaba `progress`/`stageCount`/
   `priceFromMinorUnits`/`priceCurrency` de `DeveloperProject` (la fila de LISTA), pero
   `GET /developer/projects/:id` (`developer.routes.ts:145`) nunca los manda — devuelve
   `{...proyecto, stages, evidenceCount}` a secas. `developer.project.$projectId.index.tsx` leía
   `proyecto?.progress ?? 0`: el StatCard de avance mostraba **0% siempre**, tapado por el
   fallback. Confirmado con Claude en Chrome contra `pnpm dev` antes y después del fix — Torre A
   (1/10 etapas completadas) pasó de "0% Avance" a "10% Avance". Se corrigió calculando el avance de
   `proyecto.stages` con `avanceDeStages` (mismo helper que ya usa el resto de la app), no agregando
   el campo al backend: el dato completo para calcularlo ya viaja.
2. **Cuatro sitios donde el backend manda más de lo que el front sabía leer** — la misma familia de
   hallazgo que SPEC-107 hizo del otro lado del contrato: `MerkleProof` (`GET /evidence/:id/proof/
   :hash`) sin `signerUserId`/`anchorStatus`/`txid`/`timestamp` (`evidenceProofSchema` sí los tiene);
   `ProjectStageDetail.events[]` sin `outputRef`; el `anchor` narrow (`{txid, status}`) en
   `ProjectCreated`, `StageEvidenceAnchor` e `InvitationAcceptResult` donde el evento real es el
   `OnChainEvent` completo. Ninguno tenía consumidor todavía — quedan disponibles, no invisibles.

`ProjectStageDetail` (uno de los 11 "sin schema") se pudo componer igual, sin inventar un schema
nuevo: `GET /projects/:id/stages/:stageId` arma su respuesta a partir de tres piezas que sí tienen
schema cada una (`stageSchema` + `stageEvidenceSummarySchema` + `evidenceBundleSummarySchema` +
`stageEventSummarySchema`) — el tipo se compone de esas cuatro, sin un quinto schema que las una.

**Los 10 que siguen sin schema, confirmados uno por uno contra `packages/shared`, no supuestos**:
`ProjectMemberUser` en realidad SÍ tenía equivalente (`ProjectMemberWithUser['user']`) y ya no cuenta
como manual. Quedan genuinamente sin schema: `AuditEvent` (los dos enums sí llegaron con SPEC-207;
una fila completa del audit log, no), `ProjectStageDetail` (compuesto, arriba). El resto de los 11
originales — `DeveloperUnit`, `DeveloperProjectUnit`, `InvestorUnitNews`, `MerkleProof`,
`InvitationAcceptResult`, `ProgressRow`, `ProjectCreated` — **sí tenían schema y la auditoría no lo
vio**: el código cambió entre la auditoría y esta sesión, verificado grep por grep, no asumido.
