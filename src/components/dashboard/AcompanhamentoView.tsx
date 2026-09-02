import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listAcompanhamentos,
  createAcompanhamento,
  updateAcompanhamento,
  updateEtapaAcompanhamento,
  deleteAcompanhamento,
} from "@/lib/acompanhamentos.functions";
import { listPolos, createPolo } from "@/lib/polos.functions";
import { listNegociacoes, createNegociacao } from "@/lib/negociacoes.functions";
import { listEscolasTecnicas, createEscolaTecnica } from "@/lib/escolas-tecnicas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Plus,
  Pencil,
  Trash2,
  Eye,
  Route,
  X,
  Map,
  User,
  GraduationCap,
  Users,
  Handshake,
  Search,
} from "lucide-react";
import {
  formatarTelefone,
  formatarTelefoneSeAplicavel,
  TELEFONE_INPUT_PROPS,
} from "@/lib/telefone";

type Acompanhamento = Awaited<ReturnType<typeof listAcompanhamentos>>[number];
type Etapa = Acompanhamento["etapa"];
type Destino = Acompanhamento["destino"];
type Origem = "polo" | "negociacao" | "escola_tecnica";
type Nivel = "N1" | "N2" | "N3";

const ETAPAS: { key: Etapa; label: string; cor: string; icon: typeof Map }[] = [
  { key: "mapeamento", label: "Mapeamento", cor: "#6b7280", icon: Map },
  { key: "primeiro_contato", label: "Primeiro Contato", cor: "#0ea5e9", icon: User },
  { key: "qualificacao", label: "Qualificação", cor: "#a855f7", icon: GraduationCap },
  { key: "reuniao", label: "Reunião", cor: "#f59e0b", icon: Users },
  { key: "proposta_comercial", label: "Proposta Comercial", cor: "#22c55e", icon: Handshake },
];

const DESTINO_LABEL: Record<Destino, string> = {
  ativacao: "Ativação",
  negociacoes: "Negociações",
  escola_tecnica: "Escola Técnica",
};

const DESTINO_BADGE: Record<Destino, string> = {
  ativacao: "bg-red-500 text-white",
  negociacoes: "bg-red-500 text-white",
  escola_tecnica: "bg-red-500 text-white",
};

const ORIGEM_POR_DESTINO: Record<Destino, Origem> = {
  ativacao: "polo",
  negociacoes: "negociacao",
  escola_tecnica: "escola_tecnica",
};

// Formulário de "novo cliente" é um superset dos campos das 3 telas de
// destino — só mostramos o subconjunto relevante conforme o destino
// escolhido, mas cadastramos direto na tabela real (polos_ativacao /
// negociacoes / escolas_tecnicas), igual ao cadastro completo de cada tela.
type NovoClienteForm = {
  nivel: Nivel;
  nome: string;
  contato: string;
  email: string;
  produto: string;
  data_ativacao: string;
  valor_ativacao: string;
  numero_funcionarios: string;
  estado: string;
  cidade: string;
  cursos: string[];
  observacao: string;
};

const NOVO_CLIENTE_VAZIO: NovoClienteForm = {
  nivel: "N1",
  nome: "",
  contato: "",
  email: "",
  produto: "",
  data_ativacao: "",
  valor_ativacao: "",
  numero_funcionarios: "",
  estado: "",
  cidade: "",
  cursos: [],
  observacao: "",
};

type EditForm = {
  nome: string;
  contato: string;
  email: string;
  destino: Destino;
  observacao: string;
};

const EDIT_FORM_VAZIO: EditForm = {
  nome: "",
  contato: "",
  email: "",
  destino: "ativacao",
  observacao: "",
};

