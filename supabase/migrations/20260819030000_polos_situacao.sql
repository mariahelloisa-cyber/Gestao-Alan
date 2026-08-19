-- Situação do polo (ativo/reativado/desligado) e data de saída, pra tela
-- "Ativação de Polos" mostrar os cards de resumo e a coluna de situação.
CREATE TYPE public.situacao_polo AS ENUM ('ativo', 'reativado', 'desligado');

ALTER TABLE public.polos_ativacao
  ADD COLUMN situacao public.situacao_polo NOT NULL DEFAULT 'ativo',
  ADD COLUMN data_saida date;
