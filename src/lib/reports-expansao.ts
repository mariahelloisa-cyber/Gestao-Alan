import { jsPDF } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import type { Tarefa } from "./mock-data";
import type { Periodo } from "./productivity";
import { calcPrazos, dentroDoPeriodo } from "./productivity";
import { desenharBlocoPrazos, desenharTabelaTarefas } from "./reports";
import {
  ativacoes,
  atividadeLeads,
  composicaoBase,
  coorteFechamento,
  esteveAtivoNoPeriodo,
  filtrarPorEscopo,
  filtrarReativacoesPorEscopo,
  mesesEntre,
  reativacoes,
  serieBaseAtiva,
  serieMensal,
  serieMensalValor,
  ticketMedio,
  type PoloMetrica,
} from "./dashboard-metrics";

/**
 * Relatório executivo de Expansão em PDF.
 *
 * As métricas vêm das mesmas funções que a dashboard usa (`dashboard-metrics`),
 * de propósito: um relatório com contas próprias divergiria da tela na primeira
 * mudança de regra, e ninguém saberia qual dos dois está certo. Este módulo
 * cuida só de composição visual — nenhum número aqui é calculado de outro jeito
 * do que na tela.
 */

export type SecaoRelatorio =
  | "resumo"
  | "metas"
  | "ligacoes"
  | "reunioes"
  | "ativacoes"
  | "reativacoes"
  | "base"
  | "comercial"
  | "negociacoes"
  | "escolas"
  | "funil"
  | "evolucao"
  | "tarefas";

export const SECOES: { id: SecaoRelatorio; label: string; descricao: string }[] = [
  { id: "resumo", label: "Resumo do período", descricao: "Indicadores-chave em números" },
  { id: "metas", label: "Meta x realizado", descricao: "Desempenho da meta por membro" },
  {
    id: "ligacoes",
    label: "Ligações e reuniões",
    descricao: "Ligou, marcou e fechou, por membro",
  },
  { id: "reunioes", label: "Reuniões realizadas", descricao: "Com o desfecho de cada uma" },
  { id: "ativacoes", label: "Ativações", descricao: "Novos polos no período" },
  { id: "reativacoes", label: "Reativações", descricao: "Polos reativados no período" },
  { id: "base", label: "Polos ativos no período", descricao: "A carteira e sua composição" },
  { id: "comercial", label: "Enviados ao comercial", descricao: "Polos repassados no período" },
  { id: "negociacoes", label: "Negociações", descricao: "Cadastradas no período" },
  { id: "escolas", label: "Escolas técnicas", descricao: "Cadastradas no período" },
  { id: "funil", label: "Funil de acompanhamento", descricao: "Distribuição por etapa" },
  { id: "evolucao", label: "Evolução mensal", descricao: "Histórico mês a mês" },
  { id: "tarefas", label: "Tarefas", descricao: "Lista e distribuição de prazos" },
];

export type PresetRelatorio = "executivo" | "comercial" | "operacional" | "personalizado";

export const PRESETS_RELATORIO: { id: PresetRelatorio; label: string; secoes: SecaoRelatorio[] }[] =
  [
    {
      id: "executivo",
      label: "Executivo",
      secoes: ["resumo", "metas", "ligacoes", "ativacoes", "reativacoes", "base", "evolucao"],
    },
    {
      id: "comercial",
      label: "Comercial",
      secoes: [
        "resumo",
        "ligacoes",
        "reunioes",
        "comercial",
        "negociacoes",
        "escolas",
        "funil",
        "tarefas",
      ],
    },
    {
      id: "operacional",
      label: "Operacional",
      secoes: ["resumo", "ligacoes", "reunioes", "ativacoes", "reativacoes", "base", "tarefas"],
    },
    { id: "personalizado", label: "Personalizado", secoes: [] },
  ];

// --- Formato dos dados de entrada ------------------------------------------

export interface PoloRelatorio extends PoloMetrica {
  nome: string;
  produto: string | null;
  contato: string | null;
  faturamento: number | null;
  horario_reuniao: string | null;
  motivo_saida: string | null;
}

export interface NegociacaoRelatorio {
  nome: string;
  contato: string | null;
  email: string | null;
  numero_funcionarios: number | null;
  responsavel_id: string | null;
  criado_em: string;
}

export interface EscolaRelatorio {
  nome: string;
  contato: string | null;
  estado: string | null;
  cidade: string | null;
  cursos: string[] | null;
  responsavel_id: string | null;
  criado_em: string;
}

export interface AcompanhamentoRelatorio {
  etapa: string;
  criado_em: string;
}

export interface MetaRelatorio {
  usuario_id: string;
  periodo: string;
  valor_meta: number;
  meta_ligacoes_dia: number;
  meta_reunioes_dia: number;
}

export interface LeadRelatorio {
  data_ligacao: string;
  responsavel_id: string | null;
  reuniao_marcada: boolean;
  reuniao_marcada_em: string | null;
}

export interface DadosRelatorio {
  polos: PoloRelatorio[];
  negociacoes: NegociacaoRelatorio[];
  escolas: EscolaRelatorio[];
  acompanhamentos: AcompanhamentoRelatorio[];
  metas: MetaRelatorio[];
  leads: LeadRelatorio[];
  tarefas: Tarefa[];
  // Cargo entra só para a seção de Ligações e reuniões: é trabalho de
  // Membro — o Supervisor conduz a reunião, não liga.
  membros: { id: string; nome: string; cargo?: string }[];
}

export interface OpcoesRelatorio {
  periodo: Periodo;
  periodoLabel: string;
  /** `null` = time inteiro. */
  escopoId: string | null;
  escopoLabel: string;
  secoes: SecaoRelatorio[];
  hoje: string;
}

