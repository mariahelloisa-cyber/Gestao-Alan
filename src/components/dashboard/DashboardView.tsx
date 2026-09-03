import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, Clock, PauseCircle } from "lucide-react";
import { useTasks, type WorkspaceView } from "@/lib/tasks-store";
import { listAcompanhamentos } from "@/lib/acompanhamentos.functions";
import { listPolos } from "@/lib/polos.functions";
import { listNegociacoes } from "@/lib/negociacoes.functions";
import { listEscolasTecnicas } from "@/lib/escolas-tecnicas.functions";
import { listMetas } from "@/lib/metas.functions";
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
  MetricTile,
  StatTile,
  type BarRow,
} from "./dashboard-charts";
import {
  calcPrazos,
  classificarPrazo,
  resolverPeriodo,
  type Periodo,
  type PeriodoPreset,
} from "@/lib/productivity";
import { formatarValor, hojeIso, rotuloRelativo } from "@/lib/polos-ui";
import {
  ativacoes,
  composicaoBase,
  contarNoPeriodo,
  coorteFechamento,
  filtrarPorEscopo,
  filtrarReativacoesPorEscopo,
  mesesEntre,
  mesRecorde,
  reativacoes,
  serieMensal,
  serieMensalValor,
  ticketMedio,
  SITUACOES_ATIVAS,
  type PontoMensal,
} from "@/lib/dashboard-metrics";

const ETAPA_LABEL: Record<string, string> = {
  mapeamento: "Mapeamento",
  primeiro_contato: "Primeiro Contato",
  qualificacao: "Qualificação",
  reuniao: "Reunião",
  proposta_comercial: "Proposta Comercial",
};
const ETAPA_ORDEM = Object.keys(ETAPA_LABEL);

/** Escopo "time" = todos; qualquer outro valor é o id de um membro. */
const TIME = "time";

function mesKeyAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/** O mês anterior a uma chave "YYYY-MM". */
function mesAnteriorA(key: string): string {
  const [ano, mes] = key.split("-").map(Number);
  const d = new Date(ano, mes - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** O intervalo completo de um mês "YYYY-MM". */
function periodoDoMes(key: string): Periodo {
  const [ano, mes] = key.split("-").map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  return { de: `${key}-01`, ate: `${key}-${String(ultimo).padStart(2, "0")}` };
}

function rotuloMes(key: string): string {
  const [ano, mes] = key.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function inteiro(n: number): string {
  return n.toLocaleString("pt-BR");
}

function percentual(n: number): string {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function DashboardView({ apenasMinhas = false }: { apenasMinhas?: boolean } = {}) {
  const { tarefas, myId, loading, membros, setWorkspace } = useTasks();
  const hoje = hojeIso();

  // --- Filtros globais ------------------------------------------------------
  // Metade dos indicadores é "que eu fiz" e a outra metade é total; um seletor
  // único evita duplicar cada tile em duas versões.
  const [escopoSel, setEscopoSel] = useState<string>(TIME);
  const escopoId = apenasMinhas ? myId || null : escopoSel === TIME ? null : escopoSel;

  const [preset, setPreset] = useState<PeriodoPreset>("este-mes");
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");
  const periodo = useMemo(
    () => resolverPeriodo(preset, { de: customDe, ate: customAte }),
    [preset, customDe, customAte],
  );

  // --- Dados ----------------------------------------------------------------
  const listAcompFn = useServerFn(listAcompanhamentos);
  const listPolosFn = useServerFn(listPolos);
  const listNegociacoesFn = useServerFn(listNegociacoes);
  const listEscolasFn = useServerFn(listEscolasTecnicas);
  const listMetasFn = useServerFn(listMetas);

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
  const { data: metas = [] } = useQuery({
    queryKey: ["metas-membros"],
    queryFn: () => listMetasFn(),
  });

  // --- Recortes por escopo --------------------------------------------------
  // Ativação, reunião e envio ao comercial pertencem ao `responsavel_id`;
  // reativação tem dono próprio (`reativado_por`).
  const polosResp = useMemo(() => filtrarPorEscopo(polos, escopoId), [polos, escopoId]);
  const polosReat = useMemo(() => filtrarReativacoesPorEscopo(polos, escopoId), [polos, escopoId]);

  // --- Indicadores do período ----------------------------------------------
  const ativ = useMemo(() => ativacoes(polosResp, periodo), [polosResp, periodo]);
  const reat = useMemo(() => reativacoes(polosReat, periodo), [polosReat, periodo]);
  const coorte = useMemo(
    () => coorteFechamento(polosResp, periodo, hoje),
    [polosResp, periodo, hoje],
  );
  const base = useMemo(() => composicaoBase(polosResp, periodo), [polosResp, periodo]);
  const comercial = useMemo(
    () =>
      polosResp.filter(
        (p) =>
          p.enviado_comercial_em &&
          p.enviado_comercial_em.slice(0, 10) >= periodo.de &&
          p.enviado_comercial_em.slice(0, 10) <= periodo.ate,
      ).length,
    [polosResp, periodo],
  );
  const negociacoesEscopo = useMemo(
    () => filtrarPorEscopo(negociacoes, escopoId),
    [negociacoes, escopoId],
  );
  const escolasEscopo = useMemo(() => filtrarPorEscopo(escolas, escopoId), [escolas, escopoId]);
  const negociacoesPeriodo = contarNoPeriodo(negociacoesEscopo, periodo);
  const escolasPeriodo = contarNoPeriodo(escolasEscopo, periodo);

  /** Reuniões antigas, cadastradas antes de o campo Responsável existir. */
  const reunioesSemDono = useMemo(
    () => polos.filter((p) => p.data_reuniao && !p.responsavel_id).length,
    [polos],
  );

  // --- Resultado do mês (independe do filtro de período selecionado) -------
  const mesAtualKey = mesKeyAtual();
  const mesAnteriorKey = useMemo(() => mesAnteriorA(mesAtualKey), [mesAtualKey]);
  const periodoMesAtual = useMemo(() => periodoDoMes(mesAtualKey), [mesAtualKey]);
  const periodoMesAnterior = useMemo(() => periodoDoMes(mesAnteriorKey), [mesAnteriorKey]);

  const resultadoMesAtual = useMemo(
    () =>
      ativacoes(polosResp, periodoMesAtual).valor + reativacoes(polosReat, periodoMesAtual).valor,
    [polosResp, polosReat, periodoMesAtual],
  );
  const resultadoMesAnterior = useMemo(
    () =>
      ativacoes(polosResp, periodoMesAnterior).valor +
      reativacoes(polosReat, periodoMesAnterior).valor,
    [polosResp, polosReat, periodoMesAnterior],
  );
  const variacaoMesPct =
    resultadoMesAnterior > 0
      ? ((resultadoMesAtual - resultadoMesAnterior) / resultadoMesAnterior) * 100
      : null;

  // --- Série mensal ---------------------------------------------------------
  const meses = useMemo(() => {
    const chaves = polos
      .flatMap((p) => [p.data_ativacao, p.data_reativacao, p.data_saida])
      .filter((d): d is string => !!d)
      .map((d) => d.slice(0, 7))
      .sort();
    if (chaves.length === 0) return mesesEntre(mesKeyAtual(), mesKeyAtual());
    return mesesEntre(
      chaves[0],
      mesKeyAtual() > chaves[chaves.length - 1] ? mesKeyAtual() : chaves[chaves.length - 1],
    );
  }, [polos]);

  const serieAtivacoes = useMemo(
    () =>
      serieMensal(
        meses,
        polosResp.map((p) => p.data_ativacao),
      ),
    [meses, polosResp],
  );
  const serieReativacoes = useMemo(
    () =>
      serieMensal(
        meses,
        polosReat.map((p) => p.data_reativacao),
      ),
    [meses, polosReat],
  );
  const serieValor = useMemo(
    () =>
      serieMensalValor(
        meses,
        polosResp.map((p) => ({ data: p.data_ativacao, valor: p.valor_ativacao })),
      ),
    [meses, polosResp],
  );
  // O recorde olha o histórico inteiro; os gráficos mostram só os últimos 24
  // meses, senão anos de operação viram uma lista de barras ilegível.
  const recordeAtivacoes = useMemo(() => mesRecorde(serieAtivacoes), [serieAtivacoes]);
  const recordeReativacoes = useMemo(() => mesRecorde(serieReativacoes), [serieReativacoes]);
  const JANELA_GRAFICO = -24;

  // --- Meta x realizado -----------------------------------------------------
  // A meta é mensal, então ela segue o mês do fim do período selecionado — e
  // cai no mês corrente quando o filtro é "todo o período", que não tem mês.
  const mesMeta = preset === "todos" ? mesKeyAtual() : periodo.ate.slice(0, 7);
  const periodoMeta = useMemo(() => periodoDoMes(mesMeta), [mesMeta]);
  const metasDoMes = useMemo(() => metas.filter((m) => m.periodo === mesMeta), [metas, mesMeta]);

  const rankingMetas = useMemo(() => {
    const alvo = escopoId ? membros.filter((m) => m.id === escopoId) : membros;
    return alvo
      .map((m) => {
        // Realizado = ativação + reativação, conforme definido com o time.
        const ativado = ativacoes(
          polos.filter((p) => p.responsavel_id === m.id),
          periodoMeta,
        ).valor;
        const reativado = reativacoes(
          polos.filter((p) => p.reativado_por === m.id),
          periodoMeta,
        ).valor;
        const realizado = ativado + reativado;
        const meta = metasDoMes.find((x) => x.usuario_id === m.id)?.valor_meta ?? 0;
        return {
          membro: m,
          realizado,
          meta,
          pct: meta > 0 ? (realizado / meta) * 100 : 0,
        };
      })
      .filter((r) => r.meta > 0 || r.realizado > 0)
      .sort((a, b) => b.pct - a.pct || b.realizado - a.realizado);
  }, [membros, escopoId, polos, periodoMeta, metasDoMes]);

  const metaTime = rankingMetas.reduce((s, r) => s + r.meta, 0);
  const realizadoTime = rankingMetas.reduce((s, r) => s + r.realizado, 0);

  // --- Ação do dia ----------------------------------------------------------
  // Fora do filtro de período de propósito: este bloco responde "o que preciso
  // fazer agora", não "como foi o mês".
  const daquiA7 = useMemo(() => {
    const d = new Date(`${hoje}T00:00:00`);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [hoje]);

  const emReuniao = useMemo(
    () => polosResp.filter((p) => p.situacao === "reuniao" && p.data_reuniao),
    [polosResp],
  );
  const reunioesAtrasadas = emReuniao.filter((p) => p.data_reuniao! < hoje);
  const reunioesHoje = emReuniao.filter((p) => p.data_reuniao === hoje);
  const reunioesSemana = emReuniao.filter(
    (p) => p.data_reuniao! > hoje && p.data_reuniao! <= daquiA7,
  );
  const inativosParados = useMemo(() => {
    const limite = new Date(`${hoje}T00:00:00`);
    limite.setDate(limite.getDate() - 30);
    const corte = limite.toISOString().slice(0, 10);
    return polosResp.filter(
      (p) => p.situacao === "inativo" && p.atualizado_em.slice(0, 10) < corte,
    );
  }, [polosResp, hoje]);

  // --- Tarefas (bloco mantido) ---------------------------------------------
  const todas = useMemo(() => tarefas.filter((t) => (t.tipo ?? "tarefa") === "tarefa"), [tarefas]);
  const tarefasEscopo = useMemo(
    () => (escopoId ? todas.filter((t) => t.responsaveis.some((r) => r.id === escopoId)) : todas),
    [todas, escopoId],
  );
  const tarefasVencidas = useMemo(
    () => tarefasEscopo.filter((t) => classificarPrazo(t) === "expirada"),
    [tarefasEscopo],
  );

  const membrosOrdenados = useMemo(
    () => [...membros].sort((a, b) => a.nome.localeCompare(b.nome)),
    [membros],
  );
  const [membroSelecionadoId, setMembroSelecionadoId] = useState<string>("");
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

  // Totais do bloco Expansão — sempre a empresa inteira, sem seguir o escopo
  // nem o período: é o retrato da carteira hoje.
  const polosAtivos = useMemo(
    () => polos.filter((p) => SITUACOES_ATIVAS.includes(p.situacao as never)),
    [polos],
  );
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

  const ir = (v: WorkspaceView) => () => setWorkspace(v);

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

  const escopoLabel = escopoId
    ? escopoId === myId
      ? "Minha visão"
      : (membros.find((m) => m.id === escopoId)?.nome ?? "Membro")
    : "Time inteiro";

  return (
    <div className="space-y-8 p-6">
      {/* Filtros globais */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!apenasMinhas && (
            <Select value={escopoSel} onValueChange={setEscopoSel}>
              <SelectTrigger className="h-9 w-52">
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
          )}
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
        <ReportDialog apenasMinhas={apenasMinhas} />
      </div>

      {/* 1. Resultado do mês — ativação + reativação do mês corrente, sempre,
          independente do filtro de período selecionado acima. */}
      <ResultadoMesTile valor={resultadoMesAtual} variacaoPct={variacaoMesPct} />

      {/* 2. Ação do dia */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Ação do dia</h2>
          <p className="text-xs text-muted-foreground">
            O que precisa de atenção agora — independente do período selecionado
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <AcaoTile
            icone={<AlertTriangle className="h-4 w-4" />}
            label="Reuniões aguardando conclusão"
            valor={reunioesAtrasadas.length}
            detalhe={
              reunioesAtrasadas[0] &&
              `${reunioesAtrasadas[0].nome} · ${rotuloRelativo(reunioesAtrasadas[0].data_reuniao)}`
            }
            tom="perigo"
            onClick={ir({ tipo: "reunioes" })}
          />
          <AcaoTile
            icone={<CalendarClock className="h-4 w-4" />}
            label="Reuniões hoje"
            valor={reunioesHoje.length}
            detalhe={reunioesHoje[0]?.nome}
            tom="alerta"
            onClick={ir({ tipo: "reunioes" })}
          />
          <AcaoTile
            icone={<CalendarClock className="h-4 w-4" />}
            label="Próximos 7 dias"
            valor={reunioesSemana.length}
            detalhe={
              reunioesSemana[0] &&
              `${reunioesSemana[0].nome} · ${rotuloRelativo(reunioesSemana[0].data_reuniao)}`
            }
            onClick={ir({ tipo: "reunioes" })}
          />
          <AcaoTile
            icone={<Clock className="h-4 w-4" />}
            label="Tarefas vencidas"
            valor={tarefasVencidas.length}
            detalhe={tarefasVencidas[0]?.titulo}
            tom={tarefasVencidas.length > 0 ? "perigo" : undefined}
            onClick={ir({ tipo: "tarefas" })}
          />
        </div>
      </section>

      {/* 1. Expansão e funil — o retrato da carteira, sempre a empresa inteira */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Expansão</h2>
          <p className="text-xs text-muted-foreground">
            Polos, negociações, escolas técnicas e o funil de acompanhamento
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Polos ativos" value={inteiro(polosAtivos.length)} />
          <StatTile label="Valor em ativação" value={formatarValor(valorAtivo)} />
          <StatTile label="Negociações" value={inteiro(negociacoes.length)} />
          <StatTile label="Escolas técnicas" value={inteiro(escolas.length)} />
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


      {/* 3. Números do período */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Números do período</h2>
          <p className="text-xs text-muted-foreground">{escopoLabel}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Ativações"
            value={inteiro(ativ.quantidade)}
            onClick={ir({ tipo: "ativacao" })}
          />
          <MetricTile
            label="Taxa de fechamento"
            value={coorte.realizadas > 0 ? percentual(coorte.pct) : "—"}
            hint={
              coorte.realizadas > 0
                ? `${coorte.fechadas} de ${coorte.realizadas} reuniões fecharam`
                : "Sem reuniões no período"
            }
            onClick={ir({ tipo: "reunioes" })}
          />
          <MetricTile
            label="Valor de ativação"
            value={formatarValor(ativ.valor)}
            onClick={ir({ tipo: "ativacao" })}
          />

          <MetricTile
            label="Reativações"
            value={inteiro(reat.quantidade)}
            onClick={ir({ tipo: "reativacao" })}
          />
          <MetricTile
            label="Valor de reativação"
            value={formatarValor(reat.valor)}
            onClick={ir({ tipo: "reativacao" })}
          />
          <MetricTile
            label="Ticket médio de ativação"
            value={formatarValor(ticketMedio(ativ))}
            onClick={ir({ tipo: "ativacao" })}
          />
          <MetricTile
            label="Ticket médio de reativação"
            value={formatarValor(ticketMedio(reat))}
            onClick={ir({ tipo: "reativacao" })}
          />

          <MetricTile
            label="Enviados ao comercial"
            value={inteiro(comercial)}
            onClick={ir({ tipo: "comercial" })}
          />
          <MetricTile
            label="Negociações"
            value={inteiro(negociacoesPeriodo)}
            hint={`${negociacoesEscopo.length} no total`}
            onClick={ir({ tipo: "negociacoes" })}
          />
          <MetricTile
            label="Escolas técnicas"
            value={inteiro(escolasPeriodo)}
            hint={`${escolasEscopo.length} no total`}
            onClick={ir({ tipo: "escolas-tecnicas" })}
          />
          <BaseAtivaCard
            base={base}
            periodoLabel={preset === "todos" ? "em todo o período" : "no período"}
            onClick={ir({ tipo: "ativacao" })}
          />
        </div>

        {escopoId && reunioesSemDono > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {reunioesSemDono} reunião(ões) sem responsável definido não aparecem nesta visão
            individual — elas foram cadastradas antes do campo existir e contam apenas no time.
          </p>
        )}
      </section>

      {/* 4. Meta x realizado */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Meta x realizado — {rotuloMes(mesMeta)}
            </h2>
            <p className="text-xs text-muted-foreground">
              Realizado soma valor de ativação e de reativação no mês
            </p>
          </div>
          <button
            type="button"
            onClick={ir({ tipo: "metas" })}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Definir metas
          </button>
        </div>

        {metaTime > 0 || realizadoTime > 0 ? (
          <Card title={escopoId ? escopoLabel : "Time"}>
            <MetaBarra realizado={realizadoTime} meta={metaTime} destaque />
            {!escopoId && rankingMetas.length > 0 && (
              <div className="mt-6 space-y-4 border-t border-border pt-5">
                {rankingMetas.map((r) => (
                  <div key={r.membro.id}>
                    <div className="mb-1.5 text-xs font-medium text-foreground">
                      {r.membro.nome}
                    </div>
                    <MetaBarra realizado={r.realizado} meta={r.meta} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma meta definida para {rotuloMes(mesMeta)} e nenhum valor realizado no mês.
          </div>
        )}
      </section>

      {/* 5. Evolução mensal */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Evolução mensal</h2>
          <p className="text-xs text-muted-foreground">
            Histórico completo — não segue o filtro de período, para o mês recorde não se perder
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <RecordeTile
            titulo="Mês com mais ativações"
            ponto={recordeAtivacoes}
            sufixo="ativações"
          />
          <RecordeTile
            titulo="Mês com mais reativações"
            ponto={recordeReativacoes}
            sufixo="reativações"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Ativações por mês">
            <HorizontalBarChart rows={serieAtivacoes.slice(JANELA_GRAFICO)} />
          </Card>
          <Card title="Reativações por mês">
            <HorizontalBarChart rows={serieReativacoes.slice(JANELA_GRAFICO)} />
          </Card>
          <Card title="Valor de ativação por mês">
            <HorizontalBarChart
              rows={serieValor.slice(JANELA_GRAFICO)}
              formatValue={(v) => formatarValor(v)}
            />
          </Card>
        </div>
      </section>

      {/* Tarefas — mantidas no fim */}
      {!apenasMinhas && (
        <Section title="Visão Geral das Tarefas" subtitle="Todas as tarefas de todos os clientes">
          <ProgressoCard data={geralStatus} />
          <PrazosCard data={geralPrazos} />
        </Section>
      )}

      <section className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Produtividade</h2>
          <p className="text-xs text-muted-foreground">
            Tarefas recebidas x concluídas no período selecionado
          </p>
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

// --- Peças da tela ----------------------------------------------------------

function AcaoTile({
  icone,
  label,
  valor,
  detalhe,
  tom,
  onClick,
}: {
  icone: React.ReactNode;
  label: string;
  valor: number;
  detalhe?: string | false;
  tom?: "perigo" | "alerta";
  onClick: () => void;
}) {
  // Sem pendência não há urgência: o tile fica neutro mesmo sendo "perigo".
  const ativo = valor > 0;
  const cor =
    ativo && tom === "perigo"
      ? "text-red-600 dark:text-red-400"
      : ativo && tom === "alerta"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-card/80 p-4 text-left shadow-sm transition-colors hover:border-foreground/25 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={ativo ? cor : "text-muted-foreground"}>{icone}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${cor}`}>{valor}</div>
      <div className="mt-0.5 min-h-[1rem] truncate text-[11px] text-muted-foreground">
        {ativo ? detalhe || "" : "Nada pendente"}
      </div>
    </button>
  );
}

/** Ativação + reativação do mês corrente, com a variação vs. o mês anterior. */
function ResultadoMesTile({ valor, variacaoPct }: { valor: number; variacaoPct: number | null }) {
  const subiu = variacaoPct != null && variacaoPct >= 0;
  return (
    <div className="w-full max-w-xs rounded-xl border border-border bg-card/80 p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Resultado do mês
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
        {formatarValor(valor)}
      </div>
      <div
        className={`mt-1 text-xs font-medium ${
          variacaoPct == null
            ? "text-muted-foreground"
            : subiu
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
        }`}
      >
        {variacaoPct == null
          ? "Sem dados do mês anterior"
          : `${subiu ? "↑" : "↓"} ${percentual(Math.abs(variacaoPct))} vs mês anterior`}
      </div>
    </div>
  );
}

/**
 * Polos ativos no período — estoque, não fluxo.
 *
 * Um polo ativado há dois anos e ainda ativo entra em `total` sem nunca ter
 * "entrado" no período; por isso o card mostra a composição inteira, senão o
 * número sozinho parece não bater com as ativações do mês.
 */
function BaseAtivaCard({
  base,
  periodoLabel,
  onClick,
}: {
  base: ReturnType<typeof composicaoBase>;
  periodoLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="col-span-2 rounded-xl border border-border bg-card/80 p-4 text-left shadow-sm transition-colors hover:border-foreground/25 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="text-xs text-muted-foreground">Polos ativos {periodoLabel}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {inteiro(base.total)}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>{inteiro(base.jaVinham)} já vinham</span>
        <span className="text-emerald-600 dark:text-emerald-400">+{inteiro(base.entraram)}</span>
        <span className="text-red-600 dark:text-red-400">−{inteiro(base.sairam)}</span>
        <span>·</span>
        <span className="font-medium text-foreground">{inteiro(base.aoFim)} ao fim</span>
      </div>
      {base.semData > 0 && (
        <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
          {base.semData} polo(s) ativo(s) sem data de ativação ficam fora deste corte
        </div>
      )}
    </button>
  );
}

function MetaBarra({
  realizado,
  meta,
  destaque = false,
}: {
  realizado: number;
  meta: number;
  destaque?: boolean;
}) {
  const pct = meta > 0 ? (realizado / meta) * 100 : 0;
  const falta = Math.max(meta - realizado, 0);
  const bateu = meta > 0 && realizado >= meta;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <span
          className={`tabular-nums font-semibold text-foreground ${destaque ? "text-xl" : "text-sm"}`}
        >
          {formatarValor(realizado)}
          {meta > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              de {formatarValor(meta)}
            </span>
          )}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {meta > 0 ? (
            bateu ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Meta batida · {percentual(pct)}
              </span>
            ) : (
              <>
                {percentual(pct)} · faltam {formatarValor(falta)}
              </>
            )
          ) : (
            "Sem meta definida"
          )}
        </span>
      </div>
      <div className={`w-full overflow-hidden rounded-full bg-muted ${destaque ? "h-3" : "h-2"}`}>
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: bateu
              ? "linear-gradient(90deg,#10b981,#22c55e)"
              : "linear-gradient(90deg,#14b8a6,#3b82f6)",
          }}
        />
      </div>
    </div>
  );
}

function RecordeTile({
  titulo,
  ponto,
  sufixo,
}: {
  titulo: string;
  ponto: PontoMensal | null;
  sufixo: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="text-xs text-muted-foreground">{titulo}</div>
      {ponto ? (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-foreground">{rotuloMes(ponto.id)}</span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {ponto.total} {sufixo}
          </span>
        </div>
      ) : (
        <div className="mt-1 text-2xl font-semibold text-muted-foreground">—</div>
      )}
    </div>
  );
}
