/**
 * Detecção de frontend desatualizado.
 *
 * O worker expõe `/__version` com o BUILD_ID do deploy atual. O bundle que esta
 * aba está executando carrega o BUILD_ID do seu próprio build. Divergência =
 * esta aba roda um frontend antigo e vai quebrar assim que precisar de um chunk
 * que não existe mais.
 *
 * Reload é sempre CONTROLADO: mostramos um aviso e o usuário decide, exceto
 * quando um erro de chunk já ocorreu (aí `chunk-recovery` recarrega sozinho).
 */

import { BUILD_ID, VERSION_ENDPOINT } from "./app-version";
import { log } from "./diagnostics";

const POLL_INTERVAL_MS = 5 * 60_000;
const MIN_GAP_MS = 30_000;

let lastCheck = 0;
let outdated = false;
const listeners = new Set<(outdated: boolean) => void>();

export function isOutdated(): boolean {
  return outdated;
}

export function subscribeToVersion(fn: (outdated: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setOutdated(next: boolean) {
  if (outdated === next) return;
  outdated = next;
  for (const fn of listeners) fn(next);
}

export async function checkVersion(reason: string): Promise<void> {
  if (typeof window === "undefined" || outdated) return;
  if (Date.now() - lastCheck < MIN_GAP_MS) return;
  lastCheck = Date.now();

  try {
    const res = await fetch(VERSION_ENDPOINT, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { buildId?: string };
    if (!data.buildId || data.buildId === "dev" || BUILD_ID === "dev") return;

    if (data.buildId !== BUILD_ID) {
      log("update", "Nova versão do frontend publicada", {
        running: BUILD_ID,
        published: data.buildId,
        reason,
      });
      setOutdated(true);
    }
  } catch {
    // Offline ou endpoint indisponível — silencioso por design.
  }
}

/** Recarrega para pegar o build novo. */
export function applyUpdate(): void {
  if (typeof window === "undefined") return;
  log("update", "Reload controlado para aplicar nova versão");
  const url = new URL(window.location.href);
  url.searchParams.set("__v", String(Date.now()));
  window.location.replace(url.toString());
}

let installed = false;

export function installVersionWatcher(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Limpa o marcador de update da URL.
  const url = new URL(window.location.href);
  if (url.searchParams.has("__v")) {
    url.searchParams.delete("__v");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  window.setInterval(() => void checkVersion("interval"), POLL_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkVersion("visibility");
  });

  window.addEventListener("online", () => void checkVersion("online"));

  // Primeira checagem sem competir com a hidratação.
  window.setTimeout(() => void checkVersion("boot"), 15_000);
}
