import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listPolos, createPolo, updatePolo, deletePolo } from "@/lib/polos.functions";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Search,
  RotateCcw,
  UserX,
  Phone,
  Mail,
  GraduationCap,
  Calendar,
  DollarSign,
  User,
  FileText,
  X,
} from "lucide-react";
import {
  formatarTelefone,
  formatarTelefoneSeAplicavel,
  TELEFONE_INPUT_PROPS,
} from "@/lib/telefone";
import {
  DetailHeader,
  DetailHighlight,
  DetailHighlightItem,
  DetailSection,
  DetailField,
} from "@/components/dashboard/detail-view";

type Nivel = "N1" | "N2" | "N3";
type Situacao = "ativo" | "reativado" | "desligado";
type Polo = Awaited<ReturnType<typeof listPolos>>[number];

type FormState = {
  nivel: Nivel;
  nome: string;
  contato: string;
  email: string;
  produto: string;
  // Este cadastro é sobre a reativação: pede data e valor de reativação, e só
  // quem reativou. Valor/data de ativação e responsável ficam de fora.
  data_reativacao: string;
  valor_reativacao: string;
  data_saida: string;
  motivo_saida: string;
  observacao: string;
  reativado_por: string;
};

const FORM_VAZIO: FormState = {
  nivel: "N1",
  nome: "",
  contato: "",
  email: "",
  produto: "",
  data_reativacao: "",
  valor_reativacao: "",
  data_saida: "",
  motivo_saida: "",
  observacao: "",
  reativado_por: "",
};

