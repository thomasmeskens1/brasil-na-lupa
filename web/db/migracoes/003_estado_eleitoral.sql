-- 003 — "Estado onde você vota" (opcional), para o recorte das reações por estado e para a
-- lista "Propostas com mais manifestações" (Política de Privacidade, versão 5).
--
-- Fica no registro do consentimento: revogar o consentimento geral (DELETE da linha) ou excluir a
-- conta apaga o estado junto. A sigla é declarada pela pessoa e nunca é conferida com outra base.
-- Só entra nas contagens com o consentimento próprio (uf_eleitoral_aceito_em) e só em totais
-- agregados, a partir de um número mínimo de pessoas (ver web/src/features/conta/manifestacoes.ts).
ALTER TABLE consentimentos ADD COLUMN IF NOT EXISTS uf_eleitoral text
  CHECK (uf_eleitoral IS NULL OR uf_eleitoral ~ '^[A-Z]{2}$');
ALTER TABLE consentimentos ADD COLUMN IF NOT EXISTS uf_eleitoral_aceito_em timestamptz;
