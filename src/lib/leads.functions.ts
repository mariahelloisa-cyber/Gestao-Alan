import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Leads = o registro das ligações feitas.
 *
 * Cada linha é uma ligação. Quando ela vira reunião, o lead **não sai daqui**:
 * ele ganha um `polo_id` apontando para o polo criado em `polos_ativacao` com
 * situação "reuniao" — que é o registro que a aba Reuniões mostra e que, ao
 * fechar, alimenta a taxa de fechamento. Assim o funil inteiro
 * (ligação → reunião marcada → reunião realizada → fechamento) sai dos mesmos
 * dados, sem ninguém digitar o mesmo número duas vezes.
 */

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, nome_polo, nome_gestor, tipo, contato, observacao, data_ligacao, responsavel_id, reuniao_marcada, reuniao_marcada_em, polo_id, criado_em",
      )
      .order("data_ligacao", { ascending: false })
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Uma linha de `leads` como as telas a recebem. */
export type Lead = Awaited<ReturnType<typeof listLeads>>[number];

const leadFields = {
  nome_polo: z.string().trim().min(1).max(200),
  nome_gestor: z.string().trim().max(200).optional(),
  tipo: z.enum(["empreendedor", "polo"]),
  contato: z.string().trim().max(200).optional(),
  observacao: z.string().trim().max(5000).optional(),
  data_ligacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  responsavel_id: z.string().uuid().optional(),
};

const createLeadSchema = z.object(leadFields);

export const createLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createLeadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: novo, error } = await supabase
      .from("leads")
      .insert({
        nome_polo: data.nome_polo,
        nome_gestor: data.nome_gestor || null,
        tipo: data.tipo,
        contato: data.contato || null,
        observacao: data.observacao || null,
        data_ligacao: data.data_ligacao,
        // Sem responsável explícito, a ligação é de quem a cadastrou — é o
        // caso normal, e sem isso ela não contaria para a meta de ninguém.
        responsavel_id: data.responsavel_id || userId,
        criado_por: userId,
      })
      .select("id")
      .single();
    if (error || !novo) throw new Error(error?.message ?? "Falha ao cadastrar lead");
    return { id: novo.id };
  });

const updateLeadSchema = z.object({ id: z.string().uuid(), ...leadFields });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateLeadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("leads")
      .update({
        nome_polo: data.nome_polo,
        nome_gestor: data.nome_gestor || null,
        tipo: data.tipo,
        contato: data.contato || null,
        observacao: data.observacao || null,
        data_ligacao: data.data_ligacao,
        responsavel_id: data.responsavel_id || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteLeadSchema = z.object({ id: z.string().uuid() });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteLeadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const marcarReuniaoSchema = z.object({
  id: z.string().uuid(),
  nivel: z.enum(["N1", "N2", "N3"]).default("N1"),
  data_reuniao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horario_reuniao: z.string().optional(),
  link_reuniao: z.string().trim().max(500).optional(),
  faturamento: z.number().min(0).max(100_000_000).optional(),
  observacao: z.string().trim().max(5000).optional(),
});

/**
 * Marca que a ligação virou reunião.
 *
 * Cria o polo em situação "reuniao" (é ele que aparece na aba Reuniões e segue
 * para fechamento) e amarra o lead a ele. Se o lead já tinha um polo, atualiza
 * o existente em vez de criar um segundo — senão remarcar a reunião duplicaria
 * o registro no funil e distorceria a taxa de fechamento.
 */
export const marcarReuniaoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => marcarReuniaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: lead, error: erroLead } = await supabase
      .from("leads")
      .select("id, nome_polo, nome_gestor, contato, responsavel_id, polo_id, reuniao_marcada_em")
      .eq("id", data.id)
      .single();
    if (erroLead || !lead) throw new Error(erroLead?.message ?? "Lead não encontrado");

    const camposPolo = {
      nivel: data.nivel,
      nome: lead.nome_polo,
      contato: lead.contato,
      situacao: "reuniao" as const,
      data_reuniao: data.data_reuniao,
      horario_reuniao: data.horario_reuniao || null,
      link_reuniao: data.link_reuniao || null,
      faturamento: data.faturamento ?? null,
      observacao: data.observacao || null,
      responsavel_id: lead.responsavel_id ?? userId,
      atualizado_em: new Date().toISOString(),
    };

    let poloId = lead.polo_id;
    if (poloId) {
      const { error } = await supabase.from("polos_ativacao").update(camposPolo).eq("id", poloId);
      if (error) throw new Error(error.message);
    } else {
      const { data: polo, error } = await supabase
        .from("polos_ativacao")
        .insert({ ...camposPolo, criado_por: userId })
        .select("id")
        .single();
      if (error || !polo) throw new Error(error?.message ?? "Falha ao criar a reunião");
      poloId = polo.id;
    }

    const { error: erroUpdate } = await supabase
      .from("leads")
      .update({
        reuniao_marcada: true,
        // A data em que a reunião foi *marcada* (hoje), não a data em que ela
        // acontece — é essa que a meta diária de reuniões mede. Remarcar a
        // reunião não reescreve a marcação original.
        reuniao_marcada_em: lead.reuniao_marcada_em ?? new Date().toISOString().slice(0, 10),
        polo_id: poloId,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (erroUpdate) throw new Error(erroUpdate.message);

    return { ok: true, polo_id: poloId };
  });

const desmarcarSchema = z.object({ id: z.string().uuid() });

/** Desfaz a marcação: o lead volta a "sem reunião" e o polo criado é removido. */
export const desmarcarReuniaoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => desmarcarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: lead, error: erroLead } = await supabase
      .from("leads")
      .select("id, polo_id")
      .eq("id", data.id)
      .single();
    if (erroLead || !lead) throw new Error(erroLead?.message ?? "Lead não encontrado");

    if (lead.polo_id) {
      // Só apaga o polo se ele ainda estiver parado na etapa de reunião. Se já
      // fechou (virou "ativo"), apagar destruiria o histórico de ativação.
      const { data: polo } = await supabase
        .from("polos_ativacao")
        .select("id, situacao")
        .eq("id", lead.polo_id)
        .single();
      if (polo?.situacao === "reuniao") {
        const { error } = await supabase.from("polos_ativacao").delete().eq("id", lead.polo_id);
        if (error) throw new Error(error.message);
      }
    }

    const { error } = await supabase
      .from("leads")
      .update({
        reuniao_marcada: false,
        reuniao_marcada_em: null,
        polo_id: null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