function poloParaForm(p: Polo): FormState {
  return {
    nivel: p.nivel as Nivel,
    nome: p.nome,
    contato: formatarTelefoneSeAplicavel(p.contato ?? ""),
    email: p.email ?? "",
    produto: p.produto ?? "",
    data_reativacao: p.data_reativacao ?? "",
    valor_reativacao: p.valor_reativacao != null ? String(p.valor_reativacao) : "",
    data_saida: p.data_saida ?? "",
    motivo_saida: p.motivo_saida ?? "",
    observacao: p.observacao ?? "",
    reativado_por: p.reativado_por ?? "",
  };
}

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
  const { membros } = useTasks();
  const listFn = useServerFn(listPolos);
  const createFn = useServerFn(createPolo);
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

  const nomeMembro = (id: string | null) => membros.find((m) => m.id === id)?.nome ?? "—";

  const [verAlvo, setVerAlvo] = useState<Polo | null>(null);
  const [reativarAlvo, setReativarAlvo] = useState<Polo | null>(null);
  const [reativadoPorId, setReativadoPorId] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editAlvo, setEditAlvo] = useState<Polo | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);

  const abrirNovo = () => {
    setEditAlvo(null);
    setForm(FORM_VAZIO);
    setFormOpen(true);
  };

  const abrirEdicao = (p: Polo) => {
    setEditAlvo(p);
    setForm(poloParaForm(p));
    setFormOpen(true);
  };

  const salvarMut = useMutation({
    mutationFn: async (vars: FormState) => {
      const payload = {
        nivel: vars.nivel,
        nome: vars.nome.trim(),
        contato: vars.contato.trim() || null,
        email: vars.email.trim() || null,
        produto: vars.produto.trim() || null,
        data_reativacao: vars.data_reativacao || null,
        valor_reativacao: vars.valor_reativacao ? Number(vars.valor_reativacao) : null,
        data_saida: vars.data_saida || null,
        motivo_saida: vars.motivo_saida.trim() || null,
        observacao: vars.observacao.trim() || null,
        reativado_por: vars.reativado_por || null,
      };
      if (editAlvo) {
        await updateFn({
          data: { id: editAlvo.id, situacao: editAlvo.situacao as Situacao, ...payload },
        });
      } else {
        // Cadastrado direto em Reativação: já entra como "desligado" pra
        // aparecer nesta lista — é um polo em acompanhamento pra reativar.
        await createFn({ data: { ...payload, situacao: "desligado" } });
      }
    },
    onSuccess: () => {
      toast.success(editAlvo ? "Polo atualizado." : "Polo cadastrado.");
      setFormOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar polo."),
  });

  const salvar = () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do polo.");
      return;
    }
    salvarMut.mutate(form);
  };

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
      // Só o que muda: os campos omitidos são preservados pelo updatePolo, e
      // `null` limpa data/motivo da saída — o polo voltou a operar.
      await updateFn({
        data: {
          id: reativarAlvo.id,
          nivel: reativarAlvo.nivel as Nivel,
          nome: reativarAlvo.nome,
          situacao: "reativado",
          data_saida: null,
          motivo_saida: null,
          reativado_por: reativadoPorId,
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
    <div className="w-full space-y-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reativação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Polos reativados — dados de ativação, data e motivo da saída.
          </p>
        </div>
        <Button onClick={abrirNovo} className="rounded-lg shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Novo polo
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-muted-foreground">Polos reativados</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {polosDesligados.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-muted-foreground">Valor de reativação</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {formatarValor(polosDesligados.reduce((s, p) => s + (p.valor_reativacao ?? 0), 0))}
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
                <TableHead className="text-muted-foreground">Ativação</TableHead>
                <TableHead className="text-muted-foreground">Valor reativação</TableHead>
                <TableHead className="text-muted-foreground">Reativação</TableHead>
                <TableHead className="text-muted-foreground">Saída</TableHead>
                <TableHead className="text-muted-foreground">Motivo da saída</TableHead>
                <TableHead className="text-muted-foreground">Responsável</TableHead>
                <TableHead className="text-muted-foreground">Reativado por</TableHead>
                <TableHead className="pr-4 text-right text-muted-foreground"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-destructive">
                    Falha ao carregar:{" "}
                    {error instanceof Error ? error.message : "erro desconhecido"}
                  </TableCell>
                </TableRow>
              ) : polosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
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
                    <TableCell>{formatarData(p.data_ativacao)}</TableCell>
                    <TableCell>{formatarValor(p.valor_reativacao)}</TableCell>
                    <TableCell>{formatarData(p.data_reativacao)}</TableCell>
                    <TableCell>{formatarData(p.data_saida)}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={p.motivo_saida ?? ""}>
                      {p.motivo_saida || "—"}
                    </TableCell>
                    <TableCell>{nomeMembro(p.responsavel_id)}</TableCell>
                    <TableCell>{nomeMembro(p.reativado_por)}</TableCell>
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
                          onClick={() => abrirEdicao(p)}
                          title="Editar polo"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                          onClick={() => {
                            setReativarAlvo(p);
                            setReativadoPorId("");
                          }}
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

      {/* Cadastrar / editar direto em Reativação */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAlvo ? "Editar polo" : "Novo polo"}</DialogTitle>
            <DialogDescription>
              {editAlvo
                ? "Alterações aqui valem também na página de Ativação — é o mesmo cadastro."
                : "Cadastro direto em Reativação — o polo entra já como inativo, em acompanhamento pra reativar."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nível</Label>
              <RadioGroup
                value={form.nivel}
                onValueChange={(v) => setForm((f) => ({ ...f, nivel: v as Nivel }))}
                className="flex items-center gap-4"
              >
                {(["N1", "N2", "N3"] as const).map((n) => (
                  <label key={n} className="flex items-center gap-1.5 text-sm">
                    <RadioGroupItem value={n} id={`novo-nivel-${n}`} />
                    {n}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-nome">Nome do polo</Label>
              <Input
                id="novo-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-produto">Produto</Label>
              <Input
                id="novo-produto"
                value={form.produto}
                onChange={(e) => setForm((f) => ({ ...f, produto: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-contato">Contato</Label>
              <Input
                id="novo-contato"
                {...TELEFONE_INPUT_PROPS}
                value={form.contato}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contato: formatarTelefone(e.target.value) }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-email">E-mail</Label>
              <Input
                id="novo-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-data-reativacao">Data de reativação</Label>
              <Input
                id="novo-data-reativacao"
                type="date"
                value={form.data_reativacao}
                onChange={(e) => setForm((f) => ({ ...f, data_reativacao: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-valor-reativacao">Valor de reativação (R$)</Label>
              <Input
                id="novo-valor-reativacao"
                type="number"
                min={0}
                step="0.01"
                value={form.valor_reativacao}
                onChange={(e) => setForm((f) => ({ ...f, valor_reativacao: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-data-saida">Data de saída</Label>
              <Input
                id="novo-data-saida"
                type="date"
                value={form.data_saida}
                onChange={(e) => setForm((f) => ({ ...f, data_saida: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Reativado por</Label>
              <Select
                value={form.reativado_por}
                onValueChange={(v) => setForm((f) => ({ ...f, reativado_por: v }))}
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

            {/* Os dois textos lado a lado encurtam bastante a altura do diálogo. */}
            <div className="space-y-1.5">
              <Label htmlFor="novo-motivo-saida">Motivo da saída</Label>
              <Textarea
                id="novo-motivo-saida"
                rows={3}
                value={form.motivo_saida}
                onChange={(e) => setForm((f) => ({ ...f, motivo_saida: e.target.value }))}
                placeholder="Descreva o motivo..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-obs">Observação</Label>
              <Textarea
                id="novo-obs"
                rows={3}
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvarMut.isPending}>
              {editAlvo ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizar */}
      <Dialog open={!!verAlvo} onOpenChange={(o) => !o && setVerAlvo(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DetailHeader
            icon={RotateCcw}
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

              <DetailSection icon={GraduationCap} title="Informações do produto">
                <DetailField icon={GraduationCap} label="Produto">
                  {verAlvo.produto || "—"}
                </DetailField>
                <DetailField icon={Calendar} label="Data de ativação">
                  {formatarData(verAlvo.data_ativacao)}
                </DetailField>
              </DetailSection>

              <DetailSection icon={DollarSign} title="Reativação e valores">
                <DetailField icon={DollarSign} label="Valor de reativação">
                  {formatarValor(verAlvo.valor_reativacao)}
                </DetailField>
                <DetailField icon={Calendar} label="Data de reativação">
                  {formatarData(verAlvo.data_reativacao)}
                </DetailField>
                <DetailField icon={Calendar} label="Data de saída">
                  {formatarData(verAlvo.data_saida)}
                </DetailField>
              </DetailSection>

              <DetailSection icon={UserX} title="Saída e responsáveis">
                <DetailField icon={FileText} label="Motivo da saída" full>
                  <p className="whitespace-pre-wrap">{verAlvo.motivo_saida || "—"}</p>
                </DetailField>
                <DetailField icon={User} label="Responsável">
                  {nomeMembro(verAlvo.responsavel_id)}
                </DetailField>
                <DetailField icon={User} label="Reativado por">
                  {nomeMembro(verAlvo.reativado_por)}
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
          <div className="space-y-1.5">
            <Label>Reativado por</Label>
            <Select value={reativadoPorId} onValueChange={setReativadoPorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione quem está reativando..." />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setReativarAlvo(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!reativadoPorId) {
                  toast.error("Selecione quem está reativando o polo.");
                  return;
                }
                reativarMut.mutate();
              }}
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
