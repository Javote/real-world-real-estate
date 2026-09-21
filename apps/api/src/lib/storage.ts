import { createHash } from "node:crypto";
import fs from "node:fs";
import type { Readable } from "node:stream";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

// El almacenamiento de evidencia detrás de una interfaz propia (D-011).
//
// **`s3` no es "el driver de producción" y `disk` el de juguete:** son el mismo
// código contra dos backends S3 distintos —MinIO en local, Cloudflare R2 en
// prod— y por eso probar contra MinIO prueba lo que va a correr desplegado.
// `disk` existe para el arranque sin infraestructura y para la suite.
//
// El `storageRef` que se guarda en `Evidence.storagePath` es opaco y **nunca
// sale al cliente** (D-011, incidente real de filtración de ruta absoluta): con
// `disk` es una ruta, con `s3` es la key del objeto.

export type StorageDriver = "disk" | "s3";

export interface StoragePort {
  readonly driver: StorageDriver;
  /**
   * Guarda el archivo temporal y devuelve su `storageRef`.
   *
   * Devuelve **el SHA-256 de los bytes que quedaron guardados**, no el del
   * temporal: es la deuda 🔴 que `CLAUDE.md` §El SHA-256 se mueve cuando llegue
   * R2 dejó anotada. Un hash del temporal probaría lo que subimos, no lo que
   * está guardado, y toda la cadena de prueba cuelga de esa diferencia.
   */
  put(input: { localPath: string; key: string; contentType: string }): Promise<{
    storageRef: string;
    sha256: string;
  }>;
  read(storageRef: string): Promise<Readable>;
  exists(storageRef: string): Promise<boolean>;
  remove(storageRef: string): Promise<void>;
}

function sha256Of(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/** SHA-256 de un archivo local, en streaming (no lo carga entero en memoria). */
export function sha256DeArchivo(localPath: string): Promise<string> {
  return sha256Of(fs.createReadStream(localPath));
}

/** Los primeros `n` bytes de un archivo local — para reconocer su tipo real sin leerlo entero. */
export async function leerCabecera(localPath: string, n: number): Promise<Buffer> {
  const handle = await fs.promises.open(localPath, "r");
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await handle.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Disco local: el archivo ya lo escribió Multer, así que `put` solo lo hashea. */
class DiskStorage implements StoragePort {
  readonly driver = "disk" as const;

  async put({ localPath }: { localPath: string; key: string; contentType: string }) {
    const sha256 = await sha256Of(fs.createReadStream(localPath));
    return { storageRef: localPath, sha256 };
  }

  async read(storageRef: string): Promise<Readable> {
    return fs.createReadStream(storageRef);
  }

  async exists(storageRef: string): Promise<boolean> {
    return fs.existsSync(storageRef);
  }

  async remove(storageRef: string): Promise<void> {
    if (fs.existsSync(storageRef)) fs.unlinkSync(storageRef);
  }
}

export interface S3StorageConfig {
  endpoint?: string | undefined;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  /** Crear el bucket si falta. En MinIO sí; en R2 el bucket se crea afuera. */
  createBucket: boolean;
}

class S3Storage implements StoragePort {
  readonly driver = "s3" as const;

  private readonly client: S3Client;
  private bucketReady = false;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async put({
    localPath,
    key,
    contentType
  }: {
    localPath: string;
    key: string;
    contentType: string;
  }) {
    await this.ensureBucket();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: fs.createReadStream(localPath),
        ContentType: contentType,
        ContentLength: fs.statSync(localPath).size
      })
    );

    // **Se relee y se rehashea a propósito.** El hash tiene que cubrir los
    // bytes que quedaron en el object storage, no los del temporal: si la
    // subida se truncara, el hash del temporal seguiría siendo "correcto" y
    // estaríamos anclando la huella de un archivo que no existe en ningún lado.
    const sha256 = await sha256Of(await this.read(key));
    return { storageRef: key, sha256 };
  }

  async read(storageRef: string): Promise<Readable> {
    const salida = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: storageRef })
    );
    return salida.Body as Readable;
  }

  async exists(storageRef: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: storageRef })
      );
      return true;
    } catch {
      return false;
    }
  }

  async remove(storageRef: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: storageRef })
    );
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch {
      if (!this.config.createBucket) throw new Error(`El bucket ${this.config.bucket} no existe`);
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
    }
    this.bucketReady = true;
  }
}

function required(name: string): string {
  const valor = process.env[name];
  if (!valor) {
    // D-042: el modo inseguro no existe. Si el driver es S3 y falta config, el
    // proceso se cae al arrancar — no en el primer upload, cuando ya hay un
    // usuario esperando y un archivo a medio camino.
    throw new Error(`STORAGE_DRIVER=s3 exige ${name}, y no está definida`);
  }
  return valor;
}

export function createStorage(driver: string = process.env.STORAGE_DRIVER ?? "disk"): StoragePort {
  if (driver === "disk") return new DiskStorage();

  if (driver === "s3") {
    return new S3Storage({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      bucket: required("S3_BUCKET"),
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
      // MinIO necesita path-style; R2 lo tolera. Default `true` porque el que
      // se prueba local es MinIO.
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
      createBucket: (process.env.S3_CREATE_BUCKET ?? "false") === "true"
    });
  }

  throw new Error(`STORAGE_DRIVER inválido: "${driver}". Valores posibles: disk | s3`);
}

export const storage = createStorage();
