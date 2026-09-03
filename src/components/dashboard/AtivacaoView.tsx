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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Search,
  Eye,
  SlidersHorizontal,
  X,
  Briefcase,
  Phone,
  Mail,
  GraduationCap,
  Calendar,
  DollarSign,
  User,
  FileText,
} from "lucide-react";
import { hojeIso, nivelBadgeStyle } from "@/lib/polos-ui";
import {
  DetailHeader,
  DetailHighlight,
  DetailHighlightItem,
  DetailSection,
  DetailField,
} from "@/components/dashboard/detail-view";
import {
  formatarTelefone,
  formatarTelefoneSeAplicavel,
  TELEFONE_INPUT_PROPS,
} from "@/lib/telefone";

type Nivel = "N1" | "N2" | "N3";
type Situacao = "ativo" | "reativado" | "desligado";
type Polo = Awaited<ReturnType<typeof listPolos>>[number];

type FormState = {
  nivel: Nivel;
  nome: string;
  contato: string;
  email: string;
  produto: string;
  data_ativacao: string;
  valor_ativacao: string;
  situacao: Situacao;
  observacao: string;
  responsavel_id: string;
  /** "" = não enviado ao comercial; "YYYY-MM-DD" = data do envio. */
  enviado_comercial_em: string;
};

const FORM_VAZIO: FormState = {
  nivel: "N1",
  nome: "",
  contato: "",
  email: "",
  produto: "",
  data_ativacao: "",
  valor_ativacao: "",
  situacao: "ativo",
  observacao: "",
  responsavel_id: "",
  enviado_comercial_em: "",
};

