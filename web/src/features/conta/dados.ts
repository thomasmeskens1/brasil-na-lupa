/**
 * Operações sobre os dados da conta: consentimento, preferências, exportação, exclusão e
 * limpeza automática. Recebem o cliente SQL por parâmetro (testável com Postgres em memória).
 */
import type { Preferencias } from "./regras";
import type { Sql } from "./sql";

/** Prazos de retenção (também descritos na Política de Privacidade). */
export const RETENCAO = {
  semConsentimentoDias: 7,
  inatividadeMeses: 24,
  limitesEnvioHoras: 24,
} as const;

export interface EstadoConta {
  usuario: { id: string; email: string; nome: string | null; criadoEm: Date };
  consentimento: { versao: string; aceitoEm: Date } | null;
  preferencias: Preferencias | null;
}

interface LinhaEstado {
  [k: string]: unknown;
  id: string;
  email: string;
  nome: string | null;
  criado_em: Date | string;
  versao_politica: string | null;
  aceito_em: Date | string | null;
  ufs: string[] | null;
  municipios: string[] | null;
  temas: string[] | null;
  politicos: string[] | null;
  itens: string[] | null;
  alertas_email: boolean | null;
  tem_preferencias: boolean;
}

const d = (v: Date | string) => (v instanceof Date ? v : new Date(v));

export async function obterEstado(sql: Sql, usuarioId: string): Promise<EstadoConta | null> {
  const [l] = await sql<LinhaEstado>`
    SELECT u.id, u.email, u.nome, u.criado_em,
           c.versao_politica, c.aceito_em,
           p.ufs, p.municipios, p.temas, p.politicos, p.itens, p.alertas_email,
           (p.usuario_id IS NOT NULL) AS tem_preferencias
    FROM usuarios u
    LEFT JOIN consentimentos c ON c.usuario_id = u.id
    LEFT JOIN preferencias p ON p.usuario_id = u.id
    WHERE u.id = ${usuarioId}`;
  if (!l) return null;
  return {
    usuario: { id: l.id, email: l.email, nome: l.nome, criadoEm: d(l.criado_em) },
    consentimento:
      l.versao_politica && l.aceito_em ? { versao: l.versao_politica, aceitoEm: d(l.aceito_em) } : null,
    preferencias: l.tem_preferencias
      ? {
          ufs: l.ufs ?? [],
          municipios: l.municipios ?? [],
          temas: l.temas ?? [],
          politicos: l.politicos ?? [],
          itens: l.itens ?? [],
          alertasEmail: l.alertas_email === true,
        }
      : null,
  };
}

/** Consentimento explícito: grava data e versão, e cria preferências vazias (alertas desligados). */
export async function registrarConsentimento(sql: Sql, usuarioId: string, versao: string): Promise<void> {
  // Um único comando (atômico): consentimento + preferências vazias + fim da contagem de 7 dias.
  await sql`
    WITH c AS (
      INSERT INTO consentimentos (usuario_id, versao_politica, aceito_em)
      VALUES (${usuarioId}, ${versao}, now())
      ON CONFLICT (usuario_id) DO UPDATE SET versao_politica = EXCLUDED.versao_politica, aceito_em = now()
      RETURNING usuario_id
    ), p AS (
      INSERT INTO preferencias (usuario_id) SELECT usuario_id FROM c
      ON CONFLICT (usuario_id) DO NOTHING
    )
    UPDATE usuarios SET sem_consentimento_desde = NULL WHERE id = (SELECT usuario_id FROM c)`;
}

/** Revogar o consentimento apaga as preferências e o registro do consentimento. */
export async function revogarConsentimento(sql: Sql, usuarioId: string): Promise<void> {
  await sql`
    WITH p AS (DELETE FROM preferencias WHERE usuario_id = ${usuarioId}),
         c AS (DELETE FROM consentimentos WHERE usuario_id = ${usuarioId})
    UPDATE usuarios SET sem_consentimento_desde = now() WHERE id = ${usuarioId}`;
}

