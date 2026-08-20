import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const nivelSchema = z.enum(["N1", "N2", "N3"]);
const situacaoSchema = z.enum(["ativo", "reativado", "desligado"]);

export const listPolos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("polos_ativacao")
      .select(
        "id, nivel, nome, contato, email, produto, data_ativacao, valor_ativacao, situacao, data_saida, motivo_saida, observacao, criado_em, atualizado_em, responsavel_id, reativado_por",
      )
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const poloFields = {
  nivel: nivelSchema,
  nome: z.string().trim().min(1).max(200),
  contato: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  produto: z.string().trim().max(200).optional(),
  data_ativacao: z.string().optional(),
  valor_ativacao: z.number().min(0).max(100_000_000).optional(),
  situacao: situacaoSchema.default("ativo"),
  data_saida: z.string().optional(),
  motivo_saida: z.string().trim().max(2000).optional(),
  observacao: z.string().trim().max(5000).optional(),
  responsavel_id: z.string().uuid().optional(),
  reativado_por: z.string().uuid().optional(),
};

const createPoloSchema = z.object(poloFields);

export const createPolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createPoloSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: novo, error } = await supabase
      .from("polos_ativacao")
      .insert({
        nivel: data.nivel,
        nome: data.nome,
        contato: data.contato || null,
        email: data.email || null,
        produto: data.produto || null,
        data_ativacao: data.data_ativacao || null,
        valor_ativacao: data.valor_ativacao ?? null,
        situacao: data.situacao,
        data_saida: data.data_saida || null,
        motivo_saida: data.motivo_saida || null,
        observacao: data.observacao || null,
        responsavel_id: data.responsavel_id || null,
        reativado_por: data.reativado_por || null,
        criado_por: userId,
      })
      .select("id")
      .single();
    if (error || !novo) throw new Error(error?.message ?? "Falha ao cadastrar polo");
    return { id: novo.id };
  });

const updatePoloSchema = z.object({
  id: z.string().uuid(),
  ...poloFields,
});

export const updatePolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updatePoloSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("polos_ativacao")
      .update({
        nivel: data.nivel,
        nome: data.nome,
        contato: data.contato || null,
        email: data.email || null,
        produto: data.produto || null,
        data_ativacao: data.data_ativacao || null,
        valor_ativacao: data.valor_ativacao ?? null,
        situacao: data.situacao,
        data_saida: data.data_saida || null,
        motivo_saida: data.motivo_saida || null,
        observacao: data.observacao || null,
        responsavel_id: data.responsavel_id || null,
        reativado_por: data.reativado_por || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deletePoloSchema = z.object({ id: z.string().uuid() });

export const deletePolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deletePoloSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("polos_ativacao").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
