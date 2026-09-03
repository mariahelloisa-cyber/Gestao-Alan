import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listPolos, createPolo, updatePolo, deletePolo } from "@/lib/polos.functions";
import { useTasks } from "@/lib/tasks-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Plus,
  Search,
  CalendarClock,
  CalendarDays,
  List,
  SlidersHorizontal,
  X,
  Users,
  AlarmClock,
  ExternalLink,
} from "lucide-react";
import { ReunioesAgenda } from "./ReunioesCalendar";
import { ReuniaoListItem } from "./ReuniaoListItem";
import {
  compararPorQuando,
  formatarData,
  formatarHorario,
  formatarValor,
  hojeIso,
  nivelBadgeStyle,
  statusReuniao,
  type Nivel,
} from "@/lib/polos-ui";
import {
  formatarTelefone,
  formatarTelefoneSeAplicavel,
  TELEFONE_INPUT_PROPS,
} from "@/lib/telefone";
import { cn } from "@/lib/utils";

type Polo = Awaited<ReturnType<typeof listPolos>>[number];
type Periodo = "todas" | "proximas" | "hoje" | "atrasadas";

/** Cadastro da reunião: dados do polo (sem valor/situação) + a reunião. */
type FormState = {
  nivel: Nivel;
  nome: string;
  contato: string;
  email: string;
  produto: string;
  observacao: string;
  data_reuniao: string;
  horario_reuniao: string;
  faturamento: string;
  link_reuniao: string;
  responsavel_id: string;
};

const FORM_VAZIO: FormState = {
  nivel: "N1",
  nome: "",
  contato: "",
  email: "",
  produto: "",
  observacao: "",
  data_reuniao: "",
  horario_reuniao: "",
  faturamento: "",
  link_reuniao: "",
  responsavel_id: "",
};

function poloParaForm(p: Polo): FormState {
  return {
    nivel: p.nivel as Nivel,
    nome: p.nome,
    contato: formatarTelefoneSeAplicavel(p.contato ?? ""),
    email: p.email ?? "",
    produto: p.produto ?? "",
    observacao: p.observacao ?? "",
    data_reuniao: p.data_reuniao ?? "",
    // Postgres devolve "HH:MM:SS"; o <input type="time"> espera "HH:MM".
    horario_reuniao: p.horario_reuniao ? p.horario_reuniao.slice(0, 5) : "",
    faturamento: p.faturamento != null ? String(p.faturamento) : "",
    link_reuniao: p.link_reuniao ?? "",
    responsavel_id: p.responsavel_id ?? "",
  };
}

/** Cabeçalho de seção dentro dos diálogos, pra agrupar campos. */
function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

/** Par rótulo/valor do modo somente leitura. */
function Info({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="break-words text-sm text-foreground">{valor}</div>
    </div>
  );
}

function Indicador({
  icone: Icone,
  titulo,
  valor,
  descricao,
  tom,
}: {
  icone: typeof Users;
  titulo: string;
  valor: React.ReactNode;
  descricao: string;
  tom: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tom)}>
          <Icone className="h-4 w-4" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
    </div>
  );
}

