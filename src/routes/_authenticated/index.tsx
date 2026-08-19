import { createFileRoute } from "@tanstack/react-router";
import { PrimarySidebar } from "@/components/layout/PrimarySidebar";
import { SecondarySidebar } from "@/components/layout/SecondarySidebar";
import { TarefasHeader } from "@/components/dashboard/TarefasHeader";
import { KanbanView, AddTaskDialog } from "@/components/dashboard/KanbanView";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { TasksProvider, useTasks } from "@/lib/tasks-store";
import { TaskDetailDialog } from "@/components/dashboard/TaskDetailDialog";
import { MembersView } from "@/components/dashboard/MembersView";
import { AtivacaoView } from "@/components/dashboard/AtivacaoView";
import { ReativacaoView } from "@/components/dashboard/ReativacaoView";
import { NegociacoesView } from "@/components/dashboard/NegociacoesView";
import { EscolasTecnicasView } from "@/components/dashboard/EscolasTecnicasView";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { LinksView } from "@/components/dashboard/LinksView";
import { FinalizadosView } from "@/components/dashboard/FinalizadosView";
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
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <PrimarySidebar />
        <SecondarySidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <WorkspaceContent />
        </main>
        <TaskDetailDialog />
      </div>
    </TasksProvider>
  );
}

function WorkspaceContent() {
  const { workspace, mainView, setMainView, myCargo } = useTasks();
  const isAdminLike = myCargo === "Admin" || myCargo === "Supervisor";
  const blockedForMembro = !isAdminLike && workspace.tipo === "finalizados";

  if (workspace.tipo === "dashboard") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)]">
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
          className="flex-1 animate-in fade-in-50 overflow-y-auto bg-[var(--surface-1)] duration-200"
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
          className="flex-1 animate-in fade-in-50 overflow-y-auto bg-[var(--surface-1)] duration-200"
        >
          {mainView === "Quadro" && <KanbanView semCliente />}
          {mainView === "Calendário" && <CalendarView scope="sem-cliente" />}
        </div>
      </>
    );
  }

  if (workspace.tipo === "ativacao") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)]">
        <AtivacaoView />
      </div>
    );
  }

  if (workspace.tipo === "reativacao") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)]">
        <ReativacaoView />
      </div>
    );
  }

  if (workspace.tipo === "negociacoes") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)]">
        <NegociacoesView />
      </div>
    );
  }

  if (workspace.tipo === "escolas-tecnicas") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)]">
        <EscolasTecnicasView />
      </div>
    );
  }

  if (workspace.tipo === "membros") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)]">
        <MembersView />
      </div>
    );
  }

  if (workspace.tipo === "links") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)]">
        <LinksView />
      </div>
    );
  }

  if (workspace.tipo === "finalizados") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--surface-1)]">
        <FinalizadosView />
      </div>
    );
  }

  return (
    <>
      <TarefasHeader view={mainView} onViewChange={setMainView} />
      <div
        key={mainView}
        className="flex-1 animate-in fade-in-50 overflow-y-auto bg-[var(--surface-1)] duration-200"
      >
        {mainView === "Quadro" && <KanbanView />}
        {mainView === "Calendário" && <CalendarView scope="pessoal" />}
      </div>
    </>
  );
}
