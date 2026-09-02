-- Dados da reunião de prospecção, preenchidos na aba "Reuniões".
-- Ficam no próprio polo: quando ele fecha e vira 'ativo', o histórico da
-- reunião continua junto do registro.
ALTER TABLE public.polos_ativacao
  ADD COLUMN IF NOT EXISTS data_reuniao date,
  ADD COLUMN IF NOT EXISTS horario_reuniao time without time zone,
  ADD COLUMN IF NOT EXISTS faturamento numeric,
  ADD COLUMN IF NOT EXISTS link_reuniao text;
