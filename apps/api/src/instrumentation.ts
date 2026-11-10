/**
 * OpenTelemetry: traces, metrics and logs of the API, sent over OTLP to any
 * compatible backend (Grafana Cloud, Honeycomb, a local collector...).
 *
 * Loaded before the app with `node --import ./dist/instrumentation.js` so
 * http, express, Nest, pg, undici and pino are patched before they are
 * imported. Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set: local runs and
 * tests send nothing. The exporters read the standard OTEL_EXPORTER_OTLP_*
 * variables (endpoint, headers), so no backend is hard-coded here.
 *
 * What leaves the process: request method, route template, status and
 * timing; SQL statements with `$1` placeholders (never their values); the
 * JSON log lines after pino's redaction. No bodies, headers or cookies.
 */
import { register } from 'node:module';

const HEALTH_PATH = '/api/v1/health';

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // ESM modules can only be patched through a loader hook.
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

  const { startNodeSdk } = await import('@opentelemetry/sdk-node');
  const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace');
  const { PeriodicExportingMetricReader } =
    await import('@opentelemetry/sdk-metrics');
  const { BatchLogRecordProcessor } = await import('@opentelemetry/sdk-logs');
  const { OTLPTraceExporter } =
    await import('@opentelemetry/exporter-trace-otlp-proto');
  const { OTLPMetricExporter } =
    await import('@opentelemetry/exporter-metrics-otlp-proto');
  const { OTLPLogExporter } =
    await import('@opentelemetry/exporter-logs-otlp-proto');
  const { HttpInstrumentation } =
    await import('@opentelemetry/instrumentation-http');
  const { ExpressInstrumentation } =
    await import('@opentelemetry/instrumentation-express');
  const { NestInstrumentation } =
    await import('@opentelemetry/instrumentation-nestjs-core');
  const { PgInstrumentation } =
    await import('@opentelemetry/instrumentation-pg');
  const { PinoInstrumentation } =
    await import('@opentelemetry/instrumentation-pino');
  const { UndiciInstrumentation } =
    await import('@opentelemetry/instrumentation-undici');
  const { RuntimeNodeInstrumentation } =
    await import('@opentelemetry/instrumentation-runtime-node');

  const sdk = startNodeSdk({
    resourceAttributes: {
      'service.name': process.env.OTEL_SERVICE_NAME ?? 'vetify-api',
      // Render sets the commit of the running deploy.
      ...(process.env.RENDER_GIT_COMMIT && {
        'service.version': process.env.RENDER_GIT_COMMIT.slice(0, 7),
      }),
    },
    spanProcessors: [
      new BatchSpanProcessor({ exporter: new OTLPTraceExporter() }),
    ],
    metricReaders: [
      new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
    ],
    instrumentations: [
      new HttpInstrumentation({
        // The platform's liveness probe would drown the real traffic.
        ignoreIncomingRequestHook: (req) => req.url === HEALTH_PATH,
      }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation(),
      // Adds trace_id/span_id to every log line and ships the lines.
      new PinoInstrumentation(),
      // Outgoing fetch (ONVO, web push).
      new UndiciInstrumentation(),
      // Event loop delay, heap and GC.
      new RuntimeNodeInstrumentation(),
    ],
  });

  // Flush what is buffered before the platform stops the container.
  process.once('SIGTERM', () => {
    void sdk.shutdown().finally(() => process.exit(0));
  });
}
