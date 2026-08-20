import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMetas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("metas_membros")
      .select("id, usuario_id, periodo, valor_meta");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const setMetaSchema = z.object({
  usuario_id: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  valor_meta: z.number().min(0).max(100_000_000),
});

/** Admin: cria ou atualiza a meta de um membro num mês (upsert por usuario_id + periodo). */
export const setMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => setMetaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("metas_membros").upsert(
      {
        usuario_id: data.usuario_id,
        periodo: data.periodo,
        valor_meta: data.valor_meta,
        criado_por: userId,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "usuario_id,periodo" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
