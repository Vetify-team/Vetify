/**
 * A local stand-in for Tilopay, to exercise the payment flow without a Tilopay
 * account. It serves the three endpoints the API calls and a payment form with
 * an "approve" and a "decline" button, so a browser can make the whole round
 * trip: checkout -> hosted form -> back to /pago -> plan activated.
 *
 * Load it into the API process, which it changes in two ways, in that process
 * only: it serves the fake Tilopay on TILOPAY_SANDBOX_PORT (4010 by default),
 * and it sends the API's calls to app.tilopay.com there instead.
 *
 *   node --import ./scripts/tilopay-sandbox.mjs apps/api/dist/main.js
 *
 * The API still needs TILOPAY_API_USER, TILOPAY_PASSWORD and TILOPAY_KEY set
 * to something non-empty, because it refuses to charge when they are missing.
 *
 * NEVER load this in a deployed environment: it approves payments nobody made.
 */
import { createServer } from "node:http";

const TILOPAY_HOST = "https://app.tilopay.com";
const port = Number(process.env.TILOPAY_SANDBOX_PORT ?? 4010);
const origin = `http://localhost:${port}`;
/** What Tilopay reports as the environment of a test account. */
const environment =
  (process.env.TILOPAY_ENVIRONMENT ?? "test") === "test" ? "Test" : "Production";

/** orderNumber -> what the API asked for, plus the decision made on the form. */
const orders = new Map();
let transactionId = 5000;

const log = (...parts) => console.log("[tilopay-sandbox]", ...parts);

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const json = (response, status, body) => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
};

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

const form = (order) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tilopay (local)</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; display: grid;
         place-items: center; min-height: 100dvh; background: #f4f4f5; }
  main { background: #fff; padding: 2rem; border-radius: 12px; width: 22rem;
         box-shadow: 0 1px 3px #0002; }
  h1 { font-size: 1.1rem; margin: 0 0 .25rem; }
  p  { color: #52525b; margin: .25rem 0; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: .25rem .75rem;
       margin: 1.25rem 0; }
  dt { color: #71717a; } dd { margin: 0; font-variant-numeric: tabular-nums; }
  button { width: 100%; padding: .6rem; border-radius: 8px; border: 0;
           font: inherit; cursor: pointer; margin-top: .5rem; }
  .ok { background: #16a34a; color: #fff; } .no { background: #e4e4e7; }
</style></head>
<body><main>
  <h1>Tilopay de prueba</h1>
  <p>No es Tilopay y no cobra nada. Elegí qué debe responder.</p>
  <dl>
    <dt>Orden</dt><dd>${escape(order.orderNumber)}</dd>
    <dt>Monto</dt><dd>${escape(order.amount)} ${escape(order.currency)}</dd>
    <dt>Entorno</dt><dd>${escape(environment)}</dd>
  </dl>
  <form method="post" action="/form/${encodeURIComponent(order.orderNumber)}/decide">
    <button class="ok" name="decision" value="approve">Aprobar el pago</button>
    <button class="no" name="decision" value="decline">Rechazar el pago</button>
  </form>
</main></body></html>`;

const transaction = (order) => ({
  id_tilopay: order.transactionId,
  orderNumber: order.orderNumber,
  amount: order.amount,
  currency: order.currency,
  code: order.decision === "approve" ? "1" : "2",
  response: order.decision === "approve" ? "Transaccion aprobada" : "Tarjeta rechazada",
  environment,
  auth: order.decision === "approve" ? "123456" : null,
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url, origin);
  const path = url.pathname;

  // --- The API's three calls -------------------------------------------
  if (request.method === "POST" && path === "/api/v1/login") {
    const { apiuser, password } = JSON.parse((await readBody(request)) || "{}");
    if (!apiuser || !password) {
      log("login rejected: TILOPAY_API_USER or TILOPAY_PASSWORD is empty");
      return json(response, 401, { message: "Unauthenticated." });
    }
    log("login ok");
    return json(response, 200, {
      access_token: `sandbox-token-${Date.now()}`,
      expires_in: 86_400,
    });
  }

  if (request.method === "POST" && path === "/api/v1/processPayment") {
    const body = JSON.parse((await readBody(request)) || "{}");
    if (!body.key) {
      log("processPayment rejected: TILOPAY_KEY is empty");
      return json(response, 200, { type: "0", message: "Invalid key" });
    }
    const order = {
      orderNumber: String(body.orderNumber),
      amount: String(body.amount),
      currency: String(body.currency),
      redirect: String(body.redirect),
      decision: null,
      transactionId: ++transactionId,
    };
    orders.set(order.orderNumber, order);
    log(
      `processPayment ${order.orderNumber} ${order.amount} ${order.currency}`,
      `-> ${origin}/form/${order.orderNumber} (volverá a ${order.redirect})`,
    );
    return json(response, 200, {
      type: "100",
      url: `${origin}/form/${encodeURIComponent(order.orderNumber)}`,
    });
  }

  if (request.method === "POST" && path === "/api/v1/consult") {
    const body = JSON.parse((await readBody(request)) || "{}");
    const order = orders.get(String(body.orderNumber));
    if (!order || !order.decision) {
      log(`consult ${String(body.orderNumber)} -> sin transacción todavía`);
      return json(response, 200, { response: [] });
    }
    log(
      `consult ${order.orderNumber} -> code ${order.decision === "approve" ? "1" : "2"}`,
    );
    return json(response, 200, { response: [transaction(order)] });
  }

  // --- The hosted payment form -----------------------------------------
  const match = /^\/form\/([^/]+)(\/decide)?$/.exec(path);
  if (match) {
    const order = orders.get(decodeURIComponent(match[1]));
    if (!order) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("No existe esa orden en el Tilopay de prueba.");
    }
    if (request.method === "GET" && !match[2]) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return response.end(form(order));
    }
    if (request.method === "POST" && match[2]) {
      const decision = new URLSearchParams(await readBody(request)).get("decision");
      order.decision = decision === "approve" ? "approve" : "decline";
      const back = new URL(order.redirect);
      back.searchParams.set("order", order.orderNumber);
      back.searchParams.set("code", order.decision === "approve" ? "1" : "2");
      back.searchParams.set(
        "description",
        order.decision === "approve" ? "Transaccion aprobada" : "Rechazada",
      );
      // The API never trusts these parameters; it asks /consult instead.
      back.searchParams.set("OrderHash", "sandbox-hash-not-verified");
      log(`form ${order.orderNumber} -> ${order.decision}, de vuelta a ${back}`);
      response.writeHead(302, { Location: back.toString() });
      return response.end();
    }
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Tilopay de prueba: ruta desconocida.");
});

server.listen(port, "127.0.0.1", () => {
  log(`escuchando en ${origin} (haciéndose pasar por ${TILOPAY_HOST})`);
});
server.unref();

// Send only the API's Tilopay calls to the sandbox; everything else is intact.
const upstream = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const target = input instanceof Request ? input.url : String(input);
  if (target.startsWith(TILOPAY_HOST)) {
    return upstream(`${origin}${target.slice(TILOPAY_HOST.length)}`, init);
  }
  return upstream(input, init);
};
