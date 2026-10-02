import { context } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryInit = vi.fn();
class SentryContextManager {
  enable() {
    return this;
  }
}
vi.mock("@sentry/node", () => ({ init: sentryInit, SentryContextManager }));

let previoSentryDsn: string | undefined;
let previoNodeEnv: string | undefined;

beforeEach(() => {
  vi.spyOn(context, "disable").mockImplementation(() => {});
  vi.spyOn(context, "setGlobalContextManager").mockReturnValue(true);
  previoSentryDsn = process.env.SENTRY_DSN;
  previoNodeEnv = process.env.NODE_ENV;
  process.env.SENTRY_DSN = "https://example.invalid/coverage";
  delete process.env.NODE_ENV;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
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
    await expect(shutdown.mock.results[0]?.value).rejects.toThrow("shutdown roto");
  });
});
