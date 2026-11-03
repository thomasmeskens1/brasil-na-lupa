import "server-only";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { headers } from "next/headers";
import { criarAdaptador } from "./adaptador";
import { gerarCodigo, VALIDADE_CODIGO_SEGUNDOS } from "./codigo";
import { googleAtivo } from "./config";
import { contasParaAvisar, limparExpirados, registrarAcesso, RETENCAO } from "./dados";
import { obterSql } from "./db";
import { codigoLegivel, enviarEmail, escapar, htmlCodigo } from "./email";
import { consumirLimite, ipDaRequisicao } from "./limite";

/**
 * O e-mail de login leva um código de 6 dígitos (digitado em /entrar/verifique) e, como
 * alternativa, o link. Os dois são o mesmo token: valem 10 minutos, uma vez só, e o código é
 * cancelado depois de 5 tentativas erradas (adaptador.ts).
 */
async function enviarCodigo({ identifier: email, url, token }: { identifier: string; url: string; token: string }) {
  const sql = obterSql();
  const ip = ipDaRequisicao(await headers());
  const segredo = process.env.AUTH_SECRET ?? "";
  // Segunda barreira do limite (a primeira fica na ação do formulário): cobre também
  // chamadas diretas a /api/auth/signin/resend.
  if (!(await consumirLimite(sql, { email, ip }, segredo))) {
    throw new Error("Limite de envio de códigos atingido.");
  }
  await limparExpirados(sql);

  const assunto = `Seu código para entrar no Brasil na Lupa: ${codigoLegivel(token)}`;
  const texto =
    `Seu código para entrar no Brasil na Lupa:\n\n${codigoLegivel(token)}\n\n` +
    "Digite o código na tela de entrada. Ele vale por 10 minutos e só pode ser usado uma vez.\n\n" +
    `Se preferir, entre pelo link (vale pelo mesmo prazo):\n${url}\n\n` +
    "Se você não pediu este código, ignore esta mensagem: nenhuma conta é criada sem ele.";
  const html =
    `<p>Seu código para entrar no Brasil na Lupa:</p>${htmlCodigo(token)}` +
    `<p>Digite o código na tela de entrada. Ele vale por 10 minutos e só pode ser usado uma vez.</p>` +
    `<p>Se preferir, entre pelo link (vale pelo mesmo prazo):</p>` +
    `<p><a href="${escapar(url)}" style="display:inline-block;padding:10px 16px;background:#1f2933;color:#ffffff;text-decoration:none;border-radius:4px">Entrar no Brasil na Lupa</a></p>` +
    `<p>Se você não pediu este código, ignore esta mensagem: nenhuma conta é criada sem ele.</p>`;
  await enviarEmail(email, assunto, texto, html);
}

/** Aviso, 30 dias antes, de que a conta sem acesso há quase 24 meses será excluída. */
async function avisarInativos(): Promise<void> {
  const sql = obterSql();
  for (const email of await contasParaAvisar(sql)) {
    const texto =
      `Sua conta no Brasil na Lupa está sem acesso há quase ${RETENCAO.inatividadeMeses} meses. ` +
      `Ela será excluída, com todos os favoritos e reações, em ${RETENCAO.avisoAntesDias} dias. ` +
      "Para mantê-la, basta entrar no site de novo. Se não quiser mantê-la, não faça nada.";
    try {
      await enviarEmail(email, "Sua conta no Brasil na Lupa será excluída por inatividade", texto, `<p>${escapar(texto)}</p>`);
    } catch {
      // Falha no envio: o aviso fica marcado e a exclusão só acontece 30 dias depois mesmo assim.
    }
  }
}

function configuracao(): NextAuthConfig {
  const sql = obterSql();
  const providers: NextAuthConfig["providers"] = [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
      maxAge: VALIDADE_CODIGO_SEGUNDOS,
      generateVerificationToken: gerarCodigo,
      sendVerificationRequest: enviarCodigo,
    }),
  ];
  if (googleAtivo()) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        // O Google só devolve e-mails verificados (conferido no callback signIn); assim quem
        // entrou antes por código usa a mesma conta ao entrar com o Google.
        allowDangerousEmailAccountLinking: true,
        // Só o necessário: identificador e e-mail. Nome e foto do perfil não são guardados.
        profile(p) {
          return { id: p.sub, email: p.email, name: null };
        },
      }),
    );
  }

  return {
    secret: process.env.AUTH_SECRET,
    adapter: criarAdaptador(sql),
    providers,
    // Sessão no banco: excluir a conta ou sair encerra a sessão na hora. O cookie de sessão do
    // Auth.js é HttpOnly, SameSite=Lax e, em HTTPS, Secure (prefixo __Secure-).
    session: { strategy: "database", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
    pages: { signIn: "/entrar", verifyRequest: "/entrar/verifique", error: "/entrar/erro" },
    callbacks: {
      signIn({ account, profile }) {
        if (account?.provider === "google") return profile?.email_verified === true;
        return true;
      },
      session({ session, user }) {
        return { ...session, user: { id: user.id, email: user.email, name: null } };
      },
    },
    events: {
      async signIn({ user }) {
        if (user.id) await registrarAcesso(sql, user.id);
        await limparExpirados(sql);
        await avisarInativos();
      },
    },
  };
}

/**
 * Inicialização sob demanda: a configuração (e o acesso a variáveis e ao banco) só acontece
 * numa requisição. Importar este módulo no build, com o cadastro desligado, não faz nada.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => configuracao());
