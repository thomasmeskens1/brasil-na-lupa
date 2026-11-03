/**
 * Liga/desliga do cadastro. O cadastro só existe quando TODAS as variáveis obrigatórias estão
 * definidas no ambiente. Sem elas, as rotas de conta respondem 404, o botão "Minha conta" não
 * aparece e o site funciona como antes (todas as páginas de conteúdo continuam estáticas).
 *
 * Este arquivo não importa nada: é lido por páginas estáticas, pelo layout e pelos testes.
 */

export const VARIAVEIS_OBRIGATORIAS = ["DATABASE_URL", "AUTH_SECRET", "AUTH_RESEND_KEY", "EMAIL_FROM"] as const;
export const VARIAVEIS_GOOGLE = ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] as const;

/**
 * Cookie essencial e temporário (10 minutos, só em /entrar) com o e-mail e o caminho de volta
 * enquanto a pessoa digita o código de login. Descrito na Política de Privacidade (Cookies).
 */
export const COOKIE_LOGIN = "bnl-login";

type Ambiente = Record<string, string | undefined>;

function definida(env: Ambiente, nome: string): boolean {
  return (env[nome] ?? "").trim() !== "";
}

export function cadastroAtivo(env: Ambiente = process.env): boolean {
  return VARIAVEIS_OBRIGATORIAS.every((n) => definida(env, n));
}

/** "Entrar com Google" só aparece se o cadastro estiver ativo e as duas variáveis existirem. */
export function googleAtivo(env: Ambiente = process.env): boolean {
  return cadastroAtivo(env) && VARIAVEIS_GOOGLE.every((n) => definida(env, n));
}
