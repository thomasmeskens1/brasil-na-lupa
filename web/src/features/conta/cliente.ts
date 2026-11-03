/**
 * Lado do navegador dos botões da conta (Favoritar, reações, "Seus favoritos", convite para
 * entrar). Uma única consulta a /api/conta/estado por página, compartilhada pelos botões.
 * Só é usado quando o cadastro está ligado (os componentes nem aparecem sem ele).
 */
import type { TipoFavorito } from "./ids";

export interface EstadoContaCliente {
  logado: boolean;
  consentimento?: { geral: boolean; reacoes: boolean };
  favoritos?: Record<TipoFavorito, string[]>;
}

const EVENTO_ENTRAR = "bnl:entrar";
const EVENTO_MUDOU = "bnl:conta-mudou";

let pedido: Promise<EstadoContaCliente> | null = null;

export function obterEstadoConta(): Promise<EstadoContaCliente> {
  pedido ??= fetch("/api/conta/estado", { credentials: "same-origin", cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<EstadoContaCliente>) : { logado: false }))
    .catch(() => ({ logado: false }));
  return pedido;
}

/** Depois de uma mudança (favorito, consentimento), os outros botões da página releem. */
export function avisarMudanca(): void {
  pedido = null;
  window.dispatchEvent(new Event(EVENTO_MUDOU));
}

export function aoMudar(fn: () => void): () => void {
  window.addEventListener(EVENTO_MUDOU, fn);
  return () => window.removeEventListener(EVENTO_MUDOU, fn);
}

export interface PedidoEntrada {
  /** Elemento que abriu o convite (recebe o foco de volta ao fechar). */
  origem: HTMLElement | null;
  motivo: string;
}

/** Abre o convite para entrar ou criar conta (ModalEntrar, montado no layout). */
export function pedirEntrada(origem: HTMLElement | null, motivo: string): void {
  window.dispatchEvent(new CustomEvent<PedidoEntrada>(EVENTO_ENTRAR, { detail: { origem, motivo } }));
}

export function aoPedirEntrada(fn: (p: PedidoEntrada) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<PedidoEntrada>).detail);
  window.addEventListener(EVENTO_ENTRAR, h);
  return () => window.removeEventListener(EVENTO_ENTRAR, h);
}

/** POST JSON da mesma origem (a rota confere Origin e Content-Type). */
export async function enviarJson<T>(url: string, corpo: unknown): Promise<{ ok: boolean; status: number; dados: T | null }> {
  try {
    const r = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = (await r.json().catch(() => null)) as T | null;
    return { ok: r.ok, status: r.status, dados };
  } catch {
    return { ok: false, status: 0, dados: null };
  }
}

/** Mensagem legível para os erros das rotas da conta. */
export function mensagemDeErro(erro: unknown): string {
  switch (erro) {
    case "sem-consentimento":
      return "Para usar favoritos e reações, dê o seu consentimento na página Minha conta.";
    case "limite":
      return "Muitas ações em pouco tempo. Aguarde alguns minutos e tente de novo.";
    case "limite-favoritos":
      return "Você chegou ao limite de favoritos deste tipo. Remova algum na página Minha conta.";
    case "sem-sessao":
      return "Sua sessão terminou. Entre de novo para continuar.";
    default:
      return "Não foi possível concluir agora. Tente de novo em alguns minutos.";
  }
}
