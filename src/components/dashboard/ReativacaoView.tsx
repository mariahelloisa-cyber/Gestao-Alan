import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listPolos, updatePolo, deletePolo } from "@/lib/polos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Eye, Search, RotateCcw, UserX } from "lucide-react";

type Nivel = "N1" | "N2" | "N3";
type Polo = Awaited<ReturnType<typeof listPolos>>[number];

function formatarValor(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

const NIVEL_BADGE: Record<Nivel, string> = {
  N1: "bg-foreground text-background",
  N2: "bg-gray-500 text-white",
  N3: "bg-gray-200 text-black",
};

export function ReativacaoView() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPolos);
  const updateFn = useServerFn(updatePolo);
  const deleteFn = useServerFn(deletePolo);

  const { data: polos = [], isLoading } = useQuery({
    queryKey: ["polos-ativacao"],
    queryFn: () => listFn(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["polos-ativacao"] });

  const polosDesligados = useMemo(() => polos.filter((p) => p.situacao === "desligado"), [polos]);

  const [busca, setBusca] = useState("");
  const polosFiltrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    if (!buscaNorm) return polosDesligados;
    return polosDesligados.filter((p) => {
      const alvo = [p.nome, p.contato, p.email, p.produto].filter(Boolean).join(" ").toLowerCase();
      return alvo.includes(buscaNorm);
    });
  }, [polosDesligados, busca]);

  const [verAlvo, setVerAlvo] = useState<Polo | null>(null);
  const [reativarAlvo, setReativarAlvo] = useState<Polo | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Polo excluído.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir polo."),
  });

  const reativarMut = useMutation({
    mutationFn: async () => {
      if (!reativarAlvo) return;
      await updateFn({
        data: {
          id: reativarAlvo.id,
          nivel: reativarAlvo.nivel as Nivel,
          nome: reativarAlvo.nome,
          contato: reativarAlvo.contato || undefined,
          email: reativarAlvo.email || undefined,
          produto: reativarAlvo.produto || undefined,
          data_ativacao: reativarAlvo.data_ativacao || undefined,
          valor_ativacao: reativarAlvo.valor_ativacao ?? undefined,
          situacao: "reativado",
          data_saida: undefined,
          motivo_saida: undefined,
          observacao: reativarAlvo.observacao || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Polo reativado — voltou pra Ativação.");
      setReativarAlvo(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reativar polo."),
  });

  return (
    <div className="w-full space-y-6 bg-[var(--surface-1)] px-6 py-6">
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reativação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Polos inativados — dados de ativação, data e motivo da saída.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-muted-foreground">Polos inativados</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {polosDesligados.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-muted-foreground">Valor perdido</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {formatarValor(polosDesligados.reduce((s, p) => s + (p.valor_ativacao ?? 0), 0))}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="border-b border-border p-4">
          <div className="relative min-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, contato, e-mail ou produto"
              className="rounded-full pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Nível</TableHead>
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">Produto</TableHead>
                <TableHead className="text-muted-foreground">Ativação</TableHead>
                <TableHead className="text-muted-foreground">Valor</TableHead>
                <TableHead className="text-muted-foreground">Saída</TableHead>
                <TableHead className="text-muted-foreground">Motivo da saída</TableHead>
                <TableHead className="text-right text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : polosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    {polosDesligados.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        <UserX className="h-8 w-8 text-muted-foreground" />
                        Nenhum polo inativado.
                      </span>
                    ) : (
                      "Nenhum registro encontrado."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                polosFiltrados.map((p) => (
                  <TableRow key={p.id} className="border-border hover:bg-accent/50">
                    <TableCell>
                      <Badge className={NIVEL_BADGE[p.nivel as Nivel]}>{p.nivel}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>
                      <div className="text-sm">{p.contato || "—"}</div>
                      {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                    </TableCell>
                    <TableCell>{p.produto || "—"}</TableCell>
                    <TableCell>{formatarData(p.data_ativacao)}</TableCell>
                    <TableCell>{formatarValor(p.valor_ativacao)}</TableCell>
                    <TableCell>{formatarData(p.data_saida)}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={p.motivo_saida ?? ""}>
                      {p.motivo_saida || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setVerAlvo(p)}
                          title="Visualizar polo"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                          onClick={() => setReativarAlvo(p)}
                          title="Reativar polo"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              title="Excluir polo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir "{p.nome}"?</AlertDialogTitle>
                              <AlertDialogDescription>Ação permanente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(p.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Visualizar */}
      <Dialog open={!!verAlvo} onOpenChange={(o) => !o && setVerAlvo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do polo</DialogTitle>
          </DialogHeader>
          {verAlvo && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Nível</Label>
                <p>{verAlvo.nivel}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <p>{verAlvo.nome}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Contato</Label>
                <p>{verAlvo.contato || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <p>{verAlvo.email || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Produto</Label>
                <p>{verAlvo.produto || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data de ativação</Label>
                <p>{formatarData(verAlvo.data_ativacao)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor de ativação</Label>
                <p>{formatarValor(verAlvo.valor_ativacao)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data de saída</Label>
                <p>{formatarData(verAlvo.data_saida)}</p>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Motivo da saída</Label>
                <p className="whitespace-pre-wrap">{verAlvo.motivo_saida || "—"}</p>
              </div>
              {verAlvo.observacao && (
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Observação</Label>
                  <p className="whitespace-pre-wrap">{verAlvo.observacao}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerAlvo(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reativar */}
      <Dialog open={!!reativarAlvo} onOpenChange={(o) => !o && setReativarAlvo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reativar "{reativarAlvo?.nome}"?</DialogTitle>
            <DialogDescription>
              O polo volta a aparecer em Ativação com situação "Reativado". Data e motivo da saída
              são limpos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReativarAlvo(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => reativarMut.mutate()}
              disabled={reativarMut.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Reativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
