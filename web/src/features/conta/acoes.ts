"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "./auth";
import { cadastroAtivo, googleAtivo } from "./config";
import { excluirConta, registrarConsentimento, revogarConsentimento, salvarPreferencias } from "./dados";
import { obterSql } from "./db";
import { dentroDoLimite, ipDaRequisicao } from "./limite";
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
}

const DESATIVADO: EstadoFormulario = { erro: "O cadastro não está disponível." };

export async function enviarLinkAcao(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!cadastroAtivo()) return DESATIVADO;
  const email = normalizarEmail(form.get("email"));
  if (!email) return { erro: "Informe um endereço de e-mail válido." };
  const ip = ipDaRequisicao(await headers());
  if (!(await dentroDoLimite(obterSql(), { email, ip }, process.env.AUTH_SECRET ?? ""))) {
    return { erro: "Muitos pedidos de link em pouco tempo. Aguarde 15 minutos e tente de novo." };
  }
  // Redireciona para /entrar/verifique (ou /entrar/erro se o envio falhar).
  await signIn("resend", { email, redirectTo: "/minha-conta" });
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
  if (form.get("aceito") !== "sim") {
    return { erro: "Para criar suas preferências, marque a caixa de consentimento." };
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
  const gravou = await salvarPreferencias(obterSql(), usuario.id, VERSAO_POLITICA, r.valor);
  if (!gravou) redirect("/minha-conta");
  return { ok: `Preferências salvas às ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` };
}

export async function revogarConsentimentoAcao(): Promise<void> {
  if (!cadastroAtivo()) redirect("/");
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  await revogarConsentimento(obterSql(), usuario.id);
  redirect("/minha-conta?revogado=1");
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
