import "dotenv/config";

// **Este archivo se precarga con `node --require`, antes que cualquier otro
// módulo del proceso** (ver `package.json` → `dev`/`start` y `render.yaml`).
// No es un detalle de estilo: tanto OTel como Sentry auto-instrumentan
// parcheando módulos (`http`, `express`, el driver de la base) en el momento
// en que alguien los `require`ea por primera vez. Si este archivo se
// importara desde adentro de `app.ts` —como hacía el resto del proyecto con
// `dotenv/config`—, Express y el resto ya estarían cargados sin parche antes
// de que la instrumentación exista. Mismo problema de fondo que D-042 con
// `dotenv.config()` intercalado, distinta solución porque acá no alcanza con
// el orden de los `import`: hace falta que el proceso entero arranque por
// este archivo.
//
// **Las dos piezas son opcionales y silenciosamente no-op sin su env var.**
// Ninguna cuenta de Sentry/Grafana Cloud existe todavía en un checkout nuevo,
// y un desarrollador sin esas cuentas tiene que poder correr `pnpm dev` sin
// crearlas — mismo espíritu que D-075 con el `AnchorPort`: la ausencia de
// configuración de observabilidad no puede tumbar el proceso.

import * as Sentry from "@sentry/node";

/**
 * Exportada (SPEC-017 paso 4, tanda 3) para que un test la invoque con
 * `@sentry/node` mockeado — el bloque en sí no cambia de comportamiento, y
 * sigue llamándose incondicionalmente al importar este archivo, que es lo que
 * D-042/D-075 exigen: la instrumentación tiene que ser automática al
 * `--require`, no algo que alguien tenga que acordarse de invocar.
 */
export function initSentry(): void {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      // Trazas de Sentry apagadas a propósito: OTel (abajo) ya cubre traces y
      // las manda a Grafana Cloud. Prender las dos duplica el mismo dato en dos
      // proveedores por el mismo costo de performance.
      tracesSampleRate: 0,
      // Regla 2: cero PII. `sendDefaultPii` mandaría IP e headers por default.
      sendDefaultPii: false,
      // Sin esto, @sentry/node registra su propio TracerProvider/ContextManager/
      // Propagator de OTel acá mismo, antes de que el NodeSDK de abajo llame a
      // sdk.start() — y como el registro global es el que gana la carrera, las
      // auto-instrumentaciones de http/express terminan creando spans contra el
      // tracer de Sentry (que los descarta, tracesSampleRate: 0) en vez del
      // nuestro. No tira el proceso (registerGlobal solo loguea y sigue), así
      // que quedaba en silencio: el deploy vivía, Tempo se quedaba vacío.
      skipOpenTelemetrySetup: true
    });
    console.log("[instrumentation] Sentry activo");
  } else {
    console.log("[instrumentation] SENTRY_DSN ausente — Sentry apagado");
  }
}

/**
 * Lo que `initOpenTelemetry` necesita de los `@opentelemetry/*` — separado en
 * una interfaz para poder inyectar un fake en un test sin pasar por
 * `require()`. **`vi.mock` no alcanza acá**: son requires tardíos y literales
 * (la razón está en el comentario de abajo), y a diferencia del `import
 * * as Sentry` de arriba, un `require()` corre por el `require` real de Node,
 * no por el grafo de módulos que Vitest intercepta — mockearlo dejaba
 * `NodeSDK.start()` corriendo de verdad y registrando globals reales de OTel.
 */
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

// Requires tardíos a propósito: si `OTEL_EXPORTER_OTLP_ENDPOINT` no estuviera
// seteado (el caso común en un checkout nuevo), no tiene sentido pagar el
// costo de cargar estos paquetes más pesados antes de saber que hacen falta.
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

/**
 * Idem `initSentry`: exportada solo para poder inyectarle dependencias falsas
 * en un test, sin cambiar que sigue corriendo sola al importar el archivo.
 * `deps` es opcional y solo se resuelve (con `cargarDependenciasOtel`, los
 * requires reales) si hace falta — así un test le pasa un objeto armado a
 * mano y la suite nunca toca la red ni un proceso real.
 */
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

    // Sin esto, un exporter OTLP que falla (auth, endpoint mal armado) no dice
    // nada — ni acá ni en Grafana Cloud aparece un error, solo ausencia de
    // datos. ERROR alcanza: no hace falta el ruido de DEBUG para diagnosticar
    // un rechazo del gateway.
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

    const sdk = new NodeSDK({
      resource: defaultResource().merge(
        resourceFromAttributes({ [ATTR_SERVICE_NAME]: "propnexus-api" })
      ),
      traceExporter: new OTLPTraceExporter(),
      metricReaders: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })],
      // Kysely/libSQL no tienen instrumentación OTel dedicada; `http` y
      // `express` sí, y son los dos que dan la latencia por endpoint que M3 §4
      // pide ("error budgets"). El resto de las auto-instrumentaciones
      // (fs, dns, net) es ruido para este tamaño de app — se apagan explícitas
      // en vez de quedar prendidas "porque vinieron por default".
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

    // Render manda SIGTERM en cada deploy (mismo motivo que `cerrar()` en
    // server.ts); sin este flush, los últimos spans de un request en vuelo se
    // pierden en cada redeploy.
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
