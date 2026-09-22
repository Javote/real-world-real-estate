import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// M2-D5 filas 26-29, 28s, 52v, 52s, 52r, 53 — **M3-BE-12** y **M3-BE-17**,
// patrón P8.
//
// Lo que fijan estos tests no son los hashes: es que **la firma no pueda
// quedar apuntando a un hash que ya cambió**, y que el link público no exponga
// más de lo que un desconocido con el link debería ver.

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenInvestor: string;
let tokenNotario: string;
let tokenDev: string;
let tokenAdmin: string;
let unitId: string;
let dossierId: string;
let projectId: string;
let investorId: string;

beforeAll(async () => {
  tokenInvestor = (await login(FIXTURES.investor)).body.token;
  tokenNotario = (await login(FIXTURES.notario)).body.token;
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;

  const unidad = await db
    .selectFrom("Unit")
    .select("id")
    .where("unitReference", "=", FIXTURES.unidad.unitReference)
    .executeTakeFirstOrThrow();
  unitId = unidad.id;

  const proyecto = await db
    .selectFrom("Project")
    .select("id")
    .where("slug", "=", FIXTURES.proyecto.slug)
    .executeTakeFirstOrThrow();
  projectId = proyecto.id;

  const investor = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.investor.email)
    .executeTakeFirstOrThrow();
  investorId = investor.id;
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /investor/units/:id/dossier", () => {
  it("compila el dossier de la unidad del investor, con su hash maestro", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${unitId}/dossier`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(200);
    expect(res.body.masterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.unitReference).toBe(FIXTURES.unidad.unitReference);
    expect(Array.isArray(res.body.artifacts)).toBe(true);
    // Sin firma, el TXID es null: nunca se muestra una prueba que no existe
    // (regla 17).
    expect(res.body.signatureTxid).toBeNull();
    dossierId = res.body.id;
  });

  it("el hash es estable mientras no cambie lo que compromete", async () => {
    const uno = await request(app)
      .get(`/api/v1/investor/units/${unitId}/dossier`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    const dos = await request(app)
      .get(`/api/v1/investor/units/${unitId}/dossier`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(dos.body.masterHash).toBe(uno.body.masterHash);
  });

  it("un investor que no es el dueño no lo ve", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${unitId}/dossier`)
      .set("Authorization", `Bearer ${tokenDev}`);

    // developer no está en el grupo de rol de la superficie del investor.
    expect([403, 401]).toContain(res.status);
  });
});