export function AcompanhamentoView() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAcompanhamentos);
  const createFn = useServerFn(createAcompanhamento);
  const updateFn = useServerFn(updateAcompanhamento);
  const updateEtapaFn = useServerFn(updateEtapaAcompanhamento);
  const deleteFn = useServerFn(deleteAcompanhamento);

  const listPolosFn = useServerFn(listPolos);
  const createPoloFn = useServerFn(createPolo);
  const listNegociacoesFn = useServerFn(listNegociacoes);
  const createNegociacaoFn = useServerFn(createNegociacao);
  const listEscolasFn = useServerFn(listEscolasTecnicas);
  const createEscolaFn = useServerFn(createEscolaTecnica);

  const {
    data: itens = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["acompanhamentos"],
    queryFn: () => listFn(),
    retry: 1,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["acompanhamentos"] });

  const [busca, setBusca] = useState("");
  const itensFiltrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    if (!buscaNorm) return itens;
    return itens.filter((a) => {
      const alvo = [a.nome, a.contato, a.email].filter(Boolean).join(" ").toLowerCase();
      return alvo.includes(buscaNorm);
    });
  }, [itens, busca]);

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const etapaMut = useMutation({
    mutationFn: (vars: { id: string; etapa: Etapa }) =>
      updateEtapaFn({ data: { id: vars.id, etapa: vars.etapa } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao mover card."),
  });

  const onDrop = (etapa: Etapa) => {
    if (!draggingId) return;
    etapaMut.mutate({ id: draggingId, etapa });
    setDraggingId(null);
  };

  // Diálogo de adicionar/editar
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [modo, setModo] = useState<"novo" | "existente">("novo");
  const [destino, setDestino] = useState<Destino>("ativacao");
  const [editForm, setEditForm] = useState<EditForm>(EDIT_FORM_VAZIO);
  const [novoForm, setNovoForm] = useState<NovoClienteForm>(NOVO_CLIENTE_VAZIO);
  const [cursoInput, setCursoInput] = useState("");
  const [origemId, setOrigemId] = useState("");
  const [etapaAlvo, setEtapaAlvo] = useState<Etapa>("mapeamento");

  const origemTipoAtual = ORIGEM_POR_DESTINO[destino];

  const { data: polos = [] } = useQuery({
    queryKey: ["polos-ativacao"],
    queryFn: () => listPolosFn(),
    enabled: dialogOpen && modo === "existente",
  });
  const { data: negociacoes = [] } = useQuery({
    queryKey: ["negociacoes"],
    queryFn: () => listNegociacoesFn(),
    enabled: dialogOpen && modo === "existente",
  });
  const { data: escolas = [] } = useQuery({
    queryKey: ["escolas-tecnicas"],
    queryFn: () => listEscolasFn(),
    enabled: dialogOpen && modo === "existente",
  });

  const opcoesExistentes = useMemo(() => {
    if (origemTipoAtual === "polo")
      return polos.map((p) => ({ id: p.id, nome: p.nome, email: p.email, contato: p.contato }));
    if (origemTipoAtual === "negociacao")
      return negociacoes.map((n) => ({
        id: n.id,
        nome: n.nome,
        email: n.email,
        contato: n.contato,
      }));
    return escolas.map((e) => ({ id: e.id, nome: e.nome, email: e.email, contato: e.contato }));
  }, [origemTipoAtual, polos, negociacoes, escolas]);

  const abrirNovo = (etapa: Etapa = "mapeamento") => {
    setEditId(null);
    setViewOnly(false);
    setModo("novo");
    setDestino("ativacao");
    setNovoForm(NOVO_CLIENTE_VAZIO);
    setCursoInput("");
    setOrigemId("");
    setEtapaAlvo(etapa);
    setDialogOpen(true);
  };

  const abrirEdicao = (a: Acompanhamento) => {
    setEditId(a.id);
    setViewOnly(false);
    setEditForm({
      nome: a.nome,
      contato: formatarTelefoneSeAplicavel(a.contato ?? ""),
      email: a.email ?? "",
      destino: a.destino,
      observacao: a.observacao ?? "",
    });
    setDialogOpen(true);
  };

  const abrirVisualizar = (a: Acompanhamento) => {
    setEditId(a.id);
    setViewOnly(true);
    setEditForm({
      nome: a.nome,
      contato: formatarTelefoneSeAplicavel(a.contato ?? ""),
      email: a.email ?? "",
      destino: a.destino,
      observacao: a.observacao ?? "",
    });
    setDialogOpen(true);
  };

  const adicionarCurso = () => {
    const curso = cursoInput.trim();
    if (!curso) return;
    if (novoForm.cursos.includes(curso)) {
      setCursoInput("");
      return;
    }
    setNovoForm((f) => ({ ...f, cursos: [...f.cursos, curso] }));
    setCursoInput("");
  };

  const removerCurso = (curso: string) => {
    setNovoForm((f) => ({ ...f, cursos: f.cursos.filter((c) => c !== curso) }));
  };

  const salvarMut = useMutation({
    mutationFn: async () => {
      if (editId) {
        await updateFn({
          data: {
            id: editId,
            nome: editForm.nome.trim(),
            contato: editForm.contato.trim() || undefined,
            email: editForm.email.trim() || undefined,
            destino: editForm.destino,
            observacao: editForm.observacao.trim() || undefined,
          },
        });
        return;
      }

      if (modo === "existente") {
        const selecionado = opcoesExistentes.find((o) => o.id === origemId);
        if (!selecionado) throw new Error("Selecione um item da lista.");
        const { id } = await createFn({
          data: {
            nome: selecionado.nome,
            contato: selecionado.contato || undefined,
            email: selecionado.email || undefined,
            destino,
            origem_tipo: origemTipoAtual,
            origem_id: selecionado.id,
          },
        });
        if (etapaAlvo !== "mapeamento") {
          await updateEtapaFn({ data: { id, etapa: etapaAlvo } });
        }
        return;
      }

      // Novo cliente: cadastro completo na tela de destino + entrada no funil.
      const nome = novoForm.nome.trim();
      const contato = novoForm.contato.trim() || undefined;
      const email = novoForm.email.trim() || undefined;
      const observacao = novoForm.observacao.trim() || undefined;

      let origemId2: string;
      if (destino === "ativacao") {
        const { id } = await createPoloFn({
          data: {
            nivel: novoForm.nivel,
            nome,
            contato,
            email,
            produto: novoForm.produto.trim() || undefined,
            data_ativacao: novoForm.data_ativacao || undefined,
            valor_ativacao: novoForm.valor_ativacao ? Number(novoForm.valor_ativacao) : undefined,
            observacao,
          },
        });
        origemId2 = id;
        qc.invalidateQueries({ queryKey: ["polos-ativacao"] });
      } else if (destino === "negociacoes") {
        const { id } = await createNegociacaoFn({
          data: {
            nome,
            contato,
            email,
            numero_funcionarios: novoForm.numero_funcionarios
              ? Number(novoForm.numero_funcionarios)
              : undefined,
            observacao,
          },
        });
        origemId2 = id;
        qc.invalidateQueries({ queryKey: ["negociacoes"] });
      } else {
        const { id } = await createEscolaFn({
          data: {
            nome,
            contato,
            email,
            estado: novoForm.estado.trim() || undefined,
            cidade: novoForm.cidade.trim() || undefined,
            cursos: novoForm.cursos,
            observacao,
          },
        });
        origemId2 = id;
        qc.invalidateQueries({ queryKey: ["escolas-tecnicas"] });
      }

      const { id } = await createFn({
        data: {
          nome,
          contato,
          email,
          destino,
          origem_tipo: origemTipoAtual,
          origem_id: origemId2,
        },
      });
      if (etapaAlvo !== "mapeamento") {
        await updateEtapaFn({ data: { id, etapa: etapaAlvo } });
      }
    },
    onSuccess: () => {
      toast.success(
        editId ? "Acompanhamento atualizado." : "Cliente cadastrado e adicionado ao funil.",
      );
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido do acompanhamento.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir."),
  });

  const salvar = () => {
    if (editId) {
      if (!editForm.nome.trim()) {
        toast.error("Informe o nome.");
        return;
      }
      salvarMut.mutate();
      return;
    }
    if (modo === "existente") {
      if (!origemId) {
        toast.error("Selecione um item da lista.");
        return;
      }
    } else if (!novoForm.nome.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    salvarMut.mutate();
  };

  return (
    <div className="workspace-watermark flex flex-1 flex-col overflow-hidden bg-[var(--surface-1)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Acompanhamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Funil público — o caminho de cada cliente até virar ativação, negociação ou escola
            técnica.
          </p>
        </div>
        <Button onClick={() => abrirNovo()} className="rounded-lg shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Adicionar
        </Button>
      </header>

      <div className="px-6 pt-5">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, contato ou e-mail"
            className="rounded-full pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 pt-5 sm:grid-cols-3 lg:grid-cols-5">
        {ETAPAS.map((et) => {
          const total = itens.filter((a) => a.etapa === et.key).length;
          const Icon = et.icon;
          return (
            <div
              key={et.key}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `color-mix(in oklab, ${et.cor} 16%, transparent)`,
                  color: et.cor,
                }}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{et.label}</p>
                <p className="text-xl font-semibold tracking-tight text-foreground">{total}</p>
                <p className="text-[11px] text-muted-foreground">
                  {total === 1 ? "lead" : "leads"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex-1 p-6 text-sm text-muted-foreground">Carregando…</div>
      ) : error ? (
        <div className="flex-1 p-6 text-sm text-destructive">
          Falha ao carregar: {error instanceof Error ? error.message : "erro desconhecido"}
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto p-5">
          {ETAPAS.map((et) => {
            const list = itensFiltrados.filter((a) => a.etapa === et.key);
            return (
              <div
                key={et.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(et.key)}
                className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-[var(--surface-2)]"
              >
                <div
                  className="flex items-center justify-between px-3.5 py-2.5"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${et.cor} 14%, transparent)`,
                    borderBottom: `1px solid color-mix(in oklab, ${et.cor} 30%, transparent)`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: et.cor }}
                    />
                    <span className="text-sm font-semibold" style={{ color: et.cor }}>
                      {et.label}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{list.length}</span>
                </div>

                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {list.map((a) => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={() => setDraggingId(a.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className="cursor-grab rounded-lg border-2 bg-card p-3 shadow-sm active:cursor-grabbing"
                      style={{ borderColor: `color-mix(in oklab, ${et.cor} 55%, transparent)` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{a.nome}</p>
                        <Badge className={DESTINO_BADGE[a.destino]}>
                          {DESTINO_LABEL[a.destino]}
                        </Badge>
                      </div>
                      {(a.contato || a.email) && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {a.contato}
                          {a.contato && a.email ? " · " : ""}
                          {a.email}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirVisualizar(a)}
                          title="Visualizar"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirEdicao(a)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500 hover:text-red-600"
                              title="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover "{a.nome}"?</AlertDialogTitle>
                              <AlertDialogDescription>Ação permanente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(a.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && (
                    <div className="flex shrink-0 flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 py-8 text-xs text-muted-foreground">
                      <Route className="h-5 w-5 opacity-40" />
                      Arraste cards aqui
                    </div>
                  )}
                  <button
                    onClick={() => abrirNovo(et.key)}
                    className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewOnly ? "Detalhes" : editId ? "Editar acompanhamento" : "Adicionar ao funil"}
            </DialogTitle>
            <DialogDescription>
              {editId
                ? "Acompanhe um cliente até ele virar ativação, negociação ou escola técnica."
                : "Escolha o destino e faça o cadastro completo — ele também aparece na tela correspondente."}
            </DialogDescription>
          </DialogHeader>

          {editId ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ac-nome">Nome</Label>
                <Input
                  id="ac-nome"
                  value={editForm.nome}
                  onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                  disabled={viewOnly}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-contato">Contato</Label>
                <Input
                  id="ac-contato"
                  {...TELEFONE_INPUT_PROPS}
                  value={editForm.contato}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, contato: formatarTelefone(e.target.value) }))
                  }
                  disabled={viewOnly}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-email">E-mail</Label>
                <Input
                  id="ac-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={viewOnly}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Destino</Label>
                <Select
                  value={editForm.destino}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, destino: v as Destino }))}
                  disabled={viewOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativacao">Ativação</SelectItem>
                    <SelectItem value="negociacoes">Negociações</SelectItem>
                    <SelectItem value="escola_tecnica">Escola Técnica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ac-obs">Observação</Label>
                <Textarea
                  id="ac-obs"
                  rows={4}
                  value={editForm.observacao}
                  onChange={(e) => setEditForm((f) => ({ ...f, observacao: e.target.value }))}
                  disabled={viewOnly}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Destino</Label>
                <Select
                  value={destino}
                  onValueChange={(v) => {
                    setDestino(v as Destino);
                    setOrigemId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativacao">Ativação</SelectItem>
                    <SelectItem value="negociacoes">Negociações</SelectItem>
                    <SelectItem value="escola_tecnica">Escola Técnica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 rounded-lg bg-muted p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setModo("novo")}
                  className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                    modo === "novo" ? "bg-background shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Novo cliente
                </button>
                <button
                  type="button"
                  onClick={() => setModo("existente")}
                  className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                    modo === "existente" ? "bg-background shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Selecionar existente
                </button>
              </div>

              {modo === "existente" ? (
                <div className="space-y-1.5">
                  <Label>Cliente</Label>
                  <Select value={origemId} onValueChange={setOrigemId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesExistentes.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Nada cadastrado ainda em {DESTINO_LABEL[destino]}.
                        </div>
                      )}
                      {opcoesExistentes.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {destino === "ativacao" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Nível</Label>
                      <RadioGroup
                        value={novoForm.nivel}
                        onValueChange={(v) => setNovoForm((f) => ({ ...f, nivel: v as Nivel }))}
                        className="flex items-center gap-4"
                      >
                        {(["N1", "N2", "N3"] as const).map((n) => (
                          <label key={n} className="flex items-center gap-1.5 text-sm">
                            <RadioGroupItem value={n} id={`ac-nivel-${n}`} />
                            {n}
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="ac-novo-nome">Nome</Label>
                    <Input
                      id="ac-novo-nome"
                      value={novoForm.nome}
                      onChange={(e) => setNovoForm((f) => ({ ...f, nome: e.target.value }))}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ac-novo-contato">Contato</Label>
                    <Input
                      id="ac-novo-contato"
                      {...TELEFONE_INPUT_PROPS}
                      value={novoForm.contato}
                      onChange={(e) =>
                        setNovoForm((f) => ({ ...f, contato: formatarTelefone(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ac-novo-email">E-mail</Label>
                    <Input
                      id="ac-novo-email"
                      type="email"
                      value={novoForm.email}
                      onChange={(e) => setNovoForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>

                  {destino === "ativacao" && (
                    <>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="ac-novo-produto">Produto</Label>
                        <Input
                          id="ac-novo-produto"
                          value={novoForm.produto}
                          onChange={(e) => setNovoForm((f) => ({ ...f, produto: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ac-novo-data">Data de ativação</Label>
                        <Input
                          id="ac-novo-data"
                          type="date"
                          value={novoForm.data_ativacao}
                          onChange={(e) =>
                            setNovoForm((f) => ({ ...f, data_ativacao: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ac-novo-valor">Valor de ativação</Label>
                        <Input
                          id="ac-novo-valor"
                          type="number"
                          min={0}
                          step="0.01"
                          value={novoForm.valor_ativacao}
                          onChange={(e) =>
                            setNovoForm((f) => ({ ...f, valor_ativacao: e.target.value }))
                          }
                        />
                      </div>
                    </>
                  )}

                  {destino === "negociacoes" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="ac-novo-funcionarios">Número de funcionários</Label>
                      <Input
                        id="ac-novo-funcionarios"
                        type="number"
                        min={0}
                        step="1"
                        value={novoForm.numero_funcionarios}
                        onChange={(e) =>
                          setNovoForm((f) => ({ ...f, numero_funcionarios: e.target.value }))
                        }
                      />
                    </div>
                  )}

                  {destino === "escola_tecnica" && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="ac-novo-estado">Estado</Label>
                        <Input
                          id="ac-novo-estado"
                          value={novoForm.estado}
                          onChange={(e) => setNovoForm((f) => ({ ...f, estado: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ac-novo-cidade">Cidade</Label>
                        <Input
                          id="ac-novo-cidade"
                          value={novoForm.cidade}
                          onChange={(e) => setNovoForm((f) => ({ ...f, cidade: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="ac-novo-curso">Cursos</Label>
                        <div className="flex gap-2">
                          <Input
                            id="ac-novo-curso"
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
                        {novoForm.cursos.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {novoForm.cursos.map((curso) => (
                              <Badge
                                key={curso}
                                variant="secondary"
                                className="gap-1 bg-foreground text-background"
                              >
                                {curso}
                                <button
                                  type="button"
                                  onClick={() => removerCurso(curso)}
                                  className="rounded-full hover:opacity-70"
                                  title={`Remover ${curso}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="ac-novo-obs">Observação</Label>
                    <Textarea
                      id="ac-novo-obs"
                      rows={4}
                      value={novoForm.observacao}
                      onChange={(e) => setNovoForm((f) => ({ ...f, observacao: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

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
