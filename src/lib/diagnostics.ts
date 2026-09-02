/**
 * Diagnóstico do frontend.
 *
 * Buffer circular em memória + espelho em sessionStorage, exposto em
 * `window.__CRM_DIAG__` para suporte pedir ao usuário:
 *
 *     copy(await __CRM_DIAG__.report())
 *
 * NÃO registra senhas, tokens, cookies, e-mails, telefones ou documentos.
 * Toda string passa por `redact()` antes de entrar no buffer.
 */

import { APP_VERSION, BUILD_ID } from "./app-version";
import { NS, readSession, writeSession } from "./storage";

export type DiagKind =
  | "js-error"
  | "unhandled-rejection"
  | "react-error"
  | "chunk-error"
  | "api-error"
  | "update"
  | "storage"
  | "translation"
  | "info";

export interface DiagEntry {
  t: string;
  kind: DiagKind;
  msg: string;
  route?: string;
  detail?: Record<string, unknown>;
}

const MAX_ENTRIES = 120;
const BUFFER_KEY = "diag-buffer";

let buffer: DiagEntry[] = [];
let booted = false;

// --- Redação de dados sensíveis ---------------------------------------------

const PATTERNS: [RegExp, string][] = [
  // JWT (access/refresh token do Supabase)
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, "[jwt]"],
  // e-mail
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email]"],
  // chaves publicáveis / bearer / api keys
  [/\b(sb[ps]?_[A-Za-z0-9_-]{10,})\b/g, "[key]"],
  [/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]"],
  // CPF / CNPJ
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[doc]"],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[doc]"],
  // telefone BR
  [/\b(?:\+55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, "[phone]"],
];

export function redact(input: string): string {
  let out = input;
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  return out.length > 800 ? `${out.slice(0, 800)}…` : out;
}

function currentRoute(): string | undefined {
  if (typeof window === "undefined") return undefined;
  // Apenas o pathname: query strings podem carregar identificadores.
  return window.location.pathname;
}

function persist() {
  try {
    writeSession(BUFFER_KEY, JSON.stringify(buffer.slice(-40)));
  } catch {
    /* ignore */
  }
}

// --- API --------------------------------------------------------------------

export function log(kind: DiagKind, msg: string, detail?: Record<string, unknown>): void {
  const entry: DiagEntry = {
    t: new Date().toISOString(),
    kind,
    msg: redact(msg),
    route: currentRoute(),
  };
  if (detail) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(detail)) {
      clean[k] = typeof v === "string" ? redact(v) : v;
    }
    entry.detail = clean;
  }
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer = buffer.slice(-MAX_ENTRIES);
  persist();

  if (import.meta.env.DEV) console.warn(`[diag:${kind}]`, entry.msg, entry.detail ?? "");
}

export function entries(): DiagEntry[] {
  return [...buffer];
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// --- Detecção de tradução automática ----------------------------------------

/**
 * O tradutor do Chrome marca `<html class="translated-ltr">` e o do Bing/Edge
 * injeta `<font _msttexthash>`. Ambos reescrevem nós de texto sob o React, o
 * que causa `NotFoundError: Failed to execute 'removeChild' on 'Node'`.
 */
export function detectTranslation(): { active: boolean; engine?: string } {
  if (typeof document === "undefined") return { active: false };
  const html = document.documentElement;
  if (html.classList.contains("translated-ltr") || html.classList.contains("translated-rtl")) {
    return { active: true, engine: "google" };
  }
  if (document.querySelector("font[_msttexthash], font[_mstmutation]")) {
    return { active: true, engine: "microsoft" };
  }
  if (document.querySelector(".goog-te-banner-frame, #goog-gt-tt")) {
    return { active: true, engine: "google" };
  }
  return { active: false };
}

// --- Snapshot do ambiente ---------------------------------------------------

export interface DiagSnapshot {
  appVersion: string;
  buildId: string;
  route?: string;
  userAgent?: string;
  platform?: string;
  language?: string;
  languages?: readonly string[];
  online?: boolean;
  viewport?: string;
  deviceMemoryGb?: number;
  translation: { active: boolean; engine?: string };
  serviceWorkers: number;
  cacheStorageKeys: string[];
  storageKeys: string[];
  storageAvailable: boolean;
}

export async function snapshot(): Promise<DiagSnapshot> {
  const translation = detectTranslation();

  let serviceWorkers = 0;
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      serviceWorkers = (await navigator.serviceWorker.getRegistrations()).length;
    }
  } catch {
    /* ignore */
  }

  let cacheStorageKeys: string[] = [];
  try {
    if (typeof window !== "undefined" && "caches" in window) cacheStorageKeys = await caches.keys();
  } catch {
    /* ignore */
  }

  // Apenas os NOMES das chaves do nosso namespace — nunca os valores, e nunca
  // chaves de sessão (`sb-*`).
  const storageKeys: string[] = [];
  let storageAvailable = false;
  try {
    if (typeof window !== "undefined") {
      const s = window.localStorage;
      storageAvailable = true;
      for (let i = 0; i < s.length; i++) {
        const key = s.key(i);
        if (key && key.startsWith(NS)) storageKeys.push(key);
      }
    }
  } catch {
    /* ignore */
  }

  const nav = typeof navigator !== "undefined" ? navigator : undefined;

  return {
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
    route: currentRoute(),
    userAgent: nav?.userAgent,
    platform:
      (nav as { userAgentData?: { platform?: string } } | undefined)?.userAgentData?.platform ??
      (nav as { platform?: string } | undefined)?.platform,
    language: nav?.language,
    languages: nav?.languages,
    online: nav?.onLine,
    viewport:
      typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
    deviceMemoryGb: (nav as { deviceMemory?: number } | undefined)?.deviceMemory,
    translation,
    serviceWorkers,
    cacheStorageKeys,
    storageKeys,
    storageAvailable,
  };
}

export async function report(): Promise<string> {
  const snap = await snapshot();
  return JSON.stringify({ snapshot: snap, log: entries() }, null, 2);
}

// --- Boot -------------------------------------------------------------------

/** Instala os listeners globais. Idempotente; só roda no cliente. */
export function bootDiagnostics(): void {
  if (booted || typeof window === "undefined") return;
  booted = true;

  // Recupera o buffer da mesma aba (sobrevive a reloads de recuperação).
  try {
    const raw = readSession(BUFFER_KEY);
    if (raw) buffer = (JSON.parse(raw) as DiagEntry[]).slice(-40);
  } catch {
    /* ignore */
  }

  // Fase de captura: erros de carregamento de recurso (<script>, <link>) não
  // borbulham e só são vistos aqui.
  window.addEventListener(
    "error",
    (event) => {
      const target = event.target as (HTMLElement & { src?: string; href?: string }) | null;
      if (target && target !== (window as unknown as HTMLElement) && (target.src || target.href)) {
        log("chunk-error", `Falha ao carregar recurso: ${target.src ?? target.href}`, {
          tag: target.tagName,
        });
        return;
      }
      log("js-error", errorMessage(event.error ?? event.message), {
        source: event.filename,
        line: event.lineno,
      });
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    log("unhandled-rejection", errorMessage(event.reason));
  });

  const translation = detectTranslation();
  if (translation.active) {
    log("translation", `Tradução automática ativa (${translation.engine ?? "desconhecida"})`);
  }

  log("info", `App iniciado — v${APP_VERSION} (build ${BUILD_ID})`);

  (window as unknown as Record<string, unknown>).__CRM_DIAG__ = {
    version: APP_VERSION,
    buildId: BUILD_ID,
    entries,
    snapshot,
    report,
    detectTranslation,
  };
}
