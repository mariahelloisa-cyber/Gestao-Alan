-- Motivo da saída (junto com data_saida) quando um polo é inativado —
-- alimenta a nova tela "Reativação".
ALTER TABLE public.polos_ativacao
  ADD COLUMN motivo_saida text;
