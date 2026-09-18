-- Vendas registradas dentro do cadastro de cada polo.
CREATE TABLE public.vendas_polos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polo_id uuid NOT NULL REFERENCES public.polos_ativacao(id) ON DELETE CASCADE,
  valor numeric NOT NULL CHECK (valor >= 0),
  data_venda date NOT NULL,
  observacao text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendas_polos_polo ON public.vendas_polos(polo_id);
CREATE INDEX idx_vendas_polos_data ON public.vendas_polos(data_venda);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas_polos TO authenticated;
GRANT ALL ON public.vendas_polos TO service_role;
ALTER TABLE public.vendas_polos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam vendas_polos" ON public.vendas_polos
  FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid()))
  WITH CHECK (public.tem_perfil(auth.uid()));
