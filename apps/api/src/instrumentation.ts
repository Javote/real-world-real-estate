import "dotenv/config";

import { register } from "node:module";
import { context } from "@opentelemetry/api";
import { createAddHookMessageChannel } from "import-in-the-middle";

export function initSentry(): void {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0,
      sendDefaultPii: false,
      skipOpenTelemetrySetup: true,
      registerEsmLoaderHooks: false
    });
    // Con `skipOpenTelemetrySetup` nadie instala el context manager de Sentry, y sin él todas las
    // requests comparten un isolation scope: cada error salía con la request de la primera.
    context.disable();
    context.setGlobalContextManager(new Sentry.SentryContextManager().enable());
    console.log("[instrumentation] Sentry activo");
  } else {
    console.log("[instrumentation] SENTRY_DSN ausente — Sentry apagado");
  }
}

interface DependenciasOtel {
  NodeSDK: new (config: unknown) => { start: () => void; shutdown: () => Promise<void> };
  getNodeAutoInstrumentations: (config: unknown) => unknown;
  OTLPTraceExporter: new () => unknown;
  OTLPMetricExporter: new () => unknown;
  PeriodicExportingMetricReader: new (config: unknown) => unknown;
  defaultResource: () => { merge: (r: unknown) => unknown };
  resourceFromAttributes: (attrs: unknown) => unknown;
  ATTR_SERVICE_NAME: string;
  diag: { setLogger: (logger: unknown, level: unknown) => void };
  DiagConsoleLogger: new () => unknown;
  DiagLogLevel: { ERROR: unknown };
}

// En ESM, `--import` no alcanza: lo que importa el grafo ESM solo se instrumenta si el hook de
// `import-in-the-middle` está registrado antes de cargarlo. Uno solo, para OTel y para Sentry, que por
// eso arranca con `registerEsmLoaderHooks: false`.
function registrarHookEsm(): () => Promise<void> {
  const { registerOptions, waitForAllMessagesAcknowledged } = createAddHookMessageChannel();
  register("import-in-the-middle/hook.mjs", import.meta.url, registerOptions);
  return waitForAllMessagesAcknowledged;
}

async function cargarDependenciasOtel(): Promise<DependenciasOtel> {
  const [sdkNode, auto, trazas, metricas, sdkMetricas, recursos, semconv, api] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/auto-instrumentations-node"),
    import("@opentelemetry/exporter-trace-otlp-http"),
    import("@opentelemetry/exporter-metrics-otlp-http"),
    import("@opentelemetry/sdk-metrics"),
    import("@opentelemetry/resources"),
    import("@opentelemetry/semantic-conventions"),
    import("@opentelemetry/api")
  ]);
  return {
    NodeSDK: sdkNode.NodeSDK as DependenciasOtel["NodeSDK"],
    getNodeAutoInstrumentations:
      auto.getNodeAutoInstrumentations as DependenciasOtel["getNodeAutoInstrumentations"],
    OTLPTraceExporter: trazas.OTLPTraceExporter,
    OTLPMetricExporter: metricas.OTLPMetricExporter,
    PeriodicExportingMetricReader:
      sdkMetricas.PeriodicExportingMetricReader as DependenciasOtel["PeriodicExportingMetricReader"],
    defaultResource: recursos.defaultResource as DependenciasOtel["defaultResource"],
    resourceFromAttributes:
      recursos.resourceFromAttributes as DependenciasOtel["resourceFromAttributes"],
    ATTR_SERVICE_NAME: semconv.ATTR_SERVICE_NAME,
    diag: api.diag as DependenciasOtel["diag"],
    DiagConsoleLogger: api.DiagConsoleLogger,
    DiagLogLevel: api.DiagLogLevel
  };
}

export function initOpenTelemetry(deps: DependenciasOtel | undefined): void {
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT && deps) {
    const {
      NodeSDK,
      getNodeAutoInstrumentations,
      OTLPTraceExporter,
      OTLPMetricExporter,
      PeriodicExportingMetricReader,
      defaultResource,
      resourceFromAttributes,
      ATTR_SERVICE_NAME,
      diag,
      DiagConsoleLogger,
      DiagLogLevel
    } = deps;

    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

    const sdk = new NodeSDK({
      resource: defaultResource().merge(
        resourceFromAttributes({ [ATTR_SERVICE_NAME]: "propnexus-api" })
      ),
      traceExporter: new OTLPTraceExporter(),
      metricReaders: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })],
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
          "@opentelemetry/instrumentation-dns": { enabled: false },
          "@opentelemetry/instrumentation-net": { enabled: false }
        })
      ]
    });

    sdk.start();
    console.log("[instrumentation] OpenTelemetry activo → Grafana Cloud");

    process.on("SIGTERM", () => {
      sdk.shutdown().catch(() => undefined);
    });
  } else {
    console.log("[instrumentation] OTEL_EXPORTER_OTLP_ENDPOINT ausente — OpenTelemetry apagado");
  }
}

const hookListo =
  process.env.SENTRY_DSN || process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? registrarHookEsm()
    : undefined;
const dependenciasOtel = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? await cargarDependenciasOtel()
  : undefined;

initOpenTelemetry(dependenciasOtel);
await hookListo?.();

// Después de OTel: Sentry importa `node:http` al cargarse, y en ESM ese import solo queda instrumentado
// si el loader ya confirmó qué módulos envolver.
const Sentry = await import("@sentry/node");
initSentry();
await hookListo?.();

export { Sentry };
