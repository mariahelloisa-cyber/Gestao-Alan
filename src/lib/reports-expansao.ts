import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tarefa } from "./mock-data";
import type { Periodo } from "./productivity";
import { dentroDoPeriodo } from "./productivity";
import { desenharBlocoPrazos, desenharTabelaTarefas } from "./reports";
import {
  ativacoes,
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
 * Relatório completo de Expansão em PDF.
 *
 * As métricas vêm das mesmas funções que a dashboard usa (`dashboard-metrics`),
 * de propósito: um relatório com contas próprias divergiria da tela na primeira
 * mudança de regra, e ninguém saberia qual dos dois está certo.
 */

export type SecaoRelatorio =
  | "resumo"
  | "metas"
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
  { id: "resumo", label: "Resumo do período", descricao: "Todos os indicadores em números" },
  { id: "metas", label: "Meta x realizado", descricao: "Por membro, no mês do período" },
  { id: "reunioes", label: "Reuniões realizadas", descricao: "Com o desfecho de cada uma" },
  { id: "ativacoes", label: "Ativações", descricao: "Polos ativados no período" },
  { id: "reativacoes", label: "Reativações", descricao: "Polos reativados no período" },
  { id: "base", label: "Polos ativos no período", descricao: "A carteira e sua composição" },
  { id: "comercial", label: "Enviados ao comercial", descricao: "Polos repassados no período" },
  { id: "negociacoes", label: "Negociações", descricao: "Cadastradas no período" },
  { id: "escolas", label: "Escolas técnicas", descricao: "Cadastradas no período" },
  { id: "funil", label: "Funil de acompanhamento", descricao: "Situação atual por etapa" },
  { id: "evolucao", label: "Evolução mensal", descricao: "Histórico mês a mês" },
  { id: "tarefas", label: "Tarefas", descricao: "Lista e distribuição de prazos" },
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
}

export interface MetaRelatorio {
  usuario_id: string;
  periodo: string;
  valor_meta: number;
}

export interface DadosRelatorio {
  polos: PoloRelatorio[];
  negociacoes: NegociacaoRelatorio[];
  escolas: EscolaRelatorio[];
  acompanhamentos: AcompanhamentoRelatorio[];
  metas: MetaRelatorio[];
  tarefas: Tarefa[];
  membros: { id: string; nome: string }[];
  clientesById: Map<string, string>;
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

const SITUACAO_LABEL: Record<string, string> = {
  ativo: "Ativo",
  reativado: "Reativado",
  desligado: "Desligado",
  reuniao: "Em reunião",
  inativo: "Inativo",
};

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

/** Estado de escrita no documento: onde a próxima seção começa. */
interface Cursor {
  doc: jsPDF;
  y: number;
}

const MARGEM = 14;
const RODAPE = 14;

function alturaPagina(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight();
}

/** Abre página nova se não couber `altura` no que resta da atual. */
function garantirEspaco(c: Cursor, altura: number) {
  if (c.y + altura > alturaPagina(c.doc) - RODAPE) {
    c.doc.addPage();
    c.y = 20;
  }
}

function tituloSecao(c: Cursor, texto: string, subtitulo?: string) {
  garantirEspaco(c, subtitulo ? 22 : 16);
  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(12);
  c.doc.setTextColor(20);
  c.doc.text(texto, MARGEM, c.y);
  c.y += 5;
  if (subtitulo) {
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(8);
    c.doc.setTextColor(120);
    c.doc.text(subtitulo, MARGEM, c.y);
    c.y += 4;
  }
  c.y += 2;
}

function tabela(c: Cursor, head: string[], body: (string | number)[][]) {
  if (body.length === 0) {
    garantirEspaco(c, 12);
    c.doc.setFont("helvetica", "italic");
    c.doc.setFontSize(9);
    c.doc.setTextColor(140);
    c.doc.text("Nenhum registro no período.", MARGEM, c.y);
    c.y += 10;
    return;
  }

  autoTable(c.doc, {
    startY: c.y,
    head: [head],
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [123, 104, 238] },
    margin: { left: MARGEM, right: MARGEM },
  });
  c.y = (c.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

/** Grade de indicadores: rótulo pequeno em cima, valor grande embaixo. */
function grade(c: Cursor, itens: { label: string; valor: string; nota?: string }[]) {
  const largura = (c.doc.internal.pageSize.getWidth() - MARGEM * 2) / 4;
  const alturaLinha = 18;
  const linhas = Math.ceil(itens.length / 4);
  garantirEspaco(c, linhas * alturaLinha);

  itens.forEach((item, i) => {
    const col = i % 4;
    const linha = Math.floor(i / 4);
    const x = MARGEM + col * largura;
    const y = c.y + linha * alturaLinha;

    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(7.5);
    c.doc.setTextColor(120);
    c.doc.text(item.label, x, y);

    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(13);
    c.doc.setTextColor(20);
    c.doc.text(item.valor, x, y + 6.5);

    if (item.nota) {
      c.doc.setFont("helvetica", "normal");
      c.doc.setFontSize(7);
      c.doc.setTextColor(140);
      c.doc.text(item.nota, x, y + 11);
    }
  });

  c.y += linhas * alturaLinha + 4;
}

// --- Geração ----------------------------------------------------------------

export function gerarRelatorioExpansaoPDF(dados: DadosRelatorio, opts: OpcoesRelatorio) {
  const { periodo, escopoId, secoes, hoje } = opts;
  const doc = new jsPDF({ orientation: "landscape" });
  const c: Cursor = { doc, y: 0 };

  const nomeMembro = (id: string | null) =>
    id ? (dados.membros.find((m) => m.id === id)?.nome ?? "—") : "—";

  // Recortes por escopo, iguais aos da dashboard.
  const polosResp = filtrarPorEscopo(dados.polos, escopoId);
  const polosReat = filtrarReativacoesPorEscopo(dados.polos, escopoId);
  const negociacoes = filtrarPorEscopo(dados.negociacoes, escopoId);
  const escolas = filtrarPorEscopo(dados.escolas, escopoId);

  const ativ = ativacoes(polosResp, periodo);
  const reat = reativacoes(polosReat, periodo);
  const coorte = coorteFechamento(polosResp, periodo, hoje);
  const base = composicaoBase(polosResp, periodo);

  // --- Cabeçalho ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text("Relatório de Expansão — Sistema Expansão", MARGEM, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    [
      `Período: ${opts.periodoLabel}    Visão: ${opts.escopoLabel}`,
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    ],
    MARGEM,
    24,
  );
  c.y = 38;

