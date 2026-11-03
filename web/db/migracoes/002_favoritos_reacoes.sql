-- 002 — Login por código, favoritos e reações (curtir / não curtir).
--
-- Mesmos princípios da 001: só o mínimo necessário e ON DELETE CASCADE em tudo o que é ligado
-- ao usuário (excluir a conta apaga favoritos e reações na mesma operação). Favoritos e reações
-- só são gravados com consentimento válido (a aplicação confere) e são apagados ao revogá-lo.

-- Minimização (LGPD, art. 6º, III): o nome vindo do Google deixa de ser guardado.
ALTER TABLE usuarios DROP COLUMN IF EXISTS nome;

-- Aviso por e-mail antes da exclusão por inatividade (24 meses sem acesso): a conta só é
-- excluída 30 dias depois do aviso. Um novo acesso zera o aviso.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aviso_inatividade_em timestamptz;

-- Consentimento: declaração de 18 anos ou mais (art. 14) e consentimento específico e
-- destacado para as reações, que revelam opinião política (art. 5º, II, e art. 11, I).
-- Revogar só o das reações apaga as reações e deixa o resto da conta.
ALTER TABLE consentimentos ADD COLUMN IF NOT EXISTS declarou_maioridade boolean NOT NULL DEFAULT false;
ALTER TABLE consentimentos ADD COLUMN IF NOT EXISTS reacoes_aceito_em timestamptz;

-- Login por código de 6 dígitos (o mesmo token do link do e-mail). Conta as tentativas erradas:
-- na 5ª, o código é apagado (ver adaptador.ts).
ALTER TABLE tokens_verificacao ADD COLUMN IF NOT EXISTS tentativas smallint NOT NULL DEFAULT 0;

-- Favoritos: estados (sigla), temas (id do catálogo), políticos e propostas (ids do site, ver
-- web/src/features/conta/ids.ts). Sem data nem outro campo: só o que o usuário marcou.
CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id  uuid NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('uf', 'tema', 'politico', 'proposta')),
  ref         text NOT NULL CHECK (length(ref) BETWEEN 1 AND 120),
  PRIMARY KEY (usuario_id, tipo, ref)
);

-- Os favoritos substituem as listas de estados, temas, políticos e itens das preferências
-- (uma só fonte). Copia o que existir antes de apagar as colunas. Temas não são copiados: o
-- catálogo mudou para a lista oficial de temas e nenhuma conta existia antes desta migração.
INSERT INTO favoritos (usuario_id, tipo, ref)
  SELECT usuario_id, 'uf', unnest(ufs) FROM preferencias
  UNION SELECT usuario_id, 'politico', unnest(politicos) FROM preferencias
  UNION SELECT usuario_id, 'proposta', unnest(itens) FROM preferencias
ON CONFLICT DO NOTHING;

ALTER TABLE preferencias
  DROP COLUMN IF EXISTS ufs,
  DROP COLUMN IF EXISTS temas,
  DROP COLUMN IF EXISTS politicos,
  DROP COLUMN IF EXISTS itens;

-- Reações: uma por usuário por proposta (trocar = UPDATE; retirar = DELETE).
CREATE TABLE IF NOT EXISTS reacoes (
  usuario_id  uuid NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  proposta    text NOT NULL CHECK (length(proposta) BETWEEN 1 AND 120),
  valor       smallint NOT NULL CHECK (valor IN (1, -1)),
  PRIMARY KEY (usuario_id, proposta)
);

-- Contagem agregada por proposta, mantida pelo gatilho abaixo: ler os contadores é uma
-- consulta por chave primária, sem varrer as reações. Não guarda quem reagiu.
CREATE TABLE IF NOT EXISTS reacoes_contagem (
  proposta      text PRIMARY KEY,
  curtidas      integer NOT NULL DEFAULT 0 CHECK (curtidas >= 0),
  nao_curtidas  integer NOT NULL DEFAULT 0 CHECK (nao_curtidas >= 0)
);

CREATE OR REPLACE FUNCTION reacoes_contar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE reacoes_contagem
       SET curtidas = curtidas - (OLD.valor = 1)::int,
           nao_curtidas = nao_curtidas - (OLD.valor = -1)::int
     WHERE proposta = OLD.proposta;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    INSERT INTO reacoes_contagem (proposta, curtidas, nao_curtidas)
    VALUES (NEW.proposta, (NEW.valor = 1)::int, (NEW.valor = -1)::int)
    ON CONFLICT (proposta) DO UPDATE
      SET curtidas = reacoes_contagem.curtidas + EXCLUDED.curtidas,
          nao_curtidas = reacoes_contagem.nao_curtidas + EXCLUDED.nao_curtidas;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reacoes_contagem_gatilho ON reacoes;
CREATE TRIGGER reacoes_contagem_gatilho
  AFTER INSERT OR UPDATE OR DELETE ON reacoes
  FOR EACH ROW EXECUTE FUNCTION reacoes_contar();
