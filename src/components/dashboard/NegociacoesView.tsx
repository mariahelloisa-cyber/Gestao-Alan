import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listNegociacoes,
  createNegociacao,
  updateNegociacao,
  deleteNegociacao,
} from "@/lib/negociacoes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Eye, Search, Handshake, Users } from "lucide-react";

type Negociacao = Awaited<ReturnType<typeof listNegociacoes>>[number];

type FormState = {
  nome: string;
  contato: string;
  email: string;
  numero_funcionarios: string;
  observacao: string;
};

const FORM_VAZIO: FormState = {
  nome: "",
  contato: "",
  email: "",
  numero_funcionarios: "",
  observacao: "",
};

function negociacaoParaForm(n: Negociacao): FormState {
  return {
    nome: n.nome,
    contato: n.contato ?? "",
    email: n.email ?? "",
    numero_funcionarios: n.numero_funcionarios != null ? String(n.numero_funcionarios) : "",
    observacao: n.observacao ?? "",
  };
}

export function NegociacoesView() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNegociacoes);
  const createFn = useServerFn(createNegociacao);
  const updateFn = useServerFn(updateNegociacao);
  const deleteFn = useServerFn(deleteNegociacao);

  const {
    data: negociacoes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["negociacoes"],
    queryFn: () => listFn(),
    retry: 1,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["negociacoes"] });

  const [busca, setBusca] = useState("");
  const negociacoesFiltradas = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    if (!buscaNorm) return negociacoes;
    return negociacoes.filter((n) => {
      const alvo = [n.nome, n.contato, n.email].filter(Boolean).join(" ").toLowerCase();
      return alvo.includes(buscaNorm);
    });
  }, [negociacoes, busca]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);

  const abrirNovo = () => {
    setEditId(null);
    setViewOnly(false);
    setForm(FORM_VAZIO);
    setDialogOpen(true);
  };

  const abrirEdicao = (n: Negociacao) => {
    setEditId(n.id);
    setViewOnly(false);
    setForm(negociacaoParaForm(n));
    setDialogOpen(true);
  };

  const abrirVisualizar = (n: Negociacao) => {
    setEditId(n.id);
    setViewOnly(true);
    setForm(negociacaoParaForm(n));
    setDialogOpen(true);
  };

  const salvarMut = useMutation({
    mutationFn: async (vars: { id?: string } & FormState) => {
      const payload = {
        nome: vars.nome.trim(),
        contato: vars.contato.trim() || undefined,
        email: vars.email.trim() || undefined,
        numero_funcionarios: vars.numero_funcionarios
          ? Number(vars.numero_funcionarios)
          : undefined,
        observacao: vars.observacao.trim() || undefined,
      };
      if (vars.id) {
        await updateFn({ data: { id: vars.id, ...payload } });
      } else {
        await createFn({ data: payload });
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Negociação atualizada." : "Negociação cadastrada.");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar negociação."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Negociação excluída.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir negociação."),
  });

  const salvar = () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da empresa/parceiro.");
      return;
    }
    salvarMut.mutate({ id: editId ?? undefined, ...form });
  };

  return (
    <div className="w-full space-y-6 bg-[var(--surface-1)] px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Negociações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro e listagem de negociações em andamento.
          </p>
        </div>
        <Button onClick={abrirNovo} className="rounded-lg shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nova negociação
        </Button>
      </header>

      <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)] sm:w-64">
        <p className="text-sm text-muted-foreground">Total cadastrado</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {negociacoes.length}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="border-b border-border p-4">
          <div className="relative min-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, contato ou e-mail"
              className="rounded-full pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="pl-4 text-muted-foreground">Empresa/Parceiro</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">E-mail</TableHead>
                <TableHead className="text-muted-foreground">Funcionários</TableHead>
                <TableHead className="text-muted-foreground">Observação</TableHead>
                <TableHead className="pr-4 text-right text-muted-foreground"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-destructive">
                    Falha ao carregar:{" "}
                    {error instanceof Error ? error.message : "erro desconhecido"}
                  </TableCell>
                </TableRow>
              ) : negociacoesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {negociacoes.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        <Handshake className="h-8 w-8 text-muted-foreground" />
                        Nenhuma negociação cadastrada ainda.
                      </span>
                    ) : (
                      "Nenhum registro encontrado."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                negociacoesFiltradas.map((n) => (
                  <TableRow key={n.id} className="border-border hover:bg-accent/50">
                    <TableCell className="pl-4 font-medium">{n.nome}</TableCell>
                    <TableCell>{n.contato || "—"}</TableCell>
                    <TableCell>{n.email || "—"}</TableCell>
                    <TableCell>
                      {n.numero_funcionarios != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {n.numero_funcionarios}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate" title={n.observacao ?? ""}>
                      {n.observacao || "—"}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirVisualizar(n)}
                          title="Visualizar negociação"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirEdicao(n)}
                          title="Editar negociação"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              title="Excluir negociação"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir "{n.nome}"?</AlertDialogTitle>
                              <AlertDialogDescription>Ação permanente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(n.id)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {viewOnly
                ? "Detalhes da negociação"
                : editId
                  ? "Editar negociação"
                  : "Nova negociação"}
            </DialogTitle>
            <DialogDescription>Preencha os dados da negociação.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="neg-nome">Nome da empresa/parceiro</Label>
              <Input
                id="neg-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                disabled={viewOnly}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="neg-contato">Contato</Label>
              <Input
                id="neg-contato"
                value={form.contato}
                onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
                disabled={viewOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="neg-email">E-mail</Label>
              <Input
                id="neg-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={viewOnly}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="neg-funcionarios">Número de funcionários</Label>
              <Input
                id="neg-funcionarios"
                type="number"
                min={0}
                step="1"
                value={form.numero_funcionarios}
                onChange={(e) => setForm((f) => ({ ...f, numero_funcionarios: e.target.value }))}
                disabled={viewOnly}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="neg-obs">Observação</Label>
              <Textarea
                id="neg-obs"
                rows={4}
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                disabled={viewOnly}
              />
            </div>
          </div>
          <DialogFooter>
            {viewOnly ? (
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Fechar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={salvar} disabled={salvarMut.isPending}>
                  {editId ? "Salvar" : "Cadastrar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
