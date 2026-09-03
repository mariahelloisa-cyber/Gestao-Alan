import { useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  Check,
  CheckSquare,
  Filter,
  FileDown,
  GraduationCap,
  Handshake,
  LayoutGrid,
  Loader2,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTasks } from "@/lib/tasks-store";
import { listPolos } from "@/lib/polos.functions";
import { listNegociacoes } from "@/lib/negociacoes.functions";
import { listEscolasTecnicas } from "@/lib/escolas-tecnicas.functions";
import { listAcompanhamentos } from "@/lib/acompanhamentos.functions";
import { listMetas } from "@/lib/metas.functions";
import { listLeads } from "@/lib/leads.functions";
import { PERIODO_PRESETS, resolverPeriodo, type PeriodoPreset } from "@/lib/productivity";
import { hojeIso } from "@/lib/polos-ui";
import {
  ativacoes,
  coorteFechamento,
  composicaoBase,
  filtrarPorEscopo,
  filtrarReativacoesPorEscopo,
  atividadeLeads,
  reativacoes,
} from "@/lib/dashboard-metrics";
import {
  gerarRelatorioExpansaoPDF,
  PRESETS_RELATORIO,
  SECOES,
  type PresetRelatorio,
  type SecaoRelatorio,
} from "@/lib/reports-expansao";
import { PeriodFilter } from "./PeriodFilter";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const TIME = "time";

const SECAO_ICONE: Record<SecaoRelatorio, React.ComponentType<{ className?: string }>> = {
  resumo: LayoutGrid,
  metas: Target,
  ligacoes: Phone,
  reunioes: Users,
  ativacoes: Zap,
  reativacoes: RefreshCw,
  base: Building2,
  comercial: Send,
  negociacoes: Handshake,
  escolas: GraduationCap,
  funil: Filter,
  evolucao: BarChart3,
  tarefas: CheckSquare,
};

const TODAS_SECOES: SecaoRelatorio[] = SECOES.map((s) => s.id);

/** Preset cujas seções coincidem exatamente com a seleção atual — ou "personalizado". */
function detectarPreset(secoes: SecaoRelatorio[]): PresetRelatorio {
  const atual = new Set(secoes);
  for (const p of PRESETS_RELATORIO) {
    if (p.id === "personalizado") continue;
    if (p.secoes.length === atual.size && p.secoes.every((s) => atual.has(s))) return p.id;
  }
  return "personalizado";
}

