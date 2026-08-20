import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listEscolasTecnicas,
  createEscolaTecnica,
  updateEscolaTecnica,
  deleteEscolaTecnica,
} from "@/lib/escolas-tecnicas.functions";
import { useTasks } from "@/lib/tasks-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Eye, Search, GraduationCap, X } from "lucide-react";

type EscolaTecnica = Awaited<ReturnType<typeof listEscolasTecnicas>>[number];

type FormState = {
  nome: string;
  contato: string;
  email: string;
  estado: string;
  cidade: string;
  cursos: string[];
  observacao: string;
  responsavel_id: string;
};

const FORM_VAZIO: FormState = {
  nome: "",
  contato: "",
  email: "",
  estado: "",
  cidade: "",
  cursos: [],
  observacao: "",
  responsavel_id: "",
};

function escolaParaForm(e: EscolaTecnica): FormState {
  return {
    nome: e.nome,
    contato: e.contato ?? "",
    email: e.email ?? "",
    estado: e.estado ?? "",
    cidade: e.cidade ?? "",
    cursos: e.cursos ?? [],
    observacao: e.observacao ?? "",
    responsavel_id: e.responsavel_id ?? "",
  };
}

export function EscolasTecnicasView() {
  const qc = useQueryClient();
  const { membros } = useTasks();
  const listFn = useServerFn(listEscolasTecnicas);
  const createFn = useServerFn(createEscolaTecnica);
  const updateFn = useServerFn(updateEscolaTecnica);
  const deleteFn = useServerFn(deleteEscolaTecnica);

  const {
    data: escolas = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["escolas-tecnicas"],
    queryFn: () => listFn(),
    retry: 1,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["escolas-tecnicas"] });

  const [busca, setBusca] = useState("");
  const escolasFiltradas = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    if (!buscaNorm) return escolas;
    return escolas.filter((e) => {
      const alvo = [e.nome, e.contato, e.email, e.estado, e.cidade, ...(e.cursos ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return alvo.includes(buscaNorm);
    });
  }, [escolas, busca]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [cursoInput, setCursoInput] = useState("");

  const abrirNovo = () => {
    setEditId(null);
    setViewOnly(false);
    setForm(FORM_VAZIO);
    setCursoInput("");
    setDialogOpen(true);
  };

  const abrirEdicao = (e: EscolaTecnica) => {
    setEditId(e.id);
    setViewOnly(false);
    setForm(escolaParaForm(e));
    setCursoInput("");
    setDialogOpen(true);
  };

  const abrirVisualizar = (e: EscolaTecnica) => {
    setEditId(e.id);
    setViewOnly(true);
    setForm(escolaParaForm(e));
    setCursoInput("");
    setDialogOpen(true);
  };

  const adicionarCurso = () => {
    const curso = cursoInput.trim();
    if (!curso) return;
    if (form.cursos.includes(curso)) {
      setCursoInput("");
      return;
    }
    setForm((f) => ({ ...f, cursos: [...f.cursos, curso] }));
    setCursoInput("");
  };

  const removerCurso = (curso: string) => {
    setForm((f) => ({ ...f, cursos: f.cursos.filter((c) => c !== curso) }));
  };

  const salvarMut = useMutation({
    mutationFn: async (vars: { id?: string } & FormState) => {
      const payload = {
        nome: vars.nome.trim(),
        contato: vars.contato.trim() || undefined,
        email: vars.email.trim() || undefined,
        estado: vars.estado.trim() || undefined,
        cidade: vars.cidade.trim() || undefined,
        cursos: vars.cursos,
        observacao: vars.observacao.trim() || undefined,
        responsavel_id: vars.responsavel_id || undefined,
      };
      if (vars.id) {
        await updateFn({ data: { id: vars.id, ...payload } });
      } else {
        await createFn({ data: payload });
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Escola atualizada." : "Escola cadastrada.");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar escola."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Escola excluída.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir escola."),
  });

  const salvar = () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da empresa/escola.");
      return;
    }
    salvarMut.mutate({ id: editId ?? undefined, ...form });
  };

  return (
    <div className="w-full space-y-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Escolas Técnicas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro e listagem de escolas técnicas parceiras.
          </p>
        </div>
        <Button onClick={abrirNovo} className="rounded-lg shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nova escola
        </Button>
      </header>

      <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)] sm:w-64">
        <p className="text-sm text-muted-foreground">Total cadastrado</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {escolas.length}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="border-b border-border p-4">
          <div className="relative min-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, contato, e-mail, local ou curso"
              className="rounded-full pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="pl-4 text-muted-foreground">Empresa/Escola</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">Localização</TableHead>
                <TableHead className="text-muted-foreground">Cursos</TableHead>
                <TableHead className="text-muted-foreground">Responsável</TableHead>
                <TableHead className="pr-4 text-right text-muted-foreground">Ações</TableHead>
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
              ) : escolasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {escolas.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        <GraduationCap className="h-8 w-8 text-muted-foreground" />
                        Nenhuma escola cadastrada ainda.
                      </span>
                    ) : (
                      "Nenhum registro encontrado."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                escolasFiltradas.map((e) => (
                  <TableRow key={e.id} className="border-border hover:bg-accent/50">
                    <TableCell className="pl-4 font-medium">{e.nome}</TableCell>
                    <TableCell>
                      <div className="text-sm">{e.contato || "—"}</div>
                      {e.email && <div className="text-xs text-muted-foreground">{e.email}</div>}
                    </TableCell>
                    <TableCell>
                      {e.cidade || e.estado
                        ? [e.cidade, e.estado].filter(Boolean).join(" - ")
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <div className="truncate" title={(e.cursos ?? []).join(", ") || undefined}>
                        {(e.cursos ?? []).length > 0 ? e.cursos.join(", ") : "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {membros.find((m) => m.id === e.responsavel_id)?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirVisualizar(e)}
                          title="Visualizar escola"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirEdicao(e)}
                          title="Editar escola"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              title="Excluir escola"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir "{e.nome}"?</AlertDialogTitle>
                              <AlertDialogDescription>Ação permanente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(e.id)}
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
              {viewOnly ? "Detalhes da escola" : editId ? "Editar escola" : "Nova escola"}
            </DialogTitle>
            <DialogDescription>Preencha os dados da escola técnica.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="esc-nome">Nome da empresa/escola</Label>
              <Input
                id="esc-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                disabled={viewOnly}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="esc-contato">Contato</Label>
              <Input
                id="esc-contato"
                value={form.contato}
                onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
                disabled={viewOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="esc-email">E-mail</Label>
              <Input
                id="esc-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={viewOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="esc-estado">Estado</Label>
              <Input
                id="esc-estado"
                value={form.estado}
                onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                disabled={viewOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="esc-cidade">Cidade</Label>
              <Input
                id="esc-cidade"
                value={form.cidade}
                onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                disabled={viewOnly}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="esc-curso">Cursos</Label>
              {!viewOnly && (
                <div className="flex gap-2">
                  <Input
                    id="esc-curso"
                    value={cursoInput}
                    onChange={(e) => setCursoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarCurso();
                      }
                    }}
                    placeholder="Nome do curso"
                  />
                  <Button type="button" variant="outline" onClick={adicionarCurso}>
                    Adicionar
                  </Button>
                </div>
              )}
              {form.cursos.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.cursos.map((curso) => (
                    <Badge
                      key={curso}
                      variant="secondary"
                      className="gap-1 bg-foreground text-background"
                    >
                      {curso}
                      {!viewOnly && (
                        <button
                          type="button"
                          onClick={() => removerCurso(curso)}
                          className="rounded-full hover:opacity-70"
                          title={`Remover ${curso}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              ) : (
                viewOnly && <p className="pt-1 text-sm text-muted-foreground">Nenhum curso.</p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Responsável</Label>
              <Select
                value={form.responsavel_id}
                onValueChange={(v) => setForm((f) => ({ ...f, responsavel_id: v }))}
                disabled={viewOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {membros.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                      {m.cargo ? ` (${m.cargo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="esc-obs">Observação</Label>
              <Textarea
                id="esc-obs"
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
