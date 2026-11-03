/**
 * Operações sobre os dados da conta: consentimento, preferências, exportação, exclusão e
 * limpeza automática. Recebem o cliente SQL por parâmetro (testável com Postgres em memória).
 *
 * Estados, temas, políticos e propostas das preferências são os favoritos (tabela favoritos):
 * uma só fonte, editada tanto na Minha conta quanto pelo botão "Favoritar" das páginas.
 */
import type { Preferencias } from "./regras";
import type { Sql } from "./sql";

/** Prazos de retenção (também descritos na Política de Privacidade). */
export const RETENCAO = {
  semConsentimentoDias: 7,
  inatividadeMeses: 24,
  /** Aviso por e-mail 30 dias antes da exclusão por inatividade. */
  avisoAntesDias: 30,
  limitesEnvioHoras: 24,
} as const;

export interface EstadoConta {
  usuario: { id: string; email: string; criadoEm: Date };
  consentimento: { versao: string; aceitoEm: Date; reacoesAceitoEm: Date | null } | null;
  preferencias: Preferencias | null;
}

interface LinhaEstado {
  [k: string]: unknown;
  id: string;
  email: string;
  criado_em: Date | string;
  versao_politica: string | null;
  aceito_em: Date | string | null;
  reacoes_aceito_em: Date | string | null;
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
    SELECT u.id, u.email, u.criado_em,
           c.versao_politica, c.aceito_em, c.reacoes_aceito_em,
           p.municipios, p.alertas_email,
           (p.usuario_id IS NOT NULL) AS tem_preferencias,
           (SELECT array_agg(f.ref ORDER BY f.ref) FROM favoritos f WHERE f.usuario_id = u.id AND f.tipo = 'uf') AS ufs,
           (SELECT array_agg(f.ref ORDER BY f.ref) FROM favoritos f WHERE f.usuario_id = u.id AND f.tipo = 'tema') AS temas,
           (SELECT array_agg(f.ref ORDER BY f.ref) FROM favoritos f WHERE f.usuario_id = u.id AND f.tipo = 'politico') AS politicos,
           (SELECT array_agg(f.ref ORDER BY f.ref) FROM favoritos f WHERE f.usuario_id = u.id AND f.tipo = 'proposta') AS itens
    FROM usuarios u
    LEFT JOIN consentimentos c ON c.usuario_id = u.id
    LEFT JOIN preferencias p ON p.usuario_id = u.id
    WHERE u.id = ${usuarioId}`;
  if (!l) return null;
  return {
    usuario: { id: l.id, email: l.email, criadoEm: d(l.criado_em) },
    consentimento:
      l.versao_politica && l.aceito_em
        ? {
            versao: l.versao_politica,
            aceitoEm: d(l.aceito_em),
            reacoesAceitoEm: l.reacoes_aceito_em ? d(l.reacoes_aceito_em) : null,
          }
        : null,
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
      INSERT INTO consentimentos (usuario_id, versao_politica, aceito_em, declarou_maioridade)
      VALUES (${usuarioId}, ${versao}, now(), true)
      ON CONFLICT (usuario_id) DO UPDATE
        SET versao_politica = EXCLUDED.versao_politica, aceito_em = now(), declarou_maioridade = true
      RETURNING usuario_id
    ), p AS (
      INSERT INTO preferencias (usuario_id) SELECT usuario_id FROM c
      ON CONFLICT (usuario_id) DO NOTHING
    )
    UPDATE usuarios SET sem_consentimento_desde = NULL WHERE id = (SELECT usuario_id FROM c)`;
}

/** Revogar o consentimento apaga preferências, favoritos, reações e o registro do consentimento. */
export async function revogarConsentimento(sql: Sql, usuarioId: string): Promise<void> {
  await sql`
    WITH p AS (DELETE FROM preferencias WHERE usuario_id = ${usuarioId}),
         f AS (DELETE FROM favoritos WHERE usuario_id = ${usuarioId}),
         r AS (DELETE FROM reacoes WHERE usuario_id = ${usuarioId}),
         c AS (DELETE FROM consentimentos WHERE usuario_id = ${usuarioId})
    UPDATE usuarios SET sem_consentimento_desde = now() WHERE id = ${usuarioId}`;
}

