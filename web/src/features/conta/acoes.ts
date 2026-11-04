"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { criarAdaptador } from "./adaptador";
import { signIn, signOut } from "./auth";
import { gerarCodigo, normalizarCodigo, VALIDADE_CODIGO_SEGUNDOS } from "./codigo";
import { cadastroAtivo, COOKIE_LOGIN, googleAtivo } from "./config";
import {
  apagarFavoritos,
  apagarReacoes,
  excluirConta,
  registrarConsentimento,
  revogarConsentimento,
  revogarConsentimentoReacoes,
  salvarEstadosTemas,
  trocarEmail,
} from "./dados";
import { obterSql } from "./db";
import { codigoLegivel, enviarEmail, htmlCodigo } from "./email";
import { caminhoDeVolta } from "./ids";
import { consumirLimite, dentroDoLimite, ipDaRequisicao } from "./limite";
import { normalizarEmail, validarPreferencias, VERSAO_POLITICA } from "./regras";
import { usuarioAtual } from "./sessao";

/**
 * Ações do cadastro. Cada uma confere, no servidor, se o cadastro está ativo e quem é o usuário
 * da sessão (nunca confia em identificador vindo do navegador). As ações do Next.js só aceitam
 * POST da mesma origem (proteção contra CSRF); as rotas /api/auth usam o token CSRF do Auth.js.
 */

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
  /** Troca de e-mail: endereço novo aguardando o código. */
  pendente?: string;
}

const DESATIVADO: EstadoFormulario = { erro: "O cadastro não está disponível." };

