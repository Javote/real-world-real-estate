import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `instrumentation.ts` es el archivo que se precarga con `node --require`
// (D-042/D-075) y corre `Sentry.init(...)`/`new NodeSDK(...).start()` al
// importarse, sin ninguna función exportada — SPEC-017 paso 4, tanda 3 lo
// envuelve en `initSentry()`/`initOpenTelemetry()` para poder probar las
// cuatro combinaciones con/sin `SENTRY_DSN` y con/sin
// `OTEL_EXPORTER_OTLP_ENDPOINT`, sin tocar una red ni un proceso real. Las dos
// siguen llamándose incondicionalmente al final del archivo — el
// comportamiento de producción no cambia, solo se vuelve observable.
//
// `initSentry` se prueba mockeando `@sentry/node` (es un `import` estático,
// así que `vi.mock` sí lo intercepta). `initOpenTelemetry` recibe sus
// dependencias como parámetro en vez de mockear los `@opentelemetry/*`: son
// requires tardíos y literales, y `vi.mock` no los intercepta (corren por el
// `require` real de Node) — se comprobó intentándolo primero, y el resultado
// era `NodeSDK.start()` real registrando globals de OTel de verdad.

const sentryInit = vi.fn();
vi.mock("@sentry/node", () => ({ init: sentryInit }));

let previoSentryDsn: string | undefined;

beforeEach(() => {
  previoSentryDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  vi.clearAllMocks();
});

afterEach(() => {
  if (previoSentryDsn === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = previoSentryDsn;
});

describe("initSentry", () => {
  it("con SENTRY_DSN, inicializa con skipOpenTelemetrySetup y sin PII", async () => {
    process.env.SENTRY_DSN = "https://example.invalid/1";
    vi.resetModules();
    const { initSentry } = await import("../src/instrumentation.js");

    initSentry();

    expect(sentryInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://example.invalid/1",
        tracesSampleRate: 0,
        sendDefaultPii: false,
        skipOpenTelemetrySetup: true
      })
    );
  });

  it("sin SENTRY_DSN, no inicializa nada", async () => {
    vi.resetModules();
    const { initSentry } = await import("../src/instrumentation.js");

    initSentry();

    expect(sentryInit).not.toHaveBeenCalled();
  });
});

describe("initOpenTelemetry", () => {
  const ENV = "OTEL_EXPORTER_OTLP_ENDPOINT";
  let previo: string | undefined;

  beforeEach(() => {
    previo = process.env[ENV];
    delete process.env[ENV];
  });

  afterEach(() => {
    if (previo === undefined) delete process.env[ENV];
    else process.env[ENV] = previo;
  });

  function depsFalsas() {
    const start = vi.fn();
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const NodeSDK = vi.fn().mockImplementation(function NodeSDK() {
      return { start, shutdown };
    });
    const setLogger = vi.fn();
    return {
      start,
      shutdown,
      NodeSDK,
      setLogger,
      deps: {
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
        diag: { setLogger },
        DiagConsoleLogger: vi.fn().mockImplementation(function DiagConsoleLogger() {}),
        DiagLogLevel: { ERROR: 1 }
      }
    };
  }

  it("con OTEL_EXPORTER_OTLP_ENDPOINT, arranca el NodeSDK y registra el flush en SIGTERM", async () => {
    process.env[ENV] = "https://example.invalid/otlp";
    vi.resetModules();
    const { initOpenTelemetry } = await import("../src/instrumentation.js");

    const { start, shutdown, NodeSDK, setLogger, deps } = depsFalsas();
    initOpenTelemetry(deps);

    expect(setLogger).toHaveBeenCalled();
    expect(NodeSDK).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();

    try {
      process.emit("SIGTERM");
      expect(shutdown).toHaveBeenCalled();
    } finally {
      process.removeAllListeners("SIGTERM");
    }
  });

  it("sin OTEL_EXPORTER_OTLP_ENDPOINT, no arranca ningún SDK", async () => {
    vi.resetModules();
    const { initOpenTelemetry } = await import("../src/instrumentation.js");

    const { start, NodeSDK, deps } = depsFalsas();
    initOpenTelemetry(deps);

    expect(NodeSDK).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
});
