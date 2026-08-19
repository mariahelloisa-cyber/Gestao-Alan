import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTasks } from "@/lib/tasks-store";
import { getEmailConfig, saveEmailConfig } from "@/lib/system-settings.functions";

export function SystemSettingsView() {
  const { myCargo } = useTasks();
  const getCfg = useServerFn(getEmailConfig);
  const saveCfg = useServerFn(saveEmailConfig);

  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (myCargo !== "Admin" && myCargo !== "Supervisor") {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const cfg = await getCfg();
        setApiKey(cfg.apiKey);
        setFromEmail(cfg.fromEmail);
        setFromName(cfg.fromName);
        setUpdatedAt(cfg.atualizado_em);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao carregar configurações.");
      } finally {
        setLoading(false);
      }
    })();
  }, [getCfg, myCargo]);

  if (myCargo !== "Admin" && myCargo !== "Supervisor") {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">
          Apenas Admins e Supervisores podem acessar as configurações do sistema.
        </p>
      </div>
    );
  }

  const onSave = async () => {
    if (!apiKey.trim() || !fromEmail.trim()) {
      toast.error("API Key e e-mail remetente são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      await saveCfg({
        data: { apiKey: apiKey.trim(), fromEmail: fromEmail.trim(), fromName: fromName.trim() },
      });
      toast.success("Configurações salvas.");
      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Configurações do sistema</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credenciais usadas para enviar o e-mail de convite.
        </p>
      </header>

      <section className="space-y-4 rounded-lg border border-border bg-white p-6 text-black shadow-sm">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="text-base font-medium">Integração Resend</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="rs-key">Chave da API (Resend)</Label>
              <Input
                id="rs-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">Gere em resend.com → API Keys.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rs-from">E-mail remetente</Label>
              <Input
                id="rs-from"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="avisos@seudominio.com"
              />
              <p className="text-xs text-muted-foreground">
                Use um endereço de um domínio verificado na Resend.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rs-name">Nome do remetente (opcional)</Label>
              <Input
                id="rs-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Painel"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {updatedAt
                  ? `Atualizado em ${new Date(updatedAt).toLocaleString("pt-BR")}`
                  : "Ainda não configurado."}
              </span>
              <Button onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
