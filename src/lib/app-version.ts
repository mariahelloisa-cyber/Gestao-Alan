/**
 * Identidade da versão do frontend.
 *
 * `__APP_VERSION__` e `__BUILD_ID__` são substituídos textualmente pelo Vite
 * (ver `define` em vite.config.ts) tanto no bundle do cliente quanto no do
 * servidor. Como os dois lados são compilados no mesmo build, comparar o
 * BUILD_ID que o cliente carregou com o que o servidor responde em `/__version`
 * detecta com precisão "esta aba está rodando um frontend antigo".
 */

declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0-dev";

export const BUILD_ID: string = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

/**
 * Versão do formato dos dados persistidos no navegador.
 *
 * Incremente APENAS quando o formato de algum dado gravado em localStorage /
 * sessionStorage mudar de forma incompatível. Incrementar dispara a limpeza
 * seletiva descrita em `storage.ts` — que nunca toca em sessão/credenciais.
 */
export const STORAGE_SCHEMA_VERSION = 2;

/** Rota servida pelo worker que informa o BUILD_ID atualmente publicado. */
export const VERSION_ENDPOINT = "/__version";
