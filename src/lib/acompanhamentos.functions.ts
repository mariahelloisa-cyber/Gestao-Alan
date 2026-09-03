import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAcompanhamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("acompanhamentos")
      .select(
        "id, nome, contato, email, etapa, destino, origem_tipo, origem_id, observacao, criado_em",
      )
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const etapaEnum = z.enum([
  "mapeamento",
  "primeiro_contato",
  "qualificacao",
  "reuniao",
  "proposta_comercial",
]);
const destinoEnum = z.enum([
  "ativacao",
  "negociacoes",
  "escola_tecnica",
  "reuniao",
  "reativacao",
]);
const origemEnum = z.enum(["polo", "negociacao", "escola_tecnica"]);

const createSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  contato: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  // Ausente = não vai pra lugar nenhum: fica só como card no funil público.
  destino: destinoEnum.optional(),
  origem_tipo: origemEnum.optional(),
  origem_id: z.string().uuid().optional(),
  observacao: z.string().trim().max(5000).optional(),
});

export const createAcompanhamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: novo, error } = await supabase
      .from("acompanhamentos")
      .insert({
        nome: data.nome,
        contato: data.contato || null,
        email: data.email || null,
        destino: data.destino ?? null,
        origem_tipo: data.origem_tipo ?? null,
        origem_id: data.origem_id ?? null,
        observacao: data.observacao || null,
        criado_por: userId,
      })
      .select("id")
      .single();
    if (error || !novo) throw new Error(error?.message ?? "Falha ao cadastrar acompanhamento");
    return { id: novo.id };
  });

const updateEtapaSchema = z.object({
  id: z.string().uuid(),
  etapa: etapaEnum,
});

export const updateEtapaAcompanhamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateEtapaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("acompanhamentos")
      .update({ etapa: data.etapa, atualizado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(1).max(200),
  contato: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  destino: destinoEnum.optional(),
  observacao: z.string().trim().max(5000).optional(),
});

export const updateAcompanhamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("acompanhamentos")
      .update({
        nome: data.nome,
        contato: data.contato || null,
        email: data.email || null,
        destino: data.destino ?? null,
        observacao: data.observacao || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteAcompanhamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("acompanhamentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
