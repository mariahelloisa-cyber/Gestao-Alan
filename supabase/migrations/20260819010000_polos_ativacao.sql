-- Cadastro/listagem de polos ativos (tela "Ativação").
CREATE TYPE public.nivel_polo AS ENUM ('N1', 'N2', 'N3');

CREATE TABLE public.polos_ativacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nivel public.nivel_polo NOT NULL,
  nome text NOT NULL,
  contato text,
  email text,
  produto text,
  data_ativacao date,
  valor_ativacao numeric,
  observacao text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_polos_ativacao_nivel ON public.polos_ativacao(nivel);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polos_ativacao TO authenticated;
GRANT ALL ON public.polos_ativacao TO service_role;
ALTER TABLE public.polos_ativacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam polos_ativacao" ON public.polos_ativacao
  FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid()))
  WITH CHECK (public.tem_perfil(auth.uid()));
