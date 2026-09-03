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
  Eye,
  Search,
  Briefcase,
  Undo2,
  Trash2,
  X,
  Phone,
  Mail,
  GraduationCap,
  Calendar,
  DollarSign,
  User,
  FileText,
} from "lucide-react";
import { formatarData, formatarValor, hojeIso, nivelBadgeStyle, type Nivel } from "@/lib/polos-ui";
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

export function ComercialView() {
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

  // O marcador é independente da situação: um polo pode estar aqui e em
  // Ativação ao mesmo tempo — é justamente esse o objetivo da página.
  const noComercial = useMemo(() => polos.filter((p) => !!p.enviado_comercial_em), [polos]);

  const [busca, setBusca] = useState("");
  // Faixa de datas sobre `enviado_comercial_em` — "enviei pro comercial quando?".
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  const polosFiltrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    return noComercial.filter((p) => {
      if (dataDe && (!p.enviado_comercial_em || p.enviado_comercial_em < dataDe)) return false;
      if (dataAte && (!p.enviado_comercial_em || p.enviado_comercial_em > dataAte)) return false;
      if (buscaNorm) {
        const alvo = [p.nome, p.contato, p.email, p.produto]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(buscaNorm)) return false;
      }
      return true;
    });
  }, [noComercial, busca, dataDe, dataAte]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [removerAlvo, setRemoverAlvo] = useState<Polo | null>(null);
  const [excluirAlvo, setExcluirAlvo] = useState<Polo | null>(null);

  const abrirNovo = () => {
    setEditId(null);
    setViewOnly(false);
    // Cadastrado aqui: já nasce marcado como enviado ao comercial e, por ser
    // um polo ativo, também aparece em Ativação.
    setForm({ ...FORM_VAZIO, enviado_comercial_em: hojeIso() });
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
      toast.success(editId ? "Polo atualizado." : "Polo cadastrado e enviado ao comercial.");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar polo."),
  });

  /** Retira só o marcador — o polo continua existindo em Ativação. */
  const removerDoComercialMut = useMutation({
    mutationFn: async () => {
      if (!removerAlvo) return;
      await updateFn({
        data: {
          id: removerAlvo.id,
          nivel: removerAlvo.nivel as Nivel,
          nome: removerAlvo.nome,
          situacao: removerAlvo.situacao as Situacao,
          enviado_comercial_em: null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Polo retirado do comercial. Ele continua em Ativação.");
      setRemoverAlvo(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao retirar do comercial."),
  });

  /** Apaga o polo permanentemente. */
  const excluirMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Polo excluído.");
      setExcluirAlvo(null);
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

  const valorTotal = noComercial.reduce((s, p) => s + (p.valor_ativacao ?? 0), 0);
  const mesAtual = hojeIso().slice(0, 7); // "YYYY-MM"
  const enviadosNoMes = noComercial.filter((p) =>
    p.enviado_comercial_em?.startsWith(mesAtual),
  ).length;

  return (
    <div className="w-full space-y-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Comercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Polos enviados para o time comercial. Eles continuam aparecendo em Ativação.
          </p>
        </div>
        <Button onClick={abrirNovo} className="rounded-lg shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Novo polo
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-muted-foreground">Polos no comercial</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {noComercial.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-muted-foreground">Enviados esse mês</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {enviadosNoMes}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-muted-foreground">Valor de ativação somado</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {formatarValor(valorTotal)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, contato, e-mail ou produto"
              className="rounded-full pl-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="com-de" className="text-xs text-muted-foreground">
              Enviado de
            </Label>
            <Input
              id="com-de"
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className="h-9 w-[160px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="com-ate" className="text-xs text-muted-foreground">
              até
            </Label>
            <Input
              id="com-ate"
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className="h-9 w-[160px]"
            />
          </div>

          {(dataDe || dataAte) && (
            <Button
              variant="ghost"
              className="h-9 gap-1 text-muted-foreground"
              onClick={() => {
                setDataDe("");
                setDataAte("");
              }}
            >
              <X className="h-3.5 w-3.5" /> Limpar datas
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="pl-4 text-muted-foreground">Nível</TableHead>
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">Produto</TableHead>
                <TableHead className="text-muted-foreground">Enviado em</TableHead>
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
                    {noComercial.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        <Briefcase className="h-8 w-8 text-muted-foreground" />
                        Nenhum polo enviado ao comercial ainda.
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
                    <TableCell>{formatarData(p.enviado_comercial_em)}</TableCell>
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
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-amber-600 hover:text-amber-700"
                          onClick={() => setRemoverAlvo(p)}
                          title="Retirar do comercial"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => setExcluirAlvo(p)}
                          title="Excluir polo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
                icon={Briefcase}
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
                  <DetailField icon={Calendar} label="Enviado ao comercial em" full>
                    {formatarData(form.enviado_comercial_em || null)}
                  </DetailField>
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
                <DialogDescription>
                  {editId
                    ? "Alterações aqui valem também na página de Ativação — é o mesmo cadastro."
                    : "O polo é cadastrado como ativo e já entra marcado como enviado ao comercial."}
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
                        <RadioGroupItem value={n} id={`com-nivel-${n}`} />
                        {n}
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="com-nome">Nome do polo</Label>
                  <Input
                    id="com-nome"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="com-contato">Contato</Label>
                  <Input
                    id="com-contato"
                    {...TELEFONE_INPUT_PROPS}
                    value={form.contato}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contato: formatarTelefone(e.target.value) }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="com-email">E-mail</Label>
                  <Input
                    id="com-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="com-produto">Produto</Label>
                  <Input
                    id="com-produto"
                    value={form.produto}
                    onChange={(e) => setForm((f) => ({ ...f, produto: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="com-data">Data de ativação</Label>
                  <Input
                    id="com-data"
                    type="date"
                    value={form.data_ativacao}
                    onChange={(e) => setForm((f) => ({ ...f, data_ativacao: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="com-valor">Valor de ativação (R$)</Label>
                  <Input
                    id="com-valor"
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

                <div className="space-y-1.5">
                  <Label htmlFor="com-enviado">Enviado ao comercial em</Label>
                  <Input
                    id="com-enviado"
                    type="date"
                    value={form.enviado_comercial_em}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, enviado_comercial_em: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="com-obs">Observação</Label>
                  <Textarea
                    id="com-obs"
                    rows={3}
                    value={form.observacao}
                    onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                  />
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

      {/* Retirar do comercial */}
      <AlertDialog open={!!removerAlvo} onOpenChange={(o) => !o && setRemoverAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar "{removerAlvo?.nome}" do comercial?</AlertDialogTitle>
            <AlertDialogDescription>
              O polo sai desta página, mas <strong>não é excluído</strong> — ele continua
              normalmente em Ativação, apenas sem a marcação de envio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removerDoComercialMut.mutate()}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Retirar do comercial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!excluirAlvo} onOpenChange={(o) => !o && setExcluirAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{excluirAlvo?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Ação permanente. O polo será apagado por completo, inclusive de Ativação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluirAlvo && excluirMut.mutate(excluirAlvo.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