export function ReportDialog({ apenasMinhas }: { apenasMinhas: boolean }) {
  const { tarefas, membrosAtribuiveis, myId, myNome } = useTasks();
  const [open, setOpen] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const [preset, setPreset] = useState<PeriodoPreset>("este-mes");
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");
  const [escopoSel, setEscopoSel] = useState(TIME);
  const [secoes, setSecoes] = useState<SecaoRelatorio[]>(PRESETS_RELATORIO[0].secoes);

  const presetRelatorio = useMemo(() => detectarPreset(secoes), [secoes]);

  const periodo = useMemo(
    () => resolverPeriodo(preset, { de: customDe, ate: customAte }),
    [preset, customDe, customAte],
  );

  // As mesmas queryKeys da dashboard: o cache do react-query é compartilhado,
  // então abrir o diálogo não dispara requisição nova.
  const listPolosFn = useServerFn(listPolos);
  const listNegociacoesFn = useServerFn(listNegociacoes);
  const listEscolasFn = useServerFn(listEscolasTecnicas);
  const listAcompFn = useServerFn(listAcompanhamentos);
  const listMetasFn = useServerFn(listMetas);
  const listLeadsFn = useServerFn(listLeads);

  const { data: polos = [] } = useQuery({
    queryKey: ["polos-ativacao"],
    queryFn: () => listPolosFn(),
  });
  const { data: negociacoes = [] } = useQuery({
    queryKey: ["negociacoes"],
    queryFn: () => listNegociacoesFn(),
  });
  const { data: escolas = [] } = useQuery({
    queryKey: ["escolas-tecnicas"],
    queryFn: () => listEscolasFn(),
  });
  const { data: acompanhamentos = [] } = useQuery({
    queryKey: ["acompanhamentos"],
    queryFn: () => listAcompFn(),
  });
  const { data: metas = [] } = useQuery({
    queryKey: ["metas-membros"],
    queryFn: () => listMetasFn(),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => listLeadsFn(),
  });

  // `membrosAtribuiveis` já exclui o Admin — ele não atende cliente e não deve
  // aparecer como opção de visão nem entrar nas contas do relatório.
  const membrosOrdenados = useMemo(
    () => [...membrosAtribuiveis].sort((a, b) => a.nome.localeCompare(b.nome)),
    [membrosAtribuiveis],
  );

  const escopoId = apenasMinhas ? myId || null : escopoSel === TIME ? null : escopoSel;
  const escopoLabel = escopoId
    ? escopoId === myId
      ? myNome || "Você"
      : (membrosOrdenados.find((m) => m.id === escopoId)?.nome ?? "Membro")
    : "Time inteiro";
  const periodoLabel = PERIODO_PRESETS.find((p) => p.value === preset)?.label ?? "Período";

  /** Tarefas já filtradas por período — o escopo por membro é aplicado no gerador. */
  const tarefasFiltradas = useMemo(() => {
    const semPeriodo = preset === "todos";
    return tarefas.filter((t) => {
      if ((t.tipo ?? "tarefa") !== "tarefa") return false;
      if (!semPeriodo) {
        const ref = t.concluido_em ? t.concluido_em.slice(0, 10) : t.data_vencimento || null;
        if (!ref || ref < periodo.de || ref > periodo.ate) return false;
      }
      return true;
    });
  }, [tarefas, preset, periodo]);

  // Prévia rápida — reaproveita os mesmos dados e funções da dashboard, sem
  // nenhuma consulta nova: só reagrega o que já está em cache.
  const previa = useMemo(() => {
    const polosResp = filtrarPorEscopo(polos, escopoId);
    const polosReat = filtrarReativacoesPorEscopo(polos, escopoId);
    const leadsResp = filtrarPorEscopo(leads, escopoId);
    return {
      reunioes: coorteFechamento(polosResp, periodo, hojeIso()).realizadas,
      ativacoes: ativacoes(polosResp, periodo).quantidade,
      reativacoes: reativacoes(polosReat, periodo).quantidade,
      polosAtivos: composicaoBase(polosResp, periodo).aoFim,
      ligacoes: atividadeLeads(leadsResp, periodo).ligacoes,
    };
  }, [polos, leads, escopoId, periodo]);

  const aplicarPreset = (p: PresetRelatorio) => {
    if (p !== "personalizado") setSecoes(PRESETS_RELATORIO.find((x) => x.id === p)!.secoes);
  };

  const alternar = (id: SecaoRelatorio) =>
    setSecoes((atual) => (atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]));

  const baixar = () => {
    if (gerando) return;
    setGerando(true);
    setConcluido(false);
    // O jsPDF é síncrono e pode travar a thread por um instante em relatórios
    // grandes; um microtask dá tempo do React pintar o estado "Gerando..."
    // antes do trabalho pesado começar.
    setTimeout(() => {
      try {
        gerarRelatorioExpansaoPDF(
          {
            polos,
            negociacoes,
            escolas,
            acompanhamentos,
            metas,
            leads,
            tarefas: tarefasFiltradas,
            membros: membrosOrdenados.map((m) => ({ id: m.id, nome: m.nome, cargo: m.cargo })),
          },
          {
            periodo,
            periodoLabel,
            escopoId,
            escopoLabel,
            // Preserva a ordem canônica das seções, não a ordem de clique.
            secoes: TODAS_SECOES.filter((id) => secoes.includes(id)),
            hoje: hojeIso(),
          },
        );
        setConcluido(true);
        setTimeout(() => {
          setOpen(false);
          setConcluido(false);
        }, 900);
      } finally {
        setGerando(false);
      }
    }, 30);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileDown className="mr-1.5 h-4 w-4" />
        Gerar relatório
      </Button>
      <Dialog open={open} onOpenChange={(v) => !gerando && setOpen(v)}>
        <DialogContent className="flex max-h-[88vh] w-full flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Gerar relatório</DialogTitle>
            <DialogDescription>
              Monte um relatório personalizado para compartilhar ou salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* Etapa 1 — tipo de relatório */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Tipo de relatório</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRESETS_RELATORIO.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => aplicarPreset(p.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-center text-xs font-medium transition-all",
                      presetRelatorio === p.id
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Etapa 2 e 3 — período e visão */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Período</label>
                <PeriodFilter
                  preset={preset}
                  onPresetChange={setPreset}
                  customDe={customDe}
                  customAte={customAte}
                  onCustomChange={(de, ate) => {
                    setCustomDe(de);
                    setCustomAte(ate);
                  }}
                />
              </div>

              {!apenasMinhas && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Visão</label>
                  <Select value={escopoSel} onValueChange={setEscopoSel}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TIME}>Time inteiro</SelectItem>
                      {myId && <SelectItem value={myId}>Minha visão</SelectItem>}
                      {membrosOrdenados
                        .filter((m) => m.id !== myId)
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Conteúdo do relatório */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Conteúdo do relatório
                </label>
                <span className="text-xs text-muted-foreground">
                  {secoes.length} seç{secoes.length === 1 ? "ão" : "ões"} selecionada
                  {secoes.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {SECOES.map((s) => {
                  const Icone = SECAO_ICONE[s.id];
                  const ativo = secoes.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => alternar(s.id)}
                      className={cn(
                        "group flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm",
                        ativo
                          ? "border-primary/60 bg-primary/[0.06]"
                          : "border-border bg-card hover:border-foreground/20",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                          ativo
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <Icone className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {s.label}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {s.descricao}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                          ativo
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-transparent text-transparent",
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSecoes(TODAS_SECOES)}
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Marcar todas
                </button>
                <button
                  type="button"
                  onClick={() => setSecoes([])}
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Resumo da configuração */}
            <div className="rounded-lg border border-border bg-[var(--surface-2)] p-3">
              <div className="mb-1.5 text-xs font-medium text-foreground">Seu relatório</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <strong className="font-semibold text-foreground">{secoes.length}</strong> seç
                  {secoes.length === 1 ? "ão" : "ões"}
                </span>
                <span>{periodoLabel}</span>
                <span>{escopoLabel}</span>
              </div>
              {(previa.ligacoes > 0 ||
                previa.reunioes > 0 ||
                previa.ativacoes > 0 ||
                previa.reativacoes > 0 ||
                previa.polosAtivos > 0) && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                  {previa.ligacoes > 0 && <span>{previa.ligacoes} ligações</span>}
                  {previa.reunioes > 0 && <span>{previa.reunioes} reuniões</span>}
                  {previa.ativacoes > 0 && <span>{previa.ativacoes} ativações</span>}
                  {previa.reativacoes > 0 && <span>{previa.reativacoes} reativações</span>}
                  {previa.polosAtivos > 0 && <span>{previa.polosAtivos} polos ativos</span>}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-4">
            <p className="hidden text-xs text-muted-foreground sm:block">
              {secoes.length} seções · {periodoLabel} · {escopoLabel}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={gerando}
                className="flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
              <Button
                onClick={baixar}
                disabled={secoes.length === 0 || gerando}
                className="flex-1 sm:flex-none"
              >
                {gerando ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Gerando relatório...
                  </>
                ) : concluido ? (
                  <>
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Relatório gerado!
                  </>
                ) : (
                  <>
                    <FileDown className="mr-1.5 h-4 w-4" />
                    Gerar relatório
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
