import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNegociacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("negociacoes")
      .select("id, nome, contato, email, observacao, numero_funcionarios, criado_em")
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const negociacaoFields = {
  nome: z.string().trim().min(1).max(200),
  contato: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  observacao: z.string().trim().max(5000).optional(),
  numero_funcionarios: z.number().int().min(0).max(1_000_000).optional(),
};

const createNegociacaoSchema = z.object(negociacaoFields);

export const createNegociacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createNegociacaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: nova, error } = await supabase
      .from("negociacoes")
      .insert({
        nome: data.nome,
        contato: data.contato || null,
        email: data.email || null,
        observacao: data.observacao || null,
        numero_funcionarios: data.numero_funcionarios ?? null,
        criado_por: userId,
      })
      .select("id")
      .single();
    if (error || !nova) throw new Error(error?.message ?? "Falha ao cadastrar negociação");
    return { id: nova.id };
  });

const updateNegociacaoSchema = z.object({
  id: z.string().uuid(),
  ...negociacaoFields,
});

export const updateNegociacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateNegociacaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("negociacoes")
      .update({
        nome: data.nome,
        contato: data.contato || null,
        email: data.email || null,
        observacao: data.observacao || null,
        numero_funcionarios: data.numero_funcionarios ?? null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteNegociacaoSchema = z.object({ id: z.string().uuid() });

export const deleteNegociacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteNegociacaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("negociacoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
