
-- ============================== ENUMS ==============================
CREATE TYPE public.cargo_usuario AS ENUM ('Admin', 'Membro', 'Cliente', 'Supervisor');
CREATE TYPE public.plano_cliente AS ENUM ('Bronze', 'Prata', 'Ouro', 'Diamond');
CREATE TYPE public.status_tarefa AS ENUM ('Pendente', 'Em Progresso', 'Em Análise', 'Concluído');
CREATE TYPE public.prioridade_tarefa AS ENUM ('Alta', 'Média', 'Baixa', 'Nenhuma');
CREATE TYPE public.complexidade_tarefa AS ENUM ('Fácil', 'Média', 'Difícil');
CREATE TYPE public.tipo_item AS ENUM ('tarefa', 'lembrete');
CREATE TYPE public.escopo_item AS ENUM ('geral', 'pessoal');
CREATE TYPE public.status_demanda AS ENUM ('pendente', 'aceita', 'recusada', 'transferida');

-- ============================== TABELAS ==============================

-- clientes
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa text NOT NULL,
  logo_url text,
  plano public.plano_cliente NOT NULL DEFAULT 'Bronze',
  criado_em timestamptz NOT NULL DEFAULT now(),
  endereco text,
  documento text,
  email text,
  contrato_url text,
  criado_por uuid,
  status text NOT NULL DEFAULT 'ativo'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- perfis_usuarios
CREATE TABLE public.perfis_usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  avatar_url text,
  cargo public.cargo_usuario NOT NULL DEFAULT 'Membro',
  criado_em timestamptz NOT NULL DEFAULT now(),
  cliente_id uuid REFERENCES public.clientes(id),
  status text NOT NULL DEFAULT 'ativo'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis_usuarios TO authenticated;
GRANT ALL ON public.perfis_usuarios TO service_role;
ALTER TABLE public.perfis_usuarios ENABLE ROW LEVEL SECURITY;

