import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useTasks } from "@/lib/tasks-store";
import { listPolos } from "@/lib/polos.functions";
import { listMetas, setMeta } from "@/lib/metas.functions";
import { listLeads } from "@/lib/leads.functions";
import { atividadeLeads, coorteConversao } from "@/lib/dashboard-metrics";
import { resolverPeriodo, type PeriodoPreset } from "@/lib/productivity";
import { hojeIso } from "@/lib/polos-ui";
import { PeriodFilter } from "./PeriodFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Pencil, Phone, Trophy } from "lucide-react";

function formatarValor(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "12,5" — números com no máximo uma casa decimal. */
function decimal(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

const TODOS = "todos";

/**
 * Quanto saiu de ligações / reuniões no recorte, no mesmo formato do card
 * "Meta da equipe" de Vendas: barra + percentual.
 *
 * O total é do período escolhido; a meta é a do dia — a barra compara os dois
 * números como estão, sem multiplicar a meta pelos dias do recorte.
 */
function CardAtividade({
  titulo,
  total,
  metaDia,
}: {
  titulo: string;
  total: number;
  metaDia: number;
}) {
  const pct = metaDia > 0 ? (total / metaDia) * 100 : 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {total}
        </p>
        <p className="text-sm text-muted-foreground">
          {metaDia > 0 ? `de ${metaDia}/dia` : "sem meta"}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {metaDia > 0 ? `${Math.round(pct)}% da meta` : "Sem meta diária cadastrada"}
      </p>
    </div>
  );
}

export function MetasView() {
  const qc = useQueryClient();
  const { membrosAtribuiveis: membros, myCargo } = useTasks();
  const isAdmin = myCargo === "Admin" || myCargo === "Supervisor";
  const hoje = hojeIso();

  // O recorte é livre — mês, mês anterior, últimos 30 dias, personalizado. As
  // metas continuam cadastradas por mês (o valor) e por dia (a atividade); o
  // filtro só decide o intervalo em que o realizado é apurado.
  const [preset, setPreset] = useState<PeriodoPreset>("este-mes");
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");
  const { de, ate } = useMemo(
    () => resolverPeriodo(preset, { de: customDe, ate: customAte }),
    [preset, customDe, customAte],
  );
  /** Mês de referência das metas cadastradas: o mês em que o período começa. */
  const periodo = de.slice(0, 7);
  const [membroFiltroId, setMembroFiltroId] = useState(TODOS);

  const listPolosFn = useServerFn(listPolos);
  const listMetasFn = useServerFn(listMetas);
  const listLeadsFn = useServerFn(listLeads);
  const setMetaFn = useServerFn(setMeta);

  const {
    data: polos = [],
    isLoading: loadingPolos,
    error: errorPolos,
  } = useQuery({
    queryKey: ["polos-ativacao"],
    queryFn: () => listPolosFn(),
    retry: 1,
  });
  const {
    data: metas = [],
    isLoading: loadingMetas,
    error: errorMetas,
  } = useQuery({
    queryKey: ["metas-membros"],
    queryFn: () => listMetasFn(),
    retry: 1,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => listLeadsFn(),
    retry: 1,
  });

  const isLoading = loadingPolos || loadingMetas;
  const error = errorPolos ?? errorMetas;

  const [metaAlvo, setMetaAlvo] = useState<{
    id: string;
    nome: string;
    ehMembro: boolean;
  } | null>(null);
  const [metaValor, setMetaValor] = useState("");
  const [metaLigacoes, setMetaLigacoes] = useState("");
  const [metaReunioes, setMetaReunioes] = useState("");

  const setMetaMut = useMutation({
    mutationFn: (vars: {
      usuario_id: string;
      periodo: string;
      valor_meta: number;
      meta_ligacoes_dia: number;
      meta_reunioes_dia: number;
    }) => setMetaFn({ data: vars }),
    onSuccess: () => {
      toast.success("Meta salva.");
      setMetaAlvo(null);
      qc.invalidateQueries({ queryKey: ["metas-membros"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar meta."),
  });

  const ativacoesNoPeriodo = useMemo(
    () => polos.filter((p) => p.data_ativacao && p.data_ativacao >= de && p.data_ativacao <= ate),
    [polos, de, ate],
  );
  // Realizado = ativação + reativação. A reativação tem dono próprio
  // (`reativado_por`), porque quem traz o polo de volta costuma não ser quem o
  // ativou. A dashboard usa a mesma conta — mudar aqui sem mudar lá faria as
  // duas telas mostrarem números diferentes para a mesma meta.
  const reativacoesNoPeriodo = useMemo(
    () =>
      polos.filter((p) => p.data_reativacao && p.data_reativacao >= de && p.data_reativacao <= ate),
    [polos, de, ate],
  );
  const metasNoPeriodo = useMemo(
    () => metas.filter((m) => m.periodo === periodo),
    [metas, periodo],
  );

  const linhas = useMemo(() => {
    const membrosOrdenados = [...membros].sort((a, b) => a.nome.localeCompare(b.nome));
    const periodoAtividade = { de, ate };
    return membrosOrdenados.map((m) => {
      const ativacoesDoMembro = ativacoesNoPeriodo.filter((p) => p.responsavel_id === m.id);
      const reativacoesDoMembro = reativacoesNoPeriodo.filter((p) => p.reativado_por === m.id);
      const valorAtivado =
        ativacoesDoMembro.reduce((s, p) => s + (p.valor_ativacao ?? 0), 0) +
        reativacoesDoMembro.reduce((s, p) => s + (p.valor_reativacao ?? 0), 0);
      const metaDoMembro = metasNoPeriodo.find((x) => x.usuario_id === m.id);
      const valorMeta = metaDoMembro?.valor_meta ?? 0;

      const leadsDoMembro = leads.filter((l) => l.responsavel_id === m.id);
      const funil = atividadeLeads(leadsDoMembro, periodoAtividade);
      // "Convertidos" não é uma métrica do Lead — é a mesma conta da Dashboard:
      // polos deste membro que estavam em reunião e viraram ativação. Contar
      // pela data em que o Lead foi marcado (em vez da data da reunião)
      // faria a mesma reunião converter aqui e não lá, sempre que ela caísse
      // num período diferente do da marcação.
      const polosDoMembro = polos.filter((p) => p.responsavel_id === m.id);
      const coorte = coorteConversao(polosDoMembro, periodoAtividade, hoje);
      const metaLigacoesDia = metaDoMembro?.meta_ligacoes_dia ?? 0;
      const metaReunioesDia = metaDoMembro?.meta_reunioes_dia ?? 0;

      return {
        membro: m,
        // Ligar e marcar reunião é trabalho de Membro. O Supervisor conduz a
        // reunião e converte, então não entra na seção de atividade nem soma
        // meta diária — senão a meta do time subiria sem ninguém para cumpri-la.
        ehMembro: m.cargo === "Membro",
        // Vendas
        countAtivacoes: ativacoesDoMembro.length,
        countReativacoes: reativacoesDoMembro.length,
        valorAtivado,
        valorMeta,
        pctValor: valorMeta > 0 ? (valorAtivado / valorMeta) * 100 : 0,
        // Atividade
        ligacoes: funil.ligacoes,
        reunioesMarcadas: funil.reunioesMarcadas,
        reunioesRealizadas: coorte.realizadas,
        convertidas: coorte.convertidas,
        pctConversao: coorte.pct,
        metaLigacoesDia,
        metaReunioesDia,
      };
    });
  }, [
    membros,
    ativacoesNoPeriodo,
    reativacoesNoPeriodo,
    metasNoPeriodo,
    leads,
    polos,
    de,
    ate,
    hoje,
  ]);

  const noFiltro = useMemo(
    () =>
      membroFiltroId === TODOS ? linhas : linhas.filter((r) => r.membro.id === membroFiltroId),
    [linhas, membroFiltroId],
  );

  // Cada seção tem seu próprio ranking: em Vendas quem vendeu mais fica no
  // topo; em Ligações e reuniões, quem mais ligou. Um ranking só empurraria
  // para o fim quem tem apenas a meta de atividade.
  const rankingVendas = useMemo(
    () => [...noFiltro].sort((a, b) => b.pctValor - a.pctValor || b.valorAtivado - a.valorAtivado),
    [noFiltro],
  );
  const soMembros = useMemo(() => noFiltro.filter((r) => r.ehMembro), [noFiltro]);

  const rankingAtividade = useMemo(
    () => [...soMembros].sort((a, b) => b.ligacoes - a.ligacoes || b.convertidas - a.convertidas),
    [soMembros],
  );

  const metaEquipe = noFiltro.reduce((s, r) => s + r.valorMeta, 0);
  const ativadoEquipe = noFiltro.reduce((s, r) => s + r.valorAtivado, 0);
  const pctEquipe = metaEquipe > 0 ? (ativadoEquipe / metaEquipe) * 100 : 0;

  const ligacoesEquipe = soMembros.reduce((s, r) => s + r.ligacoes, 0);
  const reunioesEquipe = soMembros.reduce((s, r) => s + r.reunioesMarcadas, 0);
  // "Convertidos" soma pela mesma conta da Dashboard (reuniões realizadas ÷
  // convertidas), não pelas reuniões marcadas via Lead — por isso o
  // denominador aqui é `reunioesRealizadas`, não `reunioesEquipe`.
  const reunioesRealizadasEquipe = soMembros.reduce((s, r) => s + r.reunioesRealizadas, 0);
  const convertidasEquipe = soMembros.reduce((s, r) => s + r.convertidas, 0);
  // Somar as metas diárias dá a meta diária do time — continua sendo por dia.
  const metaLigacoesDiaEquipe = soMembros.reduce((s, r) => s + r.metaLigacoesDia, 0);
  const metaReunioesDiaEquipe = soMembros.reduce((s, r) => s + r.metaReunioesDia, 0);
  const pctConversaoEquipe =
    reunioesRealizadasEquipe > 0 ? (convertidasEquipe / reunioesRealizadasEquipe) * 100 : 0;

  const abrirEditarMeta = (m: { id: string; nome: string; cargo?: string }) => {
    const atual = metasNoPeriodo.find((x) => x.usuario_id === m.id);
    setMetaAlvo({ id: m.id, nome: m.nome, ehMembro: m.cargo === "Membro" });
    setMetaValor(String(atual?.valor_meta ?? ""));
    setMetaLigacoes(String(atual?.meta_ligacoes_dia ?? ""));
    setMetaReunioes(String(atual?.meta_reunioes_dia ?? ""));
  };

  const salvarMeta = () => {
    if (!metaAlvo) return;
    // As três metas convivem: o membro pode ter só a de atividade (o caso
    // comum) e nenhuma meta financeira, ou vice-versa. Campo vazio = zero.
    const valor = metaValor ? Number(metaValor.replace(",", ".")) : 0;
    const ligacoes = metaAlvo.ehMembro && metaLigacoes ? Number(metaLigacoes) : 0;
    const reunioes = metaAlvo.ehMembro && metaReunioes ? Number(metaReunioes) : 0;
    if (isNaN(valor) || valor < 0) {
      toast.error("Informe um valor de meta válido.");
      return;
    }
    if (
      !Number.isInteger(ligacoes) ||
      ligacoes < 0 ||
      !Number.isInteger(reunioes) ||
      reunioes < 0
    ) {
      toast.error("As metas diárias precisam ser números inteiros.");
      return;
    }
    setMetaMut.mutate({
      usuario_id: metaAlvo.id,
      periodo,
      valor_meta: valor,
      meta_ligacoes_dia: ligacoes,
      meta_reunioes_dia: reunioes,
    });
  };

  /** O botão de editar meta, repetido nas duas listas. */
  const botaoEditar = (m: { id: string; nome: string; cargo?: string }) =>
    isAdmin && (
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => abrirEditarMeta(m)}
        title="Editar metas"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    );

  /** Carregando / erro / vazio — o mesmo nas duas listas. */
  const estadoDaLista = (vazio: string, icone: React.ReactNode, itens: unknown[]) => {
    if (isLoading)
      return <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>;
    if (error)
      return (
        <div className="py-10 text-center text-sm text-destructive">
          Falha ao carregar: {error instanceof Error ? error.message : "erro desconhecido"}
        </div>
      );
    if (itens.length === 0)
      return (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <span className="inline-flex flex-col items-center gap-2">
            {icone}
            {vazio}
          </span>
        </div>
      );
    return null;
  };

  return (
    <div className="w-full space-y-8 px-6 py-6">
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Metas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vendas e atividade da equipe. A meta de vendas é do mês; as de ligações e reuniões são por
          dia.
        </p>
      </header>

      {/* Filtros — valem para as duas seções */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-56 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Membro</Label>
          <Select value={membroFiltroId} onValueChange={setMembroFiltroId}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os membros</SelectItem>
              {membros.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Período</Label>
          <PeriodFilter
            preset={preset}
            onPresetChange={setPreset}
            customDe={customDe}
            customAte={customAte}
            onCustomChange={(d, a) => {
              setCustomDe(d);
              setCustomAte(a);
            }}
          />
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Vendas                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Vendas</h2>
          <p className="text-xs text-muted-foreground">
            Ativações e reativações apuradas no período, contra a meta em R$ do mês de referência.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)] sm:w-80">
          <p className="text-sm text-muted-foreground">Meta da equipe</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {formatarValor(ativadoEquipe)}
            </p>
            <p className="text-sm text-muted-foreground">de {formatarValor(metaEquipe)}</p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(pctEquipe, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{Math.round(pctEquipe)}% da meta</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="border-b border-border p-5">
            <h3 className="text-sm font-semibold text-foreground">Ranking de vendas</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ordenado pelo percentual da meta em R$
            </p>
          </div>

          {estadoDaLista(
            "Nenhum membro encontrado.",
            <Trophy className="h-8 w-8 text-muted-foreground" />,
            noFiltro,
          ) ??
            rankingVendas.map((r, i) => (
              <div
                key={r.membro.id}
                className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                  {i + 1}º
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-foreground">{r.membro.nome}</p>
                    <p className="shrink-0 text-sm font-semibold text-foreground">
                      {formatarValor(r.valorAtivado)}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${Math.min(r.pctValor, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Meta: {formatarValor(r.valorMeta)} · {Math.round(r.pctValor)}% da meta ·{" "}
                    {r.countAtivacoes} ativaç{r.countAtivacoes === 1 ? "ão" : "ões"} ·{" "}
                    {r.countReativacoes} reativaç{r.countReativacoes === 1 ? "ão" : "ões"}
                  </p>
                </div>
                {botaoEditar(r.membro)}
              </div>
            ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Ligações e reuniões                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Ligações e reuniões</h2>
          <p className="text-xs text-muted-foreground">
            Só membros — o Supervisor conduz a reunião, não faz a ligação. Os totais são do período
            escolhido; a meta ao lado é a do dia.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardAtividade titulo="Ligações" total={ligacoesEquipe} metaDia={metaLigacoesDiaEquipe} />
          <CardAtividade
            titulo="Reuniões marcadas"
            total={reunioesEquipe}
            metaDia={metaReunioesDiaEquipe}
          />

          {/* Mesma conta da Dashboard: polos que estavam em reunião e viraram
              ativação. Sem meta: converter não depende de quem ligou — quem
              conduz a reunião é o supervisor. */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-muted-foreground">Convertidos</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {convertidasEquipe}
              </p>
              {reunioesRealizadasEquipe > 0 && (
                <p className="text-sm text-muted-foreground">
                  de {reunioesRealizadasEquipe} reuniões
                </p>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {reunioesRealizadasEquipe > 0
                ? `${decimal(pctConversaoEquipe)}% das reuniões realizadas no período`
                : "Nenhuma reunião realizada no período."}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="border-b border-border p-5">
            <h3 className="text-sm font-semibold text-foreground">Atividade por membro</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ordenado por quem mais ligou no período
            </p>
          </div>

          {estadoDaLista(
            "Só quem tem cargo Membro aparece aqui.",
            <Phone className="h-8 w-8 text-muted-foreground" />,
            soMembros,
          ) ??
            rankingAtividade.map((r, i) => (
              <div
                key={r.membro.id}
                className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                  {i + 1}º
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="truncate text-sm font-medium text-foreground">{r.membro.nome}</p>

                  <LinhaAtividade
                    rotulo="Ligações"
                    total={r.ligacoes}
                    metaDia={r.metaLigacoesDia}
                  />
                  <LinhaAtividade
                    rotulo="Reuniões marcadas"
                    total={r.reunioesMarcadas}
                    metaDia={r.metaReunioesDia}
                  />

                  <p className="text-xs text-muted-foreground">
                    {r.reunioesRealizadas > 0 ? (
                      <>
                        <span className="font-medium text-foreground">{r.convertidas}</span>{" "}
                        convertidas de {r.reunioesRealizadas} reuniões realizadas (
                        {Math.round(r.pctConversao)}%)
                      </>
                    ) : (
                      "Nenhuma reunião realizada no período."
                    )}
                  </p>
                </div>
                {botaoEditar(r.membro)}
              </div>
            ))}
        </div>
      </section>

      <Dialog open={!!metaAlvo} onOpenChange={(o) => !o && setMetaAlvo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Metas de {metaAlvo?.nome}</DialogTitle>
            <DialogDescription>
              {metaAlvo?.ehMembro
                ? "Ligações e reuniões são metas por dia. A meta em R$ é do mês de referência do período selecionado. Deixe em branco o que não se aplica."
                : "Só quem tem cargo Membro tem meta de ligações e reuniões — aqui vale a meta de vendas do mês de referência."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {metaAlvo?.ehMembro && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="meta-ligacoes">Ligações por dia</Label>
                  <Input
                    id="meta-ligacoes"
                    type="number"
                    min={0}
                    step="1"
                    value={metaLigacoes}
                    onChange={(e) => setMetaLigacoes(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meta-reunioes">Reuniões marcadas por dia</Label>
                  <Input
                    id="meta-reunioes"
                    type="number"
                    min={0}
                    step="1"
                    value={metaReunioes}
                    onChange={(e) => setMetaReunioes(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="meta-valor">Meta de vendas no mês (R$)</Label>
              <Input
                id="meta-valor"
                type="number"
                min={0}
                step="0.01"
                value={metaValor}
                onChange={(e) => setMetaValor(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaAlvo(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarMeta} disabled={setMetaMut.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Uma métrica de atividade do membro: total no período, com a meta do dia ao lado. */
function LinhaAtividade({
  rotulo,
  total,
  metaDia,
}: {
  rotulo: string;
  total: number;
  metaDia: number;
}) {
  const pct = metaDia > 0 ? (total / metaDia) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{rotulo}</span>
        <span className="text-sm font-semibold text-foreground">{total}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {metaDia > 0
          ? `Meta: ${metaDia}/dia · ${Math.round(pct)}% da meta`
          : "Sem meta diária cadastrada"}
      </p>
    </div>
  );
}
