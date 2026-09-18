-- Responsável pela venda.
ALTER TABLE public.vendas_polos
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
