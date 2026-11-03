/**
 * Adapter mínimo do Auth.js para Postgres (Neon). Implementado aqui em vez do adapter oficial
 * para gravar só o necessário: o adapter oficial guarda foto do perfil e os tokens de acesso do
 * Google (access_token, refresh_token, id_token), que o site não usa. Aqui ficam apenas
 * e-mail, vínculo com o provedor, sessões e códigos de login (hash). O nome do Google não é
 * guardado (minimização, LGPD art. 6º, III).
 *
 * Só importa tipos (testável com node --test e um Postgres em memória).
 */
import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "next-auth/adapters";
import type { Sql } from "./sql";

/** Tentativas erradas aceitas para um código de login; na última, o código é apagado. */
export const MAX_TENTATIVAS_CODIGO = 5;

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LinhaUsuario {
  [k: string]: unknown;
  id: string;
  email: string;
  email_verificado_em: Date | string | null;
}

function data(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v : new Date(String(v));
}

function paraUsuario(l: LinhaUsuario): AdapterUser {
  return { id: l.id, email: l.email, emailVerified: data(l.email_verificado_em), name: null };
}

export function criarAdaptador(sql: Sql): Adapter {
  async function getUser(id: string): Promise<AdapterUser | null> {
    if (!RE_UUID.test(id)) return null;
    const [l] = await sql<LinhaUsuario>`
      SELECT id, email, email_verificado_em FROM usuarios WHERE id = ${id}`;
    return l ? paraUsuario(l) : null;
  }

  return {
    async createUser(user) {
      const [l] = await sql<LinhaUsuario>`
        INSERT INTO usuarios (email, email_verificado_em)
        VALUES (${user.email.trim().toLowerCase()}, ${user.emailVerified ?? null})
        RETURNING id, email, email_verificado_em`;
      return paraUsuario(l);
    },

    getUser,

    async getUserByEmail(email) {
      const [l] = await sql<LinhaUsuario>`
        SELECT id, email, email_verificado_em FROM usuarios WHERE email = ${email.trim().toLowerCase()}`;
      return l ? paraUsuario(l) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const [l] = await sql<LinhaUsuario>`
        SELECT u.id, u.email, u.email_verificado_em
        FROM contas_externas c JOIN usuarios u ON u.id = c.usuario_id
        WHERE c.provedor = ${provider} AND c.id_no_provedor = ${providerAccountId}`;
      return l ? paraUsuario(l) : null;
    },

    async updateUser(parcial) {
      const atual = await getUser(parcial.id);
      if (!atual) throw new Error("Usuário não encontrado.");
      const email = parcial.email ? parcial.email.trim().toLowerCase() : atual.email;
      const verificado = parcial.emailVerified !== undefined ? parcial.emailVerified : atual.emailVerified;
      const [l] = await sql<LinhaUsuario>`
        UPDATE usuarios SET email = ${email}, email_verificado_em = ${verificado}
        WHERE id = ${parcial.id}
        RETURNING id, email, email_verificado_em`;
      return paraUsuario(l);
    },

    async deleteUser(id) {
      if (!RE_UUID.test(id)) return;
      await sql`DELETE FROM usuarios WHERE id = ${id}`;
    },

    async linkAccount(conta: AdapterAccount) {
      // Tokens do provedor (access_token, refresh_token, id_token) são descartados de propósito.
      await sql`
        INSERT INTO contas_externas (provedor, id_no_provedor, usuario_id, tipo)
        VALUES (${conta.provider}, ${conta.providerAccountId}, ${conta.userId}, ${conta.type})
        ON CONFLICT (provedor, id_no_provedor) DO NOTHING`;
      return null;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await sql`DELETE FROM contas_externas WHERE provedor = ${provider} AND id_no_provedor = ${providerAccountId}`;
    },

    async createSession({ sessionToken, userId, expires }) {
      await sql`INSERT INTO sessoes (token, usuario_id, expira_em) VALUES (${sessionToken}, ${userId}, ${expires})`;
      return { sessionToken, userId, expires };
    },

    async getSessionAndUser(sessionToken) {
      const [l] = await sql<LinhaUsuario & { expira_em: Date | string }>`
        SELECT s.expira_em, u.id, u.email, u.email_verificado_em
        FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token = ${sessionToken}`;
      if (!l) return null;
      const session: AdapterSession = { sessionToken, userId: l.id, expires: data(l.expira_em) as Date };
      return { session, user: paraUsuario(l) };
    },

    async updateSession({ sessionToken, expires }) {
      if (!expires) return null;
      const [l] = await sql<{ usuario_id: string; expira_em: Date | string }>`
        UPDATE sessoes SET expira_em = ${expires} WHERE token = ${sessionToken}
        RETURNING usuario_id, expira_em`;
      return l ? { sessionToken, userId: l.usuario_id, expires: data(l.expira_em) as Date } : null;
    },

    async deleteSession(sessionToken) {
      await sql`DELETE FROM sessoes WHERE token = ${sessionToken}`;
    },

    async createVerificationToken({ identifier, token, expires }: VerificationToken) {
      // Só o código mais recente vale: pedir um novo cancela os anteriores do mesmo e-mail.
      await sql`
        WITH antigos AS (DELETE FROM tokens_verificacao WHERE identificador = ${identifier})
        INSERT INTO tokens_verificacao (identificador, token, expira_em)
        VALUES (${identifier}, ${token}, ${expires})`;
      return { identifier, token, expires };
    },

    async useVerificationToken({ identifier, token }) {
      // Uso único: o código (ou link) certo é apagado ao ser usado.
      const [l] = await sql<{ identificador: string; token: string; expira_em: Date | string }>`
        DELETE FROM tokens_verificacao
        WHERE identificador = ${identifier} AND token = ${token} AND tentativas < ${MAX_TENTATIVAS_CODIGO}
        RETURNING identificador, token, expira_em`;
      if (l) return { identifier: l.identificador, token: l.token, expires: data(l.expira_em) as Date };
      // Código errado: conta a tentativa e, ao chegar no limite, apaga o código do e-mail.
      // (Dois comandos: no Postgres, um mesmo comando não pode alterar e apagar a mesma linha.)
      await sql`UPDATE tokens_verificacao SET tentativas = tentativas + 1 WHERE identificador = ${identifier}`;
      await sql`
        DELETE FROM tokens_verificacao
        WHERE identificador = ${identifier} AND tentativas >= ${MAX_TENTATIVAS_CODIGO}`;
      return null;
    },
  };
}
