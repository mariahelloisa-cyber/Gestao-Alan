import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Wallet,
  ExternalLink,
} from "lucide-react";
import type { Polo } from "@/lib/polos.functions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NIVEL_COR, type Nivel } from "@/lib/polos-ui";

const HORA_ALTURA = 64; // px por hora
const CARTAO_ALTURA = 118; // altura fixa: não temos duração da reunião
const GAP = 8;
const HORA_MIN_PADRAO = 8;
const HORA_MAX_PADRAO = 18;

/** "YYYY-MM-DD" no fuso local — `toISOString()` converte pra UTC e pode pular o dia. */
function isoOf(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function minutosDe(horario: string): number {
  const [h, m] = horario.split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

function horaCurta(h: string | null): string {
  return h ? h.slice(0, 5) : "";
}

function formatarValor(v: number | null): string | null {
  if (v == null) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Posicionado {
  polo: Polo;
  top: number;
  coluna: number;
}

/**
 * Distribui em colunas para que reuniões próximas no horário não se sobreponham:
 * cada uma vai para a primeira coluna já livre naquele ponto vertical.
 */
function posicionar(polos: Polo[], inicioMin: number): { itens: Posicionado[]; colunas: number } {
  const ordenados = [...polos].sort(
    (a, b) => minutosDe(a.horario_reuniao!) - minutosDe(b.horario_reuniao!),
  );
  const fimPorColuna: number[] = [];
  const itens: Posicionado[] = [];

  for (const polo of ordenados) {
    const top = ((minutosDe(polo.horario_reuniao!) - inicioMin) / 60) * HORA_ALTURA;
    let coluna = fimPorColuna.findIndex((fim) => fim <= top);
    if (coluna === -1) coluna = fimPorColuna.length;
    fimPorColuna[coluna] = top + CARTAO_ALTURA + GAP;
    itens.push({ polo, top, coluna });
  }

  return { itens, colunas: Math.max(1, fimPorColuna.length) };
}

export function ReunioesAgenda({
  polos,
  onSelectPolo,
  onSelectSlot,
}: {
  polos: Polo[];
  /** Clique no cartão — abre os detalhes do polo. */
  onSelectPolo: (p: Polo) => void;
  /** Clique num espaço livre — abre o cadastro com data (e hora) preenchidas. */
  onSelectSlot?: (iso: string, hora?: string) => void;
}) {
  const [dia, setDia] = useState(() => isoOf(new Date()));

  // Busca, polo, nível e faturamento já vêm aplicados pela página — a Agenda
  // só recorta o dia, para Lista e Agenda mostrarem sempre o mesmo conjunto.
  const doDia = useMemo(() => polos.filter((p) => p.data_reuniao === dia), [polos, dia]);

  const comHorario = doDia.filter((p) => p.horario_reuniao);
  const semHorario = doDia.filter((p) => !p.horario_reuniao);

  // A faixa cobre 08:00–18:00, mas estica se houver reunião fora disso.
  const { horaInicio, horaFim } = useMemo(() => {
    let min = HORA_MIN_PADRAO;
    let max = HORA_MAX_PADRAO;
    for (const p of comHorario) {
      const h = Math.floor(minutosDe(p.horario_reuniao!) / 60);
      if (h < min) min = h;
      if (h + 2 > max) max = h + 2;
    }
    return { horaInicio: min, horaFim: Math.min(max, 24) };
  }, [comHorario]);

  const horas = useMemo(
    () => Array.from({ length: horaFim - horaInicio + 1 }, (_, i) => horaInicio + i),
    [horaInicio, horaFim],
  );

  const { itens, colunas } = useMemo(
    () => posicionar(comHorario, horaInicio * 60),
    [comHorario, horaInicio],
  );

  const semData = polos.filter((p) => !p.data_reuniao).length;
  const labelDia = new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const mudarDia = (delta: number) => {
    const d = new Date(`${dia}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setDia(isoOf(d));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
      {/* Navegação do dia */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => mudarDia(-1)}
            className="rounded p-1 hover:bg-muted"
            aria-label="Dia anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="min-w-[190px] text-center text-sm font-semibold capitalize">{labelDia}</h2>
          <button
            onClick={() => mudarDia(1)}
            className="rounded p-1 hover:bg-muted"
            aria-label="Próximo dia"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => setDia(isoOf(new Date()))}
          className="rounded-md border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
        >
          Hoje
        </button>
      </div>

      {/* Ir para uma data + legenda dos níveis */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <Label htmlFor="agenda-dia" className="text-xs text-muted-foreground">
          Ir para
        </Label>
        <Input
          id="agenda-dia"
          type="date"
          value={dia}
          onChange={(e) => e.target.value && setDia(e.target.value)}
          className="h-8 w-[160px]"
        />
        <span className="text-xs text-muted-foreground">
          {doDia.length} {doDia.length === 1 ? "reunião" : "reuniões"} neste dia
        </span>

        <div className="ml-auto flex items-center gap-3">
          {(["N1", "N2", "N3"] as const).map((n) => (
            <span key={n} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: NIVEL_COR[n] }}
              />
              {n}
            </span>
          ))}
        </div>
      </div>

      {/* Reuniões do dia sem horário definido */}
      {semHorario.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-[var(--surface-1)] px-4 py-2.5">
          <span className="text-xs text-muted-foreground">Sem horário definido:</span>
          {semHorario.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPolo(p)}
              className="rounded-md border px-2 py-1 text-xs font-medium"
              style={{
                borderColor: `${NIVEL_COR[p.nivel as Nivel]}66`,
                backgroundColor: `${NIVEL_COR[p.nivel as Nivel]}14`,
                color: NIVEL_COR[p.nivel as Nivel],
              }}
            >
              {p.nome}
            </button>
          ))}
        </div>
      )}

      {/* Faixa de horários */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[720px]">
          {/* Coluna das horas */}
          <div className="w-16 shrink-0 border-r border-border">
            {horas.map((h) => (
              <div
                key={h}
                style={{ height: HORA_ALTURA }}
                className="relative -top-2 pr-2 text-right text-[11px] text-muted-foreground"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Grade + cartões */}
          <div
            className="relative flex-1"
            style={{ height: horas.length * HORA_ALTURA }}
            onClick={(e) => {
              if (!onSelectSlot || e.currentTarget !== e.target) return;
              const y = e.nativeEvent.offsetY;
              const minutos = horaInicio * 60 + Math.floor(y / HORA_ALTURA) * 60;
              const hh = String(Math.floor(minutos / 60)).padStart(2, "0");
              onSelectSlot(dia, `${hh}:00`);
            }}
          >
            {/* Linhas de hora */}
            {horas.map((h, i) => (
              <div
                key={h}
                className="pointer-events-none absolute inset-x-0 border-t border-border"
                style={{ top: i * HORA_ALTURA }}
              />
            ))}

            {itens.length === 0 && semHorario.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-muted-foreground">Nenhuma reunião neste dia.</span>
              </div>
            )}

            {itens.map(({ polo, top, coluna }) => {
              const cor = NIVEL_COR[polo.nivel as Nivel];
              const valor = formatarValor(polo.faturamento);
              return (
                <button
                  key={polo.id}
                  onClick={() => onSelectPolo(polo)}
                  className="absolute overflow-hidden rounded-lg border border-l-4 bg-card p-2.5 text-left shadow-sm transition-shadow hover:shadow-md"
                  style={{
                    top,
                    height: CARTAO_ALTURA,
                    left: `calc(${(coluna / colunas) * 100}% + 8px)`,
                    width: `calc(${100 / colunas}% - 16px)`,
                    borderColor: `${cor}40`,
                    borderLeftColor: cor,
                    backgroundColor: `${cor}0D`,
                  }}
                >
                  {/* Ponto + nome à esquerda, tag do nível à direita. */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cor }}
                    />
                    <span className="truncate text-xs font-medium" style={{ color: cor }}>
                      {polo.nome}
                    </span>
                    <span
                      className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: `${cor}26`, color: cor }}
                    >
                      {polo.nivel}
                    </span>
                  </div>

                  {polo.contato && (
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {polo.contato}
                    </p>
                  )}
                  {polo.observacao && (
                    <p className="truncate text-xs text-muted-foreground">{polo.observacao}</p>
                  )}

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {polo.produto && (
                      <span className="flex min-w-0 items-center gap-1">
                        <GraduationCap className="h-3 w-3 shrink-0" />
                        <span className="truncate">{polo.produto}</span>
                      </span>
                    )}
                    {valor && (
                      <span className="flex items-center gap-1">
                        <Wallet className="h-3 w-3 shrink-0" />
                        {valor}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Clock className="h-3 w-3" />
                      {horaCurta(polo.horario_reuniao)}
                    </span>
                    {polo.link_reuniao && (
                      <a
                        href={polo.link_reuniao}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 underline underline-offset-2"
                        style={{ color: cor }}
                      >
                        Abrir <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {semData > 0 && (
        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          {semData === 1
            ? "1 polo sem data de reunião não aparece na agenda."
            : `${semData} polos sem data de reunião não aparecem na agenda.`}{" "}
          Veja na aba Lista.
        </div>
      )}
    </div>
  );
}
