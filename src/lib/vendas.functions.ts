import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listVendas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("vendas_polos")
      .select("id, polo_id, valor, data_venda, observacao, responsavel_id, criado_em")
      .order("data_venda", { ascending: false })
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export type Venda = Awaited<ReturnType<typeof listVendas>>[number];

const createVendaSchema = z.object({
  polo_id: z.string().uuid(),
  valor: z.number().min(0).max(100_000_000),
  data_venda: z.string().min(1),
  observacao: z.string().trim().max(2000).nullish(),
  responsavel_id: z.string().uuid().nullish(),
});

export const createVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createVendaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("vendas_polos").insert({
      polo_id: data.polo_id,
      valor: data.valor,
      data_venda: data.data_venda,
      observacao: data.observacao || null,
      responsavel_id: data.responsavel_id || null,
      criado_por: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteVendaSchema = z.object({ id: z.string().uuid() });

export const deleteVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteVendaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("vendas_polos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
