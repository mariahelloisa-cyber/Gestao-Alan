-- Responsável (Membro/Admin) por polos de ativação, negociações e escolas
-- técnicas. Em polos_ativacao, guarda também quem reativou separadamente de
-- quem ativou originalmente, pra manter os dois nomes visíveis depois de um
-- ciclo desligar → reativar.
ALTER TABLE public.polos_ativacao
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reativado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.negociacoes
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.escolas_tecnicas
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
