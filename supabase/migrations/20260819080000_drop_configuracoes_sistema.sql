-- A tela de Configurações (Integração Resend) saiu do app: a chave da API,
-- e-mail e nome do remetente agora vêm do .env (RESEND_API_KEY,
-- RESEND_FROM_EMAIL, RESEND_FROM_NAME), lidos direto no servidor. A tabela
-- de configurações chave/valor não é mais usada por nada no código.
DROP TABLE IF EXISTS public.configuracoes_sistema;