/**
 * Consentimento específico e destacado para as reações (opinião política, art. 11, I), pedido
 * na primeira reação. Exige o consentimento geral na versão atual. Devolve false sem ele.
 */
export async function aceitarConsentimentoReacoes(sql: Sql, usuarioId: string, versaoAtual: string): Promise<boolean> {
  const l = await sql`
    UPDATE consentimentos SET reacoes_aceito_em = now()
    WHERE usuario_id = ${usuarioId} AND versao_politica = ${versaoAtual}
    RETURNING usuario_id`;
  return l.length === 1;
}

/** Revoga só o consentimento das reações: apaga todas as reações da pessoa. */
export async function revogarConsentimentoReacoes(sql: Sql, usuarioId: string): Promise<void> {
  await sql`
    WITH r AS (DELETE FROM reacoes WHERE usuario_id = ${usuarioId})
    UPDATE consentimentos SET reacoes_aceito_em = NULL WHERE usuario_id = ${usuarioId}`;
}

/** Apaga só os favoritos (estados, temas, políticos e propostas). */
export async function apagarFavoritos(sql: Sql, usuarioId: string): Promise<void> {
  await sql`DELETE FROM favoritos WHERE usuario_id = ${usuarioId}`;
}

/** Apaga só as reações (os contadores agregados são descontados pelo gatilho). */
export async function apagarReacoes(sql: Sql, usuarioId: string): Promise<void> {
  await sql`DELETE FROM reacoes WHERE usuario_id = ${usuarioId}`;
}

/**
 * Correção do e-mail (art. 18, III), depois de confirmado o código enviado ao novo endereço.
 * Devolve false se o novo e-mail já pertencer a outra conta. Encerra as outras sessões.
 */
export async function trocarEmail(sql: Sql, usuarioId: string, novoEmail: string): Promise<boolean> {
  const ocupado = await sql`SELECT 1 FROM usuarios WHERE email = ${novoEmail} AND id <> ${usuarioId}`;
  if (ocupado.length) return false;
  const l = await sql`
    WITH antigo AS (SELECT email FROM usuarios WHERE id = ${usuarioId}),
         t AS (DELETE FROM tokens_verificacao WHERE identificador IN (SELECT email FROM antigo))
    UPDATE usuarios SET email = ${novoEmail}, email_verificado_em = now() WHERE id = ${usuarioId}
    RETURNING id`;
  return l.length === 1;
}

/** Só grava se houver consentimento na versão atual da política. Devolve false caso contrário. */
export async function salvarPreferencias(
  sql: Sql,
  usuarioId: string,
  versaoAtual: string,
  p: Preferencias,
): Promise<boolean> {
  const novos: [string, string][] = [
    ...p.ufs.map((r) => ["uf", r] as [string, string]),
    ...p.temas.map((r) => ["tema", r] as [string, string]),
    ...p.politicos.map((r) => ["politico", r] as [string, string]),
    ...p.itens.map((r) => ["proposta", r] as [string, string]),
  ];
  const tipos = novos.map((n) => n[0]);
  const refs = novos.map((n) => n[1]);
  // Um único comando: apaga só os favoritos desmarcados e insere os novos (linhas disjuntas).
  const linhas = await sql`
    WITH p AS (
      UPDATE preferencias SET municipios = ${p.municipios}, alertas_email = ${p.alertasEmail}, atualizado_em = now()
      WHERE usuario_id = ${usuarioId}
        AND EXISTS (SELECT 1 FROM consentimentos c
                    WHERE c.usuario_id = ${usuarioId} AND c.versao_politica = ${versaoAtual})
      RETURNING usuario_id
    ), novos AS (
      SELECT t.tipo, t.ref FROM unnest(${tipos}::text[], ${refs}::text[]) AS t (tipo, ref)
    ), apagados AS (
      DELETE FROM favoritos f
      WHERE f.usuario_id IN (SELECT usuario_id FROM p)
        AND NOT EXISTS (SELECT 1 FROM novos n WHERE n.tipo = f.tipo AND n.ref = f.ref)
    ), inseridos AS (
      INSERT INTO favoritos (usuario_id, tipo, ref)
      SELECT p.usuario_id, n.tipo, n.ref FROM p CROSS JOIN novos n
      ON CONFLICT DO NOTHING
    )
    SELECT usuario_id FROM p`;
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
  const reacoes = await sql<{ proposta: string; valor: number }>`
    SELECT proposta, valor FROM reacoes WHERE usuario_id = ${usuarioId} ORDER BY proposta`;
  const iso = (v: Date | string | null | undefined) => (v ? d(v).toISOString() : null);
  const p = estado.preferencias;
  return {
    geradoEm: new Date().toISOString(),
    site: "Brasil na Lupa",
    conta: {
      email: estado.usuario.email,
      criadaEm: estado.usuario.criadoEm.toISOString(),
      emailVerificadoEm: iso(u?.email_verificado_em),
      ultimoAcessoEm: iso(u?.ultimo_acesso_em),
      loginsVinculados: contas.map((c) => c.provedor),
      sessoesAtivas: sessoes.map((s) => ({ expiraEm: iso(s.expira_em) })),
    },
    consentimento: estado.consentimento
      ? {
          versaoDaPolitica: estado.consentimento.versao,
          aceitoEm: estado.consentimento.aceitoEm.toISOString(),
          declarouTer18AnosOuMais: true,
          reacoesAceitoEm: estado.consentimento.reacoesAceitoEm?.toISOString() ?? null,
        }
      : null,
    preferencias: p ? { municipios: p.municipios, alertasEmail: p.alertasEmail } : null,
    favoritos: p
      ? { estados: p.ufs, temas: p.temas, politicos: p.politicos, propostas: p.itens }
      : { estados: [], temas: [], politicos: [], propostas: [] },
    reacoes: reacoes.map((r) => ({ proposta: r.proposta, reacao: Number(r.valor) === 1 ? "curti" : "não curti" })),
  };
}

