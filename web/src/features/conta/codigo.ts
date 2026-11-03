/**
 * Código de login de 6 dígitos (o mesmo token do link do e-mail) e verificação de origem dos
 * pedidos que alteram dados (proteção contra CSRF nas rotas /api/conta). Só servidor.
 */
import { randomInt } from "node:crypto";

/** Validade do código e do link: 10 minutos. */
export const VALIDADE_CODIGO_SEGUNDOS = 10 * 60;

/** Seis dígitos, de 000000 a 999999, com gerador criptográfico. */
export function gerarCodigo(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Aceita espaços e hífen digitados no meio ("123 456"); devolve só os 6 dígitos ou null. */
export function normalizarCodigo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(c) ? c : null;
}

interface Cabecalhos {
  get(nome: string): string | null;
}

/**
 * Pedido de alteração (POST) aceito só quando vem do próprio site:
 * - Origin presente e igual à origem do endereço pedido (ou à de AUTH_URL, se definida);
 * - Sec-Fetch-Site, quando o navegador envia, igual a "same-origin";
 * - corpo JSON (Content-Type application/json), o que obriga outros sites a uma consulta
 *   prévia de CORS que o servidor não autoriza.
 */
export function origemValida(cab: Cabecalhos, urlPedida: string, authUrl?: string | null): boolean {
  const origem = cab.get("origin");
  if (!origem) return false;
  const site = cab.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const tipo = (cab.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") return false;
  const permitidas = new Set<string>();
  try {
    permitidas.add(new URL(urlPedida).origin);
  } catch {
    /* sem origem do pedido */
  }
  if (authUrl) {
    try {
      permitidas.add(new URL(authUrl).origin);
    } catch {
      /* AUTH_URL malformada: ignorada */
    }
  }
  return permitidas.has(origem);
}