-- projetos
CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- tarefas
CREATE TABLE public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  status public.status_tarefa NOT NULL DEFAULT 'Pendente',
  prioridade public.prioridade_tarefa NOT NULL DEFAULT 'Nenhuma',
  data_vencimento timestamptz,
  data_criacao timestamptz NOT NULL DEFAULT now(),
  tipo public.tipo_item NOT NULL DEFAULT 'tarefa',
  escopo public.escopo_item NOT NULL DEFAULT 'geral',
  criado_por uuid,
  concluido_em timestamptz,
  complexidade public.complexidade_tarefa NOT NULL DEFAULT 'Média',
  projeto_id uuid REFERENCES public.projetos(id),
  audio jsonb,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  video jsonb
);
CREATE INDEX idx_tarefas_cliente ON public.tarefas(cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

-- tarefa_responsaveis
CREATE TABLE public.tarefa_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfis_usuarios(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tarefa_id, usuario_id)
);
CREATE INDEX idx_resp_tarefa ON public.tarefa_responsaveis(tarefa_id);
CREATE INDEX idx_resp_usuario ON public.tarefa_responsaveis(usuario_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_responsaveis TO authenticated;
GRANT ALL ON public.tarefa_responsaveis TO service_role;
ALTER TABLE public.tarefa_responsaveis ENABLE ROW LEVEL SECURITY;

-- comentarios_tarefa
CREATE TABLE public.comentarios_tarefa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfis_usuarios(id),
  conteudo text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coment_tarefa ON public.comentarios_tarefa(tarefa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comentarios_tarefa TO authenticated;
GRANT ALL ON public.comentarios_tarefa TO service_role;
ALTER TABLE public.comentarios_tarefa ENABLE ROW LEVEL SECURITY;

-- tarefa_checklist_itens
CREATE TABLE public.tarefa_checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  texto text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_checklist_itens TO authenticated;
GRANT ALL ON public.tarefa_checklist_itens TO service_role;
ALTER TABLE public.tarefa_checklist_itens ENABLE ROW LEVEL SECURITY;

-- convites
CREATE TABLE public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  cargo public.cargo_usuario NOT NULL DEFAULT 'Membro',
  convidado_por uuid,
  status text NOT NULL DEFAULT 'pendente',
  criado_em timestamptz NOT NULL DEFAULT now(),
  aceito_em timestamptz,
  cliente_id uuid REFERENCES public.clientes(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

-- configuracoes_planos
CREATE TABLE public.configuracoes_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_plano text NOT NULL,
  valor_mensal numeric NOT NULL DEFAULT 0,
  servicos_inclusos jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_planos TO authenticated;
GRANT ALL ON public.configuracoes_planos TO service_role;
ALTER TABLE public.configuracoes_planos ENABLE ROW LEVEL SECURITY;

-- financeiro_transacoes
CREATE TABLE public.financeiro_transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_pagamento timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_transacoes TO authenticated;
GRANT ALL ON public.financeiro_transacoes TO service_role;
ALTER TABLE public.financeiro_transacoes ENABLE ROW LEVEL SECURITY;

-- ideias
CREATE TABLE public.ideias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  criado_por uuid NOT NULL REFERENCES public.perfis_usuarios(id),
  status text NOT NULL DEFAULT 'pendente',
  pontos integer,
  avaliado_por uuid REFERENCES public.perfis_usuarios(id),
  avaliado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ideias TO authenticated;
GRANT ALL ON public.ideias TO service_role;
ALTER TABLE public.ideias ENABLE ROW LEVEL SECURITY;

-- pastas_links
CREATE TABLE public.pastas_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  comentario text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pastas_links TO authenticated;
GRANT ALL ON public.pastas_links TO service_role;
ALTER TABLE public.pastas_links ENABLE ROW LEVEL SECURITY;

-- pastas_links_itens
CREATE TABLE public.pastas_links_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id uuid NOT NULL REFERENCES public.pastas_links(id) ON DELETE CASCADE,
  url text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pastas_links_itens TO authenticated;
GRANT ALL ON public.pastas_links_itens TO service_role;
ALTER TABLE public.pastas_links_itens ENABLE ROW LEVEL SECURITY;

-- configuracoes_sistema (chave/valor — hoje só guarda config de e-mail Resend)
CREATE TABLE public.configuracoes_sistema (
  chave text PRIMARY KEY,
  valor text,
  descricao text,
  atualizado_por uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_sistema TO authenticated;
GRANT ALL ON public.configuracoes_sistema TO service_role;
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- email_logs
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid,
  usuario_id uuid,
  destinatario text,
  tipo text NOT NULL,
  assunto text NOT NULL,
  mensagem text NOT NULL,
  status text NOT NULL,
  resposta text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- demandas_externas_usuarios
CREATE TABLE public.demandas_externas_usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.demandas_externas_usuarios TO authenticated;
GRANT ALL ON public.demandas_externas_usuarios TO service_role;
ALTER TABLE public.demandas_externas_usuarios ENABLE ROW LEVEL SECURITY;

-- demandas_externas
CREATE TABLE public.demandas_externas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_nome text NOT NULL,
  solicitante_email text,
  responsavel_id uuid,
  descricao text NOT NULL,
  prazo_sugerido date,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.status_demanda NOT NULL DEFAULT 'pendente',
  justificativa_recusa text,
  tarefa_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  audio jsonb,
  video jsonb,
  setor text,
  solicitante_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandas_externas TO authenticated;
GRANT ALL ON public.demandas_externas TO service_role;
ALTER TABLE public.demandas_externas ENABLE ROW LEVEL SECURITY;

-- ============================== FUNÇÕES ==============================

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis_usuarios
    WHERE id = _user_id AND cargo::text IN ('Admin', 'Supervisor')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;

CREATE OR REPLACE FUNCTION public.tem_perfil(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis_usuarios WHERE id = _user_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.tem_perfil(uuid) FROM anon, public;

-- Cria o perfil ao registrar no auth.users: primeiro usuário vira Admin
-- (bootstrap), os demais precisam de convite pendente com o mesmo e-mail.
-- Cadastro com metadata tipo='demandante' (portal externo de demandas) só
-- grava em demandas_externas_usuarios e não exige convite.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_convite public.convites%ROWTYPE;
  v_cargo public.cargo_usuario := 'Membro';
  v_cliente_id uuid := NULL;
  v_total int;
BEGIN
  IF NEW.raw_user_meta_data->>'tipo' = 'demandante' THEN
    INSERT INTO public.demandas_externas_usuarios (id, nome, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
      NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.perfis_usuarios;

  IF v_total = 0 THEN
    v_cargo := 'Admin';
  ELSE
    SELECT * INTO v_convite
    FROM public.convites
    WHERE lower(email) = lower(NEW.email)
      AND status = 'pendente'
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Acesso negado: Você precisa de um convite da agência para acessar este espaço.'
        USING ERRCODE = 'P0001';
    END IF;

    v_cargo := v_convite.cargo;
    v_cliente_id := v_convite.cliente_id;

    UPDATE public.convites
    SET status = 'aceito', aceito_em = now()
    WHERE id = v_convite.id;
  END IF;

  INSERT INTO public.perfis_usuarios (id, nome, email, avatar_url, cargo, cliente_id)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    v_cargo,
    v_cliente_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Mantém tarefas.concluido_em coerente com o status (usado pela tela Finalizados).
CREATE OR REPLACE FUNCTION public.tg_tarefas_concluido_em()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Concluído' THEN
      NEW.concluido_em := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'Concluído' AND OLD.status IS DISTINCT FROM 'Concluído' THEN
    NEW.concluido_em := now();
  ELSIF NEW.status <> 'Concluído' THEN
    NEW.concluido_em := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_tarefas_concluido_em
  BEFORE INSERT OR UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_tarefas_concluido_em();

-- ============================== RLS POLICIES ==============================
-- Fielmente reproduzidas do banco antigo (introspecção via pg_policies).

-- perfis_usuarios
CREATE POLICY "Autenticados podem ver perfis" ON public.perfis_usuarios
  FOR SELECT TO authenticated USING (public.tem_perfil(auth.uid()));
CREATE POLICY "Usuário insere próprio perfil" ON public.perfis_usuarios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuário atualiza próprio perfil" ON public.perfis_usuarios
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Usuário exclui próprio perfil" ON public.perfis_usuarios
  FOR DELETE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins atualizam cargo de outros" ON public.perfis_usuarios
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Exige perfil interno" ON public.perfis_usuarios
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid())) WITH CHECK (public.tem_perfil(auth.uid()));

-- clientes
CREATE POLICY "Autenticados gerenciam clientes" ON public.clientes
  FOR ALL TO authenticated USING (public.tem_perfil(auth.uid())) WITH CHECK (public.tem_perfil(auth.uid()));
CREATE POLICY "Exige perfil interno" ON public.clientes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid())) WITH CHECK (public.tem_perfil(auth.uid()));

-- tarefas
CREATE POLICY "Ver tarefas e lembretes permitidos" ON public.tarefas
  FOR SELECT TO authenticated
  USING (tipo = 'tarefa' OR escopo = 'geral' OR criado_por = auth.uid());
CREATE POLICY "Criar tarefas e lembretes" ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (
    (tipo = 'tarefa')
    OR (tipo = 'lembrete' AND escopo = 'geral')
    OR (tipo = 'lembrete' AND escopo = 'pessoal' AND criado_por = auth.uid())
  );
CREATE POLICY "Atualizar tarefas e lembretes permitidos" ON public.tarefas
  FOR UPDATE TO authenticated
  USING (tipo = 'tarefa' OR escopo = 'geral' OR criado_por = auth.uid())
  WITH CHECK (tipo = 'tarefa' OR escopo = 'geral' OR criado_por = auth.uid());
CREATE POLICY "Excluir tarefas e lembretes permitidos" ON public.tarefas
  FOR DELETE TO authenticated
  USING (tipo = 'tarefa' OR escopo = 'geral' OR criado_por = auth.uid());
CREATE POLICY "Exige perfil interno" ON public.tarefas
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid())) WITH CHECK (public.tem_perfil(auth.uid()));

