import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { storage } from "../src/lib/storage";
import { FIXTURES } from "./global-setup";

// SPEC-217 — `GET /evidence/:id/download` migrada a oRPC con streaming real.
// Compara bytes contra archivos reales en disco (no un mock de `storage`),
// salvo el caso del error a mitad de descarga, que necesita un `Readable` que
// falle a propósito.
let servidor: http.Server;
let puerto: number;
let tokenDev: string;
let tokenAjeno: string;
let proyecto: string;
let usuario: string;
let dir: string;
const idsCreados: string[] = [];

async function crearEvidencia(opts: {
  contenido?: Buffer;
  storagePath?: string;
  originalFilename?: string;
  mimeType?: string;
}) {
  const id = createId();
  let storagePath = opts.storagePath;
  if (!storagePath) {
    storagePath = join(dir, `${id}.bin`);
    writeFileSync(storagePath, opts.contenido ?? Buffer.from("x"));
  }
  const ahora = new Date();
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
      originalFilename: opts.originalFilename ?? "archivo.pdf",
      storedFilename: `${id}.bin`,
      storagePath,
      mimeType: opts.mimeType ?? "application/pdf",
      sizeBytes: opts.contenido?.length ?? 1,
      sha256Hash: id.padEnd(64, "0").slice(0, 64),
      uploadedAt: ahora,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  idsCreados.push(id);
  return id;
}

beforeAll(async () => {
  servidor = app.listen(0);
  puerto = (servidor.address() as AddressInfo).port;
  dir = mkdtempSync(join(tmpdir(), "spec-217-"));
  mkdirSync(dir, { recursive: true });

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

  const login = async (u: { email: string; password: string }) =>
    (await request(app).post("/api/v1/auth/login").send(u)).body.token as string;
  tokenDev = await login(FIXTURES.activo);
  tokenAjeno = await login(FIXTURES.ajeno);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  servidor.close();
  rmSync(dir, { recursive: true, force: true });
  for (const id of idsCreados) await db.deleteFrom("Evidence").where("id", "=", id).execute();
  await db.destroy();
});

/** Binario a supertest: sin esto `res.body` de un `application/pdf` llega vacío. */
const binario = (res: request.Response, cb: (err: Error | null, body: Buffer) => void): void => {
  const partes: Buffer[] = [];
  res.on("data", (c: Buffer) => partes.push(c));
  res.on("end", () => cb(null, Buffer.concat(partes)));
  res.on("error", (e: Error) => cb(e, Buffer.alloc(0)));
};

describe("GET /evidence/:id/download (SPEC-217)", () => {
  it("archivo chico: 200, bytes idénticos y headers del registro", async () => {
    const contenido = Buffer.from("%PDF-1.4 contenido chico %%EOF");
    const id = await crearEvidencia({ contenido, originalFilename: "acta de obra.pdf" });

    const res = await request(app)
      .get(`/api/v1/evidence/${id}/download`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .buffer(true)
      .parse(binario);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toBe(
      `attachment; filename="${encodeURIComponent("acta de obra.pdf")}"`
    );
    expect(Buffer.compare(res.body as Buffer, contenido)).toBe(0);
  });

  it("Content-Type sale de evidence.mimeType, no de lo que se infiera", async () => {
    const id = await crearEvidencia({
      contenido: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      mimeType: "image/png",
      originalFilename: "foto.png"
    });

    const res = await request(app)
      .get(`/api/v1/evidence/${id}/download`)
      .set("Authorization", `Bearer ${tokenDev}`)
      .buffer(true)
      .parse(binario);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
  });

  it("archivo grande (6 MB): bytes idénticos y el primer chunk llega antes de que termine", async () => {
    const contenido = randomBytes(6 * 1024 * 1024);
    const id = await crearEvidencia({ contenido });

    const { primerChunkAntesDelFin, recibido } = await new Promise<{
      primerChunkAntesDelFin: boolean;
      recibido: Buffer;
    }>((resolve, reject) => {
      http
        .get(
          {
            host: "127.0.0.1",
            port: puerto,
            path: `/api/v1/evidence/${id}/download`,
            headers: { Authorization: `Bearer ${tokenDev}` }
          },
          (res) => {
            expect(res.statusCode).toBe(200);
            const partes: Buffer[] = [];
            let bytes = 0;
            let primero = false;
            res.on("data", (c: Buffer) => {
              if (!primero) primero = bytes + c.length < contenido.length;
              bytes += c.length;
              partes.push(c);
            });
            res.on("end", () =>
              resolve({ primerChunkAntesDelFin: primero, recibido: Buffer.concat(partes) })
            );
            res.on("error", reject);
          }
        )
        .on("error", reject);
    });

    expect(recibido.length).toBe(contenido.length);
    expect(Buffer.compare(recibido, contenido)).toBe(0);
    expect(primerChunkAntesDelFin).toBe(true);
  });

  it("evidencia inexistente: 404 sin tocar el storage", async () => {
    const leer = vi.spyOn(storage, "read");
    const res = await request(app)
      .get(`/api/v1/evidence/${createId()}/download`)
      .set("Authorization", `Bearer ${tokenDev}`);
    expect(res.status).toBe(404);
    expect(leer).not.toHaveBeenCalled();
  });

  it("la evidencia existe pero el archivo no está en el storage: 404, sin intentar leer", async () => {
    const id = await crearEvidencia({ storagePath: join(dir, "no-existe.bin") });
    const leer = vi.spyOn(storage, "read");

    const res = await request(app)
      .get(`/api/v1/evidence/${id}/download`)
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Stored file not found");
    expect(leer).not.toHaveBeenCalled();
  });

  it("un usuario sin membresía en el proyecto: 403 de authorize", async () => {
    const id = await crearEvidencia({ contenido: Buffer.from("privado") });
    const res = await request(app)
      .get(`/api/v1/evidence/${id}/download`)
      .set("Authorization", `Bearer ${tokenAjeno}`);
    expect(res.status).toBe(403);
  });

  it("el storage falla a mitad de la descarga: la respuesta se corta, sin excepción sin capturar", async () => {
    const id = await crearEvidencia({ contenido: Buffer.from("presente") });
    let n = 0;
    vi.spyOn(storage, "read").mockResolvedValue(
      new Readable({
        read() {
          if (n < 3) {
            this.push(Buffer.alloc(1024, 1));
            n++;
          } else this.destroy(new Error("conexión a R2 cortada"));
        }
      })
    );

    const sinCapturar: unknown[] = [];
    const alCapturar = (e: unknown) => sinCapturar.push(e);
    process.on("uncaughtException", alCapturar);
    try {
      const completa = await new Promise<boolean>((resolve) => {
        http
          .get(
            {
              host: "127.0.0.1",
              port: puerto,
              path: `/api/v1/evidence/${id}/download`,
              headers: { Authorization: `Bearer ${tokenDev}` }
            },
            (res) => {
              res.on("data", () => {});
              res.on("error", () => {});
              res.on("close", () => resolve(res.complete));
            }
          )
          .on("error", () => resolve(false));
      });
      expect(completa).toBe(false);
      // Dejar pasar un tick por si el `'error'` sin escuchar se propagara tarde.
      await new Promise((r) => setTimeout(r, 50));
      expect(sinCapturar).toEqual([]);
    } finally {
      process.off("uncaughtException", alCapturar);
    }
  });
});
