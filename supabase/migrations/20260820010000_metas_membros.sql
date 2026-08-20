-- Meta de ativações (em R$) por membro/admin, usada no ranking da tela
-- Membros. O progresso é calculado a partir da soma de valor_ativacao dos
-- polos onde a pessoa é responsavel_id — não é um contador manual.
CREATE TABLE IF NOT EXISTS public.metas_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  valor_meta numeric NOT NULL DEFAULT 0,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.metas_membros TO authenticated;
GRANT ALL ON public.metas_membros TO service_role;
ALTER TABLE public.metas_membros ENABLE ROW LEVEL SECURITY;

-- Todo mundo com perfil vê o ranking; só Admin cadastra/edita metas.
DROP POLICY IF EXISTS "Autenticados leem metas" ON public.metas_membros;
CREATE POLICY "Autenticados leem metas" ON public.metas_membros
  FOR SELECT TO authenticated
  USING (public.tem_perfil(auth.uid()));

DROP POLICY IF EXISTS "Admins gerenciam metas" ON public.metas_membros;
CREATE POLICY "Admins gerenciam metas" ON public.metas_membros
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins atualizam metas" ON public.metas_membros;
CREATE POLICY "Admins atualizam metas" ON public.metas_membros
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT INSERT, UPDATE ON public.metas_membros TO authenticated;
