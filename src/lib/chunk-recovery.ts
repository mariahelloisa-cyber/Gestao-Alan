/**
 * Recuperação de assets incompatíveis.
 *
 * Cenário: a aba ficou aberta durante um deploy. O HTML/JS em memória aponta
 * para `assets/<nome>-<hash>.js` do build antigo. O Cloudflare Workers Assets
 * só serve os arquivos do deploy atual, então o chunk antigo devolve 404 e o
 * import dinâmico rejeita. Sem tratamento, a aplicação simplesmente morre.
 *
 * Estratégia: identificar esse erro específico e fazer UM reload forçado, com
 * trava anti-loop — se recarregar não resolver (ex.: proxy corporativo servindo
 * HTML velho), paramos e deixamos a UI de erro aparecer, em vez de entrar num
 * ciclo infinito de reloads.
 */

import { log } from "./diagnostics";
import { readSession, writeSession } from "./storage";

const GUARD_KEY = "chunk-reload";
const GUARD_WINDOW_MS = 30_000;
const MAX_ATTEMPTS = 2;

const CHUNK_ERROR_PATTERNS: RegExp[] = [
  /ChunkLoadError/i,
  /Loading chunk \S+ failed/i,
  /Loading CSS chunk/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /'text\/html' is not a valid JavaScript MIME type/i,
  /Unable to preload CSS/i,
  /Failed to load module script/i,
];

/** true quando o erro indica bundle/asset incompatível — não um bug de lógica. */
export function isChunkError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  if (!text) return false;
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(text));
}

interface Guard {
  attempts: number;
  at: number;
}

function readGuard(): Guard {
  try {
    const raw = readSession(GUARD_KEY);
    if (!raw) return { attempts: 0, at: 0 };
    const parsed = JSON.parse(raw) as Guard;
    if (Date.now() - parsed.at > GUARD_WINDOW_MS) return { attempts: 0, at: 0 };
    return parsed;
  } catch {
    return { attempts: 0, at: 0 };
  }
}

/**
 * Tenta recuperar recarregando. Retorna `false` quando a trava já estourou —
 * nesse caso o chamador deve mostrar a UI de erro.
 */
export function recoverFromChunkError(source: string): boolean {
  if (typeof window === "undefined") return false;

  const guard = readGuard();
  if (guard.attempts >= MAX_ATTEMPTS) {
    log("chunk-error", `Recuperação abortada após ${guard.attempts} tentativas (${source})`);
    return false;
  }

  writeSession(GUARD_KEY, JSON.stringify({ attempts: guard.attempts + 1, at: Date.now() }));
  log("chunk-error", `Assets incompatíveis detectados (${source}) — recarregando`, {
    attempt: guard.attempts + 1,
  });

  // `location.reload()` revalida o documento; os assets são hasheados, então os
  // novos hashes vêm do HTML novo. Query param derrota proxies intermediários.
  const url = new URL(window.location.href);
  url.searchParams.set("__r", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

/** Marca a recuperação como bem-sucedida — some com o `?__r=` da barra. */
export function clearRecoveryMarker(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("__r")) return;
  url.searchParams.delete("__r");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

let installed = false;

/** Listeners globais para erros de chunk que escapam dos Error Boundaries. */
export function installChunkRecovery(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  clearRecoveryMarker();

  window.addEventListener(
    "error",
    (event) => {
      if (isChunkError(event.error ?? event.message)) recoverFromChunkError("window.error");
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkError(event.reason)) recoverFromChunkError("unhandledrejection");
  });

  // Vite/Rollup emitem este evento quando um import dinâmico falha.
  window.addEventListener("vite:preloadError", () => {
    recoverFromChunkError("vite:preloadError");
  });
}
