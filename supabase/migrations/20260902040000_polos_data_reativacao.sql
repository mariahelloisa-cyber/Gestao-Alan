-- Data em que o polo foi (ou será) reativado. Faz par com `valor_reativacao`.
--
-- Coluna própria, e não reuso de `data_ativacao`: aquela guarda quando o polo
-- foi ativado originalmente e continua sendo exibida como "Ativação".
ALTER TABLE public.polos_ativacao
  ADD COLUMN IF NOT EXISTS data_reativacao date;
