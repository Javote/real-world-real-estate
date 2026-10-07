import { describe, expect, it } from "vitest";
import {
  avisosDelEntorno,
  DEFAULT_DATABASE_URL,
  type Entorno,
  entorno,
  VARIABLES_DEL_ENTORNO
} from "../src/platform/config.js";

// Cada fila es el comportamiento que tenía la lectura en su archivo antes de A0.2 (SPEC-612):
// ausente, vacía e inválida. Ninguna tira.
const CASOS: [keyof Entorno, string | undefined, unknown][] = [
  ["NODE_ENV", undefined, "development"],
  ["NODE_ENV", "", ""],
  ["PORT", undefined, 8787],
  ["PORT", "", 8787],
  ["PORT", "9000", 9000],
  ["PORT", "abc", Number.NaN],
  ["WEB_ORIGIN", undefined, ["http://localhost:3000"]],
  ["WEB_ORIGIN", "", []],
  ["WEB_ORIGIN", " https://a.ar , ,https://b.ar", ["https://a.ar", "https://b.ar"]],
  ["JWT_SECRET", undefined, undefined],
  ["JWT_SECRET", "   ", undefined],
  ["JWT_SECRET", " s3cret ", "s3cret"],
  ["TRUST_PROXY_HOPS", undefined, 0],
  ["TRUST_PROXY_HOPS", "abc", 0],
  ["TRUST_PROXY_HOPS", "-1", 0],
  ["TRUST_PROXY_HOPS", "3abc", 3],
  ["TRUST_PROXY_HOPS", "1", 1],
  ["LOGIN_RATE_LIMIT_MAX", undefined, 20],
  ["LOGIN_RATE_LIMIT_MAX", "0", 20],
  ["LOGIN_RATE_LIMIT_MAX", "abc", 20],
  ["LOGIN_RATE_LIMIT_MAX", "5", 5],
  ["DOSSIER_RATE_LIMIT_MAX", undefined, 60],
  ["DOSSIER_RATE_LIMIT_MAX", "-3", 60],
  ["DOSSIER_RATE_LIMIT_MAX", "7", 7],
  ["DATABASE_URL", undefined, DEFAULT_DATABASE_URL],
  ["DATABASE_URL", "", ""],
  ["DATABASE_AUTH_TOKEN", "", undefined],
  ["DATABASE_AUTH_TOKEN", "tok", "tok"],
  ["UPLOAD_DIR", "", undefined],
  ["UPLOAD_DIR", "/tmp/x", "/tmp/x"],
  ["STORAGE_DRIVER", undefined, "disk"],
  ["STORAGE_DRIVER", "ftp", "ftp"],
  ["S3_ENDPOINT", "", ""],
  ["S3_REGION", undefined, "us-east-1"],
  ["S3_REGION", "", ""],
  ["S3_BUCKET", "", undefined],
  ["S3_ACCESS_KEY_ID", "", undefined],
  ["S3_SECRET_ACCESS_KEY", "", undefined],
  ["S3_FORCE_PATH_STYLE", undefined, true],
  ["S3_FORCE_PATH_STYLE", "", false],
  ["S3_FORCE_PATH_STYLE", "yes", false],
  ["S3_FORCE_PATH_STYLE", "false", false],
  ["S3_CREATE_BUCKET", undefined, false],
  ["S3_CREATE_BUCKET", "TRUE", false],
  ["S3_CREATE_BUCKET", "true", true],
  ["ANCHOR_MODE", undefined, "simulated"],
  ["ANCHOR_MODE", "", ""],
  ["CARDANO_NETWORK", "", ""],
  ["BLOCKFROST_API_KEY", "", ""],
  ["BLOCKFROST_URL", undefined, undefined],
  ["SERVICE_WALLET_PRIVATE_KEY", "", ""],
  ["SENTRY_DSN", "", undefined],
  ["OTEL_EXPORTER_OTLP_ENDPOINT", "", undefined],
  ["SEED_ADMIN_PASSWORD", "  ", undefined],
  ["SEED_DEMO_PASSWORD", " pw ", "pw"]
];

describe("entorno — cada campo parsea como antes", () => {
  it.each(CASOS)("%s=%j → %j", (clave, valor, esperado) => {
    const env = valor === undefined ? {} : { [clave]: valor };
    expect(entorno(env)[clave]).toEqual(esperado);
  });

  it("todo campo del schema tiene al menos un caso", () => {
    const cubiertos = new Set(CASOS.map(([clave]) => clave));
    expect(VARIABLES_DEL_ENTORNO.filter((v) => !cubiertos.has(v))).toEqual([]);
  });

  it("lee el `process.env` del momento, no uno capturado al importar", () => {
    const antes = process.env.LOGIN_RATE_LIMIT_MAX;
    try {
      process.env.LOGIN_RATE_LIMIT_MAX = "9";
      expect(entorno().LOGIN_RATE_LIMIT_MAX).toBe(9);
    } finally {
      if (antes === undefined) delete process.env.LOGIN_RATE_LIMIT_MAX;
      else process.env.LOGIN_RATE_LIMIT_MAX = antes;
    }
  });
});

describe("avisosDelEntorno — lo mal formado se loguea al arrancar, no frena", () => {
  it("sin nada mal formado, ningún aviso", () => {
    expect(
      avisosDelEntorno({ PORT: "8787", TRUST_PROXY_HOPS: "1", S3_FORCE_PATH_STYLE: "false" })
    ).toEqual([]);
  });

  it("ausente o vacía no es mal formada", () => {
    expect(avisosDelEntorno({ TRUST_PROXY_HOPS: "" })).toEqual([]);
  });

  it("nombra la variable y el valor que se usa, nunca el valor crudo", () => {
    const avisos = avisosDelEntorno({
      TRUST_PROXY_HOPS: "3abc",
      LOGIN_RATE_LIMIT_MAX: "0",
      S3_CREATE_BUCKET: "yes"
    });

    expect(avisos).toHaveLength(3);
    expect(avisos[0]).toMatch(/^TRUST_PROXY_HOPS .*se usa 3$/);
    expect(avisos[1]).toMatch(/^LOGIN_RATE_LIMIT_MAX .*se usa 20$/);
    expect(avisos[2]).toMatch(/^S3_CREATE_BUCKET .*se usa false$/);
    expect(avisos.join()).not.toContain("3abc");
  });
});
