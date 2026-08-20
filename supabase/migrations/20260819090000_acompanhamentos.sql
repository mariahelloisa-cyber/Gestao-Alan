DO $$ BEGIN
  CREATE TYPE public.acompanhamento_etapa AS ENUM (
    'mapeamento', 'primeiro_contato', 'qualificacao', 'reuniao', 'proposta_comercial'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.acompanhamento_destino AS ENUM (
    'ativacao', 'negociacoes', 'escola_tecnica'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.acompanhamento_origem AS ENUM (
    'polo', 'negociacao', 'escola_tecnica'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.acompanhamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  contato text,
  email text,
  etapa public.acompanhamento_etapa NOT NULL DEFAULT 'mapeamento',
  destino public.acompanhamento_destino NOT NULL,
  origem_tipo public.acompanhamento_origem,
  origem_id uuid,
  observacao text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acompanhamentos TO authenticated;
GRANT ALL ON public.acompanhamentos TO service_role;
ALTER TABLE public.acompanhamentos ENABLE ROW LEVEL SECURITY;

-- Público pra todo mundo com perfil (não só Admin) — igual às outras telas.
DROP POLICY IF EXISTS "Autenticados gerenciam acompanhamentos" ON public.acompanhamentos;
CREATE POLICY "Autenticados gerenciam acompanhamentos" ON public.acompanhamentos
  FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid()))
  WITH CHECK (public.tem_perfil(auth.uid()));
