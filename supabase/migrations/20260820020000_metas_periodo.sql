-- Metas passam a valer por mês (formato 'YYYY-MM'), não mais um valor único
-- contínuo por pessoa — permite navegar entre meses na tela Metas.
ALTER TABLE public.metas_membros
  ADD COLUMN IF NOT EXISTS periodo text;

UPDATE public.metas_membros SET periodo = to_char(now(), 'YYYY-MM') WHERE periodo IS NULL;

ALTER TABLE public.metas_membros ALTER COLUMN periodo SET NOT NULL;

ALTER TABLE public.metas_membros DROP CONSTRAINT IF EXISTS metas_membros_usuario_id_key;

ALTER TABLE public.metas_membros DROP CONSTRAINT IF EXISTS metas_membros_usuario_id_periodo_key;
ALTER TABLE public.metas_membros ADD CONSTRAINT metas_membros_usuario_id_periodo_key
  UNIQUE (usuario_id, periodo);
