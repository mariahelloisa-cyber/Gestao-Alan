import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type PoloInsert = Database["public"]["Tables"]["polos_ativacao"]["Insert"];
type PoloUpdate = Database["public"]["Tables"]["polos_ativacao"]["Update"];

const nivelSchema = z.enum(["N1", "N2", "N3"]);
const situacaoSchema = z.enum(["ativo", "reativado", "desligado", "reuniao", "inativo"]);

export const listPolos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // Precisa ser uma string literal: é dela que o supabase-js infere o tipo
    // das linhas. Concatenar em runtime derruba a inferência para `unknown`.
    const { data, error } = await supabase
      .from("polos_ativacao")
      .select(
        "id, nivel, nome, contato, email, produto, data_ativacao, valor_ativacao, valor_reativacao, data_reativacao, situacao, data_saida, motivo_saida, observacao, criado_em, atualizado_em, responsavel_id, reativado_por, data_reuniao, horario_reuniao, faturamento, link_reuniao, enviado_comercial_em",
      )
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Uma linha de `polos_ativacao` como as telas a recebem. */
export type Polo = Awaited<ReturnType<typeof listPolos>>[number];

/**
 * Campos opcionais do polo.
 *
 * Semântica deliberada, para `updatePolo`:
 *   - `null` (ou string vazia) → limpa o valor no banco;
 *   - chave ausente           → mantém o valor atual.
 *
 * Sem essa distinção, qualquer tela que não conhecesse um campo o apagaria ao
 * salvar — por exemplo, a tela de Ativação (que não edita dados da reunião)
 * zeraria `data_reuniao`, `faturamento` etc. de todo polo que ela tocasse.
 * Em `createPolo` não existe "manter": ausente e null viram null.
 */
const camposOpcionais = {
  contato: z.string().trim().max(200).nullish(),
  email: z.union([z.string().trim().email().max(255), z.literal("")]).nullish(),
  produto: z.string().trim().max(200).nullish(),
  data_ativacao: z.string().nullish(),
  valor_ativacao: z.number().min(0).max(100_000_000).nullish(),
  valor_reativacao: z.number().min(0).max(100_000_000).nullish(),
  data_reativacao: z.string().nullish(),
  data_saida: z.string().nullish(),
  motivo_saida: z.string().trim().max(2000).nullish(),
  observacao: z.string().trim().max(5000).nullish(),
  responsavel_id: z.string().uuid().nullish(),
  reativado_por: z.string().uuid().nullish(),
  // Dados da reunião de prospecção (aba "Reuniões").
  data_reuniao: z.string().nullish(),
  horario_reuniao: z.string().nullish(),
  faturamento: z.number().min(0).max(100_000_000).nullish(),
  link_reuniao: z.string().trim().max(500).nullish(),
  // Marcador da página Comercial. Independe de `situacao`: o polo continua
  // aparecendo em Ativação enquanto também aparece em Comercial.
  enviado_comercial_em: z.string().nullish(),
};

type CampoOpcional = keyof typeof camposOpcionais;
const CHAVES_OPCIONAIS = Object.keys(camposOpcionais) as CampoOpcional[];

/** Normaliza para o banco: `undefined` e `""` viram `null`. */
function paraColuna(v: unknown): unknown {
  return v === undefined || v === "" ? null : v;
}

const createPoloSchema = z.object({
  nivel: nivelSchema,
  nome: z.string().trim().min(1).max(200),
  situacao: situacaoSchema.default("ativo"),
  ...camposOpcionais,
});

export const createPolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createPoloSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const row: PoloInsert = {
      nivel: data.nivel,
      nome: data.nome,
      situacao: data.situacao,
      criado_por: userId,
    };
    for (const chave of CHAVES_OPCIONAIS) {
      (row as Record<string, unknown>)[chave] = paraColuna(data[chave]);
    }

    const { data: novo, error } = await supabase
      .from("polos_ativacao")
      .insert(row)
      .select("id")
      .single();
    if (error || !novo) throw new Error(error?.message ?? "Falha ao cadastrar polo");
    return { id: novo.id };
  });

const updatePoloSchema = z.object({
  id: z.string().uuid(),
  nivel: nivelSchema,
  nome: z.string().trim().min(1).max(200),
  // Sem `.default()` de propósito: um caller que esquecesse de mandar a
  // situação faria o polo voltar para "ativo" silenciosamente.
  situacao: situacaoSchema,
  ...camposOpcionais,
});

export const updatePolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updatePoloSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const patch: PoloUpdate = {
      nivel: data.nivel,
      nome: data.nome,
      situacao: data.situacao,
      atualizado_em: new Date().toISOString(),
    };
    for (const chave of CHAVES_OPCIONAIS) {
      if (data[chave] === undefined) continue; // ausente = mantém o valor atual
      (patch as Record<string, unknown>)[chave] = paraColuna(data[chave]);
    }

    const { error } = await supabase.from("polos_ativacao").update(patch).eq("id", data.id);
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
