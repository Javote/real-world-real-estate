import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SPEC-018 A6 — dos ramas de `instrumentation.ts` que `test/instrumentation.test.ts`
// (SPEC-017 paso 4) no ejercita: `NODE_ENV` ausente en `initSentry` (la suite
// siempre corre con `NODE_ENV=test`, fijado en `vitest.config.mts`, así que
// el `?? "development"` nunca tomaba el lado default) y el `.catch()` del
// `sdk.shutdown()` que corre en `SIGTERM` — el test existente prueba que
// `shutdown` se llama, no que un `shutdown` que RECHAZA no tira un
// unhandled rejection.
//
// Mismo patrón que `test/instrumentation.test.ts`: `@sentry/node` se
// mockea porque es un `import` estático; los `@opentelemetry/*` no, porque
// son requires tardíos — se les pasan dependencias falsas por parámetro.

const sentryInit = vi.fn();
vi.mock("@sentry/node", () => ({ init: sentryInit }));

let previoSentryDsn: string | undefined;
let previoNodeEnv: string | undefined;

beforeEach(() => {
  previoSentryDsn = process.env.SENTRY_DSN;
  previoNodeEnv = process.env.NODE_ENV;
  process.env.SENTRY_DSN = "https://example.invalid/coverage";
  delete process.env.NODE_ENV;
  vi.clearAllMocks();
});

afterEach(() => {
  if (previoSentryDsn === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = previoSentryDsn;
  if (previoNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previoNodeEnv;
});

describe("initSentry sin NODE_ENV", () => {
  it('cae a environment: "development"', async () => {
    vi.resetModules();
    const { initSentry } = await import("../src/instrumentation.js");

    initSentry();

    expect(sentryInit).toHaveBeenCalledWith(
      expect.objectContaining({ environment: "development" })
    );
  });
});

describe("initOpenTelemetry — el catch del shutdown en SIGTERM", () => {
  const ENV = "OTEL_EXPORTER_OTLP_ENDPOINT";
  let previoOtel: string | undefined;

  beforeEach(() => {
    previoOtel = process.env[ENV];
    process.env[ENV] = "https://example.invalid/otlp-coverage";
  });

  afterEach(() => {
    if (previoOtel === undefined) delete process.env[ENV];
    else process.env[ENV] = previoOtel;
  });

  it("un shutdown que rechaza no produce un unhandled rejection", async () => {
    vi.resetModules();
    const { initOpenTelemetry } = await import("../src/instrumentation.js");

    const shutdown = vi.fn().mockRejectedValue(new Error("shutdown roto"));
    const NodeSDK = vi.fn().mockImplementation(function NodeSDK() {
      return { start: vi.fn(), shutdown };
    });

    // Se captura el listener con `vi.spyOn(process, "on")` y se invoca a
    // mano — no se manda una señal real al proceso de test (`process.emit`
    // dispararía TODOS los listeners de `SIGTERM` que otras suites de este
    // mismo archivo/proceso ya hayan dejado registrados, que es ruido que no
    // hace falta para probar este `.catch`).
    const onSpy = vi.spyOn(process, "on");

    initOpenTelemetry({
      NodeSDK,
      getNodeAutoInstrumentations: vi.fn().mockReturnValue([]),
      OTLPTraceExporter: vi.fn().mockImplementation(function OTLPTraceExporter() {}),
      OTLPMetricExporter: vi.fn().mockImplementation(function OTLPMetricExporter() {}),
      PeriodicExportingMetricReader: vi
        .fn()
        .mockImplementation(function PeriodicExportingMetricReader() {}),
      defaultResource: vi.fn().mockReturnValue({ merge: vi.fn().mockReturnValue({}) }),
      resourceFromAttributes: vi.fn().mockReturnValue({}),
      ATTR_SERVICE_NAME: "service.name",
      diag: { setLogger: vi.fn() },
      DiagConsoleLogger: vi.fn().mockImplementation(function DiagConsoleLogger() {}),
      DiagLogLevel: { ERROR: 1 }
    });

    const llamada = onSpy.mock.calls.find(([evento]) => evento === "SIGTERM");
    expect(llamada).toBeDefined();
    const listener = llamada?.[1] as () => void;
    onSpy.mockRestore();

    listener();

    expect(shutdown).toHaveBeenCalledTimes(1);
    // El rechazo de `shutdown()` ya está encadenado con `.catch(() => undefined)`
    // en la misma expresión síncrona de `listener()` — esperar sobre esa
    // misma promesa no reintroduce el rechazo, solo confirma que resolvió.
    await expect(shutdown.mock.results[0]?.value).rejects.toThrow("shutdown roto");
  });
});
