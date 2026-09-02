-- Novas etapas do funil de polos:
--   'reuniao' -> polo prospectado, com reunião marcada, ainda não fechou
--   'inativo' -> passou pela reunião e NÃO fechou
-- Em transação, o Postgres permite ADD VALUE mas proíbe usar o valor novo na
-- mesma transação — por isso estes ALTER TYPE ficam isolados nesta migration,
-- separados das colunas que vêm na migration seguinte.
ALTER TYPE public.situacao_polo ADD VALUE IF NOT EXISTS 'reuniao';
ALTER TYPE public.situacao_polo ADD VALUE IF NOT EXISTS 'inativo';
