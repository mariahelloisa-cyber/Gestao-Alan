import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Clock } from "lucide-react";
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
  dentroDoPeriodo,
  resolverPeriodo,
  type Periodo,
  type PeriodoPreset,
} from "@/lib/productivity";
import { formatarValor, hojeIso, rotuloRelativo } from "@/lib/polos-ui";
import {
  ativacoes,
  ativoEm,
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

/**
 * Um filtro de período próprio para uma seção — cada bloco da dashboard tem
 * o seu, em vez de um único filtro global que umas seções seguem e outras
 * ignoram silenciosamente.
 */
function usePeriodoFiltro(padrao: PeriodoPreset) {
  const [preset, setPreset] = useState<PeriodoPreset>(padrao);
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");
  const periodo = useMemo(
    () => resolverPeriodo(preset, { de: customDe, ate: customAte }),
    [preset, customDe, customAte],
  );
  return { preset, setPreset, customDe, customAte, setCustomDe, setCustomAte, periodo };
}

export function DashboardView({ apenasMinhas = false }: { apenasMinhas?: boolean } = {}) {
  const { tarefas, myId, loading, membros, membrosAtribuiveis, setWorkspace } = useTasks();
  const hoje = hojeIso();

  // --- Escopo global ----------------------------------------------------
  // Metade dos indicadores é "que eu fiz" e a outra metade é total; um seletor
  // único evita duplicar cada tile em duas versões. O período, diferente do
  // escopo, é filtrado seção a seção — cada bloco tem seu próprio filtro.
  const [escopoSel, setEscopoSel] = useState<string>(TIME);
  const escopoId = apenasMinhas ? myId || null : escopoSel === TIME ? null : escopoSel;

  const filtroExpansao = usePeriodoFiltro("todos");
  const filtroNumeros = usePeriodoFiltro("este-mes");
  const filtroEvolucao = usePeriodoFiltro("todos");
  const filtroProdutividade = usePeriodoFiltro("este-mes");

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

  // --- Indicadores do período — seção "Números do período" ------------------
  const periodoNumeros = filtroNumeros.periodo;
  const ativ = useMemo(() => ativacoes(polosResp, periodoNumeros), [polosResp, periodoNumeros]);
  const reat = useMemo(() => reativacoes(polosReat, periodoNumeros), [polosReat, periodoNumeros]);
  const coorte = useMemo(
    () => coorteFechamento(polosResp, periodoNumeros, hoje),
    [polosResp, periodoNumeros, hoje],
  );
  const base = useMemo(
    () => composicaoBase(polosResp, periodoNumeros),
    [polosResp, periodoNumeros],
  );
  const comercial = useMemo(
    () =>
      polosResp.filter(
        (p) =>
          p.enviado_comercial_em &&
          p.enviado_comercial_em.slice(0, 10) >= periodoNumeros.de &&
          p.enviado_comercial_em.slice(0, 10) <= periodoNumeros.ate,
      ).length,
    [polosResp, periodoNumeros],
  );
  const negociacoesEscopo = useMemo(
    () => filtrarPorEscopo(negociacoes, escopoId),
    [negociacoes, escopoId],
  );
  const escolasEscopo = useMemo(() => filtrarPorEscopo(escolas, escopoId), [escolas, escopoId]);
  const negociacoesPeriodo = contarNoPeriodo(negociacoesEscopo, periodoNumeros);
  const escolasPeriodo = contarNoPeriodo(escolasEscopo, periodoNumeros);

  /** Reuniões antigas, cadastradas antes de o campo Responsável existir. */
  const reunioesSemDono = useMemo(
    () => polos.filter((p) => p.data_reuniao && !p.responsavel_id).length,
    [polos],
  );

  // --- Resultado do mês + Meta — mês selecionável, começa no mês corrente ---
  // Ritmo e projeção só fazem sentido dentro de um mês específico (a meta é
  // mensal), então este bloco usa um seletor de mês em vez do filtro de
  // período genérico das outras seções.
  const mesAtualKey = mesKeyAtual();
  const [mesFaixaKey, setMesFaixaKey] = useState(mesAtualKey);
  const isMesFaixaAtual = mesFaixaKey === mesAtualKey;
  const mesAnteriorFaixaKey = useMemo(() => mesAnteriorA(mesFaixaKey), [mesFaixaKey]);
  const periodoMesFaixa = useMemo(() => periodoDoMes(mesFaixaKey), [mesFaixaKey]);
  const periodoMesAnteriorFaixa = useMemo(
    () => periodoDoMes(mesAnteriorFaixaKey),
    [mesAnteriorFaixaKey],
  );

  const resultadoMesFaixa = useMemo(
    () =>
      ativacoes(polosResp, periodoMesFaixa).valor + reativacoes(polosReat, periodoMesFaixa).valor,
    [polosResp, polosReat, periodoMesFaixa],
  );
  const resultadoMesAnteriorFaixa = useMemo(
    () =>
      ativacoes(polosResp, periodoMesAnteriorFaixa).valor +
      reativacoes(polosReat, periodoMesAnteriorFaixa).valor,
    [polosResp, polosReat, periodoMesAnteriorFaixa],
  );
  const variacaoMesFaixaPct =
    resultadoMesAnteriorFaixa > 0
      ? ((resultadoMesFaixa - resultadoMesAnteriorFaixa) / resultadoMesAnteriorFaixa) * 100
      : null;

  const metasDoMesFaixa = useMemo(
    () => metas.filter((m) => m.periodo === mesFaixaKey),
    [metas, mesFaixaKey],
  );

  const rankingMetas = useMemo(() => {
    const alvo = escopoId
      ? membrosAtribuiveis.filter((m) => m.id === escopoId)
      : membrosAtribuiveis;
    return alvo
      .map((m) => {
        // Realizado = ativação + reativação, conforme definido com o time.
        const ativado = ativacoes(
          polos.filter((p) => p.responsavel_id === m.id),
          periodoMesFaixa,
        ).valor;
        const reativado = reativacoes(
          polos.filter((p) => p.reativado_por === m.id),
          periodoMesFaixa,
        ).valor;
        const realizado = ativado + reativado;
        const meta = metasDoMesFaixa.find((x) => x.usuario_id === m.id)?.valor_meta ?? 0;
        return {
          membro: m,
          realizado,
          meta,
          pct: meta > 0 ? (realizado / meta) * 100 : 0,
        };
      })
      .filter((r) => r.meta > 0 || r.realizado > 0)
      .sort((a, b) => b.pct - a.pct || b.realizado - a.realizado);
  }, [membrosAtribuiveis, escopoId, polos, periodoMesFaixa, metasDoMesFaixa]);

  const metaTime = rankingMetas.reduce((s, r) => s + r.meta, 0);

  // --- Série mensal — seção "Evolução mensal" --------------------------------
  // `meses`/as séries "Total" cobrem o histórico inteiro, sempre — é o que
  // alimenta o recorde, que não pode sumir quando alguém filtra a seção.
  // A "Janela", com o filtro próprio da seção, é o que os gráficos desenham.
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

  const serieAtivacoesTotal = useMemo(
    () =>
      serieMensal(
        meses,
        polosResp.map((p) => p.data_ativacao),
      ),
    [meses, polosResp],
  );
  const serieReativacoesTotal = useMemo(
    () =>
      serieMensal(
        meses,
        polosReat.map((p) => p.data_reativacao),
      ),
    [meses, polosReat],
  );
  const recordeAtivacoes = useMemo(() => mesRecorde(serieAtivacoesTotal), [serieAtivacoesTotal]);
  const recordeReativacoes = useMemo(
    () => mesRecorde(serieReativacoesTotal),
    [serieReativacoesTotal],
  );

  const periodoEvolucao = filtroEvolucao.periodo;
  // A janela do filtro, capada em 24 meses — senão anos de operação viram uma
  // lista de barras ilegível quando alguém escolhe "todo o período".
  const mesesJanela = useMemo(() => {
    const de = periodoEvolucao.de.slice(0, 7);
    const ate = periodoEvolucao.ate.slice(0, 7);
    return meses.filter((m) => m.id >= de && m.id <= ate).slice(-24);
  }, [meses, periodoEvolucao]);

  const serieAtivacoes = useMemo(
    () =>
      serieMensal(
        mesesJanela,
        polosResp.map((p) => p.data_ativacao),
      ),
    [mesesJanela, polosResp],
  );
  const serieReativacoes = useMemo(
    () =>
      serieMensal(
        mesesJanela,
        polosReat.map((p) => p.data_reativacao),
      ),
    [mesesJanela, polosReat],
  );
  const serieValor = useMemo(
    () =>
      serieMensalValor(
        mesesJanela,
        polosResp.map((p) => ({ data: p.data_ativacao, valor: p.valor_ativacao })),
      ),
    [mesesJanela, polosResp],
  );

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

  // Totais do bloco Expansão — sempre a empresa inteira, sem seguir o escopo,
  // mas com filtro de período próprio: "polos ativos até o fim do período" em
  // vez de "hoje". Com o preset padrão ("todo o período"), a data de corte
  // cai em hoje e o retrato é idêntico ao de antes desta seção ser filtrável.
  const periodoExpansao = filtroExpansao.periodo;
  const dataCorteExpansao = periodoExpansao.ate > hoje ? hoje : periodoExpansao.ate;
  const polosAtivos = useMemo(
    () => polos.filter((p) => ativoEm(p, dataCorteExpansao)),
    [polos, dataCorteExpansao],
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
        total: acompanhamentos.filter(
          (a) => a.etapa === etapa && dentroDoPeriodo(a.criado_em, periodoExpansao),
        ).length,
      })),
    [acompanhamentos, periodoExpansao],
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
      {/* Escopo global — o período agora é filtrado seção a seção */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!apenasMinhas ? (
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
        ) : (
          <div />
        )}
        <ReportDialog apenasMinhas={apenasMinhas} />
      </div>

      {/* 1. Resultado do mês + Meta — mês selecionável, começa no mês corrente:
          é "como estou indo agora?", e ritmo/projeção só valem dentro de um
          mês específico. */}
      <ResultadoMetaFaixa
        realizado={resultadoMesFaixa}
        variacaoPct={variacaoMesFaixaPct}
        meta={metaTime}
        ranking={rankingMetas}
        escopoId={escopoId}
        escopoLabel={escopoLabel}
        mesLabel={rotuloMes(mesFaixaKey)}
        mesFaixaKey={mesFaixaKey}
        isMesAtual={isMesFaixaAtual}
        hoje={hoje}
        onMudarMes={(delta) => {
          const [ano, mes] = mesFaixaKey.split("-").map(Number);
          const d = new Date(ano, mes - 1 + delta, 1);
          setMesFaixaKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }}
        onDefinirMetas={ir({ tipo: "metas" })}
      />

      {/* 2. Ação do dia */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Ação do dia <Selo>sempre atual</Selo>
          </h2>
          <p className="text-xs text-muted-foreground">
            O que precisa de atenção agora — sem filtro de período, é fila de trabalho, não métrica
            de intervalo
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* Expansão e funil — carteira e funil, sempre a empresa inteira */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Expansão</h2>
            <p className="text-xs text-muted-foreground">
              Carteira e funil de acompanhamento — negociações e escolas técnicas estão em Números
              do período
            </p>
          </div>
          <PeriodFilter
            preset={filtroExpansao.preset}
            onPresetChange={filtroExpansao.setPreset}
            customDe={filtroExpansao.customDe}
            customAte={filtroExpansao.customAte}
            onCustomChange={(de, ate) => {
              filtroExpansao.setCustomDe(de);
              filtroExpansao.setCustomAte(ate);
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Polos ativos" value={inteiro(polosAtivos.length)} size="sm" />
          <StatTile label="Valor em ativação" value={formatarValor(valorAtivo)} size="sm" />
        </div>

        <Card title="Funil de Acompanhamento">
          {funilRows.some((r) => r.total > 0) ? (
            <HorizontalBarChart rows={funilRows} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {acompanhamentos.length > 0 ? (
                "Nenhum cliente no funil no período selecionado."
              ) : (
                <>
                  Nenhum cliente no funil de acompanhamento ainda.
                  <button
                    type="button"
                    onClick={ir({ tipo: "acompanhamento" })}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Cadastrar acompanhamento
                  </button>
                </>
              )}
            </div>
          )}
        </Card>
      </section>

      {/* Números do período */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Números do período <Selo>{escopoLabel}</Selo>
          </h2>
          <PeriodFilter
            preset={filtroNumeros.preset}
            onPresetChange={filtroNumeros.setPreset}
            customDe={filtroNumeros.customDe}
            customAte={filtroNumeros.customAte}
            onCustomChange={(de, ate) => {
              filtroNumeros.setCustomDe(de);
              filtroNumeros.setCustomAte(ate);
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
            hint={
              ticketMedio(ativ) != null
                ? `Ticket médio: ${formatarValor(ticketMedio(ativ))}`
                : undefined
            }
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
            hint={
              ticketMedio(reat) != null
                ? `Ticket médio: ${formatarValor(ticketMedio(reat))}`
                : undefined
            }
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
            periodoLabel={filtroNumeros.preset === "todos" ? "em todo o período" : "no período"}
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

      {/* Evolução mensal */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Evolução mensal</h2>
            <p className="text-xs text-muted-foreground">
              Os gráficos seguem o filtro abaixo (até 24 meses); o recorde olha o histórico
              completo, pra não se perder quando alguém filtra
            </p>
          </div>
          <PeriodFilter
            preset={filtroEvolucao.preset}
            onPresetChange={filtroEvolucao.setPreset}
            customDe={filtroEvolucao.customDe}
            customAte={filtroEvolucao.customAte}
            onCustomChange={(de, ate) => {
              filtroEvolucao.setCustomDe(de);
              filtroEvolucao.setCustomAte(ate);
            }}
          />
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

        {mesesJanela.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum mês no período selecionado.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Ativações por mês">
              <HorizontalBarChart rows={serieAtivacoes} />
            </Card>
            <Card title="Reativações por mês">
              <HorizontalBarChart rows={serieReativacoes} />
            </Card>
            <Card title="Valor de ativação por mês">
              <HorizontalBarChart rows={serieValor} formatValue={(v) => formatarValor(v)} />
            </Card>
          </div>
        )}
      </section>

      {/* Tarefas — mantidas no fim */}
      {!apenasMinhas && (
        <Section title="Visão Geral das Tarefas" subtitle="Todas as tarefas de todos os clientes">
          <ProgressoCard data={geralStatus} />
          <PrazosCard data={geralPrazos} />
        </Section>
      )}

      {!apenasMinhas && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Produtividade</h2>
              <p className="text-xs text-muted-foreground">
                Tarefas recebidas x concluídas no período selecionado
              </p>
            </div>
            <PeriodFilter
              preset={filtroProdutividade.preset}
              onPresetChange={filtroProdutividade.setPreset}
              customDe={filtroProdutividade.customDe}
              customAte={filtroProdutividade.customAte}
              onCustomChange={(de, ate) => {
                filtroProdutividade.setCustomDe(de);
                filtroProdutividade.setCustomAte(ate);
              }}
            />
          </div>

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
                periodo={filtroProdutividade.periodo}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {membrosOrdenados.length === 0
                  ? "Nenhum membro cadastrado ainda."
                  : "Selecione um membro acima para ver o dashboard individual."}
              </div>
            )}
          </div>
        </section>
      )}
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

/** Selo de contexto no título de uma seção — se ela segue o filtro global ou não. */
function Selo({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded-full border border-border bg-muted px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

/** Seletor de mês — meta e ritmo são conceitos mensais, não fazem sentido num intervalo livre. */
function SeletorMes({
  mesLabel,
  onMudarMes,
}: {
  mesLabel: string;
  onMudarMes: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-[var(--surface-2)] p-1">
      <button
        type="button"
        onClick={() => onMudarMes(-1)}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Mês anterior"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[8.5rem] px-1 text-center text-xs font-medium capitalize text-foreground">
        {mesLabel}
      </span>
      <button
        type="button"
        onClick={() => onMudarMes(1)}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Próximo mês"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Resultado do mês + meta do time numa faixa só — as duas telas antigas
 * respondiam à mesma pergunta ("como estou indo agora?") com números
 * calculados em separado. Tem seletor de mês próprio (em vez do filtro de
 * período genérico das outras seções): ritmo e projeção só fazem sentido
 * dentro de um mês específico — a meta é mensal.
 */
function ResultadoMetaFaixa({
  realizado,
  variacaoPct,
  meta,
  ranking,
  escopoId,
  escopoLabel,
  mesLabel,
  mesFaixaKey,
  isMesAtual,
  hoje,
  onMudarMes,
  onDefinirMetas,
}: {
  realizado: number;
  variacaoPct: number | null;
  meta: number;
  ranking: {
    membro: { id: string; nome: string };
    realizado: number;
    meta: number;
    pct: number;
  }[];
  escopoId: string | null;
  escopoLabel: string;
  mesLabel: string;
  mesFaixaKey: string;
  isMesAtual: boolean;
  hoje: string;
  onMudarMes: (delta: number) => void;
  onDefinirMetas: () => void;
}) {
  const subiu = variacaoPct != null && variacaoPct >= 0;
  const falta = Math.max(meta - realizado, 0);
  const bateu = meta > 0 && realizado >= meta;
  const pct = meta > 0 ? (realizado / meta) * 100 : 0;

  const [anoFaixa, mesNumFaixa] = mesFaixaKey.split("-").map(Number);
  const diasNoMes = new Date(anoFaixa, mesNumFaixa, 0).getDate();
  // Num mês fechado, "hoje" não vale — o mês inteiro já decorreu.
  const diaAtual = isMesAtual ? Math.min(Number(hoje.slice(8, 10)), diasNoMes) : diasNoMes;
  const diasRestantes = isMesAtual ? Math.max(diasNoMes - diaAtual, 0) : 0;

  const mediaDiariaAtual = diaAtual > 0 ? realizado / diaAtual : 0;
  const mediaDiariaNecessaria = diasRestantes > 0 ? falta / diasRestantes : falta;
  const projecao = mediaDiariaAtual * diasNoMes;
  const noRitmo = bateu || mediaDiariaAtual >= mediaDiariaNecessaria;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Resultado do mês {isMesAtual && <Selo>mês atual</Selo>}
          </h2>
          <p className="text-xs text-muted-foreground">{escopoLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {meta === 0 && (
            <button
              type="button"
              onClick={onDefinirMetas}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Definir metas
            </button>
          )}
          <SeletorMes mesLabel={mesLabel} onMudarMes={onMudarMes} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3 sm:divide-x sm:divide-border">
        {/* Realizado */}
        <div className="sm:pr-6">
          <div className="text-xs text-muted-foreground">Realizado</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatarValor(realizado)}
          </div>
          <div
            className={`mt-1.5 text-xs font-medium ${
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

        {/* Meta */}
        <div className="sm:px-6">
          <div className="text-xs text-muted-foreground">Meta</div>
          {meta > 0 ? (
            <>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span
                  className={`text-2xl font-semibold tabular-nums ${bateu ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
                >
                  {percentual(pct)}
                </span>
                <span className="text-xs text-muted-foreground">de {formatarValor(meta)}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
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
              <div className="mt-1.5 text-xs text-muted-foreground">
                {bateu
                  ? "Meta batida"
                  : isMesAtual
                    ? `Faltam ${formatarValor(falta)} · ${diasRestantes} dia(s) no mês`
                    : `Faltaram ${formatarValor(falta)} — mês encerrado`}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">Nenhuma meta definida</div>
          )}
        </div>

        {/* Ritmo */}
        <div className="sm:pl-6">
          <div className="text-xs text-muted-foreground">Ritmo</div>
          {!isMesAtual ? (
            <div className="mt-1 text-sm text-muted-foreground">
              Ritmo só se aplica ao mês em andamento
            </div>
          ) : meta > 0 && !bateu ? (
            <>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span
                  className={`text-2xl font-semibold tabular-nums ${
                    noRitmo
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {formatarValor(mediaDiariaAtual)}
                </span>
                <span className="text-xs text-muted-foreground">/dia</span>
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                {diasRestantes > 0
                  ? `Precisa de ${formatarValor(mediaDiariaNecessaria)}/dia · ${noRitmo ? "no ritmo" : "abaixo do ritmo"}`
                  : "Último dia do mês"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Projeção: {formatarValor(projecao)} ao fim do mês
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">
              {bateu ? "Meta batida — sem ritmo a acompanhar" : "Defina uma meta para ver o ritmo"}
            </div>
          )}
        </div>
      </div>

      {!escopoId && ranking.length > 0 && (
        <div className="mt-6 space-y-4 border-t border-border pt-5">
          {ranking.map((r) => (
            <div key={r.membro.id}>
              <div className="mb-1.5 text-xs font-medium text-foreground">{r.membro.nome}</div>
              <MetaBarra realizado={r.realizado} meta={r.meta} />
            </div>
          ))}
        </div>
      )}
      {!escopoId && ranking.length === 0 && (
        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          Nenhum membro com meta ou resultado neste mês.
        </p>
      )}
    </section>
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
