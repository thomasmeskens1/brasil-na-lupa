import "server-only";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { headers } from "next/headers";
import { criarAdaptador } from "./adaptador";
import { googleAtivo } from "./config";
import { limparExpirados, registrarAcesso } from "./dados";
import { obterSql } from "./db";
import { consumirLimite, ipDaRequisicao } from "./limite";

/** Validade do link mágico: 1 hora (o padrão do Auth.js é 24 horas). */
const VALIDADE_LINK_SEGUNDOS = 60 * 60;

function escapar(t: string): string {
  return t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function enviarLink({ identifier: email, url }: { identifier: string; url: string }) {
  const sql = obterSql();
  const ip = ipDaRequisicao(await headers());
  const segredo = process.env.AUTH_SECRET ?? "";
  // Segunda barreira do limite (a primeira fica na ação do formulário): cobre também
  // chamadas diretas a /api/auth/signin/resend.
  if (!(await consumirLimite(sql, { email, ip }, segredo))) {
    throw new Error("Limite de envio de links atingido.");
  }
  await limparExpirados(sql);

  const assunto = "Seu link para entrar no Placar do Poder";
  const texto =
    `Use o link abaixo para entrar no Placar do Poder. Ele vale por 1 hora e só pode ser usado uma vez.\n\n${url}\n\n` +
    "Se você não pediu este link, ignore esta mensagem: nenhuma conta é criada sem o clique.";
  const html =
    `<p>Use o botão abaixo para entrar no Placar do Poder. O link vale por 1 hora e só pode ser usado uma vez.</p>` +
    `<p><a href="${escapar(url)}" style="display:inline-block;padding:10px 16px;background:#1f2933;color:#ffffff;text-decoration:none;border-radius:4px">Entrar no Placar do Poder</a></p>` +
    `<p>Se você não pediu este link, ignore esta mensagem: nenhuma conta é criada sem o clique.</p>`;

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: email, subject: assunto, text: texto, html }),
  });
  if (!resposta.ok) throw new Error(`Falha no envio do e-mail (HTTP ${resposta.status}).`);
}

function configuracao(): NextAuthConfig {
  const sql = obterSql();
  const providers: NextAuthConfig["providers"] = [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
      maxAge: VALIDADE_LINK_SEGUNDOS,
      sendVerificationRequest: enviarLink,
    }),
  ];
  if (googleAtivo()) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        // O Google só devolve e-mails verificados (conferido no callback signIn); assim quem
        // entrou antes por link mágico usa a mesma conta ao entrar com o Google.
        allowDangerousEmailAccountLinking: true,
        // Só o necessário: identificador, e-mail e nome. A foto do perfil não é usada.
        profile(p) {
          return { id: p.sub, email: p.email, name: p.name ?? null };
        },
      }),
    );
  }

  return {
    secret: process.env.AUTH_SECRET,
    adapter: criarAdaptador(sql),
    providers,
    // Sessão no banco: excluir a conta ou sair encerra a sessão na hora.
    session: { strategy: "database", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
    pages: { signIn: "/entrar", verifyRequest: "/entrar/verifique", error: "/entrar/erro" },
    callbacks: {
      signIn({ account, profile }) {
        if (account?.provider === "google") return profile?.email_verified === true;
        return true;
      },
      session({ session, user }) {
        return { ...session, user: { id: user.id, email: user.email, name: user.name ?? null } };
      },
    },
    events: {
      async signIn({ user }) {
        if (user.id) await registrarAcesso(sql, user.id);
        await limparExpirados(sql);
      },
    },
  };
}

/**
 * Inicialização sob demanda: a configuração (e o acesso a variáveis e ao banco) só acontece
 * numa requisição. Importar este módulo no build, com o cadastro desligado, não faz nada.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => configuracao());
