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
import {
  Trash2,
  Eye,
  Search,
  Ban,
  Undo2,
  ExternalLink,
  Phone,
  Mail,
  GraduationCap,
  Calendar,
  DollarSign,
  FileText,
  X,
} from "lucide-react";
import {
  DetailHeader,
  DetailHighlight,
  DetailHighlightItem,
  DetailSection,
  DetailField,
} from "@/components/dashboard/detail-view";

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

function formatarHorario(h: string | null): string {
  if (!h) return "—";
  return h.slice(0, 5);
}

const NIVEL_BADGE: Record<Nivel, string> = {
  N1: "bg-foreground text-background",
  N2: "bg-gray-500 text-white",
  N3: "bg-gray-200 text-black",
};

export function InativosView() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPolos);
  const updateFn = useServerFn(updatePolo);
  const deleteFn = useServerFn(deletePolo);

  const {
    data: polos = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["polos-ativacao"],
    queryFn: () => listFn(),
    retry: 1,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["polos-ativacao"] });

  const inativos = useMemo(() => polos.filter((p) => p.situacao === "inativo"), [polos]);

  const [busca, setBusca] = useState("");
  const polosFiltrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    if (!buscaNorm) return inativos;
    return inativos.filter((p) => {
      const alvo = [p.nome, p.contato, p.email, p.produto].filter(Boolean).join(" ").toLowerCase();
      return alvo.includes(buscaNorm);
    });
  }, [inativos, busca]);

  const [verAlvo, setVerAlvo] = useState<Polo | null>(null);
  const [reabrirAlvo, setReabrirAlvo] = useState<Polo | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Polo excluído.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir polo."),
  });

  /** Desfaz a classificação: o polo volta para a aba Reuniões. */
  const reabrirMut = useMutation({
    mutationFn: async () => {
      if (!reabrirAlvo) return;
      await updateFn({
        data: {
          id: reabrirAlvo.id,
          nivel: reabrirAlvo.nivel as Nivel,
          nome: reabrirAlvo.nome,
          situacao: "reuniao",
        },
      });
    },
    onSuccess: () => {
      toast.success("Polo devolvido para Reuniões.");
      setReabrirAlvo(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reabrir polo."),
  });

  return (
    <div className="w-full space-y-6 px-6 py-6">
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inativos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Polos que passaram pela reunião e não fecharam.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-muted-foreground">Polos inativos</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {inativos.length}
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
                <TableHead className="pl-4 text-muted-foreground">Nível</TableHead>
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">Produto</TableHead>
                <TableHead className="text-muted-foreground">Reunião</TableHead>
                <TableHead className="text-muted-foreground">Horário</TableHead>
                <TableHead className="text-muted-foreground">Faturamento</TableHead>
                <TableHead className="pr-4 text-right text-muted-foreground"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-destructive">
                    Falha ao carregar:{" "}
                    {error instanceof Error ? error.message : "erro desconhecido"}
                  </TableCell>
                </TableRow>
              ) : polosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    {inativos.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        <Ban className="h-8 w-8 text-muted-foreground" />
                        Nenhum polo inativo.
                      </span>
                    ) : (
                      "Nenhum registro encontrado."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                polosFiltrados.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer border-border hover:bg-accent/50"
                    onClick={() => setVerAlvo(p)}
                  >
                    <TableCell className="pl-4">
                      <Badge className={NIVEL_BADGE[p.nivel as Nivel]}>{p.nivel}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>
                      <div className="text-sm">{p.contato || "—"}</div>
                      {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate" title={p.produto || undefined}>
                        {p.produto || "—"}
                      </div>
                    </TableCell>
                    <TableCell>{formatarData(p.data_reuniao)}</TableCell>
                    <TableCell>{formatarHorario(p.horario_reuniao)}</TableCell>
                    <TableCell>{formatarValor(p.faturamento)}</TableCell>
                    <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
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
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setReabrirAlvo(p)}
                          title="Devolver para Reuniões"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
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
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DetailHeader
            icon={Ban}
            title="Detalhes do polo"
            subtitle="Informações completas do polo selecionado"
          />
          {verAlvo && (
            <div className="space-y-4">
              <DetailHighlight>
                <DetailHighlightItem label="Nível">
                  <Badge className={NIVEL_BADGE[verAlvo.nivel as Nivel]}>{verAlvo.nivel}</Badge>
                </DetailHighlightItem>
                <DetailHighlightItem label="Nome do polo">
                  <p className="text-lg font-semibold">{verAlvo.nome}</p>
                </DetailHighlightItem>
              </DetailHighlight>

              <DetailSection icon={Phone} title="Informações de contato">
                <DetailField icon={Phone} label="Contato">
                  {verAlvo.contato || "—"}
                </DetailField>
                <DetailField icon={Mail} label="E-mail">
                  {verAlvo.email || "—"}
                </DetailField>
              </DetailSection>

              <DetailSection icon={Calendar} title="Informações da reunião">
                <DetailField icon={GraduationCap} label="Produto" full>
                  {verAlvo.produto || "—"}
                </DetailField>
                <DetailField icon={Calendar} label="Data da reunião">
                  {formatarData(verAlvo.data_reuniao)}
                </DetailField>
                <DetailField icon={Calendar} label="Horário">
                  {formatarHorario(verAlvo.horario_reuniao)}
                </DetailField>
                <DetailField icon={DollarSign} label="Faturamento">
                  {formatarValor(verAlvo.faturamento)}
                </DetailField>
                <DetailField icon={ExternalLink} label="Link da reunião">
                  {verAlvo.link_reuniao ? (
                    <a
                      href={verAlvo.link_reuniao}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      Abrir <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailField>
              </DetailSection>

              {verAlvo.observacao && (
                <DetailSection icon={FileText} title="Observação">
                  <p className="whitespace-pre-wrap sm:col-span-2">{verAlvo.observacao}</p>
                </DetailSection>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerAlvo(null)}>
              <X className="mr-1.5 h-4 w-4" /> Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Devolver para Reuniões */}
      <AlertDialog open={!!reabrirAlvo} onOpenChange={(o) => !o && setReabrirAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver "{reabrirAlvo?.nome}" para Reuniões?</AlertDialogTitle>
            <AlertDialogDescription>
              O polo volta a aparecer na aba Reuniões, com os dados da reunião preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => reabrirMut.mutate()}>Devolver</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