const ETAPA_LABEL: Record<string, string> = {
  mapeamento: "Mapeamento",
  primeiro_contato: "Primeiro Contato",
  qualificacao: "Qualificação",
  reuniao: "Reunião",
  proposta_comercial: "Proposta Comercial",
};
const ETAPA_ORDEM = Object.keys(ETAPA_LABEL);

const SITUACAO_LABEL: Record<string, string> = {
  ativo: "Ativo",
  reativado: "Reativado",
  desligado: "Desligado",
  reuniao: "Em reunião",
  inativo: "Inativo",
};

const SITUACAO_COR: Record<string, [number, number, number]> = {
  ativo: [16, 185, 129],
  reativado: [16, 185, 129],
  reuniao: [217, 119, 6],
  desligado: [148, 163, 184],
  inativo: [239, 68, 68],
};

const DESFECHO_COR: Record<string, [number, number, number]> = {
  Fechou: [16, 185, 129],
  Perdida: [239, 68, 68],
  "Em aberto": [217, 119, 6],
};

function corPorLabelSituacao(labelExibido: string): [number, number, number] | undefined {
  const chave = Object.entries(SITUACAO_LABEL).find(([, l]) => l === labelExibido)?.[0];
  return chave ? SITUACAO_COR[chave] : undefined;
}

// --- Identidade visual --------------------------------------------------

const BRAND: [number, number, number] = [123, 104, 238];
const BRAND_DARK: [number, number, number] = [76, 58, 194];
const TEXT_DARK: [number, number, number] = [24, 24, 27];
const TEXT_MUTED: [number, number, number] = [113, 113, 122];
const TEXT_FAINT: [number, number, number] = [161, 161, 170];
const SURFACE: [number, number, number] = [248, 248, 251];
const BORDER: [number, number, number] = [228, 228, 235];
const SUCCESS: [number, number, number] = [16, 185, 129];
const WARNING: [number, number, number] = [217, 119, 6];

// --- Formatação -------------------------------------------------------------

