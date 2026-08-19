import process from "node:process";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EmailSettings = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
};

/** Credenciais da Resend vêm do .env — nunca de uma tela editável no app. */
export function getEmailSettings(): EmailSettings {
  return {
    apiKey: process.env.RESEND_API_KEY ?? "",
    fromEmail: process.env.RESEND_FROM_EMAIL ?? "",
    fromName: process.env.RESEND_FROM_NAME || "Painel",
  };
}

export type SendResult = { ok: boolean; status: number; response: string };

/** Envia e-mail via Resend (POST https://api.resend.com/emails). */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  settings?: EmailSettings,
): Promise<SendResult> {
  const cfg = settings ?? (await getEmailSettings());
  if (!cfg.apiKey || !cfg.fromEmail) {
    return { ok: false, status: 0, response: "API Key ou E-mail remetente não configurados." };
  }
  if (!to || !to.includes("@")) {
    return { ok: false, status: 0, response: "Destinatário inválido." };
  }

  const from = cfg.fromName ? `${cfg.fromName} <${cfg.fromEmail}>` : cfg.fromEmail;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, response: body.slice(0, 2000) };
  } catch (e) {
    return { ok: false, status: 0, response: e instanceof Error ? e.message : String(e) };
  }
}

export async function logEmail(params: {
  tarefa_id: string | null;
  usuario_id: string | null;
  destinatario: string | null;
  tipo: "convite";
  assunto: string;
  mensagem: string;
  result: SendResult;
}) {
  await supabaseAdmin.from("email_logs").insert({
    tarefa_id: params.tarefa_id,
    usuario_id: params.usuario_id,
    destinatario: params.destinatario,
    tipo: params.tipo,
    assunto: params.assunto,
    mensagem: params.mensagem,
    status: params.result.ok ? "enviado" : "erro",
    resposta: `${params.result.status} ${params.result.response}`.slice(0, 2000),
  });
}

export type ConviteInput = {
  cargo: string;
  convidadoPor?: string | null;
  signupUrl: string;
};

export function msgConvite(opts: ConviteInput) {
  const assunto = "Você foi convidado(a) para o Painel";
  const quem = opts.convidadoPor ? `${opts.convidadoPor} convidou você` : "Você foi convidado(a)";
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <h1 style="margin:0 0 8px;font-size:20px;">Você recebeu um convite!</h1>
    <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.5;">${quem} para participar do Espaço de Trabalho como ${opts.cargo}. Para aceitar, crie sua conta usando este mesmo e-mail.</p>
    <p style="margin:0 0 24px;"><a href="${opts.signupUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">Criar minha conta</a></p>
    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">Se você não esperava este convite, pode ignorar este e-mail.</p>
  </div>
</body></html>`;
  const text = [
    `${quem} para participar do Espaço de Trabalho como ${opts.cargo}.`,
    "",
    "Para aceitar, crie sua conta usando este mesmo e-mail:",
    opts.signupUrl,
  ].join("\n");
  return { assunto, html, text };
}
