import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("perfis_usuarios")
    .select("cargo")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.cargo !== "Admin" && data?.cargo !== "Supervisor") {
    throw new Error("Apenas Admins podem acessar as configurações do sistema.");
  }
}

/** Admin: lê configurações de e-mail (Resend). */
export const getEmailConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("configuracoes_sistema")
      .select("chave, valor, atualizado_em")
      .in("chave", ["resend_api_key", "email_from_address", "email_from_name"]);
    if (error) throw new Error(error.message);
    const map = new Map((data ?? []).map((r) => [r.chave, r]));
    return {
      apiKey: map.get("resend_api_key")?.valor ?? "",
      fromEmail: map.get("email_from_address")?.valor ?? "",
      fromName: map.get("email_from_name")?.valor ?? "",
      atualizado_em: map.get("resend_api_key")?.atualizado_em ?? null,
    };
  });

const saveSchema = z.object({
  apiKey: z.string().trim().min(1).max(500),
  fromEmail: z.string().trim().email().max(255),
  fromName: z.string().trim().max(120).optional().default(""),
});

/** Admin: salva API Key da Resend, e-mail e nome do remetente. */
export const saveEmailConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const now = new Date().toISOString();
    const rows = [
      {
        chave: "resend_api_key",
        valor: data.apiKey,
        atualizado_por: context.userId,
        atualizado_em: now,
      },
      {
        chave: "email_from_address",
        valor: data.fromEmail,
        atualizado_por: context.userId,
        atualizado_em: now,
      },
      {
        chave: "email_from_name",
        valor: data.fromName ?? "",
        atualizado_por: context.userId,
        atualizado_em: now,
      },
    ];

    const { error } = await supabaseAdmin
      .from("configuracoes_sistema")
      .upsert(rows, { onConflict: "chave" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
