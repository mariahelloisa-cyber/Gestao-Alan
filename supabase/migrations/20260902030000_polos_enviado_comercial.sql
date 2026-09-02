-- Marcador de "já enviei este polo para o comercial".
--
-- É uma coluna própria, e não um valor de `situacao`, justamente porque o polo
-- precisa continuar aparecendo em Ativação ao mesmo tempo em que aparece em
-- Comercial. Guardar a data (em vez de um boolean) preserva QUANDO foi enviado.
ALTER TABLE public.polos_ativacao
  ADD COLUMN IF NOT EXISTS enviado_comercial_em date;

CREATE INDEX IF NOT EXISTS idx_polos_enviado_comercial
  ON public.polos_ativacao(enviado_comercial_em)
  WHERE enviado_comercial_em IS NOT NULL;
