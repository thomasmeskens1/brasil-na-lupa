/**
 * Lado do navegador dos botões da conta (Favoritar, reações, "Seus favoritos", convite para
 * entrar). Uma única consulta a /api/conta/estado por página, compartilhada pelos botões, e
 * uma única consulta (em lote) aos contadores de reação de todos os cartões da página.
 *
 * Os botões de reação aparecem também com o cadastro desligado: aí nenhuma consulta é feita e o
 * clique abre o aviso "O cadastro estará disponível em breve". O cadastro está ligado quando o
 * layout montou o convite para entrar (ModalEntrar, id "modal-entrar").
 */
import type { TipoFavorito } from "./ids";
import type { Contagem } from "./reacoes";

export interface EstadoContaCliente {
  logado: boolean;
  /** Cadastro desligado neste site (sem as variáveis): nada é consultado. */
  desligado?: boolean;
  consentimento?: { geral: boolean; reacoes: boolean };
  favoritos?: Record<TipoFavorito, string[]>;
}

const EVENTO_ENTRAR = "bnl:entrar";
const EVENTO_MUDOU = "bnl:conta-mudou";
export const ID_MODAL_ENTRAR = "modal-entrar";

/** O layout só monta o convite para entrar quando o cadastro está ligado. */
export function cadastroNoNavegador(): boolean {
  return typeof document !== "undefined" && document.getElementById(ID_MODAL_ENTRAR) !== null;
}

let pedido: Promise<EstadoContaCliente> | null = null;

export function obterEstadoConta(): Promise<EstadoContaCliente> {
  if (!cadastroNoNavegador()) return Promise.resolve({ logado: false, desligado: true });
  pedido ??= fetch("/api/conta/estado", { credentials: "same-origin", cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<EstadoContaCliente>) : { logado: false }))
    .catch(() => ({ logado: false }));
  return pedido;
}

// ── Contadores de reação em lote ──────────────────────────────────────────────────────────

/** Máximo de ids por consulta (o mesmo de MAX_PROPOSTAS_CONSULTA, em reacoes.ts). */
const LOTE = 50;
const contagensConhecidas = new Map<string, Promise<Contagem | null>>();
let fila: { id: string; resolver: (c: Contagem | null) => void }[] = [];
let agendado = false;

async function buscarLote(itens: typeof fila) {
  const ids = [...new Set(itens.map((i) => i.id))];
  const achados: Record<string, Contagem> = {};
  for (let i = 0; i < ids.length; i += LOTE) {
    const parte = ids.slice(i, i + LOTE);
    try {
      const r = await fetch(`/api/conta/reacoes?ids=${encodeURIComponent(parte.join(","))}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (r.ok) Object.assign(achados, ((await r.json()) as { itens: Record<string, Contagem> }).itens);
    } catch {
      /* sem contadores: os botões continuam */
    }
  }
  for (const it of itens) it.resolver(achados[it.id] ?? null);
}

/**
 * Contador de uma proposta. Os pedidos feitos no mesmo instante (todos os cartões de uma lista)
 * viram uma só consulta à API, em lotes de até 50 ids. Só para quem tem sessão.
 */
export function obterContagem(id: string): Promise<Contagem | null> {
  const ja = contagensConhecidas.get(id);
  if (ja) return ja;
  const p = new Promise<Contagem | null>((resolver) => fila.push({ id, resolver }));
  contagensConhecidas.set(id, p);
  if (!agendado) {
    agendado = true;
    setTimeout(() => {
      const itens = fila;
      fila = [];
      agendado = false;
      void buscarLote(itens);
    }, 25);
  }
  return p;
}

/** Atualiza o contador conhecido depois de reagir (sem nova consulta). */
export function guardarContagem(id: string, c: Contagem): void {
  contagensConhecidas.set(id, Promise.resolve(c));
}

/** Depois de uma mudança (favorito, consentimento), os outros botões da página releem. */
export function avisarMudanca(): void {
  pedido = null;
  contagensConhecidas.clear();
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

/**
 * Abre o convite para entrar ou criar conta (ModalEntrar, montado no layout). Devolve false
 * quando o cadastro está desligado: quem chamou mostra o aviso "disponível em breve".
 */
export function pedirEntrada(origem: HTMLElement | null, motivo: string): boolean {
  if (!cadastroNoNavegador()) return false;
  window.dispatchEvent(new CustomEvent<PedidoEntrada>(EVENTO_ENTRAR, { detail: { origem, motivo } }));
  return true;
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
