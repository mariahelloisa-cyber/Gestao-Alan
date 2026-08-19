-- Cadastro/listagem de negociações (tela "Negociações").
CREATE TABLE IF NOT EXISTS public.negociacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  contato text,
  email text,
  observacao text,
  numero_funcionarios integer,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.negociacoes TO authenticated;
GRANT ALL ON public.negociacoes TO service_role;
ALTER TABLE public.negociacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados gerenciam negociacoes" ON public.negociacoes;
CREATE POLICY "Autenticados gerenciam negociacoes" ON public.negociacoes
  FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid()))
  WITH CHECK (public.tem_perfil(auth.uid()));
