-- Valor potencial de reativação, capturado no cadastro direto feito pela
-- tela "Reativação" (polo que já entra como "desligado" pra acompanhamento).
ALTER TABLE public.polos_ativacao
  ADD COLUMN IF NOT EXISTS valor_reativacao numeric;
