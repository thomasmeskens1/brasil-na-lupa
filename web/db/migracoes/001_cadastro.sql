-- 001 — Cadastro de usuários (opcional) do Placar do Poder.
--
-- Princípios (LGPD): só o mínimo necessário. Nada de foto, telefone, CPF, tokens de acesso do
-- Google ou endereço IP em claro. Toda tabela ligada ao usuário usa ON DELETE CASCADE: excluir a
-- linha de "usuarios" apaga, na mesma operação, sessões, contas externas, consentimento e
-- preferências.

CREATE TABLE IF NOT EXISTS usuarios (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                    text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) <= 254),
  email_verificado_em      timestamptz,
  -- Só preenchido quando o login é feito com o Google (nome informado pelo próprio Google).
  nome                     text CHECK (nome IS NULL OR length(nome) <= 200),
  criado_em                timestamptz NOT NULL DEFAULT now(),
  ultimo_acesso_em         timestamptz NOT NULL DEFAULT now(),
  -- Preenchido enquanto a conta não tem consentimento válido (antes de aceitar ou depois de
  -- revogar). Contas nessa situação há mais de 7 dias são excluídas pela limpeza automática.
  sem_consentimento_desde  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usuarios_sem_consentimento_idx
  ON usuarios (sem_consentimento_desde) WHERE sem_consentimento_desde IS NOT NULL;
CREATE INDEX IF NOT EXISTS usuarios_ultimo_acesso_idx ON usuarios (ultimo_acesso_em);

-- Vínculo com o login do Google. Guarda apenas o identificador da conta no provedor;
-- nenhum token de acesso é armazenado.
CREATE TABLE IF NOT EXISTS contas_externas (
  provedor        text NOT NULL,
  id_no_provedor  text NOT NULL,
  usuario_id      uuid NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  tipo            text NOT NULL,
  PRIMARY KEY (provedor, id_no_provedor)
);
CREATE INDEX IF NOT EXISTS contas_externas_usuario_idx ON contas_externas (usuario_id);

-- Sessões (o cookie de sessão guarda só o token; os dados ficam aqui).
CREATE TABLE IF NOT EXISTS sessoes (
  token       text PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  expira_em   timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessoes_usuario_idx ON sessoes (usuario_id);
CREATE INDEX IF NOT EXISTS sessoes_expira_idx ON sessoes (expira_em);

-- Links mágicos de login. O Auth.js grava apenas o hash do token.
CREATE TABLE IF NOT EXISTS tokens_verificacao (
  identificador  text NOT NULL,
  token          text NOT NULL,
  expira_em      timestamptz NOT NULL,
  PRIMARY KEY (identificador, token)
);
CREATE INDEX IF NOT EXISTS tokens_verificacao_expira_idx ON tokens_verificacao (expira_em);

-- Registro do consentimento (LGPD, art. 8º e art. 11, I): data e versão da política aceita.
CREATE TABLE IF NOT EXISTS consentimentos (
  usuario_id      uuid PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
  versao_politica text NOT NULL,
  aceito_em       timestamptz NOT NULL DEFAULT now()
);

-- Preferências. Só existem enquanto houver consentimento: revogar apaga esta linha.
CREATE TABLE IF NOT EXISTS preferencias (
  usuario_id     uuid PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
  ufs            text[] NOT NULL DEFAULT '{}',
  municipios     text[] NOT NULL DEFAULT '{}',
  temas          text[] NOT NULL DEFAULT '{}',
  politicos      text[] NOT NULL DEFAULT '{}',
  itens          text[] NOT NULL DEFAULT '{}',
  alertas_email  boolean NOT NULL DEFAULT false,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

-- Limite de envio de links de login. A chave é um HMAC do e-mail ou do IP (nunca o valor em
-- claro); os registros são apagados depois de 24 horas.
CREATE TABLE IF NOT EXISTS limites_envio (
  id         bigserial PRIMARY KEY,
  chave      text NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS limites_envio_chave_idx ON limites_envio (chave, criado_em);
CREATE INDEX IF NOT EXISTS limites_envio_criado_idx ON limites_envio (criado_em);