-- tarefa_responsaveis
CREATE POLICY "Autenticados gerenciam responsaveis" ON public.tarefa_responsaveis
  FOR ALL TO authenticated USING (public.tem_perfil(auth.uid())) WITH CHECK (public.tem_perfil(auth.uid()));
CREATE POLICY "Exige perfil interno" ON public.tarefa_responsaveis
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid())) WITH CHECK (public.tem_perfil(auth.uid()));

-- comentarios_tarefa
CREATE POLICY "Autenticados leem comentarios" ON public.comentarios_tarefa
  FOR SELECT TO authenticated USING (public.tem_perfil(auth.uid()));
CREATE POLICY "Autenticados criam comentarios" ON public.comentarios_tarefa
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Autor edita comentario" ON public.comentarios_tarefa
  FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Autor exclui comentario" ON public.comentarios_tarefa
  FOR DELETE TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Exige perfil interno" ON public.comentarios_tarefa
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tem_perfil(auth.uid())) WITH CHECK (public.tem_perfil(auth.uid()));

-- tarefa_checklist_itens
CREATE POLICY "Autenticados gerenciam checklist" ON public.tarefa_checklist_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- convites
CREATE POLICY "Admins veem convites" ON public.convites
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins criam convites" ON public.convites
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins atualizam convites" ON public.convites
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins excluem convites" ON public.convites
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- configuracoes_planos
CREATE POLICY "Autenticados leem planos" ON public.configuracoes_planos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins inserem planos" ON public.configuracoes_planos
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins atualizam planos" ON public.configuracoes_planos
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins excluem planos" ON public.configuracoes_planos
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- financeiro_transacoes
CREATE POLICY "Admins gerenciam transacoes" ON public.financeiro_transacoes
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ideias
CREATE POLICY "Autenticados veem ideias" ON public.ideias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados criam a propria ideia" ON public.ideias
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = criado_por);
CREATE POLICY "Admins avaliam ideias" ON public.ideias
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin ou autor (pendente) excluem ideias" ON public.ideias
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR (auth.uid() = criado_por AND status = 'pendente'));

