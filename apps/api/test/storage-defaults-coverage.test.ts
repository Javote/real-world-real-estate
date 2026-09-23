import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStorage } from "../src/lib/storage";

// SPEC-018 §A6 — tres ramas de `lib/storage.ts` que `storage-mocked.test.ts`
// no alcanza porque siempre fija las tres variables juntas
// (`S3_ENDPOINT`, `S3_CREATE_BUCKET`) y nunca reusa la misma instancia dos
// veces: un S3 sin `endpoint` (AWS puro, sin MinIO/R2 de por medio), el
// `bucketReady` ya en `true` (el segundo `put` no vuelve a preguntar), y
// `S3_CREATE_BUCKET` directamente AUSENTE — no en `"false"`, que es la otra
// rama de la misma comparación pero no la del operador `??`.

const { mockSend, FakeS3Client, FakeCommand } = vi.hoisted(() => {
  const mockSend = vi.fn();

  class FakeS3Client {
    readonly config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
    send(command: unknown) {
      return mockSend(command);
    }
  }

  class FakeCommand<Name extends string> {
    readonly __name: Name;
    readonly input: unknown;
    constructor(name: Name, input: unknown) {
      this.__name = name;
      this.input = input;
    }
  }

  return { mockSend, FakeS3Client, FakeCommand };
});

interface ComandoMock<Name extends string = string> {
  readonly __name: Name;
  readonly input: unknown;
}

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: FakeS3Client,
  PutObjectCommand: class extends FakeCommand<"Put"> {
    constructor(input: unknown) {
      super("Put", input);
    }
  },
  GetObjectCommand: class extends FakeCommand<"Get"> {
    constructor(input: unknown) {
      super("Get", input);
    }
  },
  HeadObjectCommand: class extends FakeCommand<"HeadObject"> {
    constructor(input: unknown) {
      super("HeadObject", input);
    }
  },
  HeadBucketCommand: class extends FakeCommand<"HeadBucket"> {
    constructor(input: unknown) {
      super("HeadBucket", input);
    }
  },
  DeleteObjectCommand: class extends FakeCommand<"Delete"> {
    constructor(input: unknown) {
      super("Delete", input);
    }
  },
  CreateBucketCommand: class extends FakeCommand<"CreateBucket"> {
    constructor(input: unknown) {
      super("CreateBucket", input);
    }
  }
}));

const ENV_KEYS = [
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_ENDPOINT",
  "S3_CREATE_BUCKET",
  "S3_FORCE_PATH_STYLE"
] as const;

let previo: Record<string, string | undefined> = {};

beforeEach(() => {
  previo = {};
  for (const k of ENV_KEYS) {
    previo[k] = process.env[k];
    delete process.env[k];
  }
  process.env.S3_BUCKET = "propnexus-test";
  process.env.S3_ACCESS_KEY_ID = "test-key";
  process.env.S3_SECRET_ACCESS_KEY = "test-secret";
  mockSend.mockReset();
});

afterEach(() => {
  for (const [k, v] of Object.entries(previo)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function cuerpoDe(texto: string): Readable {
  return Readable.from([Buffer.from(texto)]);
}

function archivoTemporal(nombre: string, contenido: string) {
  const p = path.join(os.tmpdir(), nombre);
  fs.writeFileSync(p, contenido);
  return p;
}

describe('createStorage("s3") sin S3_ENDPOINT — AWS puro, sin MinIO/R2 de por medio', () => {
  it("igual sube y lee el hash de lo guardado", async () => {
    // `S3_ENDPOINT` queda ausente a propósito: la rama que se prueba es
    // `config.endpoint ? {...} : {}` con el lado falso.
    mockSend.mockImplementation((command: ComandoMock) => {
      if (command.__name === "HeadBucket") return Promise.resolve({});
      if (command.__name === "Put") return Promise.resolve({});
      if (command.__name === "Get") return Promise.resolve({ Body: cuerpoDe("contenido") });
      throw new Error(`comando inesperado: ${command.__name}`);
    });

    const storage = createStorage("s3");
    const temporal = archivoTemporal(`propnexus-s3-sin-endpoint-${Date.now()}.pdf`, "x");

    try {
      const resultado = await storage.put({
        localPath: temporal,
        key: "evidence/sin-endpoint.pdf",
        contentType: "application/pdf"
      });
      expect(resultado.storageRef).toBe("evidence/sin-endpoint.pdf");
    } finally {
      fs.unlinkSync(temporal);
    }
  });
});

describe('S3_CREATE_BUCKET ausente (no "false", AUSENTE) — el default de `??` es false', () => {
  it("un bucket ausente revienta en vez de crearlo, igual que con S3_CREATE_BUCKET=false", async () => {
    process.env.S3_ENDPOINT = "http://localhost:9000";
    // A propósito: NO se setea S3_CREATE_BUCKET, ni siquiera a "false" — eso
    // ejercitaría el lado derecho del `??`, no el operador en sí.
    mockSend.mockImplementation((command: ComandoMock) => {
      if (command.__name === "HeadBucket") return Promise.reject(new Error("NotFound"));
      throw new Error(`comando inesperado: ${command.__name}`);
    });

    const storage = createStorage("s3");
    const temporal = archivoTemporal(`propnexus-s3-sin-create-bucket-${Date.now()}.pdf`, "x");

    try {
      await expect(
        storage.put({ localPath: temporal, key: "k", contentType: "application/pdf" })
      ).rejects.toThrow(/El bucket propnexus-test no existe/);
    } finally {
      fs.unlinkSync(temporal);
    }
  });
});

describe("S3Storage — bucketReady ya en true", () => {
  it("el segundo put no vuelve a preguntar HeadBucket", async () => {
    process.env.S3_ENDPOINT = "http://localhost:9000";
    process.env.S3_CREATE_BUCKET = "true";
    let headBucketLlamadas = 0;
    mockSend.mockImplementation((command: ComandoMock) => {
      if (command.__name === "HeadBucket") {
        headBucketLlamadas++;
        return Promise.resolve({});
      }
      if (command.__name === "Put") return Promise.resolve({});
      if (command.__name === "Get") return Promise.resolve({ Body: cuerpoDe("dos") });
      throw new Error(`comando inesperado: ${command.__name}`);
    });

    // Una sola instancia — es la misma instancia la que recuerda `bucketReady`.
    const storage = createStorage("s3");
    const temporal1 = archivoTemporal(`propnexus-s3-ready-1-${Date.now()}.pdf`, "uno");
    const temporal2 = archivoTemporal(`propnexus-s3-ready-2-${Date.now()}.pdf`, "dos");

    try {
      await storage.put({ localPath: temporal1, key: "k1", contentType: "application/pdf" });
      expect(headBucketLlamadas).toBe(1);

      await storage.put({ localPath: temporal2, key: "k2", contentType: "application/pdf" });
      // El segundo put NO vuelve a llamar HeadBucket: bucketReady ya es true.
      expect(headBucketLlamadas).toBe(1);
    } finally {
      fs.unlinkSync(temporal1);
      fs.unlinkSync(temporal2);
    }
  });
});
