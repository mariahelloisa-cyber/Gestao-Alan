import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";
import { AppRuntime } from "@/components/AppRuntime";
import { APP_VERSION, BUILD_ID } from "@/lib/app-version";
import { errorMessage, log } from "@/lib/diagnostics";
import { isChunkError, recoverFromChunkError } from "@/lib/chunk-recovery";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o Início
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Último recurso: só chega aqui o que os Error Boundaries por área não seguraram.
 */
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const chunkFailure = isChunkError(error);

  // Assets de um deploy anterior: recarregar resolve sozinho.
  if (chunkFailure && recoverFromChunkError("route-root")) return null;

  log("react-error", errorMessage(error), { area: "route-root" });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {chunkFailure
            ? "O sistema foi atualizado enquanto esta aba estava aberta. Recarregue para continuar."
            : "Algo deu errado. Você pode tentar novamente ou voltar para o Início."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Recarregar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o Início
          </a>
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">
          versão {APP_VERSION} · build {BUILD_ID}
        </p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // CAUSA RAIZ do bug de "textos trocados": o tradutor do navegador
      // reescreve os nós de texto sob o React e provoca NotFoundError em
      // removeChild/insertBefore a cada re-render. Estas duas metas, somadas a
      // lang="pt-BR" + translate="no" no <html>, desligam Google e Bing.
      { name: "google", content: "notranslate" },
      { httpEquiv: "content-language", content: "pt-BR" },
      { name: "app-version", content: APP_VERSION },
      { name: "app-build", content: BUILD_ID },
      { title: "Sistema Expansão" },
      {
        name: "description",
        content: "Sistema Expansão is a management system for task and client tracking.",
      },
      { property: "og:title", content: "Sistema Expansão" },
      {
        property: "og:description",
        content: "Sistema Expansão is a management system for task and client tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Sistema Expansão" },
      {
        name: "twitter:description",
        content: "Sistema Expansão is a management system for task and client tracking.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    // lang="pt-BR": a interface é toda em português. Declarar "en" fazia o
    // Chrome oferecer tradução e, uma vez marcado "traduzir sempre" no perfil,
    // toda visita vinha com o DOM reescrito — origem dos "textos aleatórios"
    // e das quebras a cada clique.
    // translate="no" + class="notranslate": opt-out explícito, respeitado pelo
    // Google Tradutor e pelo tradutor do Edge.
    <html lang="pt-BR" translate="no" className="notranslate">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster />
          <AppRuntime />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
