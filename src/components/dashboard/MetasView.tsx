import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useTasks } from "@/lib/tasks-store";
import { listPolos } from "@/lib/polos.functions";
import { listMetas, setMeta } from "@/lib/metas.functions";
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
import { Pencil, Trophy } from "lucide-react";

function formatarValor(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function primeiroDiaDoMes(): string {
  const hoje = new Date();
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return d.toISOString().slice(0, 10);
}

function ultimoDiaDoMes(): string {
  const hoje = new Date();
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

const TODOS = "todos";

export function MetasView() {
  const qc = useQueryClient();
  const { membros, myCargo } = useTasks();
  const isAdmin = myCargo === "Admin";

  const [de, setDe] = useState(() => primeiroDiaDoMes());
  const [ate, setAte] = useState(() => ultimoDiaDoMes());
  const periodo = de.slice(0, 7);
  const [membroFiltroId, setMembroFiltroId] = useState(TODOS);

  const listPolosFn = useServerFn(listPolos);
  const listMetasFn = useServerFn(listMetas);
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

  const isLoading = loadingPolos || loadingMetas;
  const error = errorPolos ?? errorMetas;

  const [metaAlvo, setMetaAlvo] = useState<{ id: string; nome: string } | null>(null);
  const [metaValor, setMetaValor] = useState("");

  const setMetaMut = useMutation({
    mutationFn: (vars: { usuario_id: string; periodo: string; valor_meta: number }) =>
      setMetaFn({ data: vars }),
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

  const ranking = useMemo(() => {
    const membrosOrdenados = [...membros].sort((a, b) => a.nome.localeCompare(b.nome));
    return membrosOrdenados
      .map((m) => {
        const ativacoesDoMembro = ativacoesNoPeriodo.filter((p) => p.responsavel_id === m.id);
        const reativacoesDoMembro = reativacoesNoPeriodo.filter((p) => p.reativado_por === m.id);
        const valorAtivado =
          ativacoesDoMembro.reduce((s, p) => s + (p.valor_ativacao ?? 0), 0) +
          reativacoesDoMembro.reduce((s, p) => s + (p.valor_reativacao ?? 0), 0);
        const valorMeta = metasNoPeriodo.find((x) => x.usuario_id === m.id)?.valor_meta ?? 0;
        const pct = valorMeta > 0 ? (valorAtivado / valorMeta) * 100 : 0;
        return {
          membro: m,
          countAtivacoes: ativacoesDoMembro.length,
          countReativacoes: reativacoesDoMembro.length,
          valorAtivado,
          valorMeta,
          pct,
        };
      })
      .sort((a, b) => b.pct - a.pct || b.valorAtivado - a.valorAtivado);
  }, [membros, ativacoesNoPeriodo, reativacoesNoPeriodo, metasNoPeriodo]);

  const rankingExibido =
    membroFiltroId === TODOS ? ranking : ranking.filter((r) => r.membro.id === membroFiltroId);

  const metaEquipe = metasNoPeriodo.reduce((s, m) => s + m.valor_meta, 0);
  const ativadoEquipe =
    ativacoesNoPeriodo.reduce((s, p) => s + (p.valor_ativacao ?? 0), 0) +
    reativacoesNoPeriodo.reduce((s, p) => s + (p.valor_reativacao ?? 0), 0);
  const pctEquipe = metaEquipe > 0 ? (ativadoEquipe / metaEquipe) * 100 : 0;

  const abrirEditarMeta = (m: { id: string; nome: string }) => {
    setMetaAlvo(m);
    setMetaValor(String(metasNoPeriodo.find((x) => x.usuario_id === m.id)?.valor_meta ?? ""));
  };

  const salvarMeta = () => {
    if (!metaAlvo) return;
    const valor = Number(metaValor.replace(",", "."));
    if (!metaValor || isNaN(valor) || valor < 0) {
      toast.error("Informe um valor de meta válido.");
      return;
    }
    setMetaMut.mutate({ usuario_id: metaAlvo.id, periodo, valor_meta: valor });
  };

  return (
    <div className="w-full space-y-6 px-6 py-6">
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Metas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe as metas de ativação da equipe, período a período.
        </p>
      </header>

      <div className="max-w-xs space-y-1.5">
        <Label>Membro</Label>
        <Select value={membroFiltroId} onValueChange={setMembroFiltroId}>
          <SelectTrigger>
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
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Ranking de membros</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ordenado pelo valor apurado no período selecionado
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="meta-de" className="text-xs text-muted-foreground">
                De
              </Label>
              <Input
                id="meta-de"
                type="date"
                value={de}
                max={ate}
                onChange={(e) => setDe(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="meta-ate" className="text-xs text-muted-foreground">
                Até
              </Label>
              <Input
                id="meta-ate"
                type="date"
                value={ate}
                min={de}
                onChange={(e) => setAte(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : error ? (
          <div className="py-10 text-center text-sm text-destructive">
            Falha ao carregar: {error instanceof Error ? error.message : "erro desconhecido"}
          </div>
        ) : rankingExibido.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <span className="inline-flex flex-col items-center gap-2">
              <Trophy className="h-8 w-8 text-muted-foreground" />
              Nenhum membro encontrado.
            </span>
          </div>
        ) : (
          rankingExibido.map((r) => {
            const posicao = ranking.findIndex((x) => x.membro.id === r.membro.id);
            const pctExibida = Math.round(r.pct);
            const pctBarra = Math.min(r.pct, 100);
            return (
              <div
                key={r.membro.id}
                className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                  {posicao + 1}º
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
                      style={{ width: `${pctBarra}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Meta: {formatarValor(r.valorMeta)} · {pctExibida}% da meta · {r.countAtivacoes}{" "}
                    ativaç{r.countAtivacoes === 1 ? "ão" : "ões"} · {r.countReativacoes} reativaç
                    {r.countReativacoes === 1 ? "ão" : "ões"}
                  </p>
                </div>

                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => abrirEditarMeta(r.membro)}
                    title="Editar meta"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      <Dialog open={!!metaAlvo} onOpenChange={(o) => !o && setMetaAlvo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Meta de {metaAlvo?.nome}</DialogTitle>
            <DialogDescription>
              Valor de ativação a atingir no mês de referência do período "De".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="meta-valor">Meta (R$)</Label>
            <Input
              id="meta-valor"
              type="number"
              min={0}
              step="0.01"
              value={metaValor}
              onChange={(e) => setMetaValor(e.target.value)}
              autoFocus
            />
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
