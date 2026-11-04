/**
 * Busca de "Quem me representa" (pura, sem acesso a dados): grupos de cargo, montagem das pessoas
 * a partir dos arquivos gerados e filtro. Ordem neutra (diretriz 6): cargo na ordem fixa abaixo e,
 * dentro do cargo, nome em ordem alfabética.
 */
import { PRESIDENCIA } from "../cargos";
import type { ArquivoBase, ArquivoMun, Pessoa } from "./tipos";

export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Filtro de cargo (ordem pedida: da cidade ao país). Vices entram com o titular. */
export const GRUPOS_CARGO = [
  { id: "vereador", rotulo: "Vereador", cargos: ["Vereador"], municipal: true },
  { id: "prefeito", rotulo: "Prefeito e vice", cargos: ["Prefeito", "Vice-prefeito"], municipal: true },
  { id: "deputado-estadual", rotulo: "Deputado estadual ou distrital", cargos: ["Deputado estadual", "Deputado distrital"], municipal: false },
  { id: "governador", rotulo: "Governador e vice", cargos: ["Governador", "Vice-governador"], municipal: false },
  { id: "deputado-federal", rotulo: "Deputado federal", cargos: ["Deputado federal"], municipal: false },
  { id: "senador", rotulo: "Senador", cargos: ["Senador"], municipal: false },
  { id: "presidente", rotulo: "Presidente e vice", cargos: ["Presidente", "Vice-presidente"], municipal: false },
] as const;

export type IdGrupo = (typeof GRUPOS_CARGO)[number]["id"];

const ORDEM_CARGO: string[] = GRUPOS_CARGO.flatMap((g) => [...g.cargos]);

export function grupoDe(id: string | null | undefined) {
  return GRUPOS_CARGO.find((g) => g.id === id) ?? null;
}

export function pessoasDaBase(b: ArquivoBase): Pessoa[] {
  const lista: Pessoa[] = b.pessoas.map((x) => ({
    key: `b-${x.k}`,
    cargo: x.c,
    nome: x.n,
    uf: x.uf,
    partido: x.p,
    ano: x.a,
    situacao: x.s,
    base: x,
    busca: normalizar(`${x.n} ${x.nc ?? ""}`),
  }));
  for (const p of PRESIDENCIA) {
    lista.push({
      key: `pr-${p.cargo}`,
      cargo: p.cargo,
      nome: p.nome,
      uf: null,
      partido: null,
      ano: null,
      situacao: null,
      fonte: p.fonte,
      busca: normalizar(p.nome),
    });
  }
  return lista;
}

export function pessoasDoMunicipio(m: ArquivoMun): Pessoa[] {
  return m.p.map(([nome, ci, partido, mi, situacao], i) => {
    const [cidade, slug] = m.municipios[mi] ?? ["", ""];
    return {
      key: `m-${m.uf}-${mi}-${i}`,
      cargo: m.cargos[ci] ?? "",
      nome,
      uf: m.uf,
      cidade: { nome: cidade, slug },
      partido,
      ano: m.ano,
      situacao,
      busca: normalizar(`${nome} ${cidade}`),
    };
  });
}

export interface Filtros {
  q: string;
  cargo: IdGrupo | "";
  uf: string;
  partido: string;
  /** "uf/slug" do município escolhido. */
  cidade: string;
}

export const FILTROS_VAZIOS: Filtros = { q: "", cargo: "", uf: "", partido: "", cidade: "" };

export function temFiltro(f: Filtros): boolean {
  return Boolean(normalizar(f.q) || f.cargo || f.uf || f.partido || f.cidade);
}

/** Termos da busca casam com o início de palavras do nome (ou da cidade, para os municipais). */
function casaTexto(busca: string, termos: string[]): boolean {
  const b = ` ${busca}`;
  return termos.every((t) => b.includes(` ${t}`));
}

export function filtrar(pessoas: Pessoa[], f: Filtros): Pessoa[] {
  const termos = normalizar(f.q).split(" ").filter(Boolean);
  const g = grupoDe(f.cargo);
  const cargos = g ? new Set<string>(g.cargos) : null;
  const [ufCidade, slugCidade] = f.cidade ? f.cidade.split("/") : ["", ""];
  const uf = (ufCidade || f.uf).toUpperCase();
  const saida = pessoas.filter((p) => {
    if (cargos && !cargos.has(p.cargo)) return false;
    // Cidade: os eleitos da cidade, do estado dela e da Presidência (todo o país).
    if (slugCidade) {
      if (p.uf !== null && p.uf !== uf) return false;
      if (p.cidade && p.cidade.slug !== slugCidade) return false;
    } else if (uf && p.uf !== null && p.uf !== uf) return false;
    if (f.partido && p.partido !== f.partido) return false;
    if (termos.length && !casaTexto(p.busca, termos)) return false;
    return true;
  });
  return ordenar(saida);
}

export function ordenar(l: Pessoa[]): Pessoa[] {
  const pos = (c: string) => {
    const i = ORDEM_CARGO.indexOf(c);
    return i < 0 ? 99 : i;
  };
  return [...l].sort(
    (a, b) =>
      pos(a.cargo) - pos(b.cargo) ||
      a.nome.localeCompare(b.nome, "pt-BR") ||
      (a.cidade?.nome ?? "").localeCompare(b.cidade?.nome ?? "", "pt-BR") ||
      (a.uf ?? "").localeCompare(b.uf ?? ""),
  );
}

/** Lê e valida os filtros vindos do endereço da página. */
export function filtrosDaUrl(params: URLSearchParams, partidos: string[] = []): Filtros {
  const cargo = params.get("cargo") ?? "";
  const uf = (params.get("uf") ?? "").toUpperCase();
  const cidade = (params.get("cidade") ?? "").toLowerCase();
  const partido = params.get("partido") ?? "";
  return {
    q: (params.get("q") ?? "").slice(0, 80),
    cargo: grupoDe(cargo) ? (cargo as IdGrupo) : "",
    uf: /^[A-Z]{2}$/.test(uf) ? uf : "",
    partido: !partidos.length || partidos.includes(partido) ? partido.slice(0, 40) : "",
    cidade: /^[a-z]{2}\/[a-z0-9-]{1,90}$/.test(cidade) ? cidade : "",
  };
}

export function urlDosFiltros(f: Filtros): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.cargo) p.set("cargo", f.cargo);
  if (f.cidade) p.set("cidade", f.cidade);
  else if (f.uf) p.set("uf", f.uf);
  if (f.partido) p.set("partido", f.partido);
  const s = p.toString();
  return s ? `?${s}` : "";
}