  const inclui = (s: SecaoRelatorio) => secoes.includes(s);

  // --- Resumo ---
  if (inclui("resumo")) {
    tituloSecao(c, "Resumo do período");
    grade(c, [
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

    tituloSecao(
      c,
      `Meta x realizado — ${rotuloMes(mesMeta)}`,
      "Realizado soma valor de ativação e de reativação no mês",
    );
    tabela(
      c,
      ["Membro", "Meta", "Realizado", "% da meta", "Falta"],
      [
        ...linhas.map((r) => [
          r.nome,
          r.meta > 0 ? moeda(r.meta) : "Sem meta",
          moeda(r.realizado),
          r.meta > 0 ? pct(r.pct) : "—",
          r.meta > 0 ? moeda(Math.max(r.meta - r.realizado, 0)) : "—",
        ]),
        ...(linhas.length > 0
          ? [
              [
                "TOTAL",
                moeda(totalMeta),
                moeda(totalReal),
                totalMeta > 0 ? pct((totalReal / totalMeta) * 100) : "—",
                totalMeta > 0 ? moeda(Math.max(totalMeta - totalReal, 0)) : "—",
              ],
            ]
          : []),
      ],
    );
  }

  // --- Reuniões ---
  if (inclui("reunioes")) {
    const realizadas = polosResp
      .filter(
        (p) => p.data_reuniao && p.data_reuniao <= hoje && dentroDoPeriodo(p.data_reuniao, periodo),
      )
      .sort((a, b) => (a.data_reuniao ?? "").localeCompare(b.data_reuniao ?? ""));

    tituloSecao(
      c,
      "Reuniões realizadas",
      `${coorte.realizadas} realizadas · ${coorte.fechadas} fecharam · ${coorte.perdidas} perdidas · ${coorte.emAberto} em aberto · taxa de fechamento ${coorte.realizadas > 0 ? pct(coorte.pct) : "—"}`,
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
    );
  }

  // --- Ativações ---
  if (inclui("ativacoes")) {
    const lista = polosResp
      .filter((p) => dentroDoPeriodo(p.data_ativacao, periodo))
      .sort((a, b) => (a.data_ativacao ?? "").localeCompare(b.data_ativacao ?? ""));

    tituloSecao(
      c,
      "Ativações",
      `${ativ.quantidade} ativações · ${moeda(ativ.valor)} · ticket médio ${moeda(ticketMedio(ativ))}`,
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
    );
  }

  // --- Reativações ---
  if (inclui("reativacoes")) {
    const lista = polosReat
      .filter((p) => dentroDoPeriodo(p.data_reativacao, periodo))
      .sort((a, b) => (a.data_reativacao ?? "").localeCompare(b.data_reativacao ?? ""));

    tituloSecao(
      c,
      "Reativações",
      `${reat.quantidade} reativações · ${moeda(reat.valor)} · ticket médio ${moeda(ticketMedio(reat))}`,
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
    );
  }

  // --- Base ativa ---
  if (inclui("base")) {
    // Mesma função que alimenta `composicaoBase`, senão a lista sairia com um
    // total diferente do que o próprio cabeçalho da seção anuncia.
    const lista = polosResp
      .filter((p) => esteveAtivoNoPeriodo(p, periodo))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    tituloSecao(
      c,
      "Polos ativos no período",
      `${base.total} estiveram ativos · ${base.jaVinham} já vinham · +${base.entraram} entraram · −${base.sairam} saíram · ${base.aoFim} ao fim do período`,
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
    );
    if (base.semData > 0) {
      garantirEspaco(c, 10);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(180, 100, 20);
      doc.text(
        `Atenção: ${base.semData} polo(s) com situação ativa mas sem data de ativação ficam fora deste corte por período.`,
        MARGEM,
        c.y,
      );
      c.y += 10;
    }
  }

  // --- Comercial ---
  if (inclui("comercial")) {
    const lista = polosResp
      .filter((p) => dentroDoPeriodo(p.enviado_comercial_em, periodo))
      .sort((a, b) => (a.enviado_comercial_em ?? "").localeCompare(b.enviado_comercial_em ?? ""));

    tituloSecao(c, "Enviados ao comercial", `${lista.length} polos repassados no período`);
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
    );
  }

  // --- Negociações ---
  if (inclui("negociacoes")) {
    const lista = negociacoes
      .filter((n) => dentroDoPeriodo(n.criado_em, periodo))
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em));

