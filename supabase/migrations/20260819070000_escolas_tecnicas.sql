-- Cadastro/listagem de escolas técnicas (tela "Escolas Técnicas").
CREATE TABLE IF NOT EXISTS public.escolas_tecnicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  contato text,
  email text,
  estado text,
  cidade text,
  cursos text[] NOT NULL DEFAULT '{}',
  observacao text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escolas_tecnicas TO authenticated;
GRANT ALL ON public.escolas_tecnicas TO service_role;
ALTER TABLE public.escolas_tecnicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados gerenciam escolas_tecnicas" ON public.escolas_tecnicas;
CREATE POLICY "Autenticados gerenciam escolas_tecnicas" ON public.escolas_tecnicas
  FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid()))
  WITH CHECK (public.tem_perfil(auth.uid()));
