import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listLeads,
  createLead,
  updateLead,
  deleteLead,
  marcarReuniaoLead,
  desmarcarReuniaoLead,
  type Lead,
} from "@/lib/leads.functions";
import { listMetas } from "@/lib/metas.functions";
import { listPolos } from "@/lib/polos.functions";
import { useTasks } from "@/lib/tasks-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Phone, Plus, Pencil, Trash2, Search, CalendarCheck, Undo2 } from "lucide-react";
import { PeriodFilter } from "./PeriodFilter";
import {
  resolverPeriodo,
  type PeriodoPreset,
  dentroDoPeriodo,
  type Periodo,
} from "@/lib/productivity";
import { atividadeLeads, coorteFechamento, filtrarPorEscopo } from "@/lib/dashboard-metrics";
import { formatarData, hojeIso, type Nivel } from "@/lib/polos-ui";
import {
  formatarTelefone,
  formatarTelefoneSeAplicavel,
  TELEFONE_INPUT_PROPS,
} from "@/lib/telefone";

const TODOS = "todos";

type FormState = {
  nome_polo: string;
  nome_gestor: string;
  tipo: "empreendedor" | "polo";
  contato: string;
  observacao: string;
  data_ligacao: string;
  responsavel_id: string;
};

function formVazio(): FormState {
  return {
    nome_polo: "",
    nome_gestor: "",
    tipo: "polo",
    contato: "",
    observacao: "",
    // O caso normal é lançar a ligação no dia em que ela aconteceu.
    data_ligacao: hojeIso(),
    responsavel_id: "",
  };
}

function leadParaForm(l: Lead): FormState {
  return {
    nome_polo: l.nome_polo,
    nome_gestor: l.nome_gestor ?? "",
    tipo: l.tipo,
    contato: formatarTelefoneSeAplicavel(l.contato ?? ""),
    observacao: l.observacao ?? "",
    data_ligacao: l.data_ligacao,
    responsavel_id: l.responsavel_id ?? "",
  };
}

type ReuniaoForm = {
  nivel: Nivel;
  data_reuniao: string;
  horario_reuniao: string;
  link_reuniao: string;
  faturamento: string;
  observacao: string;
};

const REUNIAO_VAZIA: ReuniaoForm = {
  nivel: "N1",
  data_reuniao: "",
  horario_reuniao: "",
  link_reuniao: "",
  faturamento: "",
  observacao: "",
};

/**
 * Quanto saiu de ligações / reuniões no recorte, com a meta diária ao lado.
 *
 * O total é do período escolhido; a meta é a do dia, mostrada como referência
 * e não convertida em meta de período.
 */
function MetaAtividadeCard({
  titulo,
  total,
  metaDia,
}: {
  titulo: string;
  total: number;
  metaDia: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {total}
        </p>
        <p className="text-sm text-muted-foreground">no período</p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {metaDia > 0 ? `Meta: ${metaDia}/dia` : "Sem meta diária cadastrada"}
      </p>
    </div>
  );
}