    tituloSecao(c, "Negociações", `${lista.length} cadastradas no período`);
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
    );
  }

  // --- Escolas técnicas ---
  if (inclui("escolas")) {
    const lista = escolas
      .filter((e) => dentroDoPeriodo(e.criado_em, periodo))
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em));

    tituloSecao(c, "Escolas técnicas", `${lista.length} cadastradas no período`);
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
    );
  }

  // --- Funil ---
  if (inclui("funil")) {
    const total = dados.acompanhamentos.length;
    tituloSecao(c, "Funil de acompanhamento", "Situação atual, não filtrada por período");
    tabela(
      c,
      ["Etapa", "Clientes", "% do funil"],
      Object.entries(ETAPA_LABEL).map(([etapa, label]) => {
        const n = dados.acompanhamentos.filter((a) => a.etapa === etapa).length;
        return [label, String(n), total > 0 ? pct((n / total) * 100) : "—"];
      }),
    );
  }

  // --- Evolução mensal ---
  if (inclui("evolucao")) {
    const chaves = dados.polos
      .flatMap((p) => [p.data_ativacao, p.data_reativacao, p.data_saida])
      .filter((d): d is string => !!d)
      .map((d) => d.slice(0, 7))
      .sort();
    const hojeMes = hoje.slice(0, 7);
    const meses =
      chaves.length === 0
        ? mesesEntre(hojeMes, hojeMes)
        : mesesEntre(
            chaves[0],
            hojeMes > chaves[chaves.length - 1] ? hojeMes : chaves[chaves.length - 1],
          );

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

    const maxAtiv = Math.max(0, ...sAtiv.map((p) => p.total));
    const maxReat = Math.max(0, ...sReat.map((p) => p.total));

    tituloSecao(c, "Evolução mensal", "Histórico completo — não segue o filtro de período");
    tabela(
      c,
      ["Mês", "Ativações", "Reativações", "Valor de ativação", "Base ativa ao fim"],
      meses.map((m, i) => [
        m.nome,
        // Marca o mês recorde para o número não precisar ser caçado a olho.
        sAtiv[i].total > 0 && sAtiv[i].total === maxAtiv
          ? `${sAtiv[i].total}  (recorde)`
          : String(sAtiv[i].total),
        sReat[i].total > 0 && sReat[i].total === maxReat
          ? `${sReat[i].total}  (recorde)`
          : String(sReat[i].total),
        moeda(sValor[i].total),
        String(sBase[i].total),
      ]),
    );
  }

  // --- Tarefas ---
  if (inclui("tarefas")) {
    const tarefasEscopo = escopoId
      ? dados.tarefas.filter((t) => t.responsaveis.some((r) => r.id === escopoId))
      : dados.tarefas;

    tituloSecao(c, "Tarefas", `${tarefasEscopo.length} tarefas no período e na visão selecionada`);
    if (tarefasEscopo.length === 0) {
      tabela(c, ["Título"], []);
    } else {
      garantirEspaco(c, 40);
      const { finalY } = desenharTabelaTarefas(doc, tarefasEscopo, dados.clientesById, c.y);
      c.y = finalY + 14;
      // O bloco de prazos é alto (donut de raio 20 a partir de y+26).
      garantirEspaco(c, 60);
      desenharBlocoPrazos(doc, tarefasEscopo, c.y);
      c.y += 60;
    }
  }

  // Numeração no rodapé: um relatório de várias seções vira um documento
  // longo, e sem página impressa não dá pra conferir se veio tudo.
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${paginas}`,
      doc.internal.pageSize.getWidth() - MARGEM,
      alturaPagina(doc) - 6,
      { align: "right" },
    );
  }

  doc.save(`relatorio-expansao-${new Date().toISOString().slice(0, 10)}.pdf`);
}
