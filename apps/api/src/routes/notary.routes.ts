import {
  cuidParamSchema,
  cursorPaginationSchema,
  dossierRejectResultSchema,
  dossierSchema,
  dossierSignResultSchema,
  notaryKpisSchema,
  notarySignatureSchema,
  paginatedResponseSchema,
  pendingDossierSchema,
  rejectDossierSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import type { UserRole } from "../db/types";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { compileDossier } from "../domain/dossier";
import { notifyUnitInvestor } from "../domain/notify";
import { reconciliarParaLectura } from "../domain/reconcile";
import { db } from "../lib/db";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";

// El flujo del notario (M2-D5 filas 52v, 52s, 52r, 53) — **M3-BE-17** y
// **M3-SC-04**.
//
// **SPEC-212 §A — migrado a oRPC (D-066), el primero de las cuatro
// sub-partes.** El schema de cada ruta se declara una sola vez en su
// procedimiento (`packages/shared`, sin reescribir ninguno) y de ahí salen la
// validación, la respuesta y el fragmento de OpenAPI — ver
// `scripts/generate-openapi.ts`, que ya no tiene entrada de `notary` en
// `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS`.
//
// **`authorize` no cambia de lugar ni de forma.** Cada ruta sigue siendo
// `router.metodo(path, authorize(...), handlerDeExpress)` — oRPC reemplaza
// SOLO el cuerpo del handler, nunca la cadena de autorización. Por eso hay un
// `OpenAPIHandler` por procedimiento (montado en el path exacto de esa ruta) y
// no uno solo compartido por el archivo: un handler compartido montado en el
// prefijo del router no deja que cada ruta declare su propio `acceso`.
//
// **El `prefix` que necesita `.handle()` es el path ABSOLUTO, no el relativo
// dentro de este router.** oRPC lee `req.originalUrl` (nunca `req.url`), y
// Express no reescribe `originalUrl` al entrar a un sub-router — solo
// `req.url`/`req.baseUrl`. Un `prefix` relativo (p. ej. `"/kpis"`) nunca
// matchea una request real a `/api/v1/notary/kpis`: hay que pasarle
// `PREFIJO_ABSOLUTO`, uno solo para las seis, y que cada procedimiento
// declare su propio `path` relativo a ESE prefijo (`/kpis`,
// `/dossiers/{id}/sign`, ...) — nunca `"/"` para más de uno, porque
// `scripts/generate-openapi.ts` arma el documento con
// `os.prefix(PREFIJO_ABSOLUTO).router(notaryOrpcRouter)`, y ahí sí los seis
// comparten el mismo prefijo: dos procedimientos con `path: "/"` colapsarían
// al mismo path de OpenAPI (se encontró generando el doc por primera vez,
// antes de este comentario). Probado con un router anidado de verdad (no el
// smoke test, que monta al top level) antes de escribir esto — `matched:
// false` con un prefix relativo, `true` con el absoluto. Si `MONTAJE`
// (`app.ts`) alguna vez deja de montar este router en `/api/v1/notary`,
// `PREFIJO_ABSOLUTO` tiene que cambiar con él.
//
// **Los dos 404 de "no existe el dossier" y el 404 de "no se pudo compilar"
// se resuelven adentro del procedimiento, con `ORPCError("NOT_FOUND", ...)`.**
// Ningún test de `dossier.test.ts` fija el body exacto de esos 404 (solo el
// de `/reject` cuando el dossier YA está firmado, ver abajo), así que dejar
// que oRPC arme el sobre de error ahí es una adaptación sin costo — no es un
// cambio de contrato que alguien dependa de que no ocurra.
//
// **La única excepción es el 409 `DOSSIER_SIGNED` de `/reject`,** que SÍ tiene
// un test fijando `status === 409` y `body.code === "DOSSIER_SIGNED"`. El
// sobre de error nativo de oRPC anida el código de dominio en `data.code`, no
// en `code` (que ahí es el código de error DE ORPC, "CONFLICT") — cambiarlo
// sería tocar un contrato de error que SPEC-212 declara fuera de alcance
// ("NO cubre: cambiar un solo contrato de API"). Por eso esa única
// comprobación se queda como pre-chequeo en Express, exactamente con el mismo
// `res.status(409).json(...)` de siempre, y solo lo que sigue —validar el
// body y escribir— pasa por oRPC.
//
// **Lo único que la firma afirma** (D-026): que esta persona atestiguó haber
// revisado estos hashes en este momento. No dice que los documentos sean
// auténticos, ni que la obra esté bien, ni que la operación sea válida. El copy
// y el datum tienen que sostener exactamente eso y nada más.
//
// **Lo que se ancla es el `masterHash`, no el dossier.** El contenido del
// dossier nombra unidades y personas: nada de eso puede ir a la cadena (regla
// 2). El commitment compromete el hash maestro y el id opaco del dossier.
//
// El notario NO tiene membresía por proyecto: revisa dossiers de cualquier
// proyecto. Por eso acá el `acceso` de todas las rutas es `"soloRol"` — es la
// excepción que M2-D1 §4 declara para el rol, no un olvido.
//
// **Y las rutas de `/dossiers/:id` tampoco tienen regla de pertenencia**, que es
// lo que uno esperaría de una ruta con `:id`: el dossier pendiente es una **cola
// de trabajo compartida** y cualquier notary firma cualquiera; `signedById` se
// escribe recién al firmar. Lo que hacen `/kpis` y `/signatures` con esa columna
// es acotar la vista, que es scope y no autorización. Se verificó al migrar
// (2026-09-04): si algún día el dossier se asigna a un notary, esto pasa a ser
// `{ dueño: ... }` y deja de ser `"soloRol"`.

const PREFIJO_ABSOLUTO = "/api/v1/notary";

/** El contexto que cada procedimiento recibe — siempre el usuario ya
 * autenticado por `authenticate`, corrido antes de que oRPC vea la request.
 * Exportado para que `scripts/generate-openapi.ts` pueda tipar el `os.prefix(
 * ...).router(...)` combinado que arma para los docs: un router con
 * procedimientos de distinto contexto inicial (algunos piden `user`, otros
 * ninguno) solo tipa si se construye desde ESTE contexto, el más ancho de
 * los dos. */
export type NotaryContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<NotaryContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

/**
 * Fila 51 — los KPI del notario. **Ya no son `null`.**
 *
 * Lo eran mientras el dossier no existía como entidad: `null` decía "no hay
 * modelo" y cero habría dicho "no tenés trabajo", que es una afirmación
 * distinta. Ahora `Dossier` existe y los cuatro se cuentan de verdad — el
 * schema los sigue aceptando nullable porque la distinción vale para los KPI
 * del developer que todavía no se pueden calcular.
 */
const kpisProcedure = orpc
  .route({ method: "GET", path: "/kpis" })
  .output(notaryKpisSchema)
  .handler(({ context }) => {
    return db
      .selectFrom("Dossier")
      .select(["id", "status", "signedById", "unitId"])
      .execute()
      .then((filas) => {
        // Un admin ve el total; un notario, lo que firmó él más la cola común.
        const firmados = filas.filter(
          (f) =>
            f.status === "signed" &&
            (context.user.role === "admin" || f.signedById === context.user.id)
        );
        const pendientes = filas.filter((f) => f.status === "compiled");

        return {
          pendingDossiers: pendientes.length,
          // "Verificado" acá es el dossier revisado y resuelto: firmado o
          // rechazado. No afirma nada sobre la obra (D-026).
          verified: filas.filter((f) => f.status !== "compiled").length,
          signed: firmados.length,
          unitsUnderReview: new Set(pendientes.map((f) => f.unitId)).size
        };
      });
  });
const kpisHandler = new OpenAPIHandler({ kpisProcedure });

router.get(
  "/kpis",
  authorize({
    roles: ["admin", "notary"],
    acceso: { scopeEnQuery: "Dossier.signedById = usuario" }
  }),
  delegarAOrpc(kpisHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/**
 * Fila 51 — la cola de revisión, con la barra de completitud.
 *
 * `completeness` es **qué fracción de la evidencia del dossier tiene su prueba
 * sustanciada**, no "cuán listo está": un dossier al 60% tiene el 40% de sus
 * artefactos todavía sin TXID (regla 17).
 */
const pendingDossiersProcedure = os
  .route({ method: "GET", path: "/dossiers/pending" })
  .output(z.array(pendingDossierSchema))
  .handler(async () => {
    const filas = await db
      .selectFrom("Dossier")
      .innerJoin("Unit", "Unit.id", "Dossier.unitId")
      .leftJoin("User", "User.id", "Unit.investorId")
      .select([
        "Dossier.id as dossierId",
        "Dossier.unitId as unitId",
        "Unit.unitReference as unitReference",
        "User.fullName as investorName"
      ])
      .where("Dossier.status", "=", "compiled")
      .orderBy("Dossier.compiledAt", "asc")
      .limit(50)
      .execute();

    const pendientes: z.infer<typeof pendingDossierSchema>[] = [];
    for (const fila of filas) {
      const dossier = await compileDossier(fila.unitId);
      pendientes.push({
        dossierId: fila.dossierId,
        unitLabel: fila.unitReference,
        // Sin investor asignado la unidad no se vendió todavía; el panel muestra
        // la referencia de la unidad y no un nombre inventado.
        /* v8 ignore start -- @preserve: un Dossier solo se compila para una unidad con investor (SPEC-018) */
        investorName: fila.investorName ?? fila.unitReference,
        /* v8 ignore stop -- @preserve */
        /* v8 ignore start -- @preserve: un Dossier solo se compila para una unidad con investor (SPEC-018) */
        completeness: dossier?.completeness ?? 0
        /* v8 ignore stop -- @preserve */
      });
    }

    return pendientes;
  });
const pendingDossiersHandler = new OpenAPIHandler({ pendingDossiersProcedure });

router.get(
  "/dossiers/pending",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  delegarAOrpc(pendingDossiersHandler, PREFIJO_ABSOLUTO)
);

/** Fila 52v — el dossier a revisar, completo, con la huella de cada pieza. */
const dossierByIdProcedure = os
  .route({ method: "GET", path: "/dossiers/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(dossierSchema)
  .handler(async ({ input }) => {
    const fila = await db
      .selectFrom("Dossier")
      .select("unitId")
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!fila) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    const dossier = await compileDossier(fila.unitId);
    /* v8 ignore if -- @preserve: FK Dossier.unitId → Unit.id es ON DELETE CASCADE (SPEC-018) */
    if (!dossier) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    const { investorId: _investorId, ...publico } = dossier;
    return publico;
  });
const dossierByIdHandler = new OpenAPIHandler({ dossierByIdProcedure });

router.get(
  "/dossiers/:id",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  delegarAOrpc(dossierByIdHandler, PREFIJO_ABSOLUTO)
);

/**
 * Fila 52s — firmar. **Ancla** (M3-SC-04).
 *
 * El `masterHash` que se firma se congela: a partir de acá `compileDossier`
 * deja de recomputarlo, porque una firma que apunte a un hash que ya cambió no
 * prueba nada.
 *
 * **Idempotente** (regla 8): firmar dos veces devuelve la misma firma en vez de
 * gastar otra transacción y dejar dos atestiguaciones del mismo hecho — por
 * eso el status de éxito no es fijo: `outputStructure: "detailed"` deja que el
 * handler elija 200 (ya estaba firmado) o 201 (recién se firmó), con el mismo
 * `dossierSignResultSchema` de siempre como cuerpo.
 */
const signDossierProcedure = orpc
  .route({
    method: "POST",
    path: "/dossiers/{id}/sign",
    outputStructure: "detailed",
    successStatus: 201
  })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(
    z.union([
      z.strictObject({ status: z.literal(200), body: dossierSignResultSchema }),
      z.strictObject({ status: z.literal(201), body: dossierSignResultSchema })
    ])
  )
  .handler(async ({ input, context }) => {
    const fila = await db
      .selectFrom("Dossier")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!fila) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    if (fila.status === "signed") {
      await reconciliarParaLectura({ referenceId: fila.id });

      const anterior = await db
        .selectFrom("OnChainEvent")
        .selectAll()
        .where("referenceId", "=", fila.id)
        .where("eventType", "=", "DOSSIER_SIGNATURE")
        .executeTakeFirst();

      return {
        status: 200,
        body: { dossierId: fila.id, masterHash: fila.masterHash, anchor: anterior ?? undefined }
      };
    }

    // Se firma el estado ACTUAL, recompilado ahora: firmar el hash guardado
    // sería atestiguar sobre una foto vieja.
    const dossier = await compileDossier(fila.unitId);
    /* v8 ignore if -- @preserve: FK Dossier.unitId → Unit.id es ON DELETE CASCADE (SPEC-018) */
    if (!dossier) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    const ahora = new Date();

    await db
      .updateTable("Dossier")
      .set({
        status: "signed",
        masterHash: dossier.masterHash,
        signedById: context.user.id,
        signedAt: ahora,
        rejectionNote: null
      })
      .where("id", "=", fila.id)
      .execute();

    const anchor = await anchorCommitmentEvent({
      projectId: dossier.projectId,
      eventType: "DOSSIER_SIGNATURE",
      commitment: commitmentOf({
        dossierId: dossier.id,
        masterHash: dossier.masterHash,
        signedAt: ahora.toISOString()
      }),
      reference: dossier.id
    });

    await notifyUnitInvestor({
      unitId: dossier.unitId,
      category: "signature",
      titleKey: "notifications.dossier.signed",
      params: { unitReference: dossier.unitReference }
    });

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "SIGN_DOSSIER",
      entityType: "Dossier",
      entityId: dossier.id,
      metadata: { masterHash: dossier.masterHash, txid: anchor.txid }
    });

    return {
      status: 201,
      body: { dossierId: dossier.id, masterHash: dossier.masterHash, signedAt: ahora, anchor }
    };
  });
const signDossierHandler = new OpenAPIHandler({ signDossierProcedure });

router.post(
  "/dossiers/:id/sign",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  delegarAOrpc(signDossierHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/**
 * Fila 52r — rechazar. **No ancla**: un rechazo es una observación off-chain, y
 * su texto puede nombrar personas (regla 2). Queda en el `AuditLog` y en la
 * nota del dossier, que es donde el developer lo lee.
 *
 * Un dossier firmado no se rechaza: la atestiguación ya ocurrió y borrarla
 * sería reescribir un hecho. **El 409 es un error con nombre** —
 * `.errors({ DOSSIER_SIGNED: ... })`, no `ORPCError("CONFLICT", ...)` — porque
 * el segundo anida el código de dominio en `data.code` y el primero lo deja en
 * `code` al nivel que ya esperan los tests (`res.body.code`). Probado antes de
 * escribirlo: con `errors()`, `input` sigue validándose ANTES de que el
 * handler corra, así que un body inválido sobre un dossier ya firmado sigue
 * dando 400 y no 409 — el mismo orden que tenía el `safeParse` manual.
 */
const rejectDossierProcedure = orpc
  .errors({ DOSSIER_SIGNED: { status: 409, message: "Dossier already signed" } })
  .route({ method: "POST", path: "/dossiers/{id}/reject" })
  .input(rejectDossierSchema.extend({ id: cuidParamSchema }))
  .output(dossierRejectResultSchema)
  .handler(async ({ input, context, errors }) => {
    const fila = await db
      .selectFrom("Dossier")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!fila) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });
    if (fila.status === "signed") {
      throw errors.DOSSIER_SIGNED({ message: "Dossier already signed" });
    }

    await db
      .updateTable("Dossier")
      .set({ status: "rejected", rejectionNote: input.note })
      .where("id", "=", fila.id)
      .execute();

    await notifyUnitInvestor({
      unitId: fila.unitId,
      category: "signature",
      titleKey: "notifications.dossier.rejected"
    });

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "REJECT_DOSSIER",
      entityType: "Dossier",
      entityId: fila.id,
      metadata: { note: input.note }
    });

    return { dossierId: fila.id, status: "rejected" as const };
  });
