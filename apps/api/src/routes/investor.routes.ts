import { randomBytes } from "node:crypto";
import type { InvitationStatus, NotificationCategory, UnitStatus } from "@plataforma/shared";
import {
  acceptInvitationResultSchema,
  cuidParamSchema,
  dossierSchema,
  dossierShareSchema,
  investorContractSchema,
  investorInvitationDetailSchema,
  investorUnitDetailSchema,
  investorUnitListItemSchema,
  notificationQuerySchema,
  notificationSchema,
  projectSchema,
  unitNewsEventSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import type { UserRole } from "../db/types";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { compileDossier } from "../domain/dossier";
import { reconciliarParaLectura } from "../domain/reconcile";
import { ultimoBundlePorStage } from "../domain/stage-transition";
import { db } from "../lib/db";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { renderTextPdf } from "../utils/pdf";
import { avancePorProyecto } from "./_shared";

// **Toda la superficie del investor, bajo `/api/v1/investor`** (M2-D5 §4).
//
// **SPEC-212 §C — migrado a oRPC (D-066), la tercera sub-parte.** Mismo
// patrón que §A/§B, ya cerradas: el schema de cada ruta se declara una sola
// vez en su procedimiento, `authorize` no se toca — sigue siendo middleware
// Express delante de oRPC, ruta por ruta — y el `prefix` de cada
// `OpenAPIHandler.handle()` es el path ABSOLUTO (`PREFIJO_ABSOLUTO`). Ver
// `notary.routes.ts` y SPEC-212 para el porqué completo — acá no se repite.
//
// **Las 14 migran, incluida `export.pdf`.** Un `Buffer` pelado en el body de
// un procedimiento sale serializado como JSON
// (`{"type":"Buffer","data":[...]}`) — probado antes de escribir esto — pero
// el adaptador Node de oRPC tiene un caso especial para `body instanceof
// Blob`/`File`: manda los bytes crudos por stream con el `content-type` del
// propio Blob. `dossierExportProcedure` devuelve un `File`, no un `Buffer`,
// y usa `outputStructure: "detailed"` para fijar el `Content-Disposition`
// exacto (`attachment`) en vez del `inline` que oRPC pondría solo. Ver el
// comentario de esa ruta para el detalle.
//
// Antes vivía repartida en cinco routers agrupados por concepto de dominio
// —favoritos, unidades, dossier, notificaciones, invitaciones—, todos montados
// sobre `/api/v1` pelado. Eso volvía el orden de montaje de `app.ts` carga
// estructural: un `router.use(guard)` corre para TODA request que entra al
// router, matcheen o no sus rutas, así que el guard de OTRA superficie
// contestaba antes de que este router existiera para esa request (SPEC-015 §4).
//
// Ahora el prefijo es de este router y de nadie más, y el orden de montaje no
// puede romper nada. El precio es agrupar por prefijo en vez de por concepto
// —acá conviven unidades, dossier, contratos e invitaciones— y está bien: es
// como agrupa M2-D5 §4.
//
// **El aislamiento cross-rol es la regla de acceso de casi todo lo de acá**
// (M2-D1 §Cross-role data isolation): el investor ve SU unidad, SU contrato, SU
// dossier. Ese chequeo es el `acceso: { dueño: ... }` de `authorize` y se lee en
// la firma de cada ruta, junto con el rol. Vivió suelto adentro de cada handler hasta el
// 2026-09-04, con el argumento de que el dato que decide sale de la fila y no
// del token — cierto, y no alcanza: `requireProjectAccess` también carga una
// fila y nadie lo bajó al handler por eso. Lo que traía era el modo de falla de
// siempre: una ruta nueva que se olvida el `if` compila y sirve la unidad ajena.
//
// **Tres mensajes de 404 están fijados por test, byte a byte** —
// `test/require-ownership.test.ts` compara `res.body.message` contra "Unit not
// found", "Invitation not found" y "Contract not found"— así que las tres
// siguen siendo `ORPCError("NOT_FOUND", { message: "..." })` con el mismo
// literal: el sobre de oRPC deja `message` en el nivel que esos tests ya
// esperaban, sin adaptación (a diferencia del 409 con nombre que sí hizo
// falta para `accept`, ver abajo).
//
// **`accept` tiene dos códigos de negocio fijados por `res.body.code`**
// (SPEC-201, `test/accept-invitation-atomic.test.ts`): `UNIT_NOT_AVAILABLE` e
// `INVITATION_NOT_PENDING`, los dos 409. Van con `.errors({NOMBRE:...})` —
// mismo motivo que `DOSSIER_SIGNED` en `notary.routes.ts`— y reemplazan a la
// clase `InvitationAcceptError` que existía solo para viajar por el `catch`
// de Express; con oRPC, un `throw` DENTRO de `db.transaction().execute(...)`
// sigue revirtiendo la transacción igual (Kysely no distingue el tipo del
// error) y sigue propagándose hasta el `.handle()` de oRPC, así que la clase
// ya no hace falta.

const PREFIJO_ABSOLUTO = "/api/v1/investor";

/** Exportado para que `scripts/generate-openapi.ts` tipe el
 * `os.prefix(...).router(...)` combinado — mismo motivo que en
 * `notary.routes.ts`/`certifier.routes.ts`. */
export type InvestorContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<InvestorContext>();

const router = Router();

/**
 * El dossier de la unidad. **Ya no autoriza**: las tres rutas que lo usan entran
 * por `authorize({ ..., acceso: { dueño: { via: "Unit" } } })`, así que acá solo
 * queda el 404 de una
 * unidad que existe pero todavía no compila un dossier.
 */
async function dossierDeLaUnidad(unitId: string) {
  const dossier = await compileDossier(unitId);
  /* v8 ignore start -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) en las tres rutas que la llaman (SPEC-018) */
  return dossier ? { dossier } : { error: 404 as const };
  /* v8 ignore stop -- @preserve */
}

router.param("id", paramValidator(cuidParamSchema));
router.param("projectId", paramValidator(cuidParamSchema));
router.param("unitId", paramValidator(cuidParamSchema));

router.use(authenticate);

const favoritesProcedure = orpc
  .route({ method: "GET", path: "/favorites" })
  .output(z.array(projectSchema))
  .handler(({ context }) =>
    db
      .selectFrom("Favorite")
      .innerJoin("Project", "Project.id", "Favorite.projectId")
      .selectAll("Project")
      .where("Favorite.userId", "=", context.user.id)
      .orderBy("Favorite.createdAt", "desc")
      .execute()
  );
const favoritesHandler = new OpenAPIHandler({ favoritesProcedure });

router.get(
  "/favorites",
  authorize({ roles: ["admin", "buyer"], acceso: { scopeEnQuery: "Favorite.userId = usuario" } }),
  delegarAOrpc(favoritesHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const addFavoriteProcedure = orpc
  .route({ method: "POST", path: "/favorites/{projectId}", successStatus: 204 })
  .input(z.strictObject({ projectId: cuidParamSchema }))
  .output(z.void())
  .handler(async ({ input, context }) => {
    const proyecto = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", input.projectId)
      .executeTakeFirst();

    if (!proyecto) throw new ORPCError("NOT_FOUND", { message: "Project not found" });

    // Idempotente: marcar dos veces no es un error, es la misma intención.
    await db
      .insertInto("Favorite")
      .values({ userId: context.user.id, projectId: proyecto.id, createdAt: new Date() })
      .onConflict((oc) => oc.columns(["userId", "projectId"]).doNothing())
      .execute();
  });
const addFavoriteHandler = new OpenAPIHandler({ addFavoriteProcedure });

router.post(
  "/favorites/:projectId",
  authorize({ roles: ["admin", "buyer"], acceso: "soloRol" }),
  delegarAOrpc(addFavoriteHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const removeFavoriteProcedure = orpc
  .route({ method: "DELETE", path: "/favorites/{projectId}", successStatus: 204 })
  .input(z.strictObject({ projectId: cuidParamSchema }))
  .output(z.void())
  .handler(async ({ input, context }) => {
    await db
      .deleteFrom("Favorite")
      .where("userId", "=", context.user.id)
      .where("projectId", "=", input.projectId)
      .execute();
    // 204 aunque no existiera: el estado final es el mismo y el cliente no
    // gana nada distinguiendo.
  });
const removeFavoriteHandler = new OpenAPIHandler({ removeFavoriteProcedure });

router.delete(
  "/favorites/:projectId",
  authorize({ roles: ["admin", "buyer"], acceso: { scopeEnQuery: "Favorite.userId = usuario" } }),
  delegarAOrpc(removeFavoriteHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/** Fila 14 — My Units: las del investor autenticado. */
const unitsProcedure = orpc
  .route({ method: "GET", path: "/units" })
  .output(z.array(investorUnitListItemSchema))
  .handler(async ({ context }) => {
    const unidades = await db
      .selectFrom("Unit")
      .innerJoin("Project", "Project.id", "Unit.projectId")
      .select([
        "Unit.id as id",
        "Unit.unitReference as unitReference",
        "Unit.status as status",
        "Unit.sizeM2 as sizeM2",
        "Unit.priceMinorUnits as priceMinorUnits",
        "Unit.currency as currency",
        "Project.id as projectId",
        "Project.name as projectName",
        "Project.city as city"
      ])
      .where("Unit.investorId", "=", context.user.id)
      .execute();

    const avance = await avancePorProyecto([...new Set(unidades.map((u) => u.projectId))]);

    return unidades.map((u) => ({
      ...u,
      status: u.status as UnitStatus,
      /* v8 ignore start -- @preserve: avancePorProyecto setea un valor para cada id que recibe (SPEC-018) */
      progress: avance.get(u.projectId) ?? 0
      /* v8 ignore stop -- @preserve */
    }));
  });
const unitsHandler = new OpenAPIHandler({ unitsProcedure });

router.get(
  "/units",
  authorize({ roles: ["admin", "buyer"], acceso: { scopeEnQuery: "Unit.investorId = usuario" } }),
  delegarAOrpc(unitsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/** Fila 15-18 — el detalle de la unidad, con los stages del proyecto y su anclaje. */
const unitDetailProcedure = os
  .route({ method: "GET", path: "/units/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(investorUnitDetailSchema)
  .handler(async ({ input }) => {
    const unidad = await db
      .selectFrom("Unit")
      .innerJoin("Project", "Project.id", "Unit.projectId")
      .select([
        "Unit.id as id",
        "Unit.unitReference as unitReference",
        "Unit.status as status",
        "Unit.sizeM2 as sizeM2",
        "Unit.floor as floor",
        "Unit.priceMinorUnits as priceMinorUnits",
        "Unit.currency as currency",
        "Unit.investorId as investorId",
        "Project.id as projectId",
        "Project.name as projectName",
        "Project.city as city",
        "Project.country as country"
      ])
      .where("Unit.id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) (SPEC-018) */
    if (!unidad) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    // Los stages son del proyecto, con su estado de anclaje: esto alimenta los
    // StageChips del patrón P9.
    //
    // `ultimoBundlePorStage` (SPEC-213) elige el bundle vigente — un stage
    // acumula uno por cada subida de evidencia antes de completarse, así que
    // un `leftJoin` directo a `EvidenceBundle` duplicaría filas acá.
    const stages = await db
      .selectFrom("Stage")
      .leftJoin(ultimoBundlePorStage, "EvidenceBundle.stageId", "Stage.id")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.stageId", "=", "Stage.id")
          .on("OnChainEvent.eventType", "=", "STAGE_TRANSITION")
          .on("OnChainEvent.toState", "=", "Completed")
      )
      .select([
        "Stage.id as stageId",
        "Stage.name as name",
        "Stage.sequenceOrder as sequenceOrder",
        "Stage.state as state",
        "EvidenceBundle.id as bundleId",
        "OnChainEvent.txid as txid"
      ])
      .where("Stage.projectId", "=", unidad.projectId)
      .orderBy("Stage.sequenceOrder", "asc")
      .execute();

    return { ...unidad, status: unidad.status as UnitStatus, stages };
  });
const unitDetailHandler = new OpenAPIHandler({ unitDetailProcedure });

router.get(
  "/units/:id",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  delegarAOrpc(unitDetailHandler, PREFIJO_ABSOLUTO)
);

/** Fila 15-18 — las novedades de la unidad: los eventos de sus stages. */
const unitNewsProcedure = os
  .route({ method: "GET", path: "/units/{id}/news" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(unitNewsEventSchema))
  .handler(async ({ input }) => {
    const unidad = await db
      .selectFrom("Unit")
      .select(["id", "projectId", "investorId"])
      .where("id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) (SPEC-018) */
    if (!unidad) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    // El anclaje `Pending` que ya está en la cadena se confirma acá, en el
    // momento en que alguien lo mira (D-077).
    await reconciliarParaLectura({ projectId: unidad.projectId });

    return db
      .selectFrom("OnChainEvent")
      .leftJoin("Stage", "Stage.id", "OnChainEvent.stageId")
      .select([
        "OnChainEvent.id as id",
        "OnChainEvent.eventType as eventType",
        "OnChainEvent.toState as toState",
        "OnChainEvent.txid as txid",
        "OnChainEvent.status as status",
        "OnChainEvent.createdAt as createdAt",
        "Stage.name as stageName"
      ])
      .where("OnChainEvent.projectId", "=", unidad.projectId)
      .orderBy("OnChainEvent.createdAt", "desc")
      .limit(50)
      .execute();
  });
const unitNewsHandler = new OpenAPIHandler({ unitNewsProcedure });

router.get(
  "/units/:id/news",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  delegarAOrpc(unitNewsHandler, PREFIJO_ABSOLUTO)
);

/** Fila 26-29 — el dossier compilado, con su hash maestro. */
const dossierProcedure = os
  .route({ method: "GET", path: "/units/{id}/dossier" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(dossierSchema)
  .handler(async ({ input }) => {
    const resultado = await dossierDeLaUnidad(input.id);
    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) (SPEC-018) */
    if (resultado.error === 404) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    const { investorId: _investorId, ...dossier } = resultado.dossier;
    return dossier;
  });
const dossierHandler = new OpenAPIHandler({ dossierProcedure });

router.get(
  "/units/:id/dossier",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  delegarAOrpc(dossierHandler, PREFIJO_ABSOLUTO)
);

/**
 * Fila 26-29 — el export. El PDF es una TRANSCRIPCIÓN del dossier, no una
 * prueba nueva: lleva los mismos hashes y los mismos TXID, completos (regla
 * 16), para que quien lo reciba pueda verificarlos contra el explorer por su
 * cuenta. Un artefacto que dijera "verificado" sin traer con qué comprobarlo
 * sería exactamente lo que D-026 prohíbe.
 *
 * **Migra con `File`, no con un `Buffer` pelado.** El adaptador Node de oRPC
 * (`@orpc/standard-server-node`) tiene un caso especial para `body instanceof
 * Blob`: manda los bytes crudos por stream y arma `content-type`/
 * `content-disposition` desde el propio Blob — un `Buffer` en cambio siempre
 * sale serializado como JSON (`{"type":"Buffer","data":[...]}`), probado
 * antes de escribir esto. `outputStructure: "detailed"` deja fijar el
 * `Content-Disposition` exacto (`attachment`, no el `inline` que pondría
 * solo) en vez de dejárselo al nombre del archivo.
 */
const dossierExportProcedure = orpc
  .route({ method: "GET", path: "/units/{id}/dossier/export.pdf", outputStructure: "detailed" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(
    z.object({ headers: z.record(z.string(), z.string()).optional(), body: z.instanceof(File) })
  )
  .handler(async ({ input, context }) => {
    const resultado = await dossierDeLaUnidad(input.id);
    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) (SPEC-018) */
    if (resultado.error === 404) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    const d = resultado.dossier;
    const pdf = renderTextPdf([
      "PropNexus - Proof dossier",
      "",
      `Project:      ${d.projectName}`,
      `Unit:         ${d.unitReference}`,
      `Compiled at:  ${d.compiledAt.toISOString()}`,
      `Status:       ${d.status}`,
      `Master hash:  ${d.masterHash}`,
      `Notary TXID:  ${d.signatureTxid ?? "(pending)"}`,
      `Completeness: ${d.completeness}% of artifacts have an on-chain reference`,
      "",
      "This document asserts only that these hashes were registered at these times,",
      "and, where a signature TXID is present, that a notary attested to reviewing them.",
      "It certifies nothing about the construction itself.",
      "",
      "Artifacts",
      "---------",
      ...d.artifacts.flatMap((a) => [
        `[${a.kind}] ${a.label}`,
        `  sha256: ${a.sha256 ?? "(none)"}`,
        `  txid:   ${a.txid ?? "(pending)"}`
      ])
    ]);

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "EXPORT_DOSSIER",
      entityType: "Dossier",
      entityId: d.id,
      metadata: { masterHash: d.masterHash }
    });

    // El nombre lleva la ref de la unidad, que no es PII. Nunca el nombre del
    // investor.
    const nombreArchivo = `dossier-${d.unitReference.replace(/[^\w.-]/g, "_")}.pdf`;
    return {
      headers: { "content-disposition": `attachment; filename="${nombreArchivo}"` },
      // `Buffer` tipa su `.buffer` como `ArrayBufferLike` (incluye
      // `SharedArrayBuffer`), que `BlobPart` no acepta — `Uint8Array.from`
      // copia a un `Uint8Array<ArrayBuffer>` limpio, sin tocar los bytes.
      body: new File([Uint8Array.from(pdf)], nombreArchivo, { type: "application/pdf" })
    };
  });
const dossierExportHandler = new OpenAPIHandler({ dossierExportProcedure });

router.get(
  "/units/:id/dossier/export.pdf",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  delegarAOrpc(dossierExportHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/**
 * Fila 28s — compartir. El token es opaco y de 256 bits: es la única
 * credencial del link público, así que no puede derivarse del id de la unidad
 * ni de nada adivinable.
 *
 * **Idempotente** (regla 8): volver a compartir devuelve el MISMO token en vez
 * de invalidar el link que ya se mandó por mail.
 */
const shareDossierProcedure = orpc
  .route({ method: "POST", path: "/units/{id}/dossier/share", successStatus: 201 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(dossierShareSchema)
  .handler(async ({ input, context }) => {
    const resultado = await dossierDeLaUnidad(input.id);
    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) (SPEC-018) */
    if (resultado.error === 404) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    const d = resultado.dossier;

    const fila = await db
      .selectFrom("Dossier")
      .select("shareToken")
      .where("id", "=", d.id)
      .executeTakeFirstOrThrow();

    let token = fila.shareToken;
    if (!token) {
      token = randomBytes(32).toString("hex");
      await db.updateTable("Dossier").set({ shareToken: token }).where("id", "=", d.id).execute();

      await writeAuditLog({
        actorUserId: context.user.id,
        action: "SHARE_DOSSIER",
        entityType: "Dossier",
        entityId: d.id
      });
    }

    // Path sin host: el cliente lo compone con su propio origen. La API no
    // sabe —ni debe saber— bajo qué dominio se sirve el front.
    return {
      shareToken: token,
      path: `/api/v1/public/dossier/${token}`,
      masterHash: d.masterHash
    };
  });
const shareDossierHandler = new OpenAPIHandler({ shareDossierProcedure });

router.post(
  "/units/:id/dossier/share",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  delegarAOrpc(shareDossierHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/**
 * El listado (filas 22 y 62). `unitId` y `category` son los dos filtros que
 * dibujan las `FilterPill` de la captura 22.
 *
 * Un filtro inválido es 400 y no un listado vacío: quien filtra por una
 * categoría que no existe tiene que enterarse, no ver "no hay novedades".
 */
const notificationsProcedure = orpc
  .route({ method: "GET", path: "/notifications" })
  .input(notificationQuerySchema)
  .output(z.array(notificationSchema))
  .handler(async ({ input, context }) => {
    let query = db
      .selectFrom("Notification")
      .select(["id", "category", "titleKey", "paramsJson", "unitId", "readAt", "createdAt"])
      .where("userId", "=", context.user.id);

    if (input.unitId) query = query.where("unitId", "=", input.unitId);
    if (input.category) query = query.where("category", "=", input.category);

    const filas = await query.orderBy("createdAt", "desc").limit(100).execute();

    return filas.map((fila) => ({
      id: fila.id,
      category: fila.category as NotificationCategory,
      titleKey: fila.titleKey,
      params: fila.paramsJson ? JSON.parse(fila.paramsJson) : {},
      unitId: fila.unitId,
      readAt: fila.readAt,
      createdAt: fila.createdAt
    }));
  });
const notificationsHandler = new OpenAPIHandler({ notificationsProcedure });

router.get(
  "/notifications",
  authorize({
    roles: ["admin", "buyer"],
    acceso: { scopeEnQuery: "Notification.userId = usuario" }
  }),
  delegarAOrpc(notificationsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/** Fila 63 — el investor ve la invitación que le llegó. */
const invitationDetailProcedure = os
  .route({ method: "GET", path: "/invitations/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(investorInvitationDetailSchema)
  .handler(async ({ input }) => {
    const invitacion = await db
      .selectFrom("Invitation")
      .innerJoin("Unit", "Unit.id", "Invitation.unitId")
      .innerJoin("Project", "Project.id", "Invitation.projectId")
      .select([
        "Invitation.id as id",
        "Invitation.investorEmail as investorEmail",
        "Invitation.amountMinorUnits as amountMinorUnits",
        "Invitation.currency as currency",
        "Invitation.status as status",
        "Invitation.createdAt as createdAt",
        "Unit.unitReference as unitReference",
        "Project.name as projectName"
      ])
      .where("Invitation.id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Invitation) (SPEC-018) */
    if (!invitacion) throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });

    return { ...invitacion, status: invitacion.status as InvitationStatus };
  });
const invitationDetailHandler = new OpenAPIHandler({ invitationDetailProcedure });

router.get(
  "/invitations/:id",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Invitation", param: "id" } } }),
  delegarAOrpc(invitationDetailHandler, PREFIJO_ABSOLUTO)
);

/**
 * Fila 63 — aceptar. **Ancla** (M3-SC-01).
 *
 * `UNIT_NOT_AVAILABLE` e `INVITATION_NOT_PENDING` son errores CON NOMBRE
 * (`.errors({...})`) y no `ORPCError("CONFLICT", ...)` liso: SPEC-201 fija
 * `res.body.code` exacto para los dos, y el sobre de un `ORPCError` genérico
 * anida el código de dominio en `data.code`, no en `code` — ver el
 * comentario grande al principio del archivo.
 */
const acceptInvitationProcedure = orpc
  .errors({
    INVITATION_NOT_PENDING: { status: 409 },
    UNIT_NOT_AVAILABLE: { status: 409 }
  })
  .route({ method: "POST", path: "/invitations/{id}/accept", successStatus: 201 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(acceptInvitationResultSchema)
  .handler(async ({ input, context, errors }) => {
    const ahora = new Date();

    // Las 4 escrituras nacen o mueren juntas (SPEC-201): sin esto, un
    // `INSERT Contract` que choca contra `Contract_unitId_key` dejaba la
    // unidad ya transferida y la membresía ya otorgada, sin contrato — y a
    // quien ya la había comprado se la había sacado en silencio.
    const { contrato, invitacion } = await db.transaction().execute(async (trx) => {
      const invitacion = await trx
        .selectFrom("Invitation")
        .selectAll()
        .where("id", "=", input.id)
        .executeTakeFirst();

      /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Invitation) (SPEC-018) */
      if (!invitacion) throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });

      // Guarda atómica (punto 2): el `WHERE status = 'pending'` hace que solo
      // una de dos requests concurrentes sobre la MISMA invitación gane esta
      // fila — la otra ve `numUpdatedRows = 0` sin haber tenido que leer el
      // estado antes, que es exactamente la ventana que dejaba pasar el
      // `if (invitacion.status !== "pending")` de arriba (invariante 3).
      const actualizada = await trx
        .updateTable("Invitation")
        .set({ status: "accepted", respondedAt: ahora })
        .where("id", "=", invitacion.id)
        .where("status", "=", "pending")
        .executeTakeFirst();

      if (Number(actualizada.numUpdatedRows) === 0) {
        throw errors.INVITATION_NOT_PENDING({
          message: `Invitation already ${invitacion.status}`
        });
      }

      // Invariante 1: una unidad `sold` no admite invitaciones nuevas. La
      // emisión ya lo impide desde ahora (developer-comercial.routes.ts), pero
      // una invitación `pending` emitida ANTES de ese fix puede seguir
      // existiendo sobre una unidad que otra invitación ya vendió — este
      // chequeo es lo que hace que ese accept falle sin tocar nada más,
      // en vez de chocar recién en el `INSERT Contract` con un
      // `RESOURCE_ALREADY_EXISTS` que no dice qué pasó (invariante 4).
      const unidad = await trx
        .selectFrom("Unit")
        .select(["status"])
        .where("id", "=", invitacion.unitId)
        .executeTakeFirstOrThrow();

      if (unidad.status === "sold") {
        throw errors.UNIT_NOT_AVAILABLE({ message: "Unit is no longer available" });
      }

      // El `status` solo no alcanza: `PATCH /developer/units/:id` puede
      // devolver a `available` una unidad que ya tiene contrato, y
      // `Contract_unitId_key` admite uno por unidad. Sin este chequeo, aceptar
      // la re-invitación chocaba en el `INSERT Contract` y salía como un 500
      // no clasificado (SPEC-018, A1) — la misma invariante 4 de arriba.
      const contratoPrevio = await trx
        .selectFrom("Contract")
        .select("id")
        .where("unitId", "=", invitacion.unitId)
        .executeTakeFirst();

      if (contratoPrevio) {
        throw errors.UNIT_NOT_AVAILABLE({ message: "Unit is no longer available" });
      }

      await trx
        .updateTable("Unit")
        .set({ status: "sold", investorId: context.user.id, updatedAt: ahora })
        .where("id", "=", invitacion.unitId)
        .execute();

      // **La membresía, sin la cual aceptar no sirve de nada.** M2-D1 §4 le da al
      // investor lectura sobre los stages, la evidencia y el contrato del proyecto
      // de su unidad, y el paso 6 del flujo de onboarding dice que después de
      // aceptar ve su unidad "with progress timeline visible". En este código esa
      // lectura se resuelve con membresía por proyecto —`ANY_MEMBERSHIP` incluye
      // `buyer`— y hasta el 2026-09-04 este handler no la creaba: el investor
      // aceptaba y toda ruta con `requireProjectAccess` le contestaba 403,
      // **incluidas las del Merkle proof de su propia evidencia**
      // (`INV-MERKLE-PROOF-002`).
      //
      // `doNothing` por la regla 8: el índice único es
      // (userId, projectId, membershipRole), así que reintentar no duplica.
      await trx
        .insertInto("ProjectMember")
        .values({
          id: createId(),
          userId: context.user.id,
          projectId: invitacion.projectId,
          membershipRole: "buyer",
          createdAt: ahora
        })
        .onConflict((oc) => oc.doNothing())
        .execute();

      // El contrato nace de la aceptación: es el registro del acuerdo, sin
      // custodiar un centavo (D-021).
      const contrato = await trx
        .insertInto("Contract")
        .values({
          id: createId(),
          unitId: invitacion.unitId,
          investorId: context.user.id,
          totalMinorUnits: invitacion.amountMinorUnits,
          currency: invitacion.currency,
          signedAt: ahora,
          createdAt: ahora
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { contrato, invitacion };
    });

    // El anclaje es una transacción de **Cardano**: no puede ser atómico con
    // la base, y D-059 dice que el registro nunca depende de él. Se ancla
    // después del commit, como antes — si falla, la aceptación queda firme y
    // el evento queda `Pending` para reconciliar.
    const anchor = await anchorCommitmentEvent({
      projectId: invitacion.projectId,
      eventType: "INVITATION_ACCEPTED",
      commitment: commitmentOf({
        invitationId: invitacion.id,
        unitId: invitacion.unitId,
        acceptedAt: ahora.toISOString()
      }),
      reference: invitacion.id
    });

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "ACCEPT_INVITATION",
      entityType: "Invitation",
      entityId: invitacion.id,
      // La membresía queda en el mismo asiento: es un otorgamiento de permiso
      // y tiene que poder leerse en el audit log, no deducirse.
      metadata: { txid: anchor.txid, membershipRole: "buyer" }
    });

    return { contract: contrato, anchor };
  });
const acceptInvitationHandler = new OpenAPIHandler({ acceptInvitationProcedure });

router.post(
  "/invitations/:id/accept",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Invitation", param: "id" } } }),
  delegarAOrpc(acceptInvitationHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/**
 * Fila 63 — rechazar. **No ancla**: no hay nada que probar sobre lo que no pasó.
 *
 * A diferencia de `accept`, acá el 409 nunca tuvo `code` en el body (era
 * `{message: ...}` liso) y ningún test lo pide — `ORPCError("CONFLICT", ...)`
 * sin nombre alcanza; usar `.errors()` acá sería agregar un campo que el
 * contrato de hoy no tiene, y SPEC-212 no cubre eso.
 */
const declineInvitationProcedure = orpc
  .route({ method: "POST", path: "/invitations/{id}/decline", successStatus: 204 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.void())
  .handler(async ({ input, context }) => {
    const invitacion = await db
      .selectFrom("Invitation")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Invitation) (SPEC-018) */
    if (!invitacion) throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
    if (invitacion.status !== "pending") {
      throw new ORPCError("CONFLICT", { message: `Invitation already ${invitacion.status}` });
    }

    const ahora = new Date();
    await db
      .updateTable("Invitation")
      .set({ status: "declined", respondedAt: ahora })
      .where("id", "=", invitacion.id)
      .execute();

    // La unidad vuelve a estar disponible.
    await db
      .updateTable("Unit")
      .set({ status: "available", updatedAt: ahora })
      .where("id", "=", invitacion.unitId)
      .execute();

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "DECLINE_INVITATION",
      entityType: "Invitation",
      entityId: invitacion.id
    });
  });
const declineInvitationHandler = new OpenAPIHandler({ declineInvitationProcedure });

router.post(
  "/invitations/:id/decline",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Invitation", param: "id" } } }),
  delegarAOrpc(declineInvitationHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/** Fila 23-24 — el contrato de la unidad del investor. */
const contractProcedure = os
  .route({ method: "GET", path: "/contracts/{unitId}" })
  .input(z.strictObject({ unitId: cuidParamSchema }))
  .output(investorContractSchema)
  .handler(async ({ input }) => {
    const contrato = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select([
        "Contract.id as id",
        "Contract.totalMinorUnits as totalMinorUnits",
        "Contract.currency as currency",
        "Contract.signedAt as signedAt",
        "Contract.investorId as investorId",
        "Unit.unitReference as unitReference"
      ])
      .where("Contract.unitId", "=", input.unitId)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (ContractOfUnit) (SPEC-018) */
    if (!contrato) throw new ORPCError("NOT_FOUND", { message: "Contract not found" });

    return contrato;
  });
const contractHandler = new OpenAPIHandler({ contractProcedure });

router.get(
  "/contracts/:unitId",
  authorize({
    roles: ["admin", "buyer"],
    acceso: { dueño: { via: "ContractOfUnit", param: "unitId" } }
  }),
  delegarAOrpc(contractHandler, PREFIJO_ABSOLUTO)
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las
 * 14 rutas migradas. */
export const investorOrpcRouter = {
  favoritesProcedure,
  addFavoriteProcedure,
  removeFavoriteProcedure,
  unitsProcedure,
  unitDetailProcedure,
  unitNewsProcedure,
  dossierProcedure,
  dossierExportProcedure,
  shareDossierProcedure,
  notificationsProcedure,
  invitationDetailProcedure,
  acceptInvitationProcedure,
  declineInvitationProcedure,
  contractProcedure
};

export default router;
