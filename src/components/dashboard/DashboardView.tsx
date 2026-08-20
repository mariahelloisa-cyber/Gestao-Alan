import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTasks } from "@/lib/tasks-store";
import { listAcompanhamentos } from "@/lib/acompanhamentos.functions";
import { listPolos } from "@/lib/polos.functions";
import { listNegociacoes } from "@/lib/negociacoes.functions";
import { listEscolasTecnicas } from "@/lib/escolas-tecnicas.functions";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PeriodFilter } from "./PeriodFilter";
import { ReportDialog } from "./ReportDialog";
import {
  calcStatus,
  Card,
  Section,
  ProgressoCard,
  PrazosCard,
  HorizontalBarChart,
  MemberProductivityBlock,
  StatTile,
  type BarRow,
} from "./dashboard-charts";
import { calcPrazos, resolverPeriodo, type PeriodoPreset } from "@/lib/productivity";

const ETAPA_LABEL: Record<string, string> = {
  mapeamento: "Mapeamento",
  primeiro_contato: "Primeiro Contato",
  qualificacao: "Qualificação",
  reuniao: "Reunião",
  proposta_comercial: "Proposta Comercial",
};
const ETAPA_ORDEM = Object.keys(ETAPA_LABEL);

function formatarValor(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesKeyAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/** Gera um mês por mês entre "de" e "até" (formato "YYYY-MM"), inclusive. */
function mesesEntre(de: string, ate: string): { key: string; label: string }[] {
  const [deAno, deMes] = de.split("-").map(Number);
  const [ateAno, ateMes] = ate.split("-").map(Number);
  const out: { key: string; label: string }[] = [];
  const cursor = new Date(deAno, deMes - 1, 1);
  const fim = new Date(ateAno, ateMes - 1, 1);
  if (cursor > fim) return out;
  while (cursor <= fim) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const label = cursor
      .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
      .replace(".", "");
    out.push({ key, label });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function mesKeyDe(dataIso: string): string {
  return dataIso.slice(0, 7);
}

function contarPorMes(meses: { key: string; label: string }[], datas: (string | null)[]): BarRow[] {
  const porMes = new Map<string, number>();
  for (const d of datas) {
    if (!d) continue;
    const k = mesKeyDe(d);
    porMes.set(k, (porMes.get(k) ?? 0) + 1);
  }
  return meses.map((m) => ({ id: m.key, nome: m.label, total: porMes.get(m.key) ?? 0 }));
}

function somarPorMes(
  meses: { key: string; label: string }[],
  itens: { data: string | null; valor: number }[],
): BarRow[] {
  const porMes = new Map<string, number>();
  for (const { data, valor } of itens) {
    if (!data) continue;
    const k = mesKeyDe(data);
    porMes.set(k, (porMes.get(k) ?? 0) + valor);
  }
  return meses.map((m) => ({ id: m.key, nome: m.label, total: porMes.get(m.key) ?? 0 }));
}

export function DashboardView({ apenasMinhas = false }: { apenasMinhas?: boolean } = {}) {
  const { tarefas, myId, loading, membros } = useTasks();
  const [membroSelecionadoId, setMembroSelecionadoId] = useState<string>("");
  const [preset, setPreset] = useState<PeriodoPreset>("30d");
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");
  const periodo = useMemo(
    () => resolverPeriodo(preset, { de: customDe, ate: customAte }),
    [preset, customDe, customAte],
  );

  const listAcompFn = useServerFn(listAcompanhamentos);
  const listPolosFn = useServerFn(listPolos);
  const listNegociacoesFn = useServerFn(listNegociacoes);
  const listEscolasFn = useServerFn(listEscolasTecnicas);

  const { data: acompanhamentos = [] } = useQuery({
    queryKey: ["acompanhamentos"],
    queryFn: () => listAcompFn(),
  });
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

  const polosAtivos = useMemo(() => polos.filter((p) => p.situacao !== "desligado"), [polos]);
  const valorAtivo = useMemo(
    () => polosAtivos.reduce((s, p) => s + (p.valor_ativacao ?? 0), 0),
    [polosAtivos],
  );
  const funilRows = useMemo<BarRow[]>(
    () =>
      ETAPA_ORDEM.map((etapa) => ({
        id: etapa,
        nome: ETAPA_LABEL[etapa],
        total: acompanhamentos.filter((a) => a.etapa === etapa).length,
      })),
    [acompanhamentos],
  );

  const [ativacaoPreset, setAtivacaoPreset] = useState<PeriodoPreset>("todos");
  const [ativacaoCustomDe, setAtivacaoCustomDe] = useState("");
  const [ativacaoCustomAte, setAtivacaoCustomAte] = useState("");
  const ativacaoPeriodo = useMemo(
    () => resolverPeriodo(ativacaoPreset, { de: ativacaoCustomDe, ate: ativacaoCustomAte }),
    [ativacaoPreset, ativacaoCustomDe, ativacaoCustomAte],
  );
  const meses = useMemo(() => {
    if (ativacaoPreset === "todos") {
      const chaves = polos
        .flatMap((p) => [p.data_ativacao, p.data_saida, p.atualizado_em])
        .filter((d): d is string => !!d)
        .map((d) => d.slice(0, 7))
        .sort();
      if (chaves.length === 0) return mesesEntre(mesKeyAtual(), mesKeyAtual());
      return mesesEntre(chaves[0], chaves[chaves.length - 1]);
    }
    return mesesEntre(ativacaoPeriodo.de.slice(0, 7), ativacaoPeriodo.ate.slice(0, 7));
  }, [ativacaoPreset, ativacaoPeriodo, polos]);
  const ativacoesPorMes = useMemo(
    () =>
      contarPorMes(
        meses,
        polos.map((p) => p.data_ativacao),
      ),
    [meses, polos],
  );
  const valorPorMes = useMemo(
    () =>
      somarPorMes(
        meses,
        polos.map((p) => ({ data: p.data_ativacao, valor: p.valor_ativacao ?? 0 })),
      ),
    [meses, polos],
  );
  const reativacoesPorMes = useMemo(
    () =>
      contarPorMes(
        meses,
        polos.filter((p) => p.situacao === "reativado").map((p) => p.atualizado_em),
      ),
    [meses, polos],
  );
  const desligamentosPorMes = useMemo(
    () =>
      contarPorMes(
        meses,
        polos.map((p) => p.data_saida),
      ),
    [meses, polos],
  );

  const todas = useMemo(() => tarefas.filter((t) => (t.tipo ?? "tarefa") === "tarefa"), [tarefas]);
  const minhas = useMemo(
    () => todas.filter((t) => t.responsaveis.some((r) => r.id === myId)),
    [todas, myId],
  );

  const membrosOrdenados = useMemo(
    () => [...membros].sort((a, b) => a.nome.localeCompare(b.nome)),
    [membros],
  );
  const membroSelecionado = membrosOrdenados.find((m) => m.id === membroSelecionadoId);
  const tarefasMembro = useMemo(
    () =>
      membroSelecionado
        ? todas.filter((t) => t.responsaveis.some((r) => r.id === membroSelecionado.id))
        : [],
    [todas, membroSelecionado],
  );

  const geralStatus = useMemo(() => calcStatus(todas), [todas]);
  const geralPrazos = useMemo(() => calcPrazos(todas), [todas]);

  if (loading) {
    return (
      <div className="space-y-8 p-6">
        {[0, 1].map((s) => (
          <div key={s} className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-56 w-full rounded-xl" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-end">
        <ReportDialog apenasMinhas={apenasMinhas} />
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Expansão</h2>
          <p className="text-xs text-muted-foreground">
            Polos, negociações, escolas técnicas e o funil de acompanhamento
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Polos ativos" value={String(polosAtivos.length)} />
          <StatTile label="Valor em ativação" value={formatarValor(valorAtivo)} />
          <StatTile label="Negociações" value={String(negociacoes.length)} />
          <StatTile label="Escolas técnicas" value={String(escolas.length)} />
        </div>

        <Card title="Funil de Acompanhamento">
          {acompanhamentos.length > 0 ? (
            <HorizontalBarChart rows={funilRows} />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum cliente no funil de acompanhamento ainda.
            </div>
          )}
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Ativação por Período</h2>
            <p className="text-xs text-muted-foreground">
              Pra enxergar em que períodos mais gente ativa, reativa ou desliga
            </p>
          </div>
          <PeriodFilter
            preset={ativacaoPreset}
            onPresetChange={setAtivacaoPreset}
            customDe={ativacaoCustomDe}
            customAte={ativacaoCustomAte}
            onCustomChange={(de, ate) => {
              setAtivacaoCustomDe(de);
              setAtivacaoCustomAte(ate);
            }}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Valor em ativação por período">
            <HorizontalBarChart rows={valorPorMes} formatValue={formatarValor} />
          </Card>
          <Card title="Ativações por período">
            <HorizontalBarChart rows={ativacoesPorMes} />
          </Card>
          <Card title="Reativações por período">
            <HorizontalBarChart rows={reativacoesPorMes} />
          </Card>
          <Card title="Desligamentos por período">
            <HorizontalBarChart rows={desligamentosPorMes} />
          </Card>
        </div>
      </section>

      {!apenasMinhas && (
        <Section title="Visão Geral da Ativação" subtitle="Todas as tarefas de todos os clientes">
          <ProgressoCard data={geralStatus} />
          <PrazosCard data={geralPrazos} />
        </Section>
      )}

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Produtividade</h2>
            <p className="text-xs text-muted-foreground">
              Compare tarefas recebidas x concluídas no período selecionado
            </p>
          </div>
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

        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Minha Visão</h3>
          <MemberProductivityBlock tarefasDoMembro={minhas} membroId={myId} periodo={periodo} />
        </div>

        {!apenasMinhas && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Visão por Membro</h3>
              <Select value={membroSelecionadoId} onValueChange={setMembroSelecionadoId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Selecione um membro" />
                </SelectTrigger>
                <SelectContent>
                  {membrosOrdenados.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {membroSelecionado ? (
              <MemberProductivityBlock
                tarefasDoMembro={tarefasMembro}
                membroId={membroSelecionado.id}
                periodo={periodo}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {membrosOrdenados.length === 0
                  ? "Nenhum membro cadastrado ainda."
                  : "Selecione um membro acima para ver o dashboard individual."}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