/** Só grava se houver consentimento na versão atual da política. Devolve false caso contrário. */
export async function salvarPreferencias(
  sql: Sql,
  usuarioId: string,
  versaoAtual: string,
  p: Preferencias,
): Promise<boolean> {
  const linhas = await sql`
    UPDATE preferencias SET
      ufs = ${p.ufs}, municipios = ${p.municipios}, temas = ${p.temas},
      politicos = ${p.politicos}, itens = ${p.itens}, alertas_email = ${p.alertasEmail},
      atualizado_em = now()
    WHERE usuario_id = ${usuarioId}
      AND EXISTS (SELECT 1 FROM consentimentos c
                  WHERE c.usuario_id = ${usuarioId} AND c.versao_politica = ${versaoAtual})
    RETURNING usuario_id`;
  return linhas.length === 1;
}

/** "Baixar meus dados": tudo o que o banco guarda sobre a pessoa. */
export async function exportarDados(sql: Sql, usuarioId: string) {
  const estado = await obterEstado(sql, usuarioId);
  if (!estado) return null;
  const [u] = await sql<{ email_verificado_em: Date | string | null; ultimo_acesso_em: Date | string }>`
    SELECT email_verificado_em, ultimo_acesso_em FROM usuarios WHERE id = ${usuarioId}`;
  const contas = await sql<{ provedor: string }>`
    SELECT provedor FROM contas_externas WHERE usuario_id = ${usuarioId} ORDER BY provedor`;
  const sessoes = await sql<{ expira_em: Date | string }>`
    SELECT expira_em FROM sessoes WHERE usuario_id = ${usuarioId} ORDER BY expira_em`;
  const iso = (v: Date | string | null | undefined) => (v ? d(v).toISOString() : null);
  return {
    geradoEm: new Date().toISOString(),
    site: "Brasil Transparente",
    conta: {
      email: estado.usuario.email,
      nome: estado.usuario.nome,
      criadaEm: estado.usuario.criadoEm.toISOString(),
      emailVerificadoEm: iso(u?.email_verificado_em),
      ultimoAcessoEm: iso(u?.ultimo_acesso_em),
      loginsVinculados: contas.map((c) => c.provedor),
      sessoesAtivas: sessoes.map((s) => ({ expiraEm: iso(s.expira_em) })),
    },
    consentimento: estado.consentimento
      ? { versaoDaPolitica: estado.consentimento.versao, aceitoEm: estado.consentimento.aceitoEm.toISOString() }
      : null,
    preferencias: estado.preferencias,
  };
}

/** Exclusão real e imediata: a linha do usuário e, em cascata, tudo o que é ligado a ela. */
export async function excluirConta(sql: Sql, usuarioId: string): Promise<void> {
  await sql`
    WITH u AS (DELETE FROM usuarios WHERE id = ${usuarioId} RETURNING email)
    DELETE FROM tokens_verificacao WHERE identificador IN (SELECT email FROM u)`;
}

export async function registrarAcesso(sql: Sql, usuarioId: string): Promise<void> {
  await sql`UPDATE usuarios SET ultimo_acesso_em = now() WHERE id = ${usuarioId}`;
}

/** Limpeza automática dos prazos de retenção. Roda a cada login e a cada envio de link. */
export async function limparExpirados(sql: Sql): Promise<void> {
  await sql`DELETE FROM usuarios WHERE sem_consentimento_desde < now() - make_interval(days => ${RETENCAO.semConsentimentoDias}::int)`;
  await sql`DELETE FROM usuarios WHERE ultimo_acesso_em < now() - make_interval(months => ${RETENCAO.inatividadeMeses}::int)`;
  await sql`DELETE FROM sessoes WHERE expira_em < now()`;
  await sql`DELETE FROM tokens_verificacao WHERE expira_em < now()`;
  await sql`DELETE FROM limites_envio WHERE criado_em < now() - make_interval(hours => ${RETENCAO.limitesEnvioHoras}::int)`;
}
