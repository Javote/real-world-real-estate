import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStorage } from "../src/lib/storage";

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

const ENV_S3 = {
  S3_BUCKET: "propnexus-test",
  S3_ACCESS_KEY_ID: "test-key",
  S3_SECRET_ACCESS_KEY: "test-secret",
  S3_ENDPOINT: "http://localhost:9000",
  S3_CREATE_BUCKET: "true"
};

let previo: Record<string, string | undefined> = {};

beforeEach(() => {
  previo = {};
  for (const [k, v] of Object.entries(ENV_S3)) {
    previo[k] = process.env[k];
    process.env[k] = v;
  }
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

describe("S3Storage.put", () => {
  it("sube el archivo y relee el hash de lo que quedó guardado, no del temporal", async () => {
    mockSend.mockImplementation((command: ComandoMock) => {
      if (command.__name === "HeadBucket") return Promise.resolve({});
      if (command.__name === "Put") return Promise.resolve({});
      if (command.__name === "Get") return Promise.resolve({ Body: cuerpoDe("contenido subido") });
      throw new Error(`comando inesperado: ${command.__name}`);
    });

    const storage = createStorage("s3");
    const temporal = path.join(os.tmpdir(), `propnexus-s3-mock-${Date.now()}.pdf`);
    fs.writeFileSync(temporal, "otro contenido, el del temporal");

    try {
      const resultado = await storage.put({
        localPath: temporal,
        key: "evidence/mock/archivo.pdf",
        contentType: "application/pdf"
      });

      expect(resultado.storageRef).toBe("evidence/mock/archivo.pdf");
      expect(resultado.sha256).toBe(createHash("sha256").update("contenido subido").digest("hex"));

      const put = mockSend.mock.calls.find(
        (call) => (call[0] as ComandoMock).__name === "Put"
      )?.[0] as ComandoMock<"Put">;
      expect(put.input).toMatchObject({
        Bucket: "propnexus-test",
        Key: "evidence/mock/archivo.pdf",
        ContentType: "application/pdf"
      });
    } finally {
      fs.unlinkSync(temporal);
    }
  });
});

describe("S3Storage.ensureBucket", () => {
  it("crea el bucket si no existe y S3_CREATE_BUCKET=true", async () => {
    mockSend.mockImplementation((command: ComandoMock) => {
      if (command.__name === "HeadBucket") return Promise.reject(new Error("NotFound"));
      if (command.__name === "CreateBucket") return Promise.resolve({});
      if (command.__name === "Put") return Promise.resolve({});
      if (command.__name === "Get") return Promise.resolve({ Body: cuerpoDe("x") });
      throw new Error(`comando inesperado: ${command.__name}`);
    });

    const storage = createStorage("s3");
    const temporal = path.join(os.tmpdir(), `propnexus-s3-mock-crea-${Date.now()}.pdf`);
    fs.writeFileSync(temporal, "x");

    try {
      await storage.put({ localPath: temporal, key: "k", contentType: "application/pdf" });
      expect(
        mockSend.mock.calls.some((call) => (call[0] as ComandoMock).__name === "CreateBucket")
      ).toBe(true);
    } finally {
      fs.unlinkSync(temporal);
    }
  });

  it("sin S3_CREATE_BUCKET, un bucket ausente revienta en vez de crearlo en silencio", async () => {
    process.env.S3_CREATE_BUCKET = "false";
    mockSend.mockImplementation((command: ComandoMock) => {
      if (command.__name === "HeadBucket") return Promise.reject(new Error("NotFound"));
      throw new Error(`comando inesperado: ${command.__name}`);
    });

    const storage = createStorage("s3");
    const temporal = path.join(os.tmpdir(), `propnexus-s3-mock-sin-crear-${Date.now()}.pdf`);
    fs.writeFileSync(temporal, "x");

    try {
      await expect(
        storage.put({ localPath: temporal, key: "k", contentType: "application/pdf" })
      ).rejects.toThrow(/El bucket propnexus-test no existe/);
    } finally {
      fs.unlinkSync(temporal);
    }
  });
});

describe("S3Storage.read", () => {
  it("devuelve el Body de GetObjectCommand", async () => {
    mockSend.mockImplementation((command: ComandoMock) => {
      if (command.__name === "Get") return Promise.resolve({ Body: cuerpoDe("leído") });
      throw new Error(`comando inesperado: ${command.__name}`);
    });

    const storage = createStorage("s3");
    const stream = await storage.read("alguna/key.pdf");
    const partes: Buffer[] = [];
    for await (const chunk of stream) partes.push(chunk as Buffer);
    expect(Buffer.concat(partes).toString()).toBe("leído");
  });
});

describe("S3Storage.exists", () => {
  it("true cuando HeadObjectCommand resuelve", async () => {
    mockSend.mockImplementation((command: ComandoMock) => {
      if (command.__name === "HeadObject") return Promise.resolve({});
      throw new Error(`comando inesperado: ${command.__name}`);
    });

    const storage = createStorage("s3");
    expect(await storage.exists("k")).toBe(true);
  });

  it("false cuando HeadObjectCommand rechaza — objeto ausente, no un error que propagar", async () => {
    mockSend.mockImplementation((command: ComandoMock) => {
      if (command.__name === "HeadObject") return Promise.reject(new Error("NotFound"));
      throw new Error(`comando inesperado: ${command.__name}`);
    });

    const storage = createStorage("s3");
    expect(await storage.exists("k")).toBe(false);
  });
});

describe("S3Storage.remove", () => {
  it("manda DeleteObjectCommand con el bucket y la key correctos", async () => {
    mockSend.mockImplementation((command: ComandoMock) => {
      if (command.__name === "Delete") return Promise.resolve({});
      throw new Error(`comando inesperado: ${command.__name}`);
    });

    const storage = createStorage("s3");
    await storage.remove("evidence/borrar.pdf");

    const del = mockSend.mock.calls.find(
      (call) => (call[0] as ComandoMock).__name === "Delete"
    )?.[0] as ComandoMock<"Delete">;
    expect(del.input).toMatchObject({ Bucket: "propnexus-test", Key: "evidence/borrar.pdf" });
  });
});

describe("DiskStorage.remove", () => {
  it("borra el archivo si existe, y es un no-op si ya no está", async () => {
    const temporal = path.join(os.tmpdir(), `propnexus-disk-remove-${Date.now()}.pdf`);
    fs.writeFileSync(temporal, "x");

    const storage = createStorage("disk");
    expect(fs.existsSync(temporal)).toBe(true);

    await storage.remove(temporal);
    expect(fs.existsSync(temporal)).toBe(false);

    await expect(storage.remove(temporal)).resolves.toBeUndefined();
  });
});
