/**
 * Storage do frontend, namespaced e versionado.
 *
 * Regra de ouro: NUNCA `localStorage.clear()`. A sessão do Supabase mora no
 * mesmo localStorage (chaves `sb-<ref>-auth-token`, ver
 * `src/integrations/supabase/client.ts`) — apagá-la desloga o usuário sem
 * necessidade. A limpeza aqui é por allowlist/denylist explícita.
 */

import { APP_VERSION, STORAGE_SCHEMA_VERSION } from "./app-version";

/** Prefixo de tudo que ESTE app grava e, portanto, tem direito de apagar. */
export const NS = "crm:";

const SCHEMA_KEY = `${NS}storage-schema`;
const VERSION_KEY = `${NS}app-version`;

/**
 * Chaves que sobrevivem a uma migração de schema: preferências do usuário que
 * não têm formato acoplado à versão do app. Tudo mais sob `crm:` é cache/estado
 * derivado e pode ser descartado com segurança.
 */
const SURVIVES_MIGRATION = new Set([`${NS}theme`]);

/**
 * Prefixos que NUNCA são tocados por nenhuma rotina de limpeza deste módulo.
 * `sb-` / `supabase.` = sessão e refresh token do Supabase.
 */
const PROTECTED_PREFIXES = ["sb-", "supabase."];

/** Chaves sem namespace gravadas por versões antigas deste app. */
const LEGACY_KEYS: Record<string, string | null> = {
  // valor = chave nova para onde migrar; null = apenas remover
  theme: `${NS}theme`,
};

function isProtected(key: string): boolean {
  return PROTECTED_PREFIXES.some((p) => key.startsWith(p));
}

function safeArea(area: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const s = area === "local" ? window.localStorage : window.sessionStorage;
    // Modo privado/políticas corporativas podem expor o objeto e falhar no uso.
    const probe = `${NS}__probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

// --- API pública de leitura/escrita -----------------------------------------

export function readJSON<T>(key: string, fallback: T): T {
  const s = safeArea("local");
  if (!s) return fallback;
  try {
    const raw = s.getItem(NS + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Valor corrompido (ex.: escrita interrompida). Descarta e segue.
    try {
      s.removeItem(NS + key);
    } catch {
      /* ignore */
    }
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  const s = safeArea("local");
  if (!s) return;
  try {
    s.setItem(NS + key, JSON.stringify(value));
  } catch {
    /* quota cheia ou storage bloqueado — degrada silenciosamente */
  }
}

export function readString(key: string): string | null {
  const s = safeArea("local");
  if (!s) return null;
  try {
    return s.getItem(NS + key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  const s = safeArea("local");
  if (!s) return;
  try {
    s.setItem(NS + key, value);
  } catch {
    /* ignore */
  }
}

export function removeKey(key: string): void {
  const s = safeArea("local");
  if (!s) return;
  try {
    s.removeItem(NS + key);
  } catch {
    /* ignore */
  }
}

export function readSession(key: string): string | null {
  const s = safeArea("session");
  if (!s) return null;
  try {
    return s.getItem(NS + key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string): void {
  const s = safeArea("session");
  if (!s) return;
  try {
    s.setItem(NS + key, value);
  } catch {
    /* ignore */
  }
}

// --- Migração ---------------------------------------------------------------

export interface MigrationResult {
  ran: boolean;
  previousSchema: string | null;
  previousVersion: string | null;
  removedKeys: string[];
}

/**
 * Roda uma única vez por carregamento, o mais cedo possível.
 *
 * Remove apenas chaves `crm:` incompatíveis e resíduos de versões antigas.
 * Sessão, tokens e preferências preservados por construção.
 */
export function runStorageMigrations(): MigrationResult {
  const result: MigrationResult = {
    ran: false,
    previousSchema: null,
    previousVersion: null,
    removedKeys: [],
  };

  const s = safeArea("local");
  if (!s) return result;

  try {
    result.previousSchema = s.getItem(SCHEMA_KEY);
    result.previousVersion = s.getItem(VERSION_KEY);
  } catch {
    return result;
  }

  // 1. Chaves legadas sem namespace, de versões anteriores do app.
  for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
    try {
      const value = s.getItem(oldKey);
      if (value == null) continue;
      if (newKey && s.getItem(newKey) == null) s.setItem(newKey, value);
      s.removeItem(oldKey);
      result.removedKeys.push(oldKey);
    } catch {
      /* ignore */
    }
  }

  // 2. Schema incompatível: descarta o estado derivado sob `crm:`.
  const current = String(STORAGE_SCHEMA_VERSION);
  if (result.previousSchema !== current) {
    result.ran = true;
    const doomed: string[] = [];
    try {
      for (let i = 0; i < s.length; i++) {
        const key = s.key(i);
        if (!key) continue;
        if (isProtected(key)) continue;
        if (!key.startsWith(NS)) continue;
        if (SURVIVES_MIGRATION.has(key)) continue;
        if (key === SCHEMA_KEY || key === VERSION_KEY) continue;
        doomed.push(key);
      }
      for (const key of doomed) {
        s.removeItem(key);
        result.removedKeys.push(key);
      }
      s.setItem(SCHEMA_KEY, current);
    } catch {
      /* ignore */
    }
  }

  // 3. sessionStorage sob `crm:` é sempre efêmero — limpa em troca de versão.
  if (result.previousVersion !== APP_VERSION) {
    const ss = safeArea("session");
    if (ss) {
      try {
        const doomed: string[] = [];
        for (let i = 0; i < ss.length; i++) {
          const key = ss.key(i);
          if (key && key.startsWith(NS) && !isProtected(key)) doomed.push(key);
        }
        for (const key of doomed) ss.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    try {
      s.setItem(VERSION_KEY, APP_VERSION);
    } catch {
      /* ignore */
    }
  }

  return result;
}

// --- Kill-switch de Service Worker / Cache Storage --------------------------

export interface WorkerCleanupResult {
  serviceWorkersUnregistered: number;
  cachesDeleted: string[];
}

/**
 * Este app NÃO registra Service Worker nem usa Cache Storage.
 *
 * Um SW registrado por uma versão/ferramenta anterior, porém, continua ativo no
 * navegador indefinidamente e pode servir bundles antigos por dias — sintoma
 * que só some ao "limpar dados do site". Esta função é o kill-switch: remove
 * qualquer SW e qualquer cache remanescente. Inofensiva quando não há nenhum.
 */
export async function purgeLegacyWorkersAndCaches(): Promise<WorkerCleanupResult> {
  const result: WorkerCleanupResult = { serviceWorkersUnregistered: 0, cachesDeleted: [] };
  if (typeof window === "undefined") return result;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const ok = await reg.unregister();
        if (ok) result.serviceWorkersUnregistered++;
      }
    }
  } catch {
    /* ignore */
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        if (await caches.delete(key)) result.cachesDeleted.push(key);
      }
    }
  } catch {
    /* ignore */
  }

  return result;
}
