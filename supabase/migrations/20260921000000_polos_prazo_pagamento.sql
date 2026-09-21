-- Prazo de pagamento de um polo que fechou na reunião mas ainda não pagou.
-- Enquanto preenchido e com situacao = 'reuniao', o polo continua na aba
-- "Reuniões" aguardando o pagamento; ao registrar valor e data, vira 'ativo'.
ALTER TABLE public.polos_ativacao
  ADD COLUMN IF NOT EXISTS prazo_pagamento date;