/** Pede o código de login. Guarda e-mail e caminho de volta num cookie essencial de 10 minutos. */
export async function enviarCodigoAcao(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!cadastroAtivo()) return DESATIVADO;
  const email = normalizarEmail(form.get("email"));
  if (!email) return { erro: "Informe um endereço de e-mail válido, como nome@exemplo.com.br." };
  const voltar = caminhoDeVolta(form.get("voltar")) ?? "/minha-conta";
  const ip = ipDaRequisicao(await headers());
  if (!(await dentroDoLimite(obterSql(), { email, ip }, process.env.AUTH_SECRET ?? ""))) {
    return { erro: "Muitos pedidos de código em pouco tempo. Aguarde 15 minutos e tente de novo." };
  }
  (await cookies()).set(COOKIE_LOGIN, `${encodeURIComponent(email)}|${voltar}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/entrar",
    maxAge: VALIDADE_CODIGO_SEGUNDOS,
  });
  // Redireciona para /entrar/verifique (ou /entrar/erro se o envio falhar).
  await signIn("resend", { email, redirectTo: voltar });
  return {};
}

export async function entrarGoogleAcao(): Promise<void> {
  if (!googleAtivo()) redirect("/entrar");
  await signIn("google", { redirectTo: "/minha-conta" });
}

export async function sairAcao(): Promise<void> {
  if (!cadastroAtivo()) redirect("/");
  await signOut({ redirectTo: "/" });
}

export async function aceitarConsentimentoAcao(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!cadastroAtivo()) return DESATIVADO;
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  if (form.get("maioridade") !== "sim") {
    return { erro: "Para criar a conta, confirme que você tem 18 anos ou mais." };
  }
  if (form.get("aceito") !== "sim") {
    return { erro: "Para guardar favoritos e preferências, marque a caixa de consentimento." };
  }
  await registrarConsentimento(obterSql(), usuario.id, VERSAO_POLITICA);
  redirect("/minha-conta");
}

/** "Não concordo" no primeiro acesso: a conta (só o e-mail) é apagada na hora. */
export async function recusarConsentimentoAcao(): Promise<void> {
  if (!cadastroAtivo()) redirect("/");
  const usuario = await usuarioAtual();
  if (usuario) await excluirConta(obterSql(), usuario.id);
  await signOut({ redirectTo: "/minha-conta/excluida" });
}

export async function salvarPreferenciasAcao(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!cadastroAtivo()) return DESATIVADO;
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  const r = validarPreferencias(form);
  if (!r.ok) return { erro: r.erro };
  // Só estados, temas, municípios e alertas: políticos e propostas são removidos um a um na lista.
  const gravou = await salvarEstadosTemas(obterSql(), usuario.id, VERSAO_POLITICA, r.valor);
  if (!gravou) redirect("/minha-conta");
  return { ok: `Escolhas salvas às ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}.` };
}

export async function revogarConsentimentoAcao(): Promise<void> {
  if (!cadastroAtivo()) redirect("/");
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  await revogarConsentimento(obterSql(), usuario.id);
  redirect("/minha-conta?feito=revogado");
}

export async function revogarConsentimentoReacoesAcao(): Promise<void> {
  if (!cadastroAtivo()) redirect("/");
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  await revogarConsentimentoReacoes(obterSql(), usuario.id);
  redirect("/minha-conta?feito=reacoes-revogado");
}

export async function apagarFavoritosAcao(): Promise<void> {
  if (!cadastroAtivo()) redirect("/");
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  await apagarFavoritos(obterSql(), usuario.id);
  redirect("/minha-conta?feito=favoritos-apagados");
}

export async function apagarReacoesAcao(): Promise<void> {
  if (!cadastroAtivo()) redirect("/");
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  await apagarReacoes(obterSql(), usuario.id);
  redirect("/minha-conta?feito=reacoes-apagadas");
}

export async function excluirContaAcao(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!cadastroAtivo()) return DESATIVADO;
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  if (form.get("confirmo") !== "sim") {
    return { erro: "Marque a caixa de confirmação para excluir a conta." };
  }
  await excluirConta(obterSql(), usuario.id);
  await signOut({ redirectTo: "/minha-conta/excluida" });
  return {};
}

// ── Correção do e-mail (LGPD, art. 18, III): código enviado ao endereço novo ──────────────

const identificadorTroca = (usuarioId: string, novo: string) => `troca-email:${usuarioId}:${novo}`;
const hashCodigo = (codigo: string) =>
  createHash("sha256").update(`${codigo}${process.env.AUTH_SECRET ?? ""}`).digest("hex");

export async function pedirTrocaEmailAcao(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!cadastroAtivo()) return DESATIVADO;
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  const novo = normalizarEmail(form.get("novoEmail"));
  if (!novo) return { erro: "Informe um endereço de e-mail válido, como nome@exemplo.com.br." };
  if (novo === usuario.email) return { erro: "Este já é o e-mail da sua conta." };
  const sql = obterSql();
  const ip = ipDaRequisicao(await headers());
  if (!(await consumirLimite(sql, { email: novo, ip }, process.env.AUTH_SECRET ?? ""))) {
    return { erro: "Muitos pedidos de código em pouco tempo. Aguarde 15 minutos e tente de novo." };
  }
  const codigo = gerarCodigo();
  await criarAdaptador(sql).createVerificationToken?.({
    identifier: identificadorTroca(usuario.id, novo),
    token: hashCodigo(codigo),
    expires: new Date(Date.now() + VALIDADE_CODIGO_SEGUNDOS * 1000),
  });
  const texto =
    `Código para confirmar este e-mail na sua conta do Brasil na Lupa: ${codigoLegivel(codigo)}\n\n` +
    "Ele vale por 10 minutos. Se você não pediu a troca, ignore esta mensagem.";
  try {
    await enviarEmail(novo, "Confirme o novo e-mail da sua conta no Brasil na Lupa", texto, `<p>Código para confirmar este e-mail na sua conta do Brasil na Lupa:</p>${htmlCodigo(codigo)}<p>Ele vale por 10 minutos. Se você não pediu a troca, ignore esta mensagem.</p>`);
  } catch {
    return { erro: "Não foi possível enviar o código agora. Tente de novo em alguns minutos." };
  }
  return { pendente: novo, ok: `Enviamos um código de 6 dígitos para ${novo}.` };
}

export async function confirmarTrocaEmailAcao(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!cadastroAtivo()) return DESATIVADO;
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  const novo = normalizarEmail(form.get("novoEmail"));
  const codigo = normalizarCodigo(form.get("codigo"));
  if (!novo) return { erro: "Peça o código de novo." };
  if (!codigo) return { pendente: novo, erro: "O código tem 6 dígitos, só números." };
  const sql = obterSql();
  const usado = await criarAdaptador(sql).useVerificationToken?.({
    identifier: identificadorTroca(usuario.id, novo),
    token: hashCodigo(codigo),
  });
  if (!usado || usado.expires.getTime() < Date.now()) {
    return { pendente: novo, erro: "Código errado, vencido ou já usado. Depois de 5 tentativas erradas, peça outro." };
  }
  if (!(await trocarEmail(sql, usuario.id, novo))) {
    return { erro: "Este e-mail já está ligado a outra conta." };
  }
  return { ok: `E-mail da conta trocado para ${novo}.` };
}
