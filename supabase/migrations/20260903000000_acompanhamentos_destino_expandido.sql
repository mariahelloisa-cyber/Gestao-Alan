-- Acompanhamento passa a poder apontar pra Reuniões e Reativação (mesma
-- tabela polos_ativacao, só muda a situação), e também não apontar pra lugar
-- nenhum (lead que fica só no funil público, sem cadastro espelhado).
ALTER TYPE public.acompanhamento_destino ADD VALUE IF NOT EXISTS 'reuniao';
ALTER TYPE public.acompanhamento_destino ADD VALUE IF NOT EXISTS 'reativacao';

ALTER TABLE public.acompanhamentos ALTER COLUMN destino DROP NOT NULL;
