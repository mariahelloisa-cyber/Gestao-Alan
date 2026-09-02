import { dentroDoPeriodo, type Periodo } from "./productivity";

/**
 * Contas da dashboard de Expansão.
 *
 * Módulo puro de propósito: sem React e sem data-fetching, para que cada
 * métrica possa ser conferida (e testada) isoladamente. As telas só montam a
 * UI a partir daqui.
 */

/** Situações em que o polo conta como base ativa hoje. */
export const SITUACOES_ATIVAS = ["ativo", "reativado"] as const;

/** O subconjunto de `Polo` que as métricas realmente leem. */
export interface PoloMetrica {
  id: string;
  situacao: string;
  nivel: string;
  data_ativacao: string | null;
  data_saida: string | null;
  data_reativacao: string | null;
  data_reuniao: string | null;
  enviado_comercial_em: string | null;
  valor_ativacao: number | null;
  valor_reativacao: number | null;
  responsavel_id: string | null;
  reativado_por: string | null;
}

export interface RegistroPeriodo {
  criado_em: string;
  responsavel_id: string | null;
}

/** Normaliza timestamps do banco ("2026-02-03T12:00:00Z") para "2026-02-03". */
function dia(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

// --- Ciclos de vida --------------------------------------------------------

export interface Ciclo {
  inicio: string;
  /** `null` = ciclo ainda aberto (o polo segue ativo). */
  fim: string | null;
}

/**
 * Os períodos em que o polo esteve ativo.
 *
 * O modelo guarda um único par saída/retorno (`data_saida` / `data_reativacao`),
 * então no máximo dois ciclos existem: a ativação original e a reativação. Qual
 * deles a `data_saida` fecha depende de ela ser anterior ou posterior à
 * reativação — sem essa distinção, todo polo reativado sumiria dos meses
 * seguintes à sua saída antiga, mesmo estando ativo.
 *
 * Limitação conhecida: se um polo desligar e reativar mais de uma vez, o banco
 * sobrescreve o par e os ciclos intermediários se perdem.
 */
export function ciclosAtivos(p: PoloMetrica): Ciclo[] {
  const ativacao = dia(p.data_ativacao);
  const saida = dia(p.data_saida);
  const reativacao = dia(p.data_reativacao);
  const ciclos: Ciclo[] = [];

  if (ativacao) {
    // A saída fecha o primeiro ciclo apenas se veio antes da reativação;
    // caso contrário ela pertence ao segundo, e a reativação encerra este.
    const fim = saida && (!reativacao || saida <= reativacao) ? saida : (reativacao ?? saida);
    ciclos.push({ inicio: ativacao, fim: fim ?? null });
  }

  if (reativacao) {
    const fim = saida && saida > reativacao ? saida : null;
    ciclos.push({ inicio: reativacao, fim });
  }

  return ciclos;
}

/** O polo esteve ativo em algum momento dentro do intervalo? */
export function esteveAtivoNoPeriodo(p: PoloMetrica, periodo: Periodo): boolean {
  return ciclosAtivos(p).some((c) => c.inicio <= periodo.ate && (!c.fim || c.fim >= periodo.de));
}

/** O polo estava ativo numa data específica? */
export function ativoEm(p: PoloMetrica, data: string): boolean {
  return ciclosAtivos(p).some((c) => c.inicio <= data && (!c.fim || c.fim >= data));
}

export interface ComposicaoBase {
  /** Esteve ativo em algum momento do período — inclui quem saiu no meio. */
  total: number;
  /** Já estava ativo antes do início do período. */
  jaVinham: number;
  /** Começou um ciclo dentro do período (ativação ou reativação). */
  entraram: number;
  /** Encerrou um ciclo dentro do período. */
  sairam: number;
  /** Ainda ativos na data final do período. */
  aoFim: number;
  /** Situação ativa mas sem `data_ativacao` — invisíveis a qualquer corte por data. */
  semData: number;
}

/**
 * Decompõe a base ativa do período.
 *
 * "Ativos em fevereiro" é estoque, não fluxo: um polo ativado em 2023 e ainda
 * ativo entra em `total` mas nunca em `entraram`.
 */
export function composicaoBase(polos: PoloMetrica[], periodo: Periodo): ComposicaoBase {
  let total = 0;
  let entraram = 0;
  let sairam = 0;
  let aoFim = 0;

  for (const p of polos) {
    const ciclos = ciclosAtivos(p);
    const noPeriodo = ciclos.filter(
      (c) => c.inicio <= periodo.ate && (!c.fim || c.fim >= periodo.de),
    );
    if (noPeriodo.length === 0) continue;

    total++;
    if (noPeriodo.some((c) => c.inicio >= periodo.de)) entraram++;
    if (noPeriodo.some((c) => c.fim && c.fim <= periodo.ate)) sairam++;
    if (noPeriodo.some((c) => !c.fim || c.fim >= periodo.ate)) aoFim++;
  }

  const semData = polos.filter(
    (p) => SITUACOES_ATIVAS.includes(p.situacao as never) && !p.data_ativacao,
  ).length;

  return { total, jaVinham: total - entraram, entraram, sairam, aoFim, semData };
}

// --- Coorte de fechamento --------------------------------------------------

export interface Coorte {
  /** Reuniões cuja data caiu no período e já passou. */
  realizadas: number;
  /** Dessas, quantas viraram polo ativo. */
  fechadas: number;
  /** Ainda em aberto (seguem na etapa de reunião). */
  emAberto: number;
  /** Foram para Inativos sem fechar. */
  perdidas: number;
  /** 0–100. */
  pct: number;
}

/**
 * Taxa de fechamento por coorte: das reuniões *realizadas* no período, quantas
 * fecharam — mesmo que o fechamento tenha ocorrido depois.
 *
 * Medir "ativações do mês ÷ reuniões do mês" distorceria os dois meses sempre
 * que a reunião e o fechamento caíssem em meses diferentes.
 *
 * Uma reunião conta como fechada quando o polo tem `data_ativacao`: o campo é
 * gravado no fechamento e sobrevive a um desligamento posterior.
 */
export function coorteFechamento(polos: PoloMetrica[], periodo: Periodo, hoje: string): Coorte {
  const realizadas = polos.filter((p) => {
    const d = dia(p.data_reuniao);
    return !!d && d <= hoje && dentroDoPeriodo(d, periodo);
  });

  const fechadas = realizadas.filter((p) => !!p.data_ativacao).length;
  const perdidas = realizadas.filter((p) => !p.data_ativacao && p.situacao === "inativo").length;
  const emAberto = realizadas.filter((p) => !p.data_ativacao && p.situacao === "reuniao").length;

  return {
    realizadas: realizadas.length,
    fechadas,
    emAberto,
    perdidas,
    pct: realizadas.length > 0 ? (fechadas / realizadas.length) * 100 : 0,
  };
}

// --- Escopo (minha visão / time / membro) ----------------------------------

/**
 * A quem cada métrica pertence.
 *
 * Ativação, reunião e envio ao comercial seguem `responsavel_id`; reativação
 * tem dono próprio (`reativado_por`), porque quem traz o polo de volta
 * costuma não ser quem o ativou originalmente.
 */
export function filtrarPorEscopo<T extends { responsavel_id: string | null }>(
  itens: T[],
  membroId: string | null,
): T[] {
  if (!membroId) return itens;
  return itens.filter((i) => i.responsavel_id === membroId);
}

export function filtrarReativacoesPorEscopo<T extends { reativado_por: string | null }>(
  polos: T[],
  membroId: string | null,
): T[] {
  if (!membroId) return polos;
  return polos.filter((p) => p.reativado_por === membroId);
}

// --- Agregações por período ------------------------------------------------

export interface Movimento {
  /** Total de eventos no período. */
  quantidade: number;
  /** Soma dos valores associados. */
  valor: number;
}

/** Conta eventos e soma valores de uma data-campo dentro do período. */
export function movimento(
  itens: { data: string | null; valor: number | null }[],
  periodo: Periodo,
): Movimento {
  let quantidade = 0;
  let valor = 0;
  for (const item of itens) {
    if (!dentroDoPeriodo(dia(item.data), periodo)) continue;
    quantidade++;
    valor += item.valor ?? 0;
  }
  return { quantidade, valor };
}

export function ativacoes(polos: PoloMetrica[], periodo: Periodo): Movimento {
  return movimento(
    polos.map((p) => ({ data: p.data_ativacao, valor: p.valor_ativacao })),
    periodo,
  );
}

export function reativacoes(polos: PoloMetrica[], periodo: Periodo): Movimento {
  return movimento(
    polos.map((p) => ({ data: p.data_reativacao, valor: p.valor_reativacao })),
    periodo,
  );
}

/** Ticket médio — `null` quando não houve evento, para a tela mostrar "—". */
export function ticketMedio(m: Movimento): number | null {
  return m.quantidade > 0 ? m.valor / m.quantidade : null;
}

// --- Série mensal ----------------------------------------------------------

/**
 * Um mês da série.
 *
 * `id`/`nome` em vez de `key`/`label` para o ponto servir direto como linha do
 * `HorizontalBarChart`, sem uma camada de conversão só para renomear campos.
 */
export interface PontoMensal {
  /** "YYYY-MM". */
  id: string;
  /** "fev 26". */
  nome: string;
  total: number;
}

export type Mes = Omit<PontoMensal, "total">;

export function mesesEntre(de: string, ate: string): Mes[] {
  const [deAno, deMes] = de.split("-").map(Number);
  const [ateAno, ateMes] = ate.split("-").map(Number);
  const out: Mes[] = [];
  const cursor = new Date(deAno, deMes - 1, 1);
  const fim = new Date(ateAno, ateMes - 1, 1);
  if (cursor > fim) return out;
  while (cursor <= fim) {
    const id = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const nome = cursor
      .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
      .replace(".", "");
    out.push({ id, nome });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** Conta ocorrências de uma data-campo por mês. */
export function serieMensal(meses: Mes[], datas: (string | null)[]): PontoMensal[] {
  const porMes = new Map<string, number>();
  for (const d of datas) {
    if (!d) continue;
    const k = d.slice(0, 7);
    porMes.set(k, (porMes.get(k) ?? 0) + 1);
  }
  return meses.map((m) => ({ ...m, total: porMes.get(m.id) ?? 0 }));
}

/** Soma valores por mês. */
export function serieMensalValor(
  meses: Mes[],
  itens: { data: string | null; valor: number | null }[],
): PontoMensal[] {
  const porMes = new Map<string, number>();
  for (const { data, valor } of itens) {
    if (!data) continue;
    const k = data.slice(0, 7);
    porMes.set(k, (porMes.get(k) ?? 0) + (valor ?? 0));
  }
  return meses.map((m) => ({ ...m, total: porMes.get(m.id) ?? 0 }));
}

/** Base ativa ao fim de cada mês — a curva de crescimento da carteira. */
export function serieBaseAtiva(meses: Mes[], polos: PoloMetrica[]): PontoMensal[] {
  return meses.map((m) => {
    const [ano, mes] = m.id.split("-").map(Number);
    const ultimoDia = new Date(ano, mes, 0);
    const data = `${m.id}-${String(ultimoDia.getDate()).padStart(2, "0")}`;
    return { ...m, total: polos.filter((p) => ativoEm(p, data)).length };
  });
}

/** O mês de maior valor da série. `null` se a série for toda zero. */
export function mesRecorde(serie: PontoMensal[]): PontoMensal | null {
  let melhor: PontoMensal | null = null;
  for (const p of serie) {
    if (p.total > 0 && (!melhor || p.total > melhor.total)) melhor = p;
  }
  return melhor;
}

// --- Registros simples (negociações, escolas) ------------------------------

export function contarNoPeriodo(itens: RegistroPeriodo[], periodo: Periodo): number {
  return itens.filter((i) => dentroDoPeriodo(dia(i.criado_em), periodo)).length;
}
