import { useEffect, useState } from "react";
import { AlertTriangle, Download, X } from "lucide-react";
import { bootDiagnostics, detectTranslation, log } from "@/lib/diagnostics";
import { installChunkRecovery } from "@/lib/chunk-recovery";
import {
  applyUpdate,
  isOutdated,
  subscribeToVersion,
  installVersionWatcher,
} from "@/lib/version-check";
import {
  purgeLegacyWorkersAndCaches,
  runStorageMigrations,
  readString,
  writeString,
} from "@/lib/storage";
import { STORAGE_SCHEMA_VERSION } from "@/lib/app-version";

const PURGE_KEY = "worker-purge";

/**
 * Rotinas de saúde do frontend, montadas uma única vez na raiz.
 *
 * Ordem importa: diagnóstico primeiro (para capturar tudo que vier depois),
 * migração de storage antes de qualquer leitura de preferência, e só então os
 * observadores de versão/chunk.
 */
export function AppRuntime() {
  const [updateAvailable, setUpdateAvailable] = useState(isOutdated);
  const [translated, setTranslated] = useState(false);
  const [dismissedTranslation, setDismissedTranslation] = useState(false);

  useEffect(() => {
    bootDiagnostics();

    const migration = runStorageMigrations();
    if (migration.ran || migration.removedKeys.length) {
      log("storage", "Storage migrado para novo schema", {
        schema: STORAGE_SCHEMA_VERSION,
        previousSchema: migration.previousSchema,
        removed: migration.removedKeys.length,
        // Nomes de chave apenas — nunca valores.
        keys: migration.removedKeys.join(","),
      });
    }

    // Kill-switch de Service Worker / Cache Storage legados: uma vez por schema.
    if (readString(PURGE_KEY) !== String(STORAGE_SCHEMA_VERSION)) {
      void purgeLegacyWorkersAndCaches().then((result) => {
        writeString(PURGE_KEY, String(STORAGE_SCHEMA_VERSION));
        if (result.serviceWorkersUnregistered || result.cachesDeleted.length) {
          log("storage", "Service Worker/caches legados removidos", {
            serviceWorkers: result.serviceWorkersUnregistered,
            caches: result.cachesDeleted.join(","),
          });
          // Havia um SW servindo bundle antigo: só um reload garante código novo.
          window.location.reload();
        }
      });
    }

    installChunkRecovery();
    installVersionWatcher();

    return subscribeToVersion(setUpdateAvailable);
  }, []);

  // Tradutores reescrevem o DOM sob o React e provocam NotFoundError em
  // removeChild/insertBefore. Detectamos e avisamos em vez de quebrar em silêncio.
  useEffect(() => {
    const check = () => setTranslated(detectTranslation().active);
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const timer = window.setInterval(check, 10_000);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (translated) log("translation", "Tradução automática detectada em execução");
  }, [translated]);

  return (
    <>
      {translated && !dismissedTranslation && (
        <div className="fixed inset-x-0 top-0 z-[100] flex items-start justify-center px-3 py-2">
          <div className="flex max-w-2xl items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">
              A <strong>tradução automática do navegador</strong> está ativa nesta página. Ela
              altera os textos do sistema e pode travar a tela. Clique com o botão direito na página
              → <em>&ldquo;Nunca traduzir este site&rdquo;</em> e recarregue.
            </p>
            <button
              onClick={() => setDismissedTranslation(true)}
              aria-label="Fechar aviso"
              className="rounded p-0.5 hover:bg-amber-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {updateAvailable && (
        <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-xs shadow-lg">
            <Download className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">Uma nova versão do sistema está disponível.</span>
            <button
              onClick={applyUpdate}
              className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:bg-foreground/90"
            >
              Atualizar agora
            </button>
          </div>
        </div>
      )}
    </>
  );
}
