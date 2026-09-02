import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTasks } from "@/lib/tasks-store";
import { listPolos } from "@/lib/polos.functions";
import { listNegociacoes } from "@/lib/negociacoes.functions";
import { listEscolasTecnicas } from "@/lib/escolas-tecnicas.functions";
import { listAcompanhamentos } from "@/lib/acompanhamentos.functions";
import { listMetas } from "@/lib/metas.functions";
import { PERIODO_PRESETS, resolverPeriodo, type PeriodoPreset } from "@/lib/productivity";
import { hojeIso } from "@/lib/polos-ui";
import { gerarRelatorioExpansaoPDF, SECOES, type SecaoRelatorio } from "@/lib/reports-expansao";
import { PeriodFilter } from "./PeriodFilter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const TIME = "time";
const TODOS_CLIENTES = "todos";

/** Todas as seções vêm marcadas: o caso comum é querer o relatório inteiro. */
const SECOES_PADRAO: SecaoRelatorio[] = SECOES.map((s) => s.id);

export function ReportDialog({ apenasMinhas }: { apenasMinhas: boolean }) {
  const { tarefas, membros, clientes, myId, myNome } = useTasks();
  const [open, setOpen] = useState(false);

  const [preset, setPreset] = useState<PeriodoPreset>("este-mes");
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");
  const [escopoSel, setEscopoSel] = useState(TIME);
  const [clienteId, setClienteId] = useState(TODOS_CLIENTES);
  const [secoes, setSecoes] = useState<SecaoRelatorio[]>(SECOES_PADRAO);

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

  const membrosOrdenados = useMemo(
    () => [...membros].sort((a, b) => a.nome.localeCompare(b.nome)),
    [membros],
  );
  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => a.nome_empresa.localeCompare(b.nome_empresa)),
    [clientes],
  );

  const escopoId = apenasMinhas ? myId || null : escopoSel === TIME ? null : escopoSel;
  const escopoLabel = escopoId
    ? escopoId === myId
      ? myNome || "Você"
      : (membrosOrdenados.find((m) => m.id === escopoId)?.nome ?? "Membro")
    : "Time inteiro";

  /** Tarefas já filtradas por período e cliente — o escopo por membro é aplicado no gerador. */
  const tarefasFiltradas = useMemo(() => {
    const semPeriodo = preset === "todos";
    return tarefas.filter((t) => {
      if ((t.tipo ?? "tarefa") !== "tarefa") return false;
      if (clienteId !== TODOS_CLIENTES && t.cliente_id !== clienteId) return false;
      if (!semPeriodo) {
        const ref = t.concluido_em ? t.concluido_em.slice(0, 10) : t.data_vencimento || null;
        if (!ref || ref < periodo.de || ref > periodo.ate) return false;
      }
      return true;
    });
  }, [tarefas, clienteId, preset, periodo]);

  const alternar = (id: SecaoRelatorio) =>
    setSecoes((atual) => (atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]));

  const baixar = () => {
    gerarRelatorioExpansaoPDF(
      {
        polos,
        negociacoes,
        escolas,
        acompanhamentos,
        metas,
        tarefas: tarefasFiltradas,
        membros: membrosOrdenados.map((m) => ({ id: m.id, nome: m.nome })),
        clientesById: new Map(clientes.map((cl) => [cl.id, cl.nome_empresa])),
      },
      {
        periodo,
        periodoLabel: PERIODO_PRESETS.find((p) => p.value === preset)?.label ?? "Período",
        escopoId,
        escopoLabel,
        // Preserva a ordem canônica das seções, não a ordem de clique.
        secoes: SECOES.map((s) => s.id).filter((id) => secoes.includes(id)),
        hoje: hojeIso(),
      },
    );
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileDown className="mr-1.5 h-4 w-4" />
        Gerar relatório
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar relatório</DialogTitle>
            <DialogDescription>
              Escolha o período, a visão e quais seções entram no PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
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

            {secoes.includes("tarefas") && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Cliente <span className="font-normal">(afeta só a seção de tarefas)</span>
                </label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS_CLIENTES}>Todos os clientes</SelectItem>
                    {clientesOrdenados.map((cl) => (
                      <SelectItem key={cl.id} value={cl.id}>
                        {cl.nome_empresa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Seções do relatório
                </label>
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setSecoes(SECOES_PADRAO)}
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

              <div className="grid gap-x-4 gap-y-2 rounded-lg border border-border p-3 sm:grid-cols-2">
                {SECOES.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md p-1 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={secoes.includes(s.id)}
                      onCheckedChange={() => alternar(s.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground">{s.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{s.descricao}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {secoes.length === 0
                ? "Selecione ao menos uma seção."
                : `${secoes.length} seç${secoes.length === 1 ? "ão" : "ões"} · visão: ${escopoLabel}`}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={baixar} disabled={secoes.length === 0}>
              <FileDown className="mr-1.5 h-4 w-4" />
              Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
