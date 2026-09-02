import { createFileRoute } from "@tanstack/react-router";
import { PrimarySidebar } from "@/components/layout/PrimarySidebar";
import { TarefasHeader } from "@/components/dashboard/TarefasHeader";
import { KanbanView, AddTaskDialog } from "@/components/dashboard/KanbanView";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { TasksProvider, useTasks } from "@/lib/tasks-store";
import { TaskDetailDialog } from "@/components/dashboard/TaskDetailDialog";
import { MembersView } from "@/components/dashboard/MembersView";
import { MetasView } from "@/components/dashboard/MetasView";
import { AcompanhamentoView } from "@/components/dashboard/AcompanhamentoView";
import { AtivacaoView } from "@/components/dashboard/AtivacaoView";
import { ReativacaoView } from "@/components/dashboard/ReativacaoView";
import { ReunioesView } from "@/components/dashboard/ReunioesView";
import { InativosView } from "@/components/dashboard/InativosView";
import { ComercialView } from "@/components/dashboard/ComercialView";
import { NegociacoesView } from "@/components/dashboard/NegociacoesView";
import { EscolasTecnicasView } from "@/components/dashboard/EscolasTecnicasView";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { LinksView } from "@/components/dashboard/LinksView";
import { FinalizadosView } from "@/components/dashboard/FinalizadosView";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel — Sistema Expansão" },
      { name: "description", content: "Sistema de gestão de tarefas." },
      { property: "og:title", content: "Painel — Sistema Expansão" },
      { property: "og:description", content: "Sistema de gestão de tarefas." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <TasksProvider>
      <Shell />
    </TasksProvider>
  );
}

/**
 * Cada área fica isolada num Error Boundary próprio: uma view que quebra não
 * derruba a navegação nem o resto do CRM. A key por `workspace.tipo` faz o
 * boundary resetar sozinho quando o usuário troca de seção.
 */
function Shell() {
  const { workspace, setWorkspace } = useTasks();
  const voltarAoInicio = () => setWorkspace({ tipo: "dashboard" });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <ErrorBoundary area="sidebar" compact>
        <PrimarySidebar />
      </ErrorBoundary>
      <main className="flex flex-1 flex-col overflow-hidden">
        <ErrorBoundary
          key={workspace.tipo}
          area={`workspace:${workspace.tipo}`}
          onGoBack={workspace.tipo === "dashboard" ? undefined : voltarAoInicio}
        >
          <WorkspaceContent />
        </ErrorBoundary>
      </main>
      <ErrorBoundary area="task-detail" compact>
        <TaskDetailDialog />
      </ErrorBoundary>
    </div>
  );
}

function WorkspaceContent() {
  const { workspace, mainView, setMainView, myCargo } = useTasks();
  const isAdminLike = myCargo === "Admin" || myCargo === "Supervisor";
  const blockedForMembro = !isAdminLike && workspace.tipo === "finalizados";

  if (workspace.tipo === "dashboard") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <DashboardView apenasMinhas={!isAdminLike} />
      </div>
    );
  }

  if (blockedForMembro) {
    return (
      <>
        <TarefasHeader view={mainView} onViewChange={setMainView} />
        <div
          key={mainView}
          className="flex-1 animate-in fade-in-50 overflow-y-auto bg-[var(--surface-1)] workspace-watermark duration-200"
        >
          {mainView === "Quadro" && <KanbanView />}
          {mainView === "Calendário" && <CalendarView scope="pessoal" />}
        </div>
      </>
    );
  }

  if (workspace.tipo === "tarefas-gerais") {
    const criarTarefaButton = (
      <AddTaskDialog
        semCliente
        trigger={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90">
            <Plus className="h-3.5 w-3.5" />
            Criar tarefa
          </button>
        }
      />
    );
    return (
      <>
        <TarefasHeader
          view={mainView}
          onViewChange={setMainView}
          extraActions={criarTarefaButton}
          mode="geral"
        />
        <div
          key={mainView}
          className="flex-1 animate-in fade-in-50 overflow-y-auto bg-[var(--surface-1)] workspace-watermark duration-200"
        >
          {mainView === "Quadro" && <KanbanView semCliente />}
          {mainView === "Calendário" && <CalendarView scope="sem-cliente" />}
        </div>
      </>
    );
  }

  if (workspace.tipo === "acompanhamento") {
    return <AcompanhamentoView />;
  }

  if (workspace.tipo === "reunioes") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <ReunioesView />
      </div>
    );
  }

  if (workspace.tipo === "ativacao") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <AtivacaoView />
      </div>
    );
  }

  if (workspace.tipo === "polos-inativos") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <InativosView />
      </div>
    );
  }

  if (workspace.tipo === "comercial") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <ComercialView />
      </div>
    );
  }

  if (workspace.tipo === "reativacao") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <ReativacaoView />
      </div>
    );
  }

  if (workspace.tipo === "negociacoes") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <NegociacoesView />
      </div>
    );
  }

  if (workspace.tipo === "escolas-tecnicas") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <EscolasTecnicasView />
      </div>
    );
  }

  if (workspace.tipo === "membros") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <MembersView />
      </div>
    );
  }

  if (workspace.tipo === "metas") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <MetasView />
      </div>
    );
  }

  if (workspace.tipo === "links") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <LinksView />
      </div>
    );
  }

  if (workspace.tipo === "finalizados") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] workspace-watermark">
        <FinalizadosView />
      </div>
    );
  }

  return (
    <>
      <TarefasHeader view={mainView} onViewChange={setMainView} />
      <div
        key={mainView}
        className="flex-1 animate-in fade-in-50 overflow-y-auto bg-[var(--surface-1)] workspace-watermark duration-200"
      >
        {mainView === "Quadro" && <KanbanView />}
        {mainView === "Calendário" && <CalendarView scope="pessoal" />}
      </div>
    </>
  );
}
