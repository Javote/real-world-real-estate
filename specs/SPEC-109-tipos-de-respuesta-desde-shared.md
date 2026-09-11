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