/** Exclusão real e imediata: a linha do usuário e, em cascata, tudo o que é ligado a ela. */
export async function excluirConta(sql: Sql, usuarioId: string): Promise<void> {
  await sql`
    WITH u AS (DELETE FROM usuarios WHERE id = ${usuarioId} RETURNING email)
    DELETE FROM tokens_verificacao WHERE identificador IN (SELECT email FROM u)`;
}

export async function registrarAcesso(sql: Sql, usuarioId: string): Promise<void> {
  await sql`UPDATE usuarios SET ultimo_acesso_em = now(), aviso_inatividade_em = NULL WHERE id = ${usuarioId}`;
}

/** Limpeza automática dos prazos de retenção. Roda a cada login e a cada envio de código. */
export async function limparExpirados(sql: Sql): Promise<void> {
  await sql`DELETE FROM usuarios WHERE sem_consentimento_desde < now() - make_interval(days => ${RETENCAO.semConsentimentoDias}::int)`;
  // Inatividade: só exclui quem foi avisado por e-mail há pelo menos 30 dias (ver contasParaAvisar).
  await sql`
    DELETE FROM usuarios
    WHERE ultimo_acesso_em < now() - make_interval(months => ${RETENCAO.inatividadeMeses}::int)
      AND aviso_inatividade_em < now() - make_interval(days => ${RETENCAO.avisoAntesDias}::int)`;
  await sql`DELETE FROM sessoes WHERE expira_em < now()`;
  await sql`DELETE FROM tokens_verificacao WHERE expira_em < now()`;
  await sql`DELETE FROM limites_envio WHERE criado_em < now() - make_interval(hours => ${RETENCAO.limitesEnvioHoras}::int)`;
}

/**
 * Contas a avisar: sem acesso há 24 meses menos 30 dias e ainda não avisadas. Marca o aviso no
 * mesmo comando (quem chama envia o e-mail). Limite por rodada para não atrasar o login.
 */
export async function contasParaAvisar(sql: Sql, limite = 20): Promise<string[]> {
  const linhas = await sql<{ email: string }>`
    UPDATE usuarios SET aviso_inatividade_em = now()
    WHERE id IN (
      SELECT id FROM usuarios
      WHERE aviso_inatividade_em IS NULL
        AND ultimo_acesso_em < now() - make_interval(months => ${RETENCAO.inatividadeMeses}::int)
                                   + make_interval(days => ${RETENCAO.avisoAntesDias}::int)
      ORDER BY ultimo_acesso_em
      LIMIT ${limite}::int
    )
    RETURNING email`;
  return linhas.map((l) => l.email);
}