function moeda(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function data(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function pct(v: number): string {
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function rotuloMes(key: string): string {
  const [ano, mes] = key.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// --- Cursor de desenho ------------------------------------------------------

interface Cursor {
  doc: jsPDF;
  y: number;
  opts: OpcoesRelatorio;
}

const MARGEM = 14;
const RODAPE = 14;
/** Altura reservada no topo das páginas internas para o cabeçalho discreto. */
const HEADER_INTERNO_Y = 27;

function larguraPagina(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}
function alturaPagina(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight();
}

/** Cabeçalho discreto repetido em toda página interna (a partir da 2ª). */
function desenharHeaderInterno(doc: jsPDF, opts: OpcoesRelatorio) {
  const w = larguraPagina(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_DARK);
  doc.text("Sistema Expansão", MARGEM, 11.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_FAINT);
  doc.text("Relatório de Expansão", MARGEM, 16);

  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`${opts.periodoLabel}  ·  ${opts.escopoLabel}`, w - MARGEM, 13.5, { align: "right" });

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.line(MARGEM, 20, w - MARGEM, 20);
}

/** Abre página nova (com cabeçalho já desenhado) se não couber `altura` no que resta da atual. */
function garantirEspaco(c: Cursor, altura: number) {
  if (c.y + altura > alturaPagina(c.doc) - RODAPE) {
    c.doc.addPage();
    desenharHeaderInterno(c.doc, c.opts);
    c.y = HEADER_INTERNO_Y;
  }
}

function tituloSecao(c: Cursor, texto: string, subtitulo?: string) {
  garantirEspaco(c, subtitulo ? 22 : 16);
  c.doc.setFillColor(...BRAND);
  c.doc.roundedRect(MARGEM, c.y - 4, 1.4, 6.5, 0.7, 0.7, "F");
  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(12.5);
  c.doc.setTextColor(...TEXT_DARK);
  c.doc.text(texto, MARGEM + 4.5, c.y);
  c.y += 5;
  if (subtitulo) {
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(8);
    c.doc.setTextColor(...TEXT_MUTED);
    c.doc.text(subtitulo, MARGEM + 4.5, c.y);
    c.y += 4;
  }
  c.y += 2.5;
}

/** Caixa compacta e elegante para "sem registros" — evita tabelas vazias. */
function estadoVazio(c: Cursor, detalhe: string, titulo = "Nenhum registro encontrado") {
  const h = 20;
  garantirEspaco(c, h);
  const w = larguraPagina(c.doc) - MARGEM * 2;
  c.doc.setDrawColor(...BORDER);
  c.doc.setLineWidth(0.4);
  c.doc.roundedRect(MARGEM, c.y, w, h, 2, 2, "S");
  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(9);
  c.doc.setTextColor(...TEXT_MUTED);
  c.doc.text(titulo, larguraPagina(c.doc) / 2, c.y + 8.5, { align: "center" });
  c.doc.setFont("helvetica", "normal");
  c.doc.setFontSize(7.5);
  c.doc.setTextColor(...TEXT_FAINT);
  c.doc.text(detalhe, larguraPagina(c.doc) / 2, c.y + 14, { align: "center", maxWidth: w - 30 });
  c.y += h + 8;
}

/** Pill colorido centrado num ponto — usado para desfecho/situação nas tabelas. */
function desenharPill(
  doc: jsPDF,
  texto: string,
  cor: [number, number, number],
  cx: number,
  cy: number,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  const t = texto.toUpperCase();
  const larguraTexto = doc.getTextWidth(t);
  const padX = 1.6;
  const w = larguraTexto + padX * 2;
  const h = 3.8;
  doc.setDrawColor(...cor);
  doc.setLineWidth(0.3);
  doc.roundedRect(cx - w / 2, cy - h / 2, w, h, h / 2, h / 2, "S");
  doc.setTextColor(...cor);
  doc.text(t, cx, cy, { align: "center", baseline: "middle" });
}

/** Tabela padronizada (estilo, cores, banding) com estado vazio elegante embutido. */
function tabela(
  c: Cursor,
  head: string[],
  body: (string | number)[][],
  opts?: {
    vazio?: string;
    pillCol?: number;
    pillCor?: (v: string) => [number, number, number] | undefined;
    /** Callback extra por célula do corpo — usado para desenhar barras embutidas (ex.: progresso de meta). */
    celula?: (d: CellHookData) => void;
  },
) {
  if (body.length === 0) {
    estadoVazio(c, opts?.vazio ?? "Não houve registros desta categoria no período selecionado.");
    return;
  }

  const pillCol = opts?.pillCol;

  autoTable(c.doc, {
    startY: c.y,
    head: [head],
    body,
    styles: {
      fontSize: 8.2,
      cellPadding: 2.6,
      lineColor: BORDER,
      lineWidth: 0.2,
      textColor: TEXT_DARK,
    },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", fontSize: 7.8 },
    alternateRowStyles: { fillColor: SURFACE },
    margin: { left: MARGEM, right: MARGEM, top: HEADER_INTERNO_Y },
    didDrawPage: (hook) => {
      // Chamado toda vez que o autoTable quebra a tabela para uma nova
      // página por conta própria (pagina longa) — redesenha o cabeçalho
      // discreto nela. Na primeira página o cabeçalho já veio de fora.
      if (hook.pageNumber > 1) desenharHeaderInterno(c.doc, c.opts);
    },
    didParseCell: (d) => {
      if (d.section !== "body" || pillCol == null || d.column.index !== pillCol) return;
      d.cell.text = [];
    },
    didDrawCell: (d) => {
      if (d.section === "body" && pillCol != null && d.column.index === pillCol) {
        const valor = String(d.cell.raw ?? "");
        const cor = opts?.pillCor?.(valor);
        if (cor) {
          desenharPill(
            c.doc,
            valor,
            cor,
            d.cell.x + d.cell.width / 2,
            d.cell.y + d.cell.height / 2,
          );
        }
      }
      opts?.celula?.(d);
    },
  });

  c.y = (c.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
}

/** Grade de KPIs em cartões — rótulo pequeno, valor grande, nota opcional. */
function kpis(c: Cursor, itens: { label: string; valor: string; nota?: string }[], cols = 4) {
  const gap = 3.5;
  const largura = (larguraPagina(c.doc) - MARGEM * 2 - gap * (cols - 1)) / cols;
  const alturaCard = 21;
  const linhas = Math.ceil(itens.length / cols);
  garantirEspaco(c, linhas * (alturaCard + gap));

  itens.forEach((item, i) => {
    const col = i % cols;
    const linha = Math.floor(i / cols);
    const x = MARGEM + col * (largura + gap);
    const y = c.y + linha * (alturaCard + gap);

    c.doc.setFillColor(...SURFACE);
    c.doc.roundedRect(x, y, largura, alturaCard, 2, 2, "F");
    c.doc.setFillColor(...BRAND);
    c.doc.roundedRect(x, y, 1.2, alturaCard, 0.6, 0.6, "F");

    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(6.6);
    c.doc.setTextColor(...TEXT_MUTED);
    c.doc.text(item.label.toUpperCase(), x + 4.5, y + 6.5, { maxWidth: largura - 7 });

    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(12.5);
    c.doc.setTextColor(...TEXT_DARK);
    c.doc.text(item.valor, x + 4.5, y + 14);

    if (item.nota) {
      c.doc.setFont("helvetica", "normal");
      c.doc.setFontSize(6.2);
      c.doc.setTextColor(...TEXT_FAINT);
      c.doc.text(item.nota, x + 4.5, y + 18.3, { maxWidth: largura - 7 });
    }
  });

  c.y += linhas * (alturaCard + gap) + 3;
}

/** Barra de progresso horizontal simples — usada no destaque de meta. */
function barraProgresso(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  pctValor: number,
  cor: [number, number, number],
) {
  doc.setFillColor(235, 235, 240);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  const larguraPreenchida = Math.max(0, Math.min(pctValor, 100) / 100) * w;
  if (larguraPreenchida > h) {
    doc.setFillColor(...cor);
    doc.roundedRect(x, y, larguraPreenchida, h, h / 2, h / 2, "F");
  }
}

/** Lista de barras horizontais rotuladas — para funil e outras distribuições pequenas e limitadas. */
function barrasHorizontais(
  c: Cursor,
  itens: { label: string; valor: number; display: string }[],
  cor: [number, number, number] = BRAND,
) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const alturaBarra = 5.5;
  const gap = 4.5;
  const labelW = 42;
  const w = larguraPagina(c.doc) - MARGEM * 2 - labelW - 20;
  const alturaTotal = itens.length * (alturaBarra + gap);
  garantirEspaco(c, alturaTotal + 4);

  itens.forEach((item, i) => {
    const y = c.y + i * (alturaBarra + gap);
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(7.6);
    c.doc.setTextColor(...TEXT_MUTED);
    c.doc.text(item.label, MARGEM, y + alturaBarra / 2, {
      baseline: "middle",
      maxWidth: labelW - 3,
    });

    c.doc.setFillColor(238, 238, 244);
    c.doc.roundedRect(MARGEM + labelW, y, w, alturaBarra, 1, 1, "F");
    const larguraPreenchida = item.valor > 0 ? Math.max(2.5, (item.valor / max) * w) : 0;
    if (larguraPreenchida > 0) {
      c.doc.setFillColor(...cor);
      c.doc.roundedRect(MARGEM + labelW, y, larguraPreenchida, alturaBarra, 1, 1, "F");
    }

    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(7.6);
    c.doc.setTextColor(...TEXT_DARK);
    c.doc.text(item.display, MARGEM + labelW + w + 3, y + alturaBarra / 2, { baseline: "middle" });
  });

  c.y += alturaTotal + 7;
}

/** Barra horizontal em miniatura desenhada dentro de uma célula do autoTable. */
function barraNaCelula(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  valor: number,
  max: number,
  cor: [number, number, number],
  rotulo: string | null = String(valor),
) {
  const barraW = rotulo ? w * 0.55 : w;
  const barraH = Math.min(2.6, h * 0.35);
  const barraY = y + h / 2 - barraH / 2;
  doc.setFillColor(238, 238, 244);
  doc.roundedRect(x, barraY, barraW, barraH, barraH / 2, barraH / 2, "F");
  const preenchido = valor > 0 && max > 0 ? Math.max(1.2, (valor / max) * barraW) : 0;
  if (preenchido > 0) {
    doc.setFillColor(...cor);
    doc.roundedRect(x, barraY, preenchido, barraH, barraH / 2, barraH / 2, "F");
  }
  if (rotulo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_DARK);
    doc.text(rotulo, x + barraW + 2.5, y + h / 2, { baseline: "middle" });
  }
}

// --- Geração ----------------------------------------------------------------

export function gerarRelatorioExpansaoPDF(dados: DadosRelatorio, opts: OpcoesRelatorio) {
  const { periodo, escopoId, secoes, hoje } = opts;
  const doc = new jsPDF({ orientation: "landscape" });
  const c: Cursor = { doc, y: 0, opts };
  const w = larguraPagina(doc);

  const nomeMembro = (id: string | null) =>
    id ? (dados.membros.find((m) => m.id === id)?.nome ?? "—") : "—";

  // Recortes por escopo, iguais aos da dashboard.
  const polosResp = filtrarPorEscopo(dados.polos, escopoId);
  const polosReat = filtrarReativacoesPorEscopo(dados.polos, escopoId);
  const negociacoes = filtrarPorEscopo(dados.negociacoes, escopoId);
  const escolas = filtrarPorEscopo(dados.escolas, escopoId);
  const leadsResp = filtrarPorEscopo(dados.leads, escopoId);

  const ativ = ativacoes(polosResp, periodo);
  const reat = reativacoes(polosReat, periodo);
  const coorte = coorteFechamento(polosResp, periodo, hoje);
  const base = composicaoBase(polosResp, periodo);

  // --- Capa / cabeçalho principal ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("SISTEMA EXPANSÃO", MARGEM, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...TEXT_DARK);
  doc.text("Relatório de Expansão", MARGEM, 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_FAINT);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, w - MARGEM, 18, { align: "right" });

  // Chips de Período / Visão
  const chipY = 36;
  const chipH = 14;
  const chipW = (w - MARGEM * 2 - 6) / 2;
  [
    { label: "PERÍODO", valor: opts.periodoLabel },
    { label: "VISÃO", valor: opts.escopoLabel },
  ].forEach((chip, i) => {
    const x = MARGEM + i * (chipW + 6);
    doc.setFillColor(...SURFACE);
    doc.roundedRect(x, chipY, chipW, chipH, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(chip.label, x + 5, chipY + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(chip.valor, x + 5, chipY + 11);
  });

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.line(MARGEM, 56, w - MARGEM, 56);

  c.y = 66;

  const inclui = (s: SecaoRelatorio) => secoes.includes(s);

  // --- Resumo ---
  if (inclui("resumo")) {
    tituloSecao(c, "Resumo do período", "Todos os indicadores em números");
    kpis(c, [
      {
        label: "Reuniões realizadas",
        valor: String(coorte.realizadas),
        nota: coorte.emAberto > 0 ? `${coorte.emAberto} em aberto` : undefined,
      },
      { label: "Ativações", valor: String(ativ.quantidade) },
      {
        label: "Taxa de fechamento",
        valor: coorte.realizadas > 0 ? pct(coorte.pct) : "—",
        nota: coorte.realizadas > 0 ? `${coorte.fechadas} de ${coorte.realizadas}` : undefined,
      },
      { label: "Valor de ativação", valor: moeda(ativ.valor) },
      { label: "Reativações", valor: String(reat.quantidade) },
      { label: "Valor de reativação", valor: moeda(reat.valor) },
      { label: "Ticket médio de ativação", valor: moeda(ticketMedio(ativ)) },
      { label: "Ticket médio de reativação", valor: moeda(ticketMedio(reat)) },
      {
        label: "Polos ativos no período",
        valor: String(base.total),
        nota: `${base.aoFim} ao fim do período`,
      },
      {
        label: "Enviados ao comercial",
        valor: String(
          polosResp.filter((p) => dentroDoPeriodo(p.enviado_comercial_em, periodo)).length,
        ),
      },
      {
        label: "Negociações",
        valor: String(negociacoes.filter((n) => dentroDoPeriodo(n.criado_em, periodo)).length),
      },
      {
        label: "Escolas técnicas",
        valor: String(escolas.filter((e) => dentroDoPeriodo(e.criado_em, periodo)).length),
      },
    ]);
  }

  // --- Meta x realizado ---
  if (inclui("metas")) {
    const mesMeta = periodo.ate === "9999-12-31" ? hoje.slice(0, 7) : periodo.ate.slice(0, 7);
    const [ano, mes] = mesMeta.split("-").map(Number);
    const ultimo = new Date(ano, mes, 0).getDate();
    const periodoMeta: Periodo = {
      de: `${mesMeta}-01`,
      ate: `${mesMeta}-${String(ultimo).padStart(2, "0")}`,
    };
    const metasDoMes = dados.metas.filter((m) => m.periodo === mesMeta);
    const alvo = escopoId ? dados.membros.filter((m) => m.id === escopoId) : dados.membros;

    const linhas = alvo
      .map((m) => {
        // Realizado = ativação + reativação, a mesma regra da dashboard.
        const realizado =
          ativacoes(
            dados.polos.filter((p) => p.responsavel_id === m.id),
            periodoMeta,
          ).valor +
          reativacoes(
            dados.polos.filter((p) => p.reativado_por === m.id),
            periodoMeta,
          ).valor;
        const meta = metasDoMes.find((x) => x.usuario_id === m.id)?.valor_meta ?? 0;
        return { nome: m.nome, meta, realizado, pct: meta > 0 ? (realizado / meta) * 100 : 0 };
      })
      .filter((r) => r.meta > 0 || r.realizado > 0)
      .sort((a, b) => b.pct - a.pct || b.realizado - a.realizado);

    const totalMeta = linhas.reduce((s, r) => s + r.meta, 0);
    const totalReal = linhas.reduce((s, r) => s + r.realizado, 0);
    const totalPct = totalMeta > 0 ? (totalReal / totalMeta) * 100 : 0;

    tituloSecao(
      c,
      `Meta x realizado — ${rotuloMes(mesMeta)}`,
      "Realizado soma valor de ativação e de reativação no mês",
    );

    if (totalMeta > 0) {
      garantirEspaco(c, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_MUTED);
      doc.text("META DO PERÍODO", MARGEM, c.y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...TEXT_DARK);
      doc.text(moeda(totalMeta), MARGEM, c.y + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(
        `Realizado: ${moeda(totalReal)}   ·   ${pct(totalPct)} atingido`,
        MARGEM + 62,
        c.y + 7,
      );
      barraProgresso(
        doc,
        MARGEM,
        c.y + 11,
        w - MARGEM * 2,
        3,
        totalPct,
        totalPct >= 100 ? SUCCESS : BRAND,
      );
      c.y += 20;
    }

    tabela(
      c,
      ["Membro", "Meta", "Realizado", "% da meta", "Progresso", "Falta"],
      [
        ...linhas.map((r) => [
          r.nome,
          r.meta > 0 ? moeda(r.meta) : "Sem meta",
          moeda(r.realizado),
          r.meta > 0 ? pct(r.pct) : "—",
          "",
          r.meta > 0 ? moeda(Math.max(r.meta - r.realizado, 0)) : "—",
        ]),
        ...(linhas.length > 0
          ? [
              [
                "TOTAL",
                moeda(totalMeta),
                moeda(totalReal),
                totalMeta > 0 ? pct(totalPct) : "—",
                "",
                totalMeta > 0 ? moeda(Math.max(totalMeta - totalReal, 0)) : "—",
              ],
            ]
          : []),
      ],
      {
        vazio: "Nenhum membro com meta ou resultado neste mês.",
        celula: (d) => {
          if (d.section !== "body" || d.column.index !== 4) return;
          const isTotal = d.row.index === linhas.length;
          const linha = isTotal ? { meta: totalMeta, pct: totalPct } : linhas[d.row.index];
          if (!linha || linha.meta <= 0) return;
          barraNaCelula(
            doc,
            d.cell.x + 1.5,
            d.cell.y,
            d.cell.width - 3,
            d.cell.height,
            Math.round(Math.min(linha.pct, 100)),
            100,
            linha.pct >= 100 ? SUCCESS : BRAND,
            null,
          );
        },
      },
    );
  }

  // --- Ligações e reuniões ---
  if (inclui("ligacoes")) {
    // Mesmo mês de referência que a seção "Meta x realizado": o preset "todo o
    // período" cai em "hoje", senão o mês de referência ficaria indefinido.
    const mesMetaLig = periodo.ate === "9999-12-31" ? hoje.slice(0, 7) : periodo.ate.slice(0, 7);
    const metasDoMesLig = dados.metas.filter((m) => m.periodo === mesMetaLig);

    // Ligações e reuniões marcadas são métricas do Lead (coorte da própria
    // ação); "fecharam" não é — é a mesma conta da seção "Meta x realizado"
    // e do resumo: polos que estavam em reunião e viraram ativação, tenham
    // vindo de um Lead ou não. Medir o fechamento pela data de marcação do
    // Lead faria a mesma reunião fechar aqui e não nas outras seções, sempre
    // que a reunião acontecesse num mês diferente do da marcação.
    const funilTotal = atividadeLeads(leadsResp, periodo);
    const coorteLig = coorteFechamento(polosResp, periodo, hoje);

    // Ligar é trabalho de Membro — o Supervisor conduz a reunião e não tem
    // meta de ligação, então nem ele nem o Admin (já fora de `dados.membros`)
    // entram nesta lista.
    const alvoLig = (escopoId ? dados.membros.filter((m) => m.id === escopoId) : dados.membros)
      .filter((m) => m.cargo === "Membro")
      .map((m) => {
        const leadsDoMembro = leadsResp.filter((l) => l.responsavel_id === m.id);
        const funil = atividadeLeads(leadsDoMembro, periodo);
        const polosDoMembro = dados.polos.filter((p) => p.responsavel_id === m.id);
        const coorte = coorteFechamento(polosDoMembro, periodo, hoje);
        const metaDoMembro = metasDoMesLig.find((x) => x.usuario_id === m.id);
        return {
          nome: m.nome,
          metaLigacoesDia: metaDoMembro?.meta_ligacoes_dia ?? 0,
          metaReunioesDia: metaDoMembro?.meta_reunioes_dia ?? 0,
          ligacoes: funil.ligacoes,
          reunioesMarcadas: funil.reunioesMarcadas,
          reunioesRealizadas: coorte.realizadas,
          fechadas: coorte.fechadas,
          pctFechamento: coorte.pct,
        };
      })
      .filter(
        (r) =>
          r.metaLigacoesDia > 0 ||
          r.metaReunioesDia > 0 ||
          r.ligacoes > 0 ||
          r.reunioesMarcadas > 0 ||
          r.reunioesRealizadas > 0,
      )
      .sort((a, b) => b.ligacoes - a.ligacoes || b.fechadas - a.fechadas);

    tituloSecao(
      c,
      "Ligações e reuniões",
      "Ligou e marcou — trabalho de quem tem cargo Membro. Metas são por dia; fechamento segue a mesma conta do resumo",
    );
    kpis(
      c,
      [
        { label: "Ligações", valor: String(funilTotal.ligacoes) },
        { label: "Reuniões marcadas", valor: String(funilTotal.reunioesMarcadas) },
        { label: "Reuniões realizadas", valor: String(coorteLig.realizadas) },
        { label: "Fecharam", valor: String(coorteLig.fechadas) },
        {
          label: "Taxa de fechamento",
          valor: coorteLig.realizadas > 0 ? pct(coorteLig.pct) : "—",
        },
      ],
      5,
    );

    tabela(
      c,
      [
        "Membro",
        "Meta ligações/dia",
        "Ligações",
        "Meta reuniões/dia",
        "Reuniões marcadas",
        "Reuniões realizadas",
        "Fecharam",
        "% fechamento",
      ],
      alvoLig.map((r) => [
        r.nome,
        r.metaLigacoesDia > 0 ? `${r.metaLigacoesDia}/dia` : "—",
        String(r.ligacoes),
        r.metaReunioesDia > 0 ? `${r.metaReunioesDia}/dia` : "—",
        String(r.reunioesMarcadas),
        String(r.reunioesRealizadas),
        String(r.fechadas),
        r.reunioesRealizadas > 0 ? pct(r.pctFechamento) : "—",
      ]),
      { vazio: "Nenhum membro com meta ou atividade de ligação neste período." },
    );
  }

  // --- Reuniões ---
  if (inclui("reunioes")) {
    const realizadas = polosResp
      .filter(
        (p) => p.data_reuniao && p.data_reuniao <= hoje && dentroDoPeriodo(p.data_reuniao, periodo),
      )
      .sort((a, b) => (a.data_reuniao ?? "").localeCompare(b.data_reuniao ?? ""));

    tituloSecao(c, "Reuniões realizadas");
    kpis(
      c,
      [
        { label: "Realizadas", valor: String(coorte.realizadas) },
        { label: "Fecharam", valor: String(coorte.fechadas) },
        { label: "Perdidas", valor: String(coorte.perdidas) },
        { label: "Em aberto", valor: String(coorte.emAberto) },
        {
          label: "Taxa de fechamento",
          valor: coorte.realizadas > 0 ? pct(coorte.pct) : "—",
        },
      ],
      5,
    );
    tabela(
      c,
      ["Polo", "Nível", "Data", "Horário", "Responsável", "Faturamento", "Desfecho"],
      realizadas.map((p) => [
        p.nome,
        p.nivel,
        data(p.data_reuniao),
        p.horario_reuniao ? p.horario_reuniao.slice(0, 5) : "—",
        nomeMembro(p.responsavel_id),
        moeda(p.faturamento),
        p.data_ativacao ? "Fechou" : p.situacao === "inativo" ? "Perdida" : "Em aberto",
      ]),
      {
        vazio: "Não houve reuniões realizadas no período selecionado.",
        pillCol: 6,
        pillCor: (v) => DESFECHO_COR[v],
      },
    );
  }

  // --- Ativações ---
  if (inclui("ativacoes")) {
    const lista = polosResp
      .filter((p) => dentroDoPeriodo(p.data_ativacao, periodo))
      .sort((a, b) => (a.data_ativacao ?? "").localeCompare(b.data_ativacao ?? ""));

    tituloSecao(c, "Ativações");
    kpis(
      c,
      [
        { label: "Quantidade", valor: String(ativ.quantidade) },
        { label: "Valor", valor: moeda(ativ.valor) },
        { label: "Ticket médio", valor: moeda(ticketMedio(ativ)) },
      ],
      3,
    );
    tabela(
      c,
      ["Polo", "Nível", "Produto", "Data", "Valor", "Responsável", "Situação atual"],
      lista.map((p) => [
        p.nome,
        p.nivel,
        p.produto ?? "—",
        data(p.data_ativacao),
        moeda(p.valor_ativacao),
        nomeMembro(p.responsavel_id),
        SITUACAO_LABEL[p.situacao] ?? p.situacao,
      ]),
      {
        vazio: "Não houve ativações no período selecionado.",
        pillCol: 6,
        pillCor: corPorLabelSituacao,
      },
    );
  }

  // --- Reativações ---
  if (inclui("reativacoes")) {
    const lista = polosReat
      .filter((p) => dentroDoPeriodo(p.data_reativacao, periodo))
      .sort((a, b) => (a.data_reativacao ?? "").localeCompare(b.data_reativacao ?? ""));

    tituloSecao(c, "Reativações");
    kpis(
      c,
      [
        { label: "Quantidade", valor: String(reat.quantidade) },
        { label: "Valor", valor: moeda(reat.valor) },
        { label: "Ticket médio", valor: moeda(ticketMedio(reat)) },
      ],
      3,
    );
    tabela(
      c,
      ["Polo", "Nível", "Data da reativação", "Valor", "Reativado por", "Saída anterior", "Motivo"],
      lista.map((p) => [
        p.nome,
        p.nivel,
        data(p.data_reativacao),
        moeda(p.valor_reativacao),
        nomeMembro(p.reativado_por),
        data(p.data_saida),
        p.motivo_saida ?? "—",
      ]),
      { vazio: "Não houve reativações no período selecionado." },
    );
  }

  // --- Base ativa ---
  if (inclui("base")) {
    // Mesma função que alimenta `composicaoBase`, senão a lista sairia com um
    // total diferente do que o próprio cabeçalho da seção anuncia.
    const lista = polosResp
      .filter((p) => esteveAtivoNoPeriodo(p, periodo))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    tituloSecao(c, "Polos ativos no período");
    kpis(
      c,
      [
        { label: "Ao fim do período", valor: String(base.aoFim) },
        { label: "Já estavam ativos", valor: String(base.jaVinham) },
        { label: "Entraram", valor: `+${base.entraram}` },
        { label: "Saíram", valor: `−${base.sairam}` },
      ],
      4,
    );
    tabela(
      c,
      ["Polo", "Nível", "Produto", "Ativação", "Saída", "Reativação", "Valor", "Situação"],
      lista.map((p) => [
        p.nome,
        p.nivel,
        p.produto ?? "—",
        data(p.data_ativacao),
        data(p.data_saida),
        data(p.data_reativacao),
        moeda(p.valor_ativacao),
        SITUACAO_LABEL[p.situacao] ?? p.situacao,
      ]),
      {
        vazio: "Nenhum polo esteve ativo no período selecionado.",
        pillCol: 7,
        pillCor: corPorLabelSituacao,
      },
    );
    if (base.semData > 0) {
      garantirEspaco(c, 9);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...WARNING);
      doc.text(
        `Atenção: ${base.semData} polo(s) com situação ativa mas sem data de ativação ficam fora deste corte por período.`,
        MARGEM,
        c.y,
      );
      c.y += 9;
    }
  }

  // --- Comercial ---
  if (inclui("comercial")) {
    const lista = polosResp
      .filter((p) => dentroDoPeriodo(p.enviado_comercial_em, periodo))
      .sort((a, b) => (a.enviado_comercial_em ?? "").localeCompare(b.enviado_comercial_em ?? ""));

    tituloSecao(c, "Enviados ao comercial", `${lista.length} polo(s) repassado(s) no período`);
    tabela(
      c,
      ["Polo", "Nível", "Contato", "Produto", "Enviado em", "Responsável"],
      lista.map((p) => [
        p.nome,
        p.nivel,
        p.contato ?? "—",
        p.produto ?? "—",
        data(p.enviado_comercial_em),
        nomeMembro(p.responsavel_id),
      ]),
      { vazio: "Nenhum polo foi enviado ao comercial no período selecionado." },
    );
  }

  // --- Negociações ---
  if (inclui("negociacoes")) {
    const lista = negociacoes
      .filter((n) => dentroDoPeriodo(n.criado_em, periodo))
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em));

    tituloSecao(c, "Negociações", `${lista.length} cadastrada(s) no período`);
    tabela(
      c,
      ["Nome", "Contato", "E-mail", "Funcionários", "Responsável", "Cadastrada em"],
      lista.map((n) => [
        n.nome,
        n.contato ?? "—",
        n.email ?? "—",
        n.numero_funcionarios != null ? String(n.numero_funcionarios) : "—",
        nomeMembro(n.responsavel_id),
        data(n.criado_em),
      ]),
      { vazio: "Nenhuma negociação foi cadastrada no período selecionado." },
    );
  }

  // --- Escolas técnicas ---
  if (inclui("escolas")) {
    const lista = escolas
      .filter((e) => dentroDoPeriodo(e.criado_em, periodo))
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em));

    tituloSecao(c, "Escolas técnicas", `${lista.length} cadastrada(s) no período`);
    tabela(
      c,
      ["Nome", "Cidade", "Estado", "Cursos", "Responsável", "Cadastrada em"],
      lista.map((e) => [
        e.nome,
        e.cidade ?? "—",
        e.estado ?? "—",
        e.cursos && e.cursos.length > 0 ? e.cursos.join(", ") : "—",
        nomeMembro(e.responsavel_id),
        data(e.criado_em),
      ]),
      { vazio: "Nenhuma escola técnica foi cadastrada no período selecionado." },
    );
  }

  // --- Funil ---
  if (inclui("funil")) {
    const acompNoPeriodo = dados.acompanhamentos.filter((a) =>
      dentroDoPeriodo(a.criado_em, periodo),
    );
    const total = acompNoPeriodo.length;

    tituloSecao(c, "Funil de acompanhamento", "Clientes cadastrados no período, por etapa atual");

    if (total === 0) {
      estadoVazio(c, "Nenhum cliente no funil de acompanhamento.", "Funil vazio");
    } else {
      barrasHorizontais(
        c,
        ETAPA_ORDEM.map((etapa) => {
          const n = acompNoPeriodo.filter((a) => a.etapa === etapa).length;
          return {
            label: ETAPA_LABEL[etapa],
            valor: n,
            display: `${n}  ·  ${pct((n / total) * 100)}`,
          };
        }),
      );
    }
  }

  // --- Evolução mensal ---
  if (inclui("evolucao")) {
    const chaves = dados.polos
      .flatMap((p) => [p.data_ativacao, p.data_reativacao, p.data_saida])
      .filter((d): d is string => !!d)
      .map((d) => d.slice(0, 7))
      .sort();
    const hojeMes = hoje.slice(0, 7);
    const mesesTotal =
      chaves.length === 0
        ? mesesEntre(hojeMes, hojeMes)
        : mesesEntre(
            chaves[0],
            hojeMes > chaves[chaves.length - 1] ? hojeMes : chaves[chaves.length - 1],
          );

    // Janela do filtro de período — com "todo o período" (de/ate abertos),
    // cobre o histórico inteiro, igual ao comportamento de antes desta seção
    // respeitar o filtro.
    const deMes = periodo.de.slice(0, 7);
    const ateMes = periodo.ate.slice(0, 7);
    const meses = mesesTotal.filter((m) => m.id >= deMes && m.id <= ateMes);

    const sAtiv = serieMensal(
      meses,
      polosResp.map((p) => p.data_ativacao),
    );
    const sReat = serieMensal(
      meses,
      polosReat.map((p) => p.data_reativacao),
    );
    const sValor = serieMensalValor(
      meses,
      polosResp.map((p) => ({ data: p.data_ativacao, valor: p.valor_ativacao })),
    );
    const sBase = serieBaseAtiva(meses, polosResp);

    const maxAtiv = Math.max(1, ...sAtiv.map((p) => p.total));
    const maxReat = Math.max(1, ...sReat.map((p) => p.total));

    tituloSecao(c, "Evolução mensal", "Mês a mês, dentro do período selecionado");

    if (meses.length === 0) {
      estadoVazio(c, "Nenhum mês cai dentro do período selecionado.", "Sem histórico");
    } else {
      autoTable(doc, {
        startY: c.y,
        head: [["Mês", "Ativações", "Reativações", "Valor de ativação", "Base ativa ao fim"]],
        body: meses.map((m, i) => [m.nome, "", "", moeda(sValor[i].total), String(sBase[i].total)]),
        styles: {
          fontSize: 8.2,
          cellPadding: 3,
          lineColor: BORDER,
          lineWidth: 0.2,
          textColor: TEXT_DARK,
        },
        headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", fontSize: 7.8 },
        alternateRowStyles: { fillColor: SURFACE },
        margin: { left: MARGEM, right: MARGEM, top: HEADER_INTERNO_Y },
        columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
        didDrawPage: (hook) => {
          if (hook.pageNumber > 1) desenharHeaderInterno(doc, opts);
        },
        didDrawCell: (d) => {
          if (d.section !== "body") return;
          const i = d.row.index;
          if (d.column.index === 1) {
            const recorde = sAtiv[i].total > 0 && sAtiv[i].total === maxAtiv;
            barraNaCelula(
              doc,
              d.cell.x + 2,
              d.cell.y,
              d.cell.width - 4,
              d.cell.height,
              sAtiv[i].total,
              maxAtiv,
              recorde ? SUCCESS : BRAND,
            );
          }
          if (d.column.index === 2) {
            const recorde = sReat[i].total > 0 && sReat[i].total === maxReat;
            barraNaCelula(
              doc,
              d.cell.x + 2,
              d.cell.y,
              d.cell.width - 4,
              d.cell.height,
              sReat[i].total,
              maxReat,
              recorde ? SUCCESS : BRAND,
            );
          }
        },
      });
      c.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
    }
  }

  // --- Tarefas ---
  if (inclui("tarefas")) {
    const tarefasEscopo = escopoId
      ? dados.tarefas.filter((t) => t.responsaveis.some((r) => r.id === escopoId))
      : dados.tarefas;

    tituloSecao(c, "Tarefas", `${tarefasEscopo.length} tarefa(s) na visão selecionada`);
    if (tarefasEscopo.length === 0) {
      estadoVazio(c, "Não há tarefas para a visão selecionada.", "Nenhuma tarefa encontrada");
    } else {
      const prazos = calcPrazos(tarefasEscopo);
      kpis(
        c,
        [
          { label: "Total", valor: String(tarefasEscopo.length) },
          { label: "No prazo", valor: String(prazos.counts["no-prazo"]) },
          { label: "Prestes a vencer", valor: String(prazos.counts.prestes) },
          { label: "Expiradas", valor: String(prazos.counts.expirada) },
        ],
        4,
      );
      garantirEspaco(c, 40);
      const { finalY } = desenharTabelaTarefas(doc, tarefasEscopo, c.y);
      c.y = finalY + 14;
      // O bloco de prazos é alto (donut de raio 20 a partir de y+26).
      garantirEspaco(c, 60);
      desenharBlocoPrazos(doc, tarefasEscopo, c.y);
      c.y += 60;
    }
  }

  // Rodapé em todas as páginas: data de geração + numeração — um relatório de
  // várias seções vira um documento longo, e sem isso não dá pra conferir se
  // veio tudo nem quando foi gerado.
  const paginas = doc.getNumberOfPages();
  const geradoEm = `Relatório gerado em ${new Date().toLocaleString("pt-BR")}`;
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, alturaPagina(doc) - 10, w - MARGEM, alturaPagina(doc) - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(...TEXT_FAINT);
    doc.text(geradoEm, MARGEM, alturaPagina(doc) - 6);
    doc.text(`Página ${i} de ${paginas}`, w - MARGEM, alturaPagina(doc) - 6, { align: "right" });
  }

  doc.save(`relatorio-expansao-${new Date().toISOString().slice(0, 10)}.pdf`);
}
