import { createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { sembrarUnidadVendida } from "../src/db/fixtures.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";

// SPEC-615, criterio 3: ninguna lectura escribe el dossier. Lo que puede escribir una lectura es la
// reconciliación del `OnChainEvent` de una firma (D-077) y el audit del export, nunca la fila `Dossier`.

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenInvestor: string;
let tokenNotario: string;
let unitId: string;
let dossierId: string;
let shareToken: string;

const fotoDeLaTabla = () => db.selectFrom("Dossier").selectAll().orderBy("id").execute();

beforeAll(async () => {
  tokenInvestor = (await login(FIXTURES.investor)).body.token;
  tokenNotario = (await login(FIXTURES.notario)).body.token;
  const proyecto = await db
    .selectFrom("Project")
    .select("id")
    .where("slug", "=", FIXTURES.proyecto.slug)
    .executeTakeFirstOrThrow();
  const investor = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.investor.email)
    .executeTakeFirstOrThrow();

  ({ unitId } = await sembrarUnidadVendida(db, {
    projectId: proyecto.id,
    investorId: investor.id,
    unitReference: `LECTURAS-${createId()}`,
    floor: 1,
    sizeM2: 40,
    priceMinorUnits: 5_000_000,
    currency: "USD"
  }));
  dossierId = (
    await db
      .selectFrom("Dossier")
      .select("id")
      .where("unitId", "=", unitId)
      .executeTakeFirstOrThrow()
  ).id;

  shareToken = (
    await request(app)
      .post(`/api/v1/investor/units/${unitId}/dossier/share`)
      .set("Authorization", `Bearer ${tokenInvestor}`)
  ).body.shareToken;

  // Rechazado, y después cambia lo que compromete: se lee `compiled`, pero la fila sigue `rejected`.
  await request(app)
    .post(`/api/v1/notary/dossiers/${dossierId}/reject`)
    .set("Authorization", `Bearer ${tokenNotario}`)
    .send({ note: "falta el permiso" });
  const ahora = new Date();
  const evidenceId = createId();
  await db
    .insertInto("Evidence")
    .values({
      id: evidenceId,
      projectId: proyecto.id,
      stageId: null,
      uploadedById: investor.id,
      evidenceType: "document",
      category: "permits",
      authoritative: false,
      issuingAuthority: null,
      originalFilename: `${evidenceId}.pdf`,
      storedFilename: `${evidenceId}.pdf`,
      storagePath: `/tmp/no-existe/${evidenceId}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1,
      sha256Hash: createHash("sha256").update(evidenceId).digest("hex"),
      uploadedAt: ahora,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
});

afterAll(async () => {
  await db.destroy();
});

describe("las lecturas del dossier no lo escriben (SPEC-615, criterio 3)", () => {
  it("las siete lecturas dejan la tabla igual y no intentan escribirla", async () => {
    const antes = await fotoDeLaTabla();
    const escrituras = [
      vi.spyOn(db, "insertInto"),
      vi.spyOn(db, "updateTable"),
      vi.spyOn(db, "deleteFrom")
    ];

    const lecturas = [
      request(app)
        .get(`/api/v1/investor/units/${unitId}/dossier`)
        .set("Authorization", `Bearer ${tokenInvestor}`),
      request(app)
        .get(`/api/v1/investor/units/${unitId}/dossier/export.pdf`)
        .set("Authorization", `Bearer ${tokenInvestor}`),
      request(app)
        .get(`/api/v1/notary/dossiers/${dossierId}`)
        .set("Authorization", `Bearer ${tokenNotario}`),
      request(app)
        .get("/api/v1/notary/dossiers/pending")
        .set("Authorization", `Bearer ${tokenNotario}`),
      request(app).get("/api/v1/notary/kpis").set("Authorization", `Bearer ${tokenNotario}`),
      request(app).get("/api/v1/notary/signatures").set("Authorization", `Bearer ${tokenNotario}`),
      request(app).get(`/api/v1/public/dossier/${shareToken}`)
    ];
    const respuestas = await Promise.all(lecturas);

    const tablas = escrituras.flatMap((espia) => espia.mock.calls.map(([tabla]) => tabla));
    for (const espia of escrituras) espia.mockRestore();

    expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200, 200]);
    expect(tablas.filter((t) => t !== "AuditLog")).toEqual([]);
    expect(await fotoDeLaTabla()).toEqual(antes);
  });

  it("el rechazado con cambios se lee compiled, aparece en la cola y la fila sigue rejected", async () => {
    const leido = await request(app)
      .get(`/api/v1/notary/dossiers/${dossierId}`)
      .set("Authorization", `Bearer ${tokenNotario}`);
    const cola = await request(app)
      .get("/api/v1/notary/dossiers/pending")
      .set("Authorization", `Bearer ${tokenNotario}`);
    const fila = await db
      .selectFrom("Dossier")
      .select(["status", "rejectionNote"])
      .where("id", "=", dossierId)
      .executeTakeFirstOrThrow();

    expect(leido.body.status).toBe("compiled");
    expect(cola.body.map((d: { dossierId: string }) => d.dossierId)).toContain(dossierId);
    expect(fila).toEqual({ status: "rejected", rejectionNote: "falta el permiso" });
  });
});
