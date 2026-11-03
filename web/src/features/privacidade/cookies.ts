/**
 * Cookies do site e regra do aviso (LGPD). Sem dependências (lido pelo aviso no navegador, pela
 * Política de Privacidade e pelos testes).
 *
 * Hoje o site só usa cookies ESSENCIAIS (login) e medição de audiência sem cookies e sem
 * identificação (Vercel Web Analytics). Por isso o aviso é só informativo ("Entendi").
 *
 * Se um dia houver cookie não essencial, cadastre-o em COOKIES_NAO_ESSENCIAIS: o aviso passa a
 * pedir consentimento, com "Aceitar" e "Recusar" do mesmo tamanho e destaque, e o código que
 * gravaria esse cookie deve chamar podeUsar(categoria) antes (nada é gravado sem o "Aceitar").
 * Mudar a lista exige nova versão do aviso (VERSAO_AVISO) e da Política de Privacidade.
 */

export type CategoriaCookie = "essencial" | "medicao" | "preferencias" | "publicidade";

export interface CookieDescrito {
  nome: string;
  categoria: CategoriaCookie;
  finalidade: string;
  duracao: string;
  /** Só existe com o cadastro ligado. */
  soComCadastro: boolean;
}

/** Cookies essenciais (Auth.js e o pedido do código). Em HTTPS, os do Auth.js têm prefixo __Secure-/__Host-. */
export const COOKIES_ESSENCIAIS: readonly CookieDescrito[] = [
  {
    nome: "authjs.session-token",
    categoria: "essencial",
    finalidade: "Mantém você conectado depois de entrar na conta.",
    duracao: "Até 30 dias ou até você sair",
    soComCadastro: true,
  },
  {
    nome: "authjs.csrf-token",
    categoria: "essencial",
    finalidade: "Protege o login contra pedidos falsificados por outros sites.",
    duracao: "Até fechar o navegador",
    soComCadastro: true,
  },
  {
    nome: "authjs.callback-url",
    categoria: "essencial",
    finalidade: "Lembra a página para onde voltar depois de entrar.",
    duracao: "Até fechar o navegador",
    soComCadastro: true,
  },
  {
    nome: "bnl-login",
    categoria: "essencial",
    finalidade: "Guarda o e-mail e a página de volta enquanto você digita o código de acesso.",
    duracao: "10 minutos",
    soComCadastro: true,
  },
  {
    nome: "authjs.pkce.code_verifier e authjs.state",
    categoria: "essencial",
    finalidade: "Só no login com o Google: confere que a resposta veio do Google.",
    duracao: "15 minutos",
    soComCadastro: true,
  },
];

/** Vazio de propósito: o site não usa cookies não essenciais. */
export const COOKIES_NAO_ESSENCIAIS: readonly CookieDescrito[] = [];

/** Item gravado no armazenamento local do navegador (não é cookie e não vai ao servidor). */
export const CHAVE_AVISO = "bnl-aviso-cookies";
export const VERSAO_AVISO = "1";

export type EscolhaNaoEssenciais = "aceitos" | "recusados" | null;

export interface EscolhaAviso {
  versao: string;
  naoEssenciais: EscolhaNaoEssenciais;
}

export function exigeConsentimento(naoEssenciais: readonly CookieDescrito[] = COOKIES_NAO_ESSENCIAIS): boolean {
  return naoEssenciais.length > 0;
}

/** Lê o valor guardado; qualquer coisa malformada vale como "sem escolha". */
export function lerEscolha(texto: string | null): EscolhaAviso | null {
  if (!texto) return null;
  try {
    const v = JSON.parse(texto) as Partial<EscolhaAviso>;
    if (typeof v?.versao !== "string") return null;
    const n = v.naoEssenciais === "aceitos" || v.naoEssenciais === "recusados" ? v.naoEssenciais : null;
    return { versao: v.versao, naoEssenciais: n };
  } catch {
    return null;
  }
}

/** O aviso aparece se a pessoa ainda não respondeu à versão atual. */
export function deveMostrarAviso(escolha: EscolhaAviso | null, versao = VERSAO_AVISO): boolean {
  return escolha?.versao !== versao;
}

/** Cookies essenciais sempre; os demais só com "Aceitar" na versão atual do aviso. */
export function podeUsar(
  categoria: CategoriaCookie,
  escolha: EscolhaAviso | null,
  versao = VERSAO_AVISO,
): boolean {
  if (categoria === "essencial") return true;
  return escolha?.versao === versao && escolha.naoEssenciais === "aceitos";
}