export function ReunioesView() {
  const qc = useQueryClient();
  const { membros, membrosAtribuiveis } = useTasks();
  const listFn = useServerFn(listPolos);
  const createFn = useServerFn(createPolo);
  const updateFn = useServerFn(updatePolo);
  const deleteFn = useServerFn(deletePolo);

  const {
    data: polos = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["polos-ativacao"],
    queryFn: () => listFn(),
    retry: 1,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["polos-ativacao"] });

  const emReuniao = useMemo(() => polos.filter((p) => p.situacao === "reuniao"), [polos]);

  // --- Filtros (compartilhados entre Lista e Agenda) ------------------------
  const [busca, setBusca] = useState("");
  const [filtroPolo, setFiltroPolo] = useState("todos");
  const [filtroNivel, setFiltroNivel] = useState<"todos" | Nivel>("todos");
  const [periodo, setPeriodo] = useState<Periodo>("todas");
  const [fatMin, setFatMin] = useState("");
  const [fatMax, setFatMax] = useState("");

  const nomesDePolo = useMemo(
    () => Array.from(new Set(emReuniao.map((p) => p.nome))).sort((a, b) => a.localeCompare(b)),
    [emReuniao],
  );

  const maisFiltrosAtivos = [!!fatMin, !!fatMax].filter(Boolean).length;

  const limparFiltros = () => {
    setFiltroPolo("todos");
    setFiltroNivel("todos");
    setPeriodo("todas");
    setFatMin("");
    setFatMax("");
  };

  const algumFiltroAtivo =
    filtroPolo !== "todos" ||
    filtroNivel !== "todos" ||
    periodo !== "todas" ||
    maisFiltrosAtivos > 0;

  /**
   * Base: tudo menos o período. É o que a Agenda recebe — ela já navega por
   * dia, então um filtro de "próximas" esvaziaria a tela sem explicação.
   */
  const filtradosBase = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    return emReuniao.filter((p) => {
      if (filtroPolo !== "todos" && p.nome !== filtroPolo) return false;
      if (filtroNivel !== "todos" && p.nivel !== filtroNivel) return false;
      if (fatMin && (p.faturamento == null || p.faturamento < Number(fatMin))) return false;
      if (fatMax && (p.faturamento == null || p.faturamento > Number(fatMax))) return false;
      if (buscaNorm) {
        const alvo = [p.nome, p.contato, p.email, p.produto]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(buscaNorm)) return false;
      }
      return true;
    });
  }, [emReuniao, busca, filtroPolo, filtroNivel, fatMin, fatMax]);

  /** Lista: aplica o período e ordena cronologicamente (atrasadas no topo). */
  const filtradosLista = useMemo(() => {
    const hoje = hojeIso();
    return filtradosBase
      .filter((p) => {
        if (periodo === "todas") return true;
        if (!p.data_reuniao) return false;
        if (periodo === "atrasadas") return p.data_reuniao < hoje;
        if (periodo === "hoje") return p.data_reuniao === hoje;
        return p.data_reuniao >= hoje; // proximas
      })
      .sort(compararPorQuando);
  }, [filtradosBase, periodo]);

  // --- Estado dos diálogos --------------------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [poloVisto, setPoloVisto] = useState<Polo | null>(null);

  const [fecharAlvo, setFecharAlvo] = useState<Polo | null>(null);
  const [fecharData, setFecharData] = useState("");
  const [fecharValor, setFecharValor] = useState("");
  const [fecharResponsavel, setFecharResponsavel] = useState("");

  const [naoFechouAlvo, setNaoFechouAlvo] = useState<Polo | null>(null);

  const [modo, setModo] = useState<"lista" | "agenda">("lista");

  const abrirNovo = () => {
    setEditId(null);
    setViewOnly(false);
    setPoloVisto(null);
    setForm(FORM_VAZIO);
    setDialogOpen(true);
  };

  /** Clique num espaço livre da agenda: novo polo já com data e hora da reunião. */
  const abrirNovoEm = (iso: string, hora?: string) => {
    setEditId(null);
    setViewOnly(false);
    setPoloVisto(null);
    setForm({ ...FORM_VAZIO, data_reuniao: iso, horario_reuniao: hora ?? "" });
    setDialogOpen(true);
  };

  const abrirEdicao = (p: Polo) => {
    setEditId(p.id);
    setViewOnly(false);
    setPoloVisto(null);
    setForm(poloParaForm(p));
    setDialogOpen(true);
  };

  const abrirVisualizar = (p: Polo) => {
    setEditId(p.id);
    setViewOnly(true);
    setPoloVisto(p);
    setForm(poloParaForm(p));
    setDialogOpen(true);
  };

  const abrirFechar = (p: Polo) => {
    setFecharAlvo(p);
    setFecharData("");
    setFecharValor("");
    // Já vem com quem conduziu a reunião: normalmente é a mesma pessoa que
    // ativa, e trocar aqui é a exceção. Sem isso o campo voltaria a zerar o
    // responsável no fechamento.
    setFecharResponsavel(p.responsavel_id ?? "");
  };

  const salvarMut = useMutation({
    mutationFn: async (vars: { id?: string } & FormState) => {
      const payload = {
        nivel: vars.nivel,
        nome: vars.nome.trim(),
        contato: vars.contato.trim() || null,
        email: vars.email.trim() || null,
        produto: vars.produto.trim() || null,
        observacao: vars.observacao.trim() || null,
        data_reuniao: vars.data_reuniao || null,
        horario_reuniao: vars.horario_reuniao || null,
        faturamento: vars.faturamento ? Number(vars.faturamento) : null,
        link_reuniao: vars.link_reuniao.trim() || null,
        // Dono da reunião. É o mesmo campo que o fechamento preenche, então
        // marcar aqui é o que permite contar "reuniões que fiz" por pessoa.
        responsavel_id: vars.responsavel_id || null,
        // O polo ainda não fechou: fica nesta etapa até alguém concluir.
        situacao: "reuniao" as const,
      };
      if (vars.id) {
        await updateFn({ data: { id: vars.id, ...payload } });
      } else {
        await createFn({ data: payload });
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Reunião atualizada." : "Polo cadastrado.");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Polo excluído.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir polo."),
  });

  /** Fechou: vira polo ativo e passa a aparecer em Ativação. */
  const fechouMut = useMutation({
    mutationFn: async () => {
      if (!fecharAlvo) return;
      await updateFn({
        data: {
          id: fecharAlvo.id,
          nivel: fecharAlvo.nivel as Nivel,
          nome: fecharAlvo.nome,
          situacao: "ativo",
          data_ativacao: fecharData,
          valor_ativacao: fecharValor ? Number(fecharValor) : null,
          responsavel_id: fecharResponsavel || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Polo fechado — agora ele aparece em Ativação.");
      setFecharAlvo(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao concluir."),
  });

  /** Não fechou: sai do funil de reunião e vai para Inativos. */
  const naoFechouMut = useMutation({
    mutationFn: async () => {
      if (!naoFechouAlvo) return;
      await updateFn({
        data: {
          id: naoFechouAlvo.id,
          nivel: naoFechouAlvo.nivel as Nivel,
          nome: naoFechouAlvo.nome,
          situacao: "inativo",
        },
      });
    },
    onSuccess: () => {
      toast.success("Polo movido para Inativos.");
      setNaoFechouAlvo(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao concluir."),
  });

  const salvar = () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do polo.");
      return;
    }
    salvarMut.mutate({ id: editId ?? undefined, ...form });
  };

  const confirmarFechou = () => {
    if (!fecharData) {
      toast.error("Informe a data de ativação.");
      return;
    }
    fechouMut.mutate();
  };

  // --- Indicadores ----------------------------------------------------------
  const hoje = hojeIso();
  const aguardandoConclusao = emReuniao.filter(
    (p) => p.data_reuniao && p.data_reuniao < hoje,
  ).length;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-full space-y-5 px-6 py-6">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reuniões</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Visualize e gerencie todas as reuniões agendadas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-[var(--surface-1)] p-1">
              {(
                [
                  { id: "lista", label: "Lista", icon: List },
                  { id: "agenda", label: "Agenda", icon: CalendarDays },
                ] as const
              ).map(({ id, label, icon: Icone }) => (
                <button
                  key={id}
                  onClick={() => setModo(id)}
                  aria-pressed={modo === id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                    modo === id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icone className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <Button onClick={abrirNovo} className="rounded-lg">
              <Plus className="mr-1.5 h-4 w-4" /> Nova reunião
            </Button>
          </div>
        </header>

        {/* Indicadores */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Indicador
            icone={Users}
            titulo="Polos em reunião"
            valor={emReuniao.length}
            descricao="Prospecções aguardando desfecho."
            tom="bg-[#7B68EE1A] text-[#7B68EE]"
          />
          <Indicador
            icone={AlarmClock}
            titulo="Aguardando conclusão"
            valor={aguardandoConclusao}
            descricao="Reunião já passou e ninguém marcou se fechou."
            tom="bg-amber-500/10 text-amber-600 dark:text-amber-500"
          />
        </div>

        {/* Busca e filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, contato, e-mail ou produto..."
              className="h-9 rounded-lg pl-9"
            />
          </div>

          {modo === "lista" && (
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-9 w-[150px]">
                <CalendarDays className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as datas</SelectItem>
                <SelectItem value="proximas">Próximas</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="atrasadas">Atrasadas</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select value={filtroPolo} onValueChange={setFiltroPolo}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os polos</SelectItem>
              {nomesDePolo.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroNivel} onValueChange={(v) => setFiltroNivel(v as "todos" | Nivel)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os níveis</SelectItem>
              {(["N1", "N2", "N3"] as const).map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 gap-1.5 rounded-lg">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                Faturamento
                {maisFiltrosAtivos > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full bg-foreground px-1 text-background">
                    {maisFiltrosAtivos}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-3" align="end">
              <SecaoTitulo>Faturamento do polo</SecaoTitulo>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fat-min" className="text-xs text-muted-foreground">
                    Mínimo
                  </Label>
                  <Input
                    id="fat-min"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={fatMin}
                    onChange={(e) => setFatMin(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fat-max" className="text-xs text-muted-foreground">
                    Máximo
                  </Label>
                  <Input
                    id="fat-max"
                    type="number"
                    min={0}
                    placeholder="—"
                    value={fatMax}
                    onChange={(e) => setFatMax(e.target.value)}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {algumFiltroAtivo && (
            <Button
              variant="ghost"
              className="h-9 gap-1 text-muted-foreground"
              onClick={limparFiltros}
            >
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>

        {/* Conteúdo */}
        <div key={modo} className="animate-in fade-in-50 duration-200">
          {modo === "agenda" ? (
            <ReunioesAgenda
              polos={filtradosBase}
              onSelectPolo={abrirVisualizar}
              onSelectSlot={abrirNovoEm}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <p className="text-sm font-medium text-foreground">
                  {filtradosLista.length} {filtradosLista.length === 1 ? "reunião" : "reuniões"}
                </p>
                {filtradosLista.length > 0 && (
                  <p className="text-xs text-muted-foreground">Ordenadas por data</p>
                )}
              </div>

              {isLoading ? (
                <p className="py-14 text-center text-sm text-muted-foreground">Carregando…</p>
              ) : error ? (
                <p className="py-14 text-center text-sm text-destructive">
                  Falha ao carregar: {error instanceof Error ? error.message : "erro desconhecido"}
                </p>
              ) : filtradosLista.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <CalendarClock className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {emReuniao.length === 0
                      ? "Nenhum polo em reunião ainda."
                      : "Nenhuma reunião encontrada com esses filtros."}
                  </p>
                  {emReuniao.length === 0 && (
                    <Button onClick={abrirNovo} variant="outline" className="mt-1">
                      <Plus className="mr-1.5 h-4 w-4" /> Nova reunião
                    </Button>
                  )}
                </div>
              ) : (
                filtradosLista.map((p) => (
                  <ReuniaoListItem
                    key={p.id}
                    polo={p}
                    onVisualizar={() => abrirVisualizar(p)}
                    onEditar={() => abrirEdicao(p)}
                    onFechou={() => abrirFechar(p)}
                    onNaoFechou={() => setNaoFechouAlvo(p)}
                    onExcluir={() => deleteMut.mutate(p.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Detalhes (somente leitura) / cadastro / edição */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {viewOnly && poloVisto ? (
                  <>
                    <Badge
                      style={nivelBadgeStyle(poloVisto.nivel as Nivel)}
                      className="text-[10px]"
                    >
                      {poloVisto.nivel}
                    </Badge>
                    <span className="truncate">{poloVisto.nome}</span>
                  </>
                ) : editId ? (
                  "Editar reunião"
                ) : (
                  "Nova reunião"
                )}
              </DialogTitle>
              {!viewOnly && (
                <DialogDescription>
                  Dados do polo e da reunião. Valor e responsável são pedidos quando o polo fechar.
                </DialogDescription>
              )}
            </DialogHeader>

            {viewOnly && poloVisto ? (
              // Leitura: grid compacto em vez de formulário desabilitado empilhado.
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  {(() => {
                    const s = statusReuniao(poloVisto.data_reuniao);
                    return (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          s.badge,
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", s.ponto)} />
                        {s.label}
                      </span>
                    );
                  })()}
                </div>

                <section className="space-y-3">
                  <SecaoTitulo>Dados do polo</SecaoTitulo>
                  <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info label="Nível" valor={poloVisto.nivel} />
                    <Info label="Nome" valor={poloVisto.nome} />
                    <Info label="Contato" valor={poloVisto.contato || "—"} />
                    <Info label="E-mail" valor={poloVisto.email || "—"} />
                    <div className="sm:col-span-2">
                      <Info label="Produto" valor={poloVisto.produto || "—"} />
                    </div>
                  </div>
                </section>

                <section className="space-y-3 border-t border-border pt-4">
                  <SecaoTitulo>Dados da reunião</SecaoTitulo>
                  <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info label="Data" valor={formatarData(poloVisto.data_reuniao)} />
                    <Info label="Horário" valor={formatarHorario(poloVisto.horario_reuniao)} />
                    <Info label="Faturamento" valor={formatarValor(poloVisto.faturamento)} />
                    <Info
                      label="Link da reunião"
                      valor={
                        poloVisto.link_reuniao ? (
                          <a
                            href={poloVisto.link_reuniao}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 underline underline-offset-2"
                          >
                            Abrir <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <Info
                      label="Responsável"
                      valor={membros.find((m) => m.id === poloVisto.responsavel_id)?.nome ?? "—"}
                    />
                  </div>
                </section>

                <section className="space-y-2 border-t border-border pt-4">
                  <SecaoTitulo>Observação</SecaoTitulo>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {poloVisto.observacao || "—"}
                  </p>
                </section>
              </div>
            ) : (
              <div className="space-y-5">
                <section className="space-y-3">
                  <SecaoTitulo>Dados do polo</SecaoTitulo>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Nível</Label>
                      <RadioGroup
                        value={form.nivel}
                        onValueChange={(v) => setForm((f) => ({ ...f, nivel: v as Nivel }))}
                        className="flex items-center gap-4"
                      >
                        {(["N1", "N2", "N3"] as const).map((n) => (
                          <label key={n} className="flex items-center gap-1.5 text-sm">
                            <RadioGroupItem value={n} id={`reuniao-nivel-${n}`} />
                            {n}
                          </label>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="reuniao-nome">Nome do polo</Label>
                      <Input
                        id="reuniao-nome"
                        value={form.nome}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reuniao-contato">Contato</Label>
                      <Input
                        id="reuniao-contato"
                        {...TELEFONE_INPUT_PROPS}
                        value={form.contato}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, contato: formatarTelefone(e.target.value) }))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reuniao-email">E-mail</Label>
                      <Input
                        id="reuniao-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="reuniao-produto">Produto</Label>
                      <Input
                        id="reuniao-produto"
                        value={form.produto}
                        onChange={(e) => setForm((f) => ({ ...f, produto: e.target.value }))}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3 border-t border-border pt-4">
                  <SecaoTitulo>Dados da reunião</SecaoTitulo>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="reuniao-data">Data da reunião</Label>
                      <Input
                        id="reuniao-data"
                        type="date"
                        value={form.data_reuniao}
                        onChange={(e) => setForm((f) => ({ ...f, data_reuniao: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reuniao-horario">Horário</Label>
                      <Input
                        id="reuniao-horario"
                        type="time"
                        value={form.horario_reuniao}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, horario_reuniao: e.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reuniao-faturamento">Faturamento do polo (R$)</Label>
                      <Input
                        id="reuniao-faturamento"
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.faturamento}
                        onChange={(e) => setForm((f) => ({ ...f, faturamento: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reuniao-link">Link da reunião</Label>
                      <Input
                        id="reuniao-link"
                        value={form.link_reuniao}
                        onChange={(e) => setForm((f) => ({ ...f, link_reuniao: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="reuniao-responsavel">Responsável pela reunião</Label>
                      <Select
                        value={form.responsavel_id}
                        onValueChange={(v) => setForm((f) => ({ ...f, responsavel_id: v }))}
                      >
                        <SelectTrigger id="reuniao-responsavel">
                          <SelectValue placeholder="Selecione um membro" />
                        </SelectTrigger>
                        <SelectContent>
                          {membrosAtribuiveis.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                <section className="space-y-3 border-t border-border pt-4">
                  <SecaoTitulo>Observação</SecaoTitulo>
                  <Textarea
                    id="reuniao-obs"
                    rows={3}
                    value={form.observacao}
                    onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                  />
                </section>
              </div>
            )}

            <DialogFooter>
              {viewOnly ? (
                <>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Fechar
                  </Button>
                  <Button
                    onClick={() => {
                      if (poloVisto) abrirEdicao(poloVisto);
                    }}
                  >
                    Editar
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={salvar} disabled={salvarMut.isPending}>
                    {editId ? "Salvar" : "Cadastrar"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Concluir: fechou */}
        <Dialog open={!!fecharAlvo} onOpenChange={(o) => !o && setFecharAlvo(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>"{fecharAlvo?.nome}" fechou</DialogTitle>
              <DialogDescription>
                Preencha os dados de ativação. O polo sai de Reuniões e passa a aparecer em
                Ativação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fechar-data">Data de ativação</Label>
                <Input
                  id="fechar-data"
                  type="date"
                  value={fecharData}
                  onChange={(e) => setFecharData(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fechar-valor">Valor de ativação (R$)</Label>
                <Input
                  id="fechar-valor"
                  type="number"
                  min={0}
                  step="0.01"
                  value={fecharValor}
                  onChange={(e) => setFecharValor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select value={fecharResponsavel} onValueChange={setFecharResponsavel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {membrosAtribuiveis.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                        {m.cargo ? ` (${m.cargo})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFecharAlvo(null)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmarFechou}
                disabled={fechouMut.isPending}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Confirmar fechamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Concluir: não fechou */}
        <AlertDialog open={!!naoFechouAlvo} onOpenChange={(o) => !o && setNaoFechouAlvo(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>"{naoFechouAlvo?.nome}" não fechou?</AlertDialogTitle>
              <AlertDialogDescription>
                O polo sai de Reuniões e passa a aparecer na página de Inativos. Os dados da reunião
                são mantidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => naoFechouMut.mutate()}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                Mover para Inativos
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