-- pastas_links / pastas_links_itens
CREATE POLICY "Autenticados gerenciam pastas_links" ON public.pastas_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados gerenciam pastas_links_itens" ON public.pastas_links_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- configuracoes_sistema
CREATE POLICY "Admins leem configuracoes" ON public.configuracoes_sistema
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins inserem configuracoes" ON public.configuracoes_sistema
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins atualizam configuracoes" ON public.configuracoes_sistema
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins excluem configuracoes" ON public.configuracoes_sistema
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- email_logs
CREATE POLICY "Admins leem logs de email" ON public.email_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- demandas_externas_usuarios
CREATE POLICY "Usuario le proprio registro externo" ON public.demandas_externas_usuarios
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Usuario atualiza proprio registro externo" ON public.demandas_externas_usuarios
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- demandas_externas
CREATE POLICY "Admins leem demandas" ON public.demandas_externas
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "demandas_externas_admin_insert" ON public.demandas_externas
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Responsavel ou admin atualizam demandas" ON public.demandas_externas
  FOR UPDATE TO authenticated
  USING (responsavel_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (responsavel_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Responsavel ou admin excluem demandas" ON public.demandas_externas
  FOR DELETE TO authenticated
  USING (responsavel_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============================== STORAGE ==============================
-- Bucket usado pelas tarefas (áudio/vídeo/anexos) — feature de Tarefas, mantida.
INSERT INTO storage.buckets (id, name, public)
VALUES ('demandas-anexos', 'demandas-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Demandas anexos: leitura autenticada" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'demandas-anexos' AND (public.is_admin(auth.uid()) OR owner = auth.uid()));
CREATE POLICY "Demandas anexos: upload autenticado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'demandas-anexos');
CREATE POLICY "demandas_anexos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'demandas-anexos' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'demandas-anexos' AND public.is_admin(auth.uid()));
CREATE POLICY "demandas_anexos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'demandas-anexos' AND public.is_admin(auth.uid()));
