import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listEscolasTecnicas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("escolas_tecnicas")
      .select(
        "id, nome, contato, email, estado, cidade, cursos, observacao, responsavel_id, criado_em",
      )
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const escolaTecnicaFields = {
  nome: z.string().trim().min(1).max(200),
  contato: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  estado: z.string().trim().max(100).optional(),
  cidade: z.string().trim().max(100).optional(),
  cursos: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  observacao: z.string().trim().max(5000).optional(),
  responsavel_id: z.string().uuid().optional(),
};

const createEscolaTecnicaSchema = z.object(escolaTecnicaFields);

export const createEscolaTecnica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createEscolaTecnicaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: nova, error } = await supabase
      .from("escolas_tecnicas")
      .insert({
        nome: data.nome,
        contato: data.contato || null,
        email: data.email || null,
        estado: data.estado || null,
        cidade: data.cidade || null,
        cursos: data.cursos ?? [],
        observacao: data.observacao || null,
        responsavel_id: data.responsavel_id || null,
        criado_por: userId,
      })
      .select("id")
      .single();
    if (error || !nova) throw new Error(error?.message ?? "Falha ao cadastrar escola técnica");
    return { id: nova.id };
  });

const updateEscolaTecnicaSchema = z.object({
  id: z.string().uuid(),
  ...escolaTecnicaFields,
});

export const updateEscolaTecnica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateEscolaTecnicaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("escolas_tecnicas")
      .update({
        nome: data.nome,
        contato: data.contato || null,
        email: data.email || null,
        estado: data.estado || null,
        cidade: data.cidade || null,
        cursos: data.cursos ?? [],
        observacao: data.observacao || null,
        responsavel_id: data.responsavel_id || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteEscolaTecnicaSchema = z.object({ id: z.string().uuid() });

export const deleteEscolaTecnica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteEscolaTecnicaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("escolas_tecnicas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