function poloParaForm(p: Polo): FormState {
  return {
    nivel: p.nivel as Nivel,
    nome: p.nome,
    contato: formatarTelefoneSeAplicavel(p.contato ?? ""),
    email: p.email ?? "",
    produto: p.produto ?? "",
    data_ativacao: p.data_ativacao ?? "",
    valor_ativacao: p.valor_ativacao != null ? String(p.valor_ativacao) : "",
    situacao: p.situacao as Situacao,
    observacao: p.observacao ?? "",
    responsavel_id: p.responsavel_id ?? "",
    enviado_comercial_em: p.enviado_comercial_em ?? "",
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

/** Mantém só dígitos e um separador decimal (vírgula ou ponto) enquanto digita. */
function sanitizarValor(raw: string): string {
  const limpo = raw.replace(/[^\d.,]/g, "");
  const partes = limpo.split(/[.,]/);
  if (partes.length <= 2) return limpo;
  return `${partes[0]},${partes.slice(1).join("")}`;
}

function paraNumero(v: string): number {
  return Number(v.replace(",", "."));
}

export function AtivacaoView() {
  const qc = useQueryClient();
  const { membros, membrosAtribuiveis } = useTasks();
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

  // Só quem está de fato em operação. As demais etapas do funil têm tela
  // própria: "reuniao" → Reuniões, "inativo" → Inativos, "desligado" → Reativação.
  const polosAtivos = useMemo(
    () => polos.filter((p) => p.situacao === "ativo" || p.situacao === "reativado"),
    [polos],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);

  const [busca, setBusca] = useState("");
  const [filtroNivel, setFiltroNivel] = useState<"todos" | Nivel>("todos");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

  const filtrosAvancadosAtivos = [
    filtroNivel !== "todos",
    !!dataDe,
    !!dataAte,
    !!valorMin,
    !!valorMax,
  ].filter(Boolean).length;

  const limparFiltros = () => {
    setFiltroNivel("todos");
    setDataDe("");
    setDataAte("");
    setValorMin("");
    setValorMax("");
  };

  const polosFiltrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    return polosAtivos.filter((p) => {
      if (filtroNivel !== "todos" && p.nivel !== filtroNivel) return false;
      if (dataDe && (!p.data_ativacao || p.data_ativacao < dataDe)) return false;
      if (dataAte && (!p.data_ativacao || p.data_ativacao > dataAte)) return false;
      if (valorMin && (p.valor_ativacao == null || p.valor_ativacao < paraNumero(valorMin)))
        return false;
      if (valorMax && (p.valor_ativacao == null || p.valor_ativacao > paraNumero(valorMax)))
        return false;
      if (buscaNorm) {
        const alvo = [p.nome, p.contato, p.email, p.produto]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(buscaNorm)) return false;
      }
      return true;
    });
  }, [polosAtivos, busca, filtroNivel, dataDe, dataAte, valorMin, valorMax]);

  const abrirNovo = () => {
    setEditId(null);
    setViewOnly(false);
    setForm(FORM_VAZIO);
    setDialogOpen(true);
  };

  const abrirEdicao = (p: Polo) => {
    setEditId(p.id);
    setViewOnly(false);
    setForm(poloParaForm(p));
    setDialogOpen(true);
  };

  const abrirVisualizar = (p: Polo) => {
    setEditId(p.id);
    setViewOnly(true);
    setForm(poloParaForm(p));
    setDialogOpen(true);
  };

  const salvarMut = useMutation({
    mutationFn: async (vars: { id?: string } & FormState) => {
      // `null` (e não `undefined`) para campo vazio: é assim que updatePolo
      // distingue "limpar" de "manter". Os campos que esta tela não edita —
      // dados da reunião, valor de reativação, reativado_por — ficam de fora
      // do payload de propósito, e o servidor preserva o que já está lá.
      const payload = {
        nivel: vars.nivel,
        nome: vars.nome.trim(),
        contato: vars.contato.trim() || null,
        email: vars.email.trim() || null,
        produto: vars.produto.trim() || null,
        data_ativacao: vars.data_ativacao || null,
        valor_ativacao: vars.valor_ativacao ? Number(vars.valor_ativacao) : null,
        situacao: vars.situacao,
        observacao: vars.observacao.trim() || null,
        responsavel_id: vars.responsavel_id || null,
        enviado_comercial_em: vars.enviado_comercial_em || null,
      };
      if (vars.id) {
        await updateFn({ data: { id: vars.id, ...payload } });
      } else {
        await createFn({ data: payload });
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Polo atualizado." : "Polo cadastrado.");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar polo."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Polo excluído.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir polo."),
  });

  const salvar = () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do polo.");
      return;
    }
    salvarMut.mutate({ id: editId ?? undefined, ...form });
  };

  const totalCadastrado = polosAtivos.length;
  const emOperacao = polosAtivos.filter((p) => p.situacao === "ativo").length;
  const valorTotal = polosAtivos.reduce((soma, p) => soma + (p.valor_ativacao ?? 0), 0);

  return (
    <div className="w-full space-y-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Ativação de Polos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro e listagem dos polos ativos.
          </p>
        </div>
        <Button onClick={abrirNovo} className="rounded-lg shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Novo polo
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-muted-foreground">Total cadastrado</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {totalCadastrado}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-muted-foreground">Em operação</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{emOperacao}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-muted-foreground">Valor de ativação</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {formatarValor(valorTotal)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, contato, e-mail ou produto"
              className="rounded-full pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-1.5 rounded-full">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                Filtrar
                {filtrosAvancadosAtivos > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full bg-foreground px-1 text-background">
                    {filtrosAvancadosAtivos}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-3" align="end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nível</Label>
                <Select
                  value={filtroNivel}
                  onValueChange={(v) => setFiltroNivel(v as "todos" | Nivel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="N1">N1</SelectItem>
                    <SelectItem value="N2">N2</SelectItem>
                    <SelectItem value="N3">N3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ativação de</Label>
                  <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">até</Label>
                  <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="valor-min" className="text-xs text-muted-foreground">
                    Valor mínimo
                  </Label>
                  <Input
                    id="valor-min"
                    inputMode="decimal"
                    placeholder="R$ 0,00"
                    value={valorMin}
                    onChange={(e) => setValorMin(sanitizarValor(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="valor-max" className="text-xs text-muted-foreground">
                    Valor máximo
                  </Label>
                  <Input
                    id="valor-max"
                    inputMode="decimal"
                    placeholder="R$ 0,00"
                    value={valorMax}
                    onChange={(e) => setValorMax(sanitizarValor(e.target.value))}
                  />
                </div>
              </div>

              {filtrosAvancadosAtivos > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={limparFiltros}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Limpar filtros
                </Button>
              )}
            </PopoverContent>
          </Popover>
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
                <TableHead className="text-muted-foreground">Valor</TableHead>
                <TableHead className="text-muted-foreground">Responsável</TableHead>
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
                    {polosAtivos.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                        Nenhum polo cadastrado ainda.
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
                    onClick={() => abrirVisualizar(p)}
                  >
                    <TableCell className="pl-4">
                      <Badge style={nivelBadgeStyle(p.nivel as Nivel)}>{p.nivel}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{p.nome}</span>
                        {p.enviado_comercial_em && (
                          <Briefcase
                            className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500"
                            aria-label="Enviado ao comercial"
                          >
                            <title>
                              Enviado ao comercial em {formatarData(p.enviado_comercial_em)}
                            </title>
                          </Briefcase>
                        )}
                      </div>
                    </TableCell>
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
                    <TableCell>{formatarValor(p.valor_ativacao)}</TableCell>
                    <TableCell>
                      {membros.find((m) => m.id === p.responsavel_id)?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirVisualizar(p)}
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

      {/* Cadastrar / editar / visualizar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          {viewOnly ? (
            <>
              <DetailHeader
                icon={Building2}
                title="Detalhes do polo"
                subtitle="Informações completas do polo selecionado"
              />
              <div className="space-y-4">
                <DetailHighlight>
                  <DetailHighlightItem label="Nível">
                    <Badge style={nivelBadgeStyle(form.nivel)}>{form.nivel}</Badge>
                  </DetailHighlightItem>
                  <DetailHighlightItem label="Nome do polo">
                    <p className="text-lg font-semibold">{form.nome}</p>
                  </DetailHighlightItem>
                </DetailHighlight>

                <DetailSection icon={Phone} title="Informações de contato">
                  <DetailField icon={Phone} label="Contato">
                    {form.contato || "—"}
                  </DetailField>
                  <DetailField icon={Mail} label="E-mail">
                    {form.email || "—"}
                  </DetailField>
                </DetailSection>

                <DetailSection icon={GraduationCap} title="Informações do produto">
                  <DetailField icon={GraduationCap} label="Produto">
                    {form.produto || "—"}
                  </DetailField>
                  <DetailField icon={User} label="Situação">
                    {form.situacao === "ativo" ? "Ativo" : "Reativado"}
                  </DetailField>
                </DetailSection>

                <DetailSection icon={DollarSign} title="Ativação e valores">
                  <DetailField icon={Calendar} label="Data de ativação">
                    {formatarData(form.data_ativacao || null)}
                  </DetailField>
                  <DetailField icon={DollarSign} label="Valor de ativação">
                    {formatarValor(form.valor_ativacao ? Number(form.valor_ativacao) : null)}
                  </DetailField>
                  <DetailField icon={User} label="Responsável" full>
                    {membros.find((m) => m.id === form.responsavel_id)?.nome ?? "—"}
                  </DetailField>
                </DetailSection>

                <DetailSection icon={Briefcase} title="Comercial">
                  <div className="sm:col-span-2">
                    {form.enviado_comercial_em ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <Briefcase className="h-3.5 w-3.5" />
                        Enviado ao comercial em {formatarData(form.enviado_comercial_em)}
                      </span>
                    ) : (
                      <p className="text-sm text-muted-foreground">Não enviado ao comercial.</p>
                    )}
                  </div>
                </DetailSection>

                {form.observacao && (
                  <DetailSection icon={FileText} title="Observação">
                    <p className="whitespace-pre-wrap sm:col-span-2">{form.observacao}</p>
                  </DetailSection>
                )}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{editId ? "Editar polo" : "Novo polo"}</DialogTitle>
                <DialogDescription>Preencha os dados de ativação do polo.</DialogDescription>
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
                        <RadioGroupItem value={n} id={`nivel-${n}`} />
                        {n}
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="polo-nome">Nome do polo</Label>
                  <Input
                    id="polo-nome"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="polo-contato">Contato</Label>
                  <Input
                    id="polo-contato"
                    {...TELEFONE_INPUT_PROPS}
                    value={form.contato}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contato: formatarTelefone(e.target.value) }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="polo-email">E-mail</Label>
                  <Input
                    id="polo-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="polo-produto">Produto</Label>
                  <Input
                    id="polo-produto"
                    value={form.produto}
                    onChange={(e) => setForm((f) => ({ ...f, produto: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="polo-data">Data de ativação</Label>
                  <Input
                    id="polo-data"
                    type="date"
                    value={form.data_ativacao}
                    onChange={(e) => setForm((f) => ({ ...f, data_ativacao: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="polo-valor">Valor de ativação (R$)</Label>
                  <Input
                    id="polo-valor"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.valor_ativacao}
                    onChange={(e) => setForm((f) => ({ ...f, valor_ativacao: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Situação</Label>
                  <Select
                    value={form.situacao}
                    onValueChange={(v) => setForm((f) => ({ ...f, situacao: v as Situacao }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="reativado">Reativado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Responsável</Label>
                  <Select
                    value={form.responsavel_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, responsavel_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {membrosAtribuiveis.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                          {m.cargo ? ` (${m.cargo})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="polo-obs">Observação</Label>
                  <Textarea
                    id="polo-obs"
                    rows={6}
                    value={form.observacao}
                    onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                  />
                </div>

                {/* Envio ao comercial — marcador independente da situação: o polo
                    continua nesta lista e passa a aparecer também em Comercial. */}
                <div className="space-y-2 border-t border-border pt-3 sm:col-span-2">
                  <Label>Comercial</Label>
                  {form.enviado_comercial_em ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <Briefcase className="h-3.5 w-3.5" />
                        Enviado ao comercial em {formatarData(form.enviado_comercial_em)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => setForm((f) => ({ ...f, enviado_comercial_em: "" }))}
                      >
                        Desfazer
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setForm((f) => ({ ...f, enviado_comercial_em: hojeIso() }))}
                      >
                        <Briefcase className="mr-1.5 h-3.5 w-3.5" />
                        Enviar para o comercial
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        O polo continua em Ativação e passa a aparecer também em Comercial.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
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