describe("GET /investor/units/:id/dossier/export.pdf", () => {
  it("devuelve un PDF de verdad, no un texto con otro Content-Type", async () => {
    const res = await request(app)
      .get(`/api/v1/investor/units/${unitId}/dossier/export.pdf`)
      .set("Authorization", `Bearer ${tokenInvestor}`)
      .buffer(true)
      .parse((res, cb) => {
        const trozos: Buffer[] = [];
        res.on("data", (t: Buffer) => trozos.push(t));
        res.on("end", () => cb(null, Buffer.concat(trozos)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    const cuerpo = res.body as Buffer;
    expect(cuerpo.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(cuerpo.subarray(-6).toString("latin1")).toContain("%%EOF");
  });
});

describe("POST /investor/units/:id/dossier/share", () => {
  it("es idempotente: no invalida el link que ya se mandó", async () => {
    const uno = await request(app)
      .post(`/api/v1/investor/units/${unitId}/dossier/share`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    const dos = await request(app)
      .post(`/api/v1/investor/units/${unitId}/dossier/share`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(uno.status).toBe(201);
    expect(uno.body.shareToken).toMatch(/^[0-9a-f]{64}$/);
    expect(dos.body.shareToken).toBe(uno.body.shareToken);
  });

  it("el link público se lee SIN sesión y no expone al investor", async () => {
    const compartido = await request(app)
      .post(`/api/v1/investor/units/${unitId}/dossier/share`)
      .set("Authorization", `Bearer ${tokenInvestor}`);

    const publico = await request(app).get(`/api/v1/public/dossier/${compartido.body.shareToken}`);

    expect(publico.status).toBe(200);
    expect(publico.body.masterHash).toBe(compartido.body.masterHash);
    // Nada del investor ni de la unidad más allá de su referencia.
    expect(publico.body.investorId).toBeUndefined();
    expect(publico.body.unitId).toBeUndefined();
  });

  it("un token bien formado que no existe es 404 sin más detalle", async () => {
    // 64 hex — la forma real de un `shareToken` (`randomBytes(32).toString("hex")`)
    // — que nunca se generó, para separar "no existe" de "está mal formado".
    const res = await request(app).get(`/api/v1/public/dossier/${"a".repeat(64)}`);
    expect(res.status).toBe(404);
  });

  it("un token mal formado es 400, no 404 — el path param se valida antes de tocar la base", async () => {
    const res = await request(app).get("/api/v1/public/dossier/nope");
    expect(res.status).toBe(400);
  });
});

describe("los 404 de dossier inexistente en firmar y rechazar", () => {
  it("firmar un dossier inexistente da 404", async () => {
    const res = await request(app)
      .post(`/api/v1/notary/dossiers/${createId()}/sign`)
      .set("Authorization", `Bearer ${tokenNotario}`);
    expect(res.status).toBe(404);
  });

  it("rechazar un dossier inexistente da 404", async () => {
    const res = await request(app)
      .post(`/api/v1/notary/dossiers/${createId()}/reject`)
      .set("Authorization", `Bearer ${tokenNotario}`)
      .send({ note: "no existe" });
    expect(res.status).toBe(404);
  });
});

describe("el flujo del notario", () => {
  it("ve el dossier a revisar", async () => {
    const res = await request(app)
      .get(`/api/v1/notary/dossiers/${dossierId}`)
      .set("Authorization", `Bearer ${tokenNotario}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(dossierId);
  });

  it("aparece en la cola de revisión con el nombre del investor, no su referencia", async () => {
    const res = await request(app)
      .get("/api/v1/notary/dossiers/pending")
      .set("Authorization", `Bearer ${tokenNotario}`);

    expect(res.status).toBe(200);
    const propio = res.body.find((d: { dossierId: string }) => d.dossierId === dossierId);
    expect(propio).toBeTruthy();
    // La unidad ya tiene investor (es la del fixture): el fallback a la
    // referencia de la unidad no aplica.
    expect(propio.investorName).toBe(FIXTURES.investor.fullName);
  });

  it("un developer no entra a la superficie del notario", async () => {
    const res = await request(app)
      .get(`/api/v1/notary/dossiers/${dossierId}`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(403);
  });

  it("firmar ancla y congela el hash firmado", async () => {
    const firma = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/sign`)
      .set("Authorization", `Bearer ${tokenNotario}`);

    expect(firma.status).toBe(201);
    expect(firma.body.masterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(firma.body.anchor.eventType).toBe("DOSSIER_SIGNATURE");

    // El commitment anclado NO es el masterHash pelado: es el hash del evento,
    // que además compromete el momento de la firma.
    expect(firma.body.anchor.commitment).not.toBe(firma.body.masterHash);

    const releido = await request(app)
      .get(`/api/v1/notary/dossiers/${dossierId}`)
      .set("Authorization", `Bearer ${tokenNotario}`);

    expect(releido.body.status).toBe("signed");
    expect(releido.body.masterHash).toBe(firma.body.masterHash);
  });

  it("firmar dos veces devuelve la misma firma, no una segunda", async () => {
    const otra = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/sign`)
      .set("Authorization", `Bearer ${tokenNotario}`);

    expect(otra.status).toBe(200);

    const eventos = await db
      .selectFrom("OnChainEvent")
      .select("id")
      .where("referenceId", "=", dossierId)
      .where("eventType", "=", "DOSSIER_SIGNATURE")
      .execute();

    expect(eventos).toHaveLength(1);
  });

  it("rechazar un dossier sin firmar contesta 200 y deja la nota", async () => {
    // Unidad propia para este caso: el dossier de arriba ya quedó firmado, y
    // firmar es terminal.
    const unidad = await db
      .insertInto("Unit")
      .values({
        id: createId(),
        projectId,
        unitReference: "RECHAZO",
        status: "sold",
        floor: 1,
        sizeM2: 40,
        priceMinorUnits: 5_000_000,
        currency: "USD",
        investorId: investorId,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const compilado = await request(app)
      .get(`/api/v1/investor/units/${unidad.id}/dossier`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(compilado.status).toBe(200);

    const rechazo = await request(app)
      .post(`/api/v1/notary/dossiers/${compilado.body.id}/reject`)
      .set("Authorization", `Bearer ${tokenNotario}`)
      .send({ note: "falta el permiso municipal" });

    // **200 y no 201**: rechazar no crea nada, cambia el estado de algo que ya
    // existía.
    expect(rechazo.status).toBe(200);
    expect(rechazo.body.status).toBe("rejected");

    const fila = await db
      .selectFrom("Dossier")
      .select(["status", "rejectionNote"])
      .where("id", "=", compilado.body.id)
      .executeTakeFirstOrThrow();
    expect(fila.status).toBe("rejected");
    expect(fila.rejectionNote).toBe("falta el permiso municipal");

    // **Rechazar NO ancla**: no hay nada que probar sobre lo que no ocurrió, y
    // el texto de la observación puede nombrar personas (regla 2).
    const eventos = await db
      .selectFrom("OnChainEvent")
      .select("id")
      .where("referenceId", "=", compilado.body.id)
      .execute();
    expect(eventos).toHaveLength(0);
  });

  it("rechazar sin nota es 400: la observación es el punto del rechazo", async () => {
    const res = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/reject`)
      .set("Authorization", `Bearer ${tokenNotario}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("un dossier firmado no se rechaza: la atestiguación ya ocurrió", async () => {
    const res = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierId}/reject`)
      .set("Authorization", `Bearer ${tokenNotario}`)
      .send({ note: "falta el permiso municipal" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DOSSIER_SIGNED");
  });

  it("el historial trae el hash firmado y su TXID", async () => {
    const res = await request(app)
      .get("/api/v1/notary/signatures")
      .set("Authorization", `Bearer ${tokenNotario}`);

    expect(res.status).toBe(200);
    const firma = res.body.items.find((f: { dossierId: string }) => f.dossierId === dossierId);
    expect(firma.masterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(firma.status).toBe("signed");
  });

  // Un segundo dossier, firmado por el ADMIN (no por `tokenNotario`): sin
  // esto, `Dossier.signedById` de todo lo firmado en este archivo apunta
  // siempre al mismo notario, y `kpis`/`signatures` nunca ejercitan la rama
  // "firmado, pero por otro" — la mitad disyuntiva de "un admin ve el total;
  // un notario, lo que firmó él más la cola común" nunca se ponía a prueba.
  let dossierAjenoId: string;
  it("un segundo dossier, firmado por el admin", async () => {
    const unidad = await db
      .insertInto("Unit")
      .values({
        id: createId(),
        projectId,
        unitReference: "AJENO",
        status: "sold",
        floor: 2,
        sizeM2: 45,
        priceMinorUnits: 6_000_000,
        currency: "USD",
        investorId,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const compilado = await request(app)
      .get(`/api/v1/investor/units/${unidad.id}/dossier`)
      .set("Authorization", `Bearer ${tokenInvestor}`);
    expect(compilado.status).toBe(200);
    dossierAjenoId = compilado.body.id;

    const firma = await request(app)
      .post(`/api/v1/notary/dossiers/${dossierAjenoId}/sign`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(firma.status).toBe(201);
  });

  it("kpis: el notario cuenta lo suyo; el admin, todo", async () => {
    const notario = await request(app)
      .get("/api/v1/notary/kpis")
      .set("Authorization", `Bearer ${tokenNotario}`);
    expect(notario.status).toBe(200);
    // `dossierId` es suyo; `dossierAjenoId` lo firmó el admin.
    expect(notario.body.signed).toBe(1);

    const admin = await request(app)
      .get("/api/v1/notary/kpis")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(admin.status).toBe(200);
    expect(admin.body.signed).toBe(2);
  });

  it("signatures: el admin ve los dos; paginado por cursor", async () => {
    const admin = await request(app)
      .get("/api/v1/notary/signatures?limit=1")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(admin.status).toBe(200);
    expect(admin.body.items).toHaveLength(1);
    expect(admin.body.nextCursor).toBeTruthy();

    const siguientePagina = await request(app)
      .get(`/api/v1/notary/signatures?limit=1&cursor=${encodeURIComponent(admin.body.nextCursor)}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(siguientePagina.status).toBe(200);
    expect(siguientePagina.body.items).toHaveLength(1);
    expect(siguientePagina.body.items[0].dossierId).not.toBe(admin.body.items[0].dossierId);
  });
});
