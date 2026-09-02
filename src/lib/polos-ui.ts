export type Nivel = "N1" | "N2" | "N3";

/**
 * Uma cor por nível de polo.
 *
 * Vive fora dos componentes de propósito: agenda e lista precisam da mesma
 * paleta, e exportar constante junto de componente quebra o fast refresh.
 */
export const NIVEL_COR: Record<Nivel, string> = {
  N1: "#7B68EE",
  N2: "#3B82F6",
  N3: "#F97316",
};

/** Badge sólido do nível, na cor correspondente. */
export function nivelBadgeStyle(nivel: Nivel) {
  return { backgroundColor: NIVEL_COR[nivel], color: "#fff" } as const;
}

/** "YYYY-MM-DD" de hoje no fuso local — `toISOString()` usa UTC e vira o dia. */
export function hojeIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// --- Formatação ------------------------------------------------------------

export function formatarValor(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

export function formatarHorario(h: string | null): string {
  if (!h) return "—";
  return h.slice(0, 5);
}

/** "Hoje", "Amanhã", "Há 3 dias"… — leitura rápida sem calcular data mentalmente. */
export function rotuloRelativo(data: string | null): string {
  if (!data) return "Sem data";
  const alvo = new Date(`${data}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias === -1) return "Ontem";
  if (dias > 1) return `Em ${dias} dias`;
  return `Há ${Math.abs(dias)} dias`;
}

// --- Status ----------------------------------------------------------------

export type StatusReuniao = "atrasada" | "hoje" | "agendada" | "sem-data";

export interface StatusInfo {
  id: StatusReuniao;
  label: string;
  /** Classes do badge — em tokens/paleta Tailwind, para funcionar nos dois temas. */
  badge: string;
  /** Cor do ponto indicador. */
  ponto: string;
}

const STATUS: Record<StatusReuniao, StatusInfo> = {
  atrasada: {
    id: "atrasada",
    label: "Atrasada",
    badge:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400",
    ponto: "bg-red-500",
  },
  hoje: {
    id: "hoje",
    label: "Hoje",
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400",
    ponto: "bg-amber-500",
  },
  agendada: {
    id: "agendada",
    label: "Agendada",
    badge:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-400",
    ponto: "bg-blue-500",
  },
  "sem-data": {
    id: "sem-data",
    label: "Sem data",
    badge: "border-border bg-muted text-muted-foreground",
    ponto: "bg-muted-foreground",
  },
};

/**
 * Status derivado da data da reunião.
 *
 * Não existe "Concluída" aqui: concluir move o polo para Ativação ou Inativos,
 * então ele deixa de aparecer nesta aba.
 */
export function statusReuniao(dataReuniao: string | null, hoje = hojeIso()): StatusInfo {
  if (!dataReuniao) return STATUS["sem-data"];
  if (dataReuniao < hoje) return STATUS.atrasada;
  if (dataReuniao === hoje) return STATUS.hoje;
  return STATUS.agendada;
}

/** Ordena cronologicamente; reuniões sem data vão para o fim. */
export function compararPorQuando(
  a: { data_reuniao: string | null; horario_reuniao: string | null },
  b: { data_reuniao: string | null; horario_reuniao: string | null },
): number {
  if (!a.data_reuniao && !b.data_reuniao) return 0;
  if (!a.data_reuniao) return 1;
  if (!b.data_reuniao) return -1;
  if (a.data_reuniao !== b.data_reuniao) return a.data_reuniao < b.data_reuniao ? -1 : 1;
  return (a.horario_reuniao ?? "99").localeCompare(b.horario_reuniao ?? "99");
}
