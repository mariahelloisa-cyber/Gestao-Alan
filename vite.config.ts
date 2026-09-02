import path from "node:path";
import { createRequire } from "node:module";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

const require = createRequire(import.meta.url);
const pkg = require("./package.json") as { version?: string };

/**
 * Identidade do build, injetada nos bundles do cliente E do servidor.
 *
 * O cliente compara o BUILD_ID que carregou com o que `/__version` (servido
 * pelo worker do mesmo build) devolve. Divergência = a aba está rodando um
 * frontend antigo e precisa recarregar antes de pedir um chunk que sumiu.
 * Em `vite dev` fica "dev", o que desliga a checagem.
 */
const BUILD_ID =
  process.env.CF_VERSION_METADATA_ID ??
  process.env.CF_PAGES_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  `b${Date.now().toString(36)}`;

export default defineConfig(async ({ command }) => {
  const buildId = command === "build" ? BUILD_ID : "dev";
  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
  ];

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ defaultPreset: "cloudflare-module" }));
  }

  plugins.push(viteReact());

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version ?? "1.0.0"),
      __BUILD_ID__: JSON.stringify(buildId),
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins,
  };
});