const rejectDossierHandler = new OpenAPIHandler({ rejectDossierProcedure });

router.post(
  "/dossiers/:id/reject",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  delegarAOrpc(rejectDossierHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/** Fila 53 — el historial de lo firmado, paginado por cursor. */
const signaturesProcedure = orpc
  .route({ method: "GET", path: "/signatures" })
  .input(cursorPaginationSchema)
  .output(paginatedResponseSchema(notarySignatureSchema))
  .handler(async ({ input, context }) => {
    let query = db
      .selectFrom("Dossier")
      .innerJoin("Unit", "Unit.id", "Dossier.unitId")
      .innerJoin("Project", "Project.id", "Unit.projectId")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.referenceId", "=", "Dossier.id")
          .on("OnChainEvent.eventType", "=", "DOSSIER_SIGNATURE")
      )
      .select([
        "Dossier.id as dossierId",
        "Dossier.masterHash as masterHash",
        "Dossier.status as status",
        "Dossier.signedAt as signedAt",
        "Unit.unitReference as unitReference",
        "Project.name as projectName",
        "OnChainEvent.txid as signatureTxid"
      ])
      .where("Dossier.status", "=", "signed")
      .orderBy("Dossier.signedAt", "desc")
      .limit(input.limit);

    // Un admin ve todo; un notario, lo que firmó él.
    if (context.user.role !== "admin") {
      query = query.where("Dossier.signedById", "=", context.user.id);
    }
    if (input.cursor) {
      // SPEC-208 (B-10): `Dossier.signedAt` es epoch ms de verdad, no `Date`
      // — comparar contra un objeto `Date` dependía de que el driver lo
      // serializara igual que el entero que ya está en la columna.
      query = query.where("Dossier.signedAt", "<", new Date(input.cursor).getTime());
    }

    const filas = await query.execute();
    const items = filas.map((f) => ({
      dossierId: f.dossierId,
      unitReference: f.unitReference,
      projectName: f.projectName,
      masterHash: f.masterHash,
      signatureTxid: f.signatureTxid,
      /* v8 ignore start -- @preserve: la query filtra status = "signed", y firmar siempre escribe signedAt (SPEC-018) */
      signedAt: f.signedAt ? new Date(f.signedAt) : null,
      /* v8 ignore stop -- @preserve */
      // La query filtra `Dossier.status = "signed"`: la columna es `string` en
      // Kysely (D-016, sin enum nativo en SQLite), pero acá solo puede valer eso.
      status: "signed" as const
    }));

    const ultima = items.at(-1);

    return {
      items,
      nextCursor: ultima?.signedAt ? ultima.signedAt.toISOString() : null
    };
  });
const signaturesHandler = new OpenAPIHandler({ signaturesProcedure });

router.get(
  "/signatures",
  authorize({
    roles: ["admin", "notary"],
    acceso: { scopeEnQuery: "Dossier.signedById = usuario" }
  }),
  delegarAOrpc(signaturesHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 6
 * rutas migradas, aparte del documento manual de las que no migraron. */
export const notaryOrpcRouter = {
  kpisProcedure,
  pendingDossiersProcedure,
  dossierByIdProcedure,
  signDossierProcedure,
  rejectDossierProcedure,
  signaturesProcedure
};

export default router;
