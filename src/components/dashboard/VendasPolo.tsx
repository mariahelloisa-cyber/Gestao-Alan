import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { createVenda, deleteVenda, listVendas } from "@/lib/vendas.functions";
import { useTasks } from "@/lib/tasks-store";
import { hojeIso } from "@/lib/polos-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const QUERY_KEY = ["vendas-polos"];

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataBr(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

function useVendas() {
  const listFn = useServerFn(listVendas);
  return useQuery({ queryKey: QUERY_KEY, queryFn: () => listFn(), retry: 1 });
}

function useCriarVenda(onDone?: () => void) {
  const qc = useQueryClient();
  const createFn = useServerFn(createVenda);
  return useMutation({
    mutationFn: (vars: {
      polo_id: string;
      valor: number;
      data_venda: string;
      observacao: string;
      responsavel_id: string;
    }) => createFn({ data: vars }),
    onSuccess: () => {
      toast.success("Venda cadastrada.");
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      onDone?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao cadastrar venda."),
  });
}

type FormVenda = {
  polo_id: string;
  valor: string;
  data_venda: string;
  observacao: string;
  responsavel_id: string;
};

function formVazio(poloId = ""): FormVenda {
  return { polo_id: poloId, valor: "", data_venda: hojeIso(), observacao: "", responsavel_id: "" };
}

/** Valida o formulário; devolve a mensagem de erro ou null se estiver ok. */
function validar(f: FormVenda): string | null {
  if (!f.polo_id) return "Selecione o polo.";
  const valor = Number(f.valor.replace(",", "."));
  if (!f.valor || Number.isNaN(valor) || valor < 0) return "Informe um valor válido.";
  if (!f.data_venda) return "Informe a data da venda.";
  return null;
}

function CamposVenda({
  form,
  setForm,
  idPrefix,
}: {
  form: FormVenda;
  setForm: (f: FormVenda) => void;
  idPrefix: string;
}) {
  const { membrosAtribuiveis } = useTasks();
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-valor`}>Valor (R$)</Label>
        <Input
          id={`${idPrefix}-valor`}
          type="number"
          min={0}
          step="0.01"
          value={form.valor}
          onChange={(e) => setForm({ ...form, valor: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-data`}>Data da venda</Label>
        <Input
          id={`${idPrefix}-data`}
          type="date"
          value={form.data_venda}
          onChange={(e) => setForm({ ...form, data_venda: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Responsável pela venda</Label>
        <Select
          value={form.responsavel_id}
          onValueChange={(v) => setForm({ ...form, responsavel_id: v })}
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
        <Label htmlFor={`${idPrefix}-obs`}>Observação</Label>
        <Textarea
          id={`${idPrefix}-obs`}
          rows={3}
          value={form.observacao}
          onChange={(e) => setForm({ ...form, observacao: e.target.value })}
        />
      </div>
    </>
  );
}

/** Seletor de polo com busca por digitação. */
function PoloCombobox({
  polos,
  value,
  onChange,
}: {
  polos: { id: string; nome: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selecionado = polos.find((p) => p.id === value);
  const ordenados = [...polos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={selecionado ? "truncate" : "truncate text-muted-foreground"}>
            {selecionado?.nome ?? "Selecione o polo..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite para buscar..." />
          <CommandList>
            <CommandEmpty>Nenhum polo encontrado.</CommandEmpty>
            <CommandGroup>
              {ordenados.map((p) => (
                <CommandItem
                  key={p.id}
                  // O id no valor evita que polos com o mesmo nome se confundam.
                  value={`${p.nome} ${p.id}`}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${p.id === value ? "opacity-100" : "opacity-0"}`}
                  />
                  {p.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Botão + diálogo "Cadastrar venda": escolhe o polo, valor, data e observação. */
export function CadastrarVendaButton({
  polos,
}: {
  polos: { id: string; nome: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormVenda>(formVazio());
  const criar = useCriarVenda(() => setOpen(false));

  const abrir = () => {
    setForm(formVazio());
    setOpen(true);
  };

  const salvar = () => {
    const erro = validar(form);
    if (erro) {
      toast.error(erro);
      return;
    }
    criar.mutate({ ...form, valor: Number(form.valor.replace(",", ".")) });
  };

  return (
    <>
      <Button variant="outline" onClick={abrir} className="rounded-lg shadow-sm">
        <Plus className="mr-1.5 h-4 w-4" /> Cadastrar venda
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar venda</DialogTitle>
            <DialogDescription>Escolha o polo e informe os dados da venda.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Polo</Label>
              <PoloCombobox
                polos={polos}
                value={form.polo_id}
                onChange={(v) => setForm({ ...form, polo_id: v })}
              />
            </div>
            <CamposVenda form={form} setForm={setForm} idPrefix="venda" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={criar.isPending}>
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Seção "Vendas" do diálogo de edição do polo: lista as vendas e permite adicionar. */
export function VendasDoPolo({
  poloId,
  somenteLeitura = false,
}: {
  poloId: string;
  /** Na visualização (olhinho): só lista, sem adicionar nem excluir. */
  somenteLeitura?: boolean;
}) {
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteVenda);
  const { membros } = useTasks();
  const { data: todas = [], isLoading } = useVendas();
  const vendas = todas.filter((v) => v.polo_id === poloId);
  const [adicionando, setAdicionando] = useState(false);
  const [form, setForm] = useState<FormVenda>(formVazio(poloId));
  const criar = useCriarVenda(() => setAdicionando(false));

  const excluir = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Venda excluída.");
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir venda."),
  });

  const salvar = () => {
    const erro = validar(form);
    if (erro) {
      toast.error(erro);
      return;
    }
    criar.mutate({ ...form, valor: Number(form.valor.replace(",", ".")) });
  };

  const total = vendas.reduce((s, v) => s + v.valor, 0);

  return (
    <div className="space-y-2 border-t border-border pt-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Label>
          Vendas{vendas.length > 0 ? ` (${vendas.length} · ${moeda(total)})` : ""}
        </Label>
        {!adicionando && !somenteLeitura && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setForm(formVazio(poloId));
              setAdicionando(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar venda
          </Button>
        )}
      </div>

      {adicionando && (
        <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
          <CamposVenda form={form} setForm={setForm} idPrefix="venda-polo" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdicionando(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={salvar} disabled={criar.isPending}>
              Salvar venda
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando vendas...</p>
      ) : vendas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma venda cadastrada para este polo.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {vendas.map((v) => (
            <li key={v.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium">
                  {moeda(v.valor)}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {dataBr(v.data_venda)}
                    {v.responsavel_id
                      ? ` · ${membros.find((m) => m.id === v.responsavel_id)?.nome ?? "—"}`
                      : ""}
                  </span>
                </div>
                {v.observacao && (
                  <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {v.observacao}
                  </p>
                )}
              </div>
              {!somenteLeitura && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-red-600"
                  aria-label="Excluir venda"
                  onClick={() => excluir.mutate(v.id)}
                  disabled={excluir.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
