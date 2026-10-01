import "dotenv/config";

import * as Sentry from "@sentry/node";

export function initSentry(): void {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0,
      sendDefaultPii: false,
      skipOpenTelemetrySetup: true
    });
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

function cargarDependenciasOtel(): DependenciasOtel {
  const { NodeSDK } = require("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
  const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
  const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-http");
  const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");
  const { defaultResource, resourceFromAttributes } = require("@opentelemetry/resources");
  const { ATTR_SERVICE_NAME } = require("@opentelemetry/semantic-conventions");
  const { diag, DiagConsoleLogger, DiagLogLevel } = require("@opentelemetry/api");
  return {
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
  };
}

export function initOpenTelemetry(deps?: DependenciasOtel): void {
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
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
    } = deps ?? cargarDependenciasOtel();

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

initSentry();
initOpenTelemetry();

export { Sentry };
