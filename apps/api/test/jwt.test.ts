import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { en } from "../src/lib/arrays.js";
import { db } from "../src/lib/db.js";
import { requireJwtSecret, signToken, verifyToken } from "../src/lib/jwt.js";
import { FIXTURES } from "./global-setup.js";

afterAll(async () => {
  await db.destroy();
});

describe("requireJwtSecret", () => {
  it("revienta si la variable no está definida", () => {
    expect(() => requireJwtSecret({})).toThrow(/JWT_SECRET/);
  });

  it("revienta si la variable está vacía — el caso de .env.example", () => {
    expect(() => requireJwtSecret({ JWT_SECRET: "" })).toThrow(/JWT_SECRET/);
  });

  it("revienta si la variable es solo espacios", () => {
    expect(() => requireJwtSecret({ JWT_SECRET: "   \n\t " })).toThrow(/JWT_SECRET/);
  });

  it("no menciona ningún valor por defecto: no existe ninguno", () => {
    expect(() => requireJwtSecret({})).not.toThrow(/dev-secret/);
  });

  it("devuelve el secreto cuando está cargado", () => {
    expect(requireJwtSecret({ JWT_SECRET: "un-secreto-cualquiera" })).toBe("un-secreto-cualquiera");
  });

  it("recorta los espacios que pegan los dashboards de plataforma", () => {
    expect(requireJwtSecret({ JWT_SECRET: "  secreto-con-salto\n" })).toBe("secreto-con-salto");
  });
});

describe("arranque de la API", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("importar lib/jwt sin JWT_SECRET falla — el proceso no llega a escuchar", async () => {
    vi.stubEnv("JWT_SECRET", "");
    vi.resetModules();

    await expect(import("../src/lib/jwt.js")).rejects.toThrow(/JWT_SECRET/);
  });
});

describe("el algoritmo de firma está fijado de los dos lados", () => {
  const payload = { userId: "x", role: "admin", email: "x@example.com" };

  it("un token HS512 firmado con la clave REAL es rechazado", () => {
    const otroAlgoritmo = jwt.sign(payload, process.env.JWT_SECRET!, {
      algorithm: "HS512",
      expiresIn: "7d"
    });

    expect(() => verifyToken(otroAlgoritmo)).toThrow(/algorithm/i);
  });

  it("el token que emite signToken se verifica", () => {
    expect(verifyToken(signToken(payload))).toMatchObject(payload);
  });

  it("signToken emite HS256, no lo que elija el default de la librería", () => {
    const header = JSON.parse(
      Buffer.from(en(signToken(payload).split("."), 0), "base64url").toString()
    );

    expect(header.alg).toBe("HS256");
  });
});

describe("regresión del P1 · el literal público ya no firma nada", () => {
  const payloadDe = async () => {
    const user = await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow();
    return { userId: user.id, role: user.role, email: user.email };
  };

  it("un token firmado con 'dev-secret' es rechazado", async () => {
    const forjado = jwt.sign(await payloadDe(), "dev-secret", { expiresIn: "7d" });

    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${forjado}`);

    expect(res.status).toBe(401);
  });

  it("un rol forjado firmado con 'dev-secret' tampoco entra", async () => {
    const { userId, email } = await payloadDe();
    const forjado = jwt.sign({ userId, role: "admin", email }, "dev-secret", { expiresIn: "7d" });

    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${forjado}`);

    expect(res.status).toBe(401);
  });

  it("el MISMO payload firmado con la clave real sí entra", async () => {
    const legitimo = jwt.sign(await payloadDe(), process.env.JWT_SECRET!, { expiresIn: "7d" });

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${legitimo}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(FIXTURES.activo.email);
  });
});
