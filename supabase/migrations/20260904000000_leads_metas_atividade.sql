-- Metas de atividade (ligações e reuniões marcadas por dia útil) e a tela
-- "Leads", que é onde essas duas coisas passam a ser medidas.
--
-- Até aqui a única meta do membro era financeira (`valor_meta`, ativação no
-- mês). Mas o trabalho diário dele é ligar e marcar reunião — o valor é
-- consequência. As duas metas novas são *por dia útil*: a meta do período é
-- meta/dia × dias úteis do período, então o mesmo número serve para "hoje",
-- "esta semana" e "este mês" sem precisar de um cadastro por recorte.

ALTER TABLE public.metas_membros
  ADD COLUMN IF NOT EXISTS meta_ligacoes_dia integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_reunioes_dia integer NOT NULL DEFAULT 0;

-- Uma linha por ligação feita. É o registro de origem do funil:
-- ligação → reunião marcada → reunião realizada → fechamento.
DO $$ BEGIN
  CREATE TYPE public.lead_tipo AS ENUM ('empreendedor', 'polo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_polo text NOT NULL,
  nome_gestor text,
  tipo public.lead_tipo NOT NULL DEFAULT 'polo',
  contato text,
  observacao text,
  -- Dia em que a ligação foi feita. Separado de `criado_em` porque o membro
  -- pode lançar o dia anterior — e é esta data que a meta diária mede.
  data_ligacao date NOT NULL DEFAULT current_date,
  -- Dono da ligação: é por ele que a meta de cada membro é apurada.
  responsavel_id uuid,
  reuniao_marcada boolean NOT NULL DEFAULT false,
  -- Quando a reunião foi marcada (não quando ela acontece — isso é
  -- `polos_ativacao.data_reuniao`). Permite contar "reuniões marcadas em X".
  reuniao_marcada_em date,
  -- O polo criado na aba Reuniões a partir deste lead. O lead continua
  -- aparecendo em Leads; o polo é o que segue no funil de reunião/fechamento.
  polo_id uuid REFERENCES public.polos_ativacao(id) ON DELETE SET NULL,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_data_ligacao_idx ON public.leads (data_ligacao);
CREATE INDEX IF NOT EXISTS leads_responsavel_idx ON public.leads (responsavel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados gerenciam leads" ON public.leads;
CREATE POLICY "Autenticados gerenciam leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid()))
  WITH CHECK (public.tem_perfil(auth.uid()));
