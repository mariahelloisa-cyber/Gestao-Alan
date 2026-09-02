import "./lib/error-capture";

import process from "node:process";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { APP_VERSION, BUILD_ID, VERSION_ENDPOINT } from "./lib/app-version";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function redirectDemandasRoot(request: Request): Response | undefined {
  const domains = (process.env.DEMANDAS_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  if (domains.length === 0) return undefined;

  const url = new URL(request.url);
  if (domains.includes(url.hostname) && url.pathname === "/") {
    return Response.redirect(new URL("/demandas/nova", url), 302);
  }
  return undefined;
}

/**
 * Identidade do build publicado. O frontend compara com o BUILD_ID que ele
 * próprio carregou para detectar abas rodando uma versão antiga.
 */
function versionResponse(): Response {
  return new Response(JSON.stringify({ version: APP_VERSION, buildId: BUILD_ID }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, must-revalidate",
    },
  });
}

/**
 * O documento HTML é gerado pelo SSR e referencia assets hasheados do deploy
 * ATUAL. Sem `Cache-Control`, o navegador aplica cache heurístico e pode
 * reutilizar um HTML antigo — que aponta para chunks já removidos do Workers
 * Assets, causando 404 e ChunkLoadError.
 *
 * HTML: nunca cacheado. Os assets seguem `immutable` via `_headers`, que é o
 * comportamento correto justamente por serem hasheados.
 */
function withNoStoreForHtml(response: Response): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;
  if (response.headers.has("cache-control")) return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("pragma", "no-cache");
  headers.set("x-app-build", BUILD_ID);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (new URL(request.url).pathname === VERSION_ENDPOINT) return versionResponse();

    const redirect = redirectDemandasRoot(request);
    if (redirect) return redirect;

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withNoStoreForHtml(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store, must-revalidate",
        },
      });
    }
  },
};
