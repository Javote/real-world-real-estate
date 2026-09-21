import { createHash } from "node:crypto";
import type http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { evidenceOrpcRouter } from "../src/routes/evidence.routes";
import { FIXTURES } from "./global-setup";
import { createORPCClient, OpenAPILink, type RouterClient } from "./helpers/orpc";

function crearCliente(link: InstanceType<typeof OpenAPILink>) {
  return createORPCClient<RouterClient<typeof evidenceOrpcRouter>>(link);
}

// SPEC-216 §E7 — mismo patrón que `orpc-client-profile.test.ts`. Cubre las 8
// rutas migradas (`GET /:id/download` cierra con `SPEC-217`).
let servidor: http.Server;
let baseUrl: string;
let tokenAdmin: string;
let tokenDev: string;
let proyecto: string;
let usuario: string;

async function subirEvidencia(contenido: string) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("Evidence")
    .values({
      id,
      projectId: proyecto,
      stageId: null,
      uploadedById: usuario,
      evidenceType: "certificate",
      category: "permits",
      authoritative: false,
      issuingAuthority: null,
      originalFilename: `${contenido}.pdf`,
      storedFilename: `${id}.pdf`,
      storagePath: `/tmp/no-existe/${id}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1,
      sha256Hash: createHash("sha256").update(contenido).digest("hex"),
      uploadedAt: ahora,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

beforeAll(async () => {
  servidor = app.listen(0);
  const { port } = servidor.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/evidence`;

  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  usuario = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;

  const loginAdmin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.admin.email, password: FIXTURES.admin.password });
  tokenAdmin = loginAdmin.body.token;

  const loginDev = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.activo.email, password: FIXTURES.activo.password });
  tokenDev = loginDev.body.token;
});

afterAll(async () => {
  servidor.close();
  await db.destroy();
});

describe("cliente oRPC tipado de evidence, contra el servidor real (SPEC-216 §E7)", () => {
  it("evidenceDetailProcedure: el cliente tipado recibe la evidencia con su proyecto y quien la subió", async () => {
    const id = await subirEvidencia("client-detail");
    const link = new OpenAPILink(evidenceOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const evidencia = await client.evidenceDetailProcedure({ id });

    expect(evidencia.id).toBe(id);
    expect(evidencia.uploadedBy.id).toBe(usuario);
    expect(evidencia).not.toHaveProperty("storagePath");
  });

  it("updateEvidenceProcedure: cambia la categoría", async () => {
    const id = await subirEvidencia("client-update");
    const link = new OpenAPILink(evidenceOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenDev}` })
    });
    const client = crearCliente(link);

    const actualizada = await client.updateEvidenceProcedure({ id, category: "planos" });
    expect(actualizada.category).toBe("planos");
  });

  it("anchorEvidenceProcedure: 201 la primera vez, 200 (mismo evento) la segunda — idempotente", async () => {
    const id = await subirEvidencia("client-anchor");
    const link = new OpenAPILink(evidenceOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    // `outputStructure: "detailed"` (SPEC-212 §A, mismo patrón que
    // `signDossierProcedure`): el cliente ve `{status, body}`, no el body
    // pelado — es lo que permite que el 200 y el 201 compartan un solo output.
    const primera = await client.anchorEvidenceProcedure({ id });
    expect(primera.status).toBe(201);
    expect(primera.body.txid).toBeTruthy();

    const segunda = await client.anchorEvidenceProcedure({ id });
    expect(segunda.status).toBe(200);
    expect(segunda.body.id).toBe(primera.body.id);
    expect(segunda.body.txid).toBe(primera.body.txid);
  });

  it("deleteEvidenceProcedure: una evidencia anclada es EVIDENCE_ANCHORED, no se borra", async () => {
    const id = await subirEvidencia("client-delete-anclada");
    const linkAdmin = new OpenAPILink(evidenceOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const clienteAdmin = crearCliente(linkAdmin);
    await clienteAdmin.anchorEvidenceProcedure({ id });

    await expect(clienteAdmin.deleteEvidenceProcedure({ id })).rejects.toMatchObject({
      code: "EVIDENCE_ANCHORED",
      status: 409
    });
  });

  it("deleteEvidenceProcedure: una evidencia sin anclar se borra, 204 sin cuerpo", async () => {
    const id = await subirEvidencia("client-delete-libre");
    const link = new OpenAPILink(evidenceOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    await expect(client.deleteEvidenceProcedure({ id })).resolves.toBeUndefined();
  });

  it("reconcileEvidenceProcedure: el cliente tipado recibe el resultado de la reconciliación", async () => {
    const link = new OpenAPILink(evidenceOrpcRouter, {
      url: baseUrl,
      headers: () => ({ Authorization: `Bearer ${tokenAdmin}` })
    });
    const client = crearCliente(link);

    const resultado = await client.reconcileEvidenceProcedure();
    expect(Array.isArray(resultado.sospechosos)).toBe(true);
  });
});
