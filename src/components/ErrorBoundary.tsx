import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { APP_VERSION, BUILD_ID } from "@/lib/app-version";
import { errorMessage, log } from "@/lib/diagnostics";
import { isChunkError, recoverFromChunkError } from "@/lib/chunk-recovery";

interface Props {
  /** Nome da área isolada — aparece no log e ajuda o suporte. */
  area: string;
  children: ReactNode;
  /** Ação extra oferecida junto de "Tentar novamente" (ex.: voltar ao Início). */
  onGoBack?: () => void;
  goBackLabel?: string;
  /** Layout enxuto para áreas pequenas (sidebar, diálogos). */
  compact?: boolean;
}

interface State {
  error: Error | null;
  attempt: number;
}

/**
 * Isola falhas de render por área.
 *
 * Sem isso, qualquer exceção sobe até o `errorComponent` da rota raiz e derruba
 * o CRM inteiro — inclusive as exceções de `removeChild`/`insertBefore` que a
 * tradução automática do navegador provoca ao reescrever o DOM sob o React.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Assets antigos: recarregar resolve, então nem mostramos a UI de erro.
    if (isChunkError(error) && recoverFromChunkError(`boundary:${this.props.area}`)) return;

    log("react-error", errorMessage(error), {
      area: this.props.area,
      // Só o topo do stack de componentes: nomes de componentes, sem dados.
      componentStack: (info.componentStack ?? "").split("\n").slice(0, 8).join("\n").trim(),
    });
  }

  private retry = () => {
    // `attempt` vira key do children: força remontagem limpa da subárvore, o
    // que também descarta nós de texto adulterados por tradutores.
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  };

  render() {
    const { error } = this.state;
    // Fragment com key remonta a subárvore sem introduzir nó extra no layout.
    if (!error) return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;

    const { compact, onGoBack, goBackLabel = "Voltar ao Início", area } = this.props;

    return (
      <div
        className={
          compact
            ? "flex flex-col items-center gap-2 p-4 text-center"
            : "flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
        }
      >
        <AlertTriangle className={compact ? "h-5 w-5 text-amber-500" : "h-8 w-8 text-amber-500"} />
        <div>
          <p className="text-sm font-medium text-foreground">Não foi possível carregar esta área</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            O restante do sistema continua funcionando. Você pode tentar de novo ou ir para outra
            seção.
          </p>
        </div>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <button
            onClick={this.retry}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </button>
          {onGoBack && (
            <button
              onClick={() => {
                this.setState({ error: null });
                onGoBack();
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              <Home className="h-3.5 w-3.5" />
              {goBackLabel}
            </button>
          )}
        </div>
        <details className="mt-2 max-w-full text-left">
          <summary className="cursor-pointer text-[11px] text-muted-foreground">
            Detalhes técnicos
          </summary>
          <pre className="mt-1 max-w-sm overflow-auto rounded bg-muted p-2 text-[10px] text-muted-foreground">
            {`área: ${area}\nversão: ${APP_VERSION} (${BUILD_ID})\n${errorMessage(error)}`}
          </pre>
        </details>
      </div>
    );
  }
}