export function LeadsView() {
  const qc = useQueryClient();
  const { membros, membrosAtribuiveis, myId } = useTasks();

  const listFn = useServerFn(listLeads);
  const createFn = useServerFn(createLead);
  const updateFn = useServerFn(updateLead);
  const deleteFn = useServerFn(deleteLead);
  const marcarFn = useServerFn(marcarReuniaoLead);
  const desmarcarFn = useServerFn(desmarcarReuniaoLead);
  const listMetasFn = useServerFn(listMetas);
  const listPolosFn = useServerFn(listPolos);

  const {
    data: leads = [],
    isLoading,
    error,
  } = useQuery({ queryKey: ["leads"], queryFn: () => listFn(), retry: 1 });
  const { data: metas = [] } = useQuery({
    queryKey: ["metas-membros"],
    queryFn: () => listMetasFn(),
  });
  // Os polos só entram para saber quais reuniões fecharam — o lead guarda o
  // `polo_id`, e é no polo que a `data_ativacao` do fechamento é gravada.
  const { data: polos = [] } = useQuery({
    queryKey: ["polos-ativacao"],
    queryFn: () => listPolosFn(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    // A marcação cria/apaga um polo em situação "reuniao": a aba Reuniões e a
    // dashboard leem a mesma query e precisam recarregar junto.
    qc.invalidateQueries({ queryKey: ["polos-ativacao"] });
  };

  // --- Filtros --------------------------------------------------------------
  const [preset, setPreset] = useState<PeriodoPreset>("este-mes");
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");
  const periodo: Periodo = useMemo(
    () => resolverPeriodo(preset, { de: customDe, ate: customAte }),
    [preset, customDe, customAte],
  );
  const [membroFiltro, setMembroFiltro] = useState(TODOS);
  const [busca, setBusca] = useState("");

  const leadsDoEscopo = useMemo(
    () => (membroFiltro === TODOS ? leads : leads.filter((l) => l.responsavel_id === membroFiltro)),
    [leads, membroFiltro],
  );

  const leadsDoPeriodo = useMemo(
    () => leadsDoEscopo.filter((l) => dentroDoPeriodo(l.data_ligacao, periodo)),
    [leadsDoEscopo, periodo],
  );

  const leadsExibidos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return leadsDoPeriodo;
    return leadsDoPeriodo.filter((l) =>
      [l.nome_polo, l.nome_gestor, l.contato].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [leadsDoPeriodo, busca]);

  // --- Metas -----------------------------------------------------------------
  // A meta é cadastrada por dia, num mês de referência. Ela não é multiplicada
  // pelo recorte — aparece ao lado do total como a régua do dia.
  const periodoMes = periodo.de.slice(0, 7);
  const metasDoMes = useMemo(
    () => metas.filter((m) => m.periodo === periodoMes),
    [metas, periodoMes],
  );
  // Ligar é trabalho de Membro: o Supervisor conduz a reunião e não tem meta
  // de ligação, então a meta diária do time não soma a dele.
  const membrosDaMeta =
    membroFiltro === TODOS
      ? membrosAtribuiveis.filter((m) => m.cargo === "Membro").map((m) => m.id)
      : [membroFiltro];
  const metaLigacoesDia = metasDoMes
    .filter((m) => membrosDaMeta.includes(m.usuario_id))
    .reduce((s, m) => s + (m.meta_ligacoes_dia ?? 0), 0);
  const metaReunioesDia = metasDoMes
    .filter((m) => membrosDaMeta.includes(m.usuario_id))
    .reduce((s, m) => s + (m.meta_reunioes_dia ?? 0), 0);

  const funil = useMemo(() => atividadeLeads(leadsDoEscopo, periodo), [leadsDoEscopo, periodo]);

  // "Fecharam" não é uma métrica do Lead — é a mesma conta usada em toda a
  // Dashboard: polos que estavam em reunião (por `data_reuniao`) e viraram
  // ativação, tenham vindo de um Lead ou não. Contar pela data em que a
  // reunião foi *marcada* faria a mesma reunião fechar aqui e não na
  // Dashboard sempre que a reunião acontecesse num mês diferente do da
  // marcação.
  const polosDoEscopo = useMemo(
    () => filtrarPorEscopo(polos, membroFiltro === TODOS ? null : membroFiltro),
    [polos, membroFiltro],
  );
  const coorte = useMemo(
    () => coorteFechamento(polosDoEscopo, periodo, hojeIso()),
    [polosDoEscopo, periodo],
  );

  // --- Cadastro / edição ----------------------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(formVazio);

  const abrirNovo = () => {
    setEditId(null);
    setForm({ ...formVazio(), responsavel_id: myId ?? "" });
    setDialogOpen(true);
  };

  const abrirEdicao = (l: Lead) => {
    setEditId(l.id);
    setForm(leadParaForm(l));
    setDialogOpen(true);
  };

  const salvarMut = useMutation({
    mutationFn: async (vars: { id?: string } & FormState) => {
      const payload = {
        nome_polo: vars.nome_polo.trim(),
        nome_gestor: vars.nome_gestor.trim() || undefined,
        tipo: vars.tipo,
        contato: vars.contato.trim() || undefined,
        observacao: vars.observacao.trim() || undefined,
        data_ligacao: vars.data_ligacao,
        responsavel_id: vars.responsavel_id || undefined,
      };
      if (vars.id) await updateFn({ data: { id: vars.id, ...payload } });
      else await createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(editId ? "Lead atualizado." : "Ligação registrada.");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar o lead."),
  });

  const salvar = () => {
    if (!form.nome_polo.trim()) {
      toast.error("Informe o nome do polo.");
      return;
    }
    if (!form.data_ligacao) {
      toast.error("Informe a data da ligação.");
      return;
    }
    salvarMut.mutate({ id: editId ?? undefined, ...form });
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Lead excluído.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir o lead."),
  });

  // --- Marcar reunião -------------------------------------------------------
  const [reuniaoAlvo, setReuniaoAlvo] = useState<Lead | null>(null);
  const [reuniaoForm, setReuniaoForm] = useState<ReuniaoForm>(REUNIAO_VAZIA);

  const abrirMarcarReuniao = (l: Lead) => {
    setReuniaoAlvo(l);
    setReuniaoForm(REUNIAO_VAZIA);
  };

  const marcarMut = useMutation({
    mutationFn: async () => {
      if (!reuniaoAlvo) return;
      await marcarFn({
        data: {
          id: reuniaoAlvo.id,
          nivel: reuniaoForm.nivel,
          data_reuniao: reuniaoForm.data_reuniao,
          horario_reuniao: reuniaoForm.horario_reuniao || undefined,
          link_reuniao: reuniaoForm.link_reuniao.trim() || undefined,
          faturamento: reuniaoForm.faturamento ? Number(reuniaoForm.faturamento) : undefined,
          observacao: reuniaoForm.observacao.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Reunião marcada — o polo já aparece na aba Reuniões.");
      setReuniaoAlvo(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao marcar a reunião."),
  });

  const confirmarReuniao = () => {
    if (!reuniaoForm.data_reuniao) {
      toast.error("Informe a data da reunião.");
      return;
    }
    marcarMut.mutate();
  };

  const desmarcarMut = useMutation({
    mutationFn: (id: string) => desmarcarFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Reunião desmarcada.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao desmarcar."),
  });

  const nomeMembro = (id: string | null) =>
    id ? (membros.find((m) => m.id === id)?.nome ?? "—") : "—";

  return (
    <div className="w-full space-y-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada linha é uma ligação feita. Ao marcar reunião, o polo passa a aparecer também na aba
            Reuniões — e o lead continua aqui.
          </p>
        </div>
        <Button onClick={abrirNovo} className="rounded-lg shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Registrar ligação
        </Button>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Período</Label>
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
        <div className="w-56 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Membro</Label>
          <Select value={membroFiltro} onValueChange={setMembroFiltro}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os membros</SelectItem>
              {membrosAtribuiveis.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metas de atividade e funil do período */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetaAtividadeCard titulo="Ligações" total={funil.ligacoes} metaDia={metaLigacoesDia} />
        <MetaAtividadeCard
          titulo="Reuniões marcadas"
          total={funil.reunioesMarcadas}
          metaDia={metaReunioesDia}
        />
        {/* Mesma conta da Dashboard: polos que estavam em reunião e viraram
            ativação — não é uma métrica do Lead, então não tem meta diária. */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-muted-foreground">Fecharam</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {coorte.fechadas}
            </p>
            {coorte.realizadas > 0 && (
              <p className="text-sm text-muted-foreground">
                de {coorte.realizadas} reuniões · {coorte.pct.toFixed(1).replace(".", ",")}%
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {coorte.realizadas > 0
              ? `${coorte.emAberto} em aberto · ${coorte.perdidas} não fecharam`
              : "Nenhuma reunião realizada no período."}
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="border-b border-border p-4">
          <div className="relative min-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por polo, gestor ou contato"
              className="rounded-full pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="pl-4 text-muted-foreground">Data</TableHead>
                <TableHead className="text-muted-foreground">Polo</TableHead>
                <TableHead className="text-muted-foreground">Gestor</TableHead>
                <TableHead className="text-muted-foreground">Tipo</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">Reunião</TableHead>
                <TableHead className="text-muted-foreground">Responsável</TableHead>
                <TableHead className="pr-4 text-right text-muted-foreground"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-destructive">
                    Falha ao carregar:{" "}
                    {error instanceof Error ? error.message : "erro desconhecido"}
                  </TableCell>
                </TableRow>
              ) : leadsExibidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    <span className="inline-flex flex-col items-center gap-2">
                      <Phone className="h-8 w-8 text-muted-foreground" />
                      {leads.length === 0
                        ? "Nenhuma ligação registrada ainda."
                        : "Nenhuma ligação no período/filtro selecionado."}
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                leadsExibidos.map((l) => (
                  <TableRow key={l.id} className="border-border hover:bg-accent/50">
                    <TableCell className="whitespace-nowrap pl-4 tabular-nums">
                      {formatarData(l.data_ligacao)}
                    </TableCell>
                    <TableCell className="font-medium">{l.nome_polo}</TableCell>
                    <TableCell>{l.nome_gestor || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {l.tipo === "empreendedor" ? "Empreendedor" : "Polo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{l.contato || "—"}</TableCell>
                    <TableCell>
                      {l.reuniao_marcada ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          <CalendarCheck className="h-3.5 w-3.5" />
                          Marcada
                          {l.reuniao_marcada_em ? ` em ${formatarData(l.reuniao_marcada_em)}` : ""}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Não marcada</span>
                      )}
                    </TableCell>
                    <TableCell>{nomeMembro(l.responsavel_id)}</TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-1">
                        {l.reuniao_marcada ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-muted-foreground hover:text-foreground"
                            onClick={() => desmarcarMut.mutate(l.id)}
                            title="Desmarcar reunião"
                          >
                            <Undo2 className="mr-1 h-3.5 w-3.5" /> Desmarcar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => abrirMarcarReuniao(l)}
                          >
                            <CalendarCheck className="mr-1 h-3.5 w-3.5" /> Marcar reunião
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirEdicao(l)}
                          title="Editar lead"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              title="Excluir lead"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir este lead?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A ligação sai da contagem de metas. A reunião já marcada, se houver,
                                continua na aba Reuniões.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMut.mutate(l.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Cadastro / edição do lead */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar lead" : "Registrar ligação"}</DialogTitle>
            <DialogDescription>
              Os dados do contato feito. Marcar a reunião é um passo separado, na lista.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lead-polo">Nome do polo *</Label>
              <Input
                id="lead-polo"
                value={form.nome_polo}
                onChange={(e) => setForm((f) => ({ ...f, nome_polo: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-gestor">Nome do gestor</Label>
              <Input
                id="lead-gestor"
                value={form.nome_gestor}
                onChange={(e) => setForm((f) => ({ ...f, nome_gestor: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-contato">Contato</Label>
              <Input
                id="lead-contato"
                value={form.contato}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contato: formatarTelefone(e.target.value) }))
                }
                {...TELEFONE_INPUT_PROPS}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Tipo</Label>
              <RadioGroup
                value={form.tipo}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, tipo: v as "empreendedor" | "polo" }))
                }
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="polo" id="tipo-polo" />
                  <Label htmlFor="tipo-polo" className="font-normal">
                    Polo
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="empreendedor" id="tipo-emp" />
                  <Label htmlFor="tipo-emp" className="font-normal">
                    Empreendedor
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-data">Data da ligação *</Label>
              <Input
                id="lead-data"
                type="date"
                value={form.data_ligacao}
                onChange={(e) => setForm((f) => ({ ...f, data_ligacao: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select
                value={form.responsavel_id}
                onValueChange={(v) => setForm((f) => ({ ...f, responsavel_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lead-obs">Observação</Label>
              <Textarea
                id="lead-obs"
                rows={3}
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvarMut.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Marcar reunião */}
      <Dialog open={!!reuniaoAlvo} onOpenChange={(o) => !o && setReuniaoAlvo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reunião com {reuniaoAlvo?.nome_polo}</DialogTitle>
            <DialogDescription>
              Ao salvar, o polo é criado na aba Reuniões e segue de lá para fechamento. Este lead
              continua na lista, marcado como convertido.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reu-data">Data da reunião *</Label>
              <Input
                id="reu-data"
                type="date"
                value={reuniaoForm.data_reuniao}
                onChange={(e) => setReuniaoForm((f) => ({ ...f, data_reuniao: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reu-hora">Horário</Label>
              <Input
                id="reu-hora"
                type="time"
                value={reuniaoForm.horario_reuniao}
                onChange={(e) => setReuniaoForm((f) => ({ ...f, horario_reuniao: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nível</Label>
              <Select
                value={reuniaoForm.nivel}
                onValueChange={(v) => setReuniaoForm((f) => ({ ...f, nivel: v as Nivel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["N1", "N2", "N3"] as const).map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reu-fat">Faturamento (R$)</Label>
              <Input
                id="reu-fat"
                type="number"
                min={0}
                step="0.01"
                value={reuniaoForm.faturamento}
                onChange={(e) => setReuniaoForm((f) => ({ ...f, faturamento: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="reu-link">Link da reunião</Label>
              <Input
                id="reu-link"
                value={reuniaoForm.link_reuniao}
                onChange={(e) => setReuniaoForm((f) => ({ ...f, link_reuniao: e.target.value }))}
                placeholder="https://meet.google.com/…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="reu-obs">Observação</Label>
              <Textarea
                id="reu-obs"
                rows={3}
                value={reuniaoForm.observacao}
                onChange={(e) => setReuniaoForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReuniaoAlvo(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarReuniao} disabled={marcarMut.isPending}>
              Marcar reunião
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
