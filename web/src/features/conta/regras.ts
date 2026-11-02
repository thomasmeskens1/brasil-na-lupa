/**
 * Catálogo e validação das preferências da conta. Sem dependências (testável com node --test).
 */

/** Versão da Política de Privacidade que o consentimento registra. */
export const VERSAO_POLITICA = "2 (02/11/2026)";

export const UFS: ReadonlyArray<{ sigla: string; nome: string }> = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

/**
 * Lista PROVISÓRIA de temas, em ordem alfabética. Deve ser trocada pela lista oficial de
 * dados/titulos/temas.json quando esse arquivo existir (mantendo os mesmos identificadores, ou
 * migrando as preferências já gravadas).
 */
export const TEMAS: ReadonlyArray<{ id: string; nome: string }> = [
  { id: "administracao-publica", nome: "Administração pública e contas públicas" },
  { id: "agricultura", nome: "Agricultura e abastecimento" },
  { id: "ciencia-tecnologia", nome: "Ciência, tecnologia e comunicações" },
  { id: "direitos-justica", nome: "Direitos e justiça" },
  { id: "economia-trabalho", nome: "Economia e trabalho" },
  { id: "educacao", nome: "Educação" },
  { id: "impostos", nome: "Impostos e tributos" },
  { id: "infraestrutura-transporte", nome: "Infraestrutura e transporte" },
  { id: "meio-ambiente", nome: "Meio ambiente" },
  { id: "previdencia-assistencia", nome: "Previdência e assistência social" },
  { id: "saude", nome: "Saúde" },
  { id: "seguranca-publica", nome: "Segurança pública" },
];

/** Limites de tamanho (evitam abuso do banco). */
export const LIMITES_PREFERENCIAS = { municipios: 50, politicos: 200, itens: 500 } as const;

/** Código IBGE de município: 7 dígitos. */
const RE_MUNICIPIO = /^\d{7}$/;
/**
 * Identificador de político ou item acompanhado: "<origem>:<id na fonte oficial>",
 * ex.: "camara:204554", "senado:5012", "alesp:PL-123-2025", "stf:ADI-7000".
 */
const RE_ID_ACOMPANHADO = /^[a-z][a-z0-9-]{1,23}:[A-Za-z0-9._-]{1,80}$/;

export interface Preferencias {
  ufs: string[];
  municipios: string[];
  temas: string[];
  politicos: string[];
  itens: string[];
  alertasEmail: boolean;
}

export const PREFERENCIAS_VAZIAS: Preferencias = {
  ufs: [],
  municipios: [],
  temas: [],
  politicos: [],
  itens: [],
  alertasEmail: false,
};

/** Interface mínima de FormData (facilita testes). */
export interface LeitorFormulario {
  getAll(nome: string): unknown[];
  get(nome: string): unknown;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

function textos(valores: unknown[]): string[] | null {
  const saida: string[] = [];
  for (const v of valores) {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (t) saida.push(t);
  }
  return [...new Set(saida)];
}

function lista(
  valores: unknown[],
  aceita: (v: string) => boolean,
  max: number,
  rotulo: string,
): Resultado<string[]> {
  const t = textos(valores);
  if (!t) return { ok: false, erro: `Valor inválido em ${rotulo}.` };
  if (t.length > max) return { ok: false, erro: `Limite de ${max} itens em ${rotulo}.` };
  if (!t.every(aceita)) return { ok: false, erro: `Valor não reconhecido em ${rotulo}.` };
  return { ok: true, valor: t };
}

export function validarPreferencias(form: LeitorFormulario): Resultado<Preferencias> {
  const siglas = new Set(UFS.map((u) => u.sigla));
  const temas = new Set(TEMAS.map((t) => t.id));

  const ufs = lista(form.getAll("ufs"), (v) => siglas.has(v), UFS.length, "estados");
  if (!ufs.ok) return ufs;
  const tms = lista(form.getAll("temas"), (v) => temas.has(v), TEMAS.length, "temas");
  if (!tms.ok) return tms;
  const mun = lista(
    form.getAll("municipios"),
    (v) => RE_MUNICIPIO.test(v),
    LIMITES_PREFERENCIAS.municipios,
    "municípios",
  );
  if (!mun.ok) return mun;
  const pol = lista(
    form.getAll("politicos"),
    (v) => RE_ID_ACOMPANHADO.test(v),
    LIMITES_PREFERENCIAS.politicos,
    "políticos acompanhados",
  );
  if (!pol.ok) return pol;
  const itens = lista(
    form.getAll("itens"),
    (v) => RE_ID_ACOMPANHADO.test(v),
    LIMITES_PREFERENCIAS.itens,
    "itens acompanhados",
  );
  if (!itens.ok) return itens;

  const alerta = form.get("alertasEmail");
  if (alerta !== null && alerta !== undefined && alerta !== "sim") {
    return { ok: false, erro: "Valor inválido na preferência de alertas." };
  }

  return {
    ok: true,
    valor: {
      ufs: ufs.valor.sort(),
      municipios: mun.valor.sort(),
      temas: tms.valor.sort(),
      politicos: pol.valor,
      itens: itens.valor,
      alertasEmail: alerta === "sim",
    },
  };
}

/**
 * Validação de e-mail na entrada do formulário de login (o Auth.js normaliza de novo depois).
 * Propositalmente simples: um "@", domínio com ponto, sem espaços nem aspas, até 254 caracteres.
 */
export function normalizarEmail(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const e = valor.normalize("NFKC").trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return null;
  if (!/^[^\s@"<>(),;:\\[\]]+@[^\s@"<>(),;:\\[\]]+\.[a-z0-9-]{2,}$/.test(e)) return null;
  return e;
}
