import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStorage } from "../src/lib/storage";

// Integración real contra un S3: MinIO en local (`compose.dev.yml`), R2 en
// prod. **No corre en CI**: necesita el contenedor arriba, y el CI no levanta
// infraestructura. Se corre a mano, que es exactamente el caso de uso —
// verificar que el código que va a hablar con R2 funciona contra un S3 de
// verdad y no solo contra el driver de disco.
//
//   docker compose -f compose.dev.yml up -d
//   pnpm --filter @plataforma/api test:s3
const corre = process.env.S3_TEST === "1";

const temporal = path.join(os.tmpdir(), `propnexus-s3-${Date.now()}.pdf`);
const contenido = Buffer.from("%PDF-1.4 acta de obra de prueba");
const sha256Esperado = createHash("sha256").update(contenido).digest("hex");

afterAll(() => {
  if (fs.existsSync(temporal)) fs.unlinkSync(temporal);
});

describe.skipIf(!corre)("StoragePort · s3 contra un S3 real", () => {
  // Perezoso a propósito: `describe.skipIf` **igual ejecuta el cuerpo** para
  // recolectar los tests, así que construir el storage acá arriba haría
  // explotar la suite entera en cualquier máquina sin MinIO.
  let storage: ReturnType<typeof createStorage>;
  const key = `evidence/test/${path.basename(temporal)}`;

  beforeAll(() => {
    storage = createStorage("s3");
  });

  it("sube, y el hash que devuelve es el de los bytes GUARDADOS", async () => {
    fs.writeFileSync(temporal, contenido);

    const guardado = await storage.put({
      localPath: temporal,
      key,
      contentType: "application/pdf"
    });

    // Esta igualdad es la deuda 🔴 que cierra el port: el hash sale de releer
    // el objeto subido, no del temporal.
    expect(guardado.sha256).toBe(sha256Esperado);
    expect(guardado.storageRef).toBe(key);
  });

  it("lo puede leer de vuelta, byte por byte", async () => {
    const stream = await storage.read(key);
    const partes: Buffer[] = [];
    for await (const chunk of stream) partes.push(chunk as Buffer);
    expect(Buffer.concat(partes).equals(contenido)).toBe(true);
  });

  it("exists dice la verdad antes y después de borrar", async () => {
    expect(await storage.exists(key)).toBe(true);
    await storage.remove(key);
    expect(await storage.exists(key)).toBe(false);
  });
});

describe("createStorage · configuración", () => {
  it("sin STORAGE_DRIVER usa disco", () => {
    expect(createStorage("disk").driver).toBe("disk");
  });

  it("revienta con un driver inventado, no cae a un default silencioso", () => {
    expect(() => createStorage("dropbox")).toThrow(/STORAGE_DRIVER inválido/);
  });

  it("con s3 y sin configuración revienta al construirlo (D-042)", () => {
    const previo = process.env.S3_BUCKET;
    process.env.S3_BUCKET = "";
    expect(() => createStorage("s3")).toThrow(/S3_BUCKET/);
    if (previo !== undefined) process.env.S3_BUCKET = previo;
  });
});
