"use client";

/**
 * Tabela com busca, filtros compactos e "Mostrar mais", que vira lista no celular.
 * Componente cliente que recebe SÓ dados (serializáveis): pode ser chamado direto de uma
 * página de servidor.
 *
 *   <TabelaFiltravel
 *     legenda="Votos dos deputados (ordem alfabética)"
 *     chave="id"
 *     linhas={votos.map((v) => ({ id: v.id, nome: v.nome, partido: v.partido, uf: v.uf, voto: v.voto,
 *                                 href: `/congresso/camara/parlamentares/${v.id}` }))}
 *     colunas={[
 *       { chave: "nome", rotulo: "Deputado", principal: true, link: "href" },
 *       { chave: "partido", rotulo: "Partido" },
 *       { chave: "uf", rotulo: "UF" },
 *       { chave: "voto", rotulo: "Voto" },
 *     ]}
 *     busca={{ chaves: ["nome"], rotulo: "Buscar pelo nome" }}
 *     filtros={[{ chave: "uf", rotulo: "Estado (UF)" }, { chave: "partido", rotulo: "Partido" },
 *               { chave: "voto", rotulo: "Voto", ordem: ["Sim", "Não", "Abstenção", "Obstrução"] }]}
 *     itens={{ singular: "voto", plural: "votos" }}
 *     porPagina={50}
 *   />
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { FiltrosCompactos } from "./FiltrosCompactos";
import { TabelaResponsiva, type ColunaTabela } from "./TabelaResponsiva";

export type ValorCelula = string | number | null;
export type LinhaDados = Record<string, ValorCelula>;

export interface ColunaDados {
  chave: string;
  rotulo: string;
  principal?: boolean;
  numerica?: boolean;
  /** Nome do campo da linha que traz o href (interno "/…" ou externo "https://…"). */
  link?: string;
}

export interface FiltroDados {
  chave: string;
  rotulo: string;
  /** Ordem fixa das opções (as demais seguem em ordem alfabética). */
  ordem?: string[];
}

export interface TabelaFiltravelProps {
  legenda: string;
  colunas: ColunaDados[];
  linhas: LinhaDados[];
  /** Campo único de cada linha. */
  chave: string;
  busca?: { chaves: string[]; rotulo: string; dica?: string };
  filtros?: FiltroDados[];
  itens?: { singular: string; plural: string };
  /** Linhas por "página" (Mostrar mais). Padrão 50. */
  porPagina?: number;
  vazio?: string;
}

/** Sem diferença de maiúsculas e acentos. */
export function normalizarBusca(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function opcoesDe(linhas: LinhaDados[], f: FiltroDados): string[] {
  const vals = [...new Set(linhas.map((l) => l[f.chave]).filter((v): v is string | number => v !== null && v !== ""))].map(String);
  const ordem = f.ordem ?? [];
  return vals.sort((a, b) => {
    const ia = ordem.indexOf(a);
    const ib = ordem.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
    return a.localeCompare(b, "pt-BR", { numeric: true });
  });
}

export function TabelaFiltravel({
  legenda,
  colunas,
  linhas,
  chave,
  busca,
  filtros = [],
  itens = { singular: "registro", plural: "registros" },
  porPagina = 50,
  vazio = "Nenhum registro com esses filtros. Tente limpar os filtros.",
}: TabelaFiltravelProps) {
  const [termo, setTermo] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [limite, setLimite] = useState(porPagina);

  const opcoes = useMemo(() => Object.fromEntries(filtros.map((f) => [f.chave, opcoesDe(linhas, f)])), [filtros, linhas]);
  const t = normalizarBusca(termo.trim());
  const filtradas = linhas.filter(
    (l) =>
      filtros.every((f) => !valores[f.chave] || String(l[f.chave] ?? "") === valores[f.chave]) &&
      (!t || (busca?.chaves ?? []).some((k) => normalizarBusca(String(l[k] ?? "")).includes(t))),
  );
  const visiveis = filtradas.slice(0, limite);
  const resto = filtradas.length - visiveis.length;

  function mudar(k: string, v: string) {
    setValores((s) => ({ ...s, [k]: v }));
    setLimite(porPagina);
  }

  const cols: ColunaTabela<LinhaDados>[] = colunas.map((c) => ({
    chave: c.chave,
    rotulo: c.rotulo,
    principal: c.principal,
    numerica: c.numerica,
    celula: (l) => {
      const v = l[c.chave];
      const texto = v === null || v === "" ? "—" : typeof v === "number" ? v.toLocaleString("pt-BR") : v;
      const href = c.link ? l[c.link] : null;
      if (typeof href === "string" && href) {
        return /^https?:\/\//.test(href) ? (
          <a href={href} className="lk" target="_blank" rel="noopener noreferrer">
            {texto}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : (
          <Link href={href} className="lk">
            {texto}
          </Link>
        );
      }
      return texto;
    },
  }));

  return (
    <div className="space-y-3">
      <FiltrosCompactos
        busca={
          busca
            ? {
                valor: termo,
                aoMudar: (v) => {
                  setTermo(v);
                  setLimite(porPagina);
                },
                rotulo: busca.rotulo,
                dica: busca.dica,
              }
            : undefined
        }
        filtros={filtros.map((f) => ({
          id: f.chave,
          rotulo: f.rotulo,
          valor: valores[f.chave] ?? "",
          aoMudar: (v: string) => mudar(f.chave, v),
          opcoes: opcoes[f.chave] ?? [],
        }))}
        contagem={`Mostrando ${visiveis.length.toLocaleString("pt-BR")} de ${filtradas.length.toLocaleString("pt-BR")} ${
          filtradas.length === 1 ? itens.singular : itens.plural
        }${filtradas.length !== linhas.length ? ` (total: ${linhas.length.toLocaleString("pt-BR")})` : ""}`}
        aoLimpar={() => {
          setTermo("");
          setValores({});
          setLimite(porPagina);
        }}
      />
      <TabelaResponsiva
        legenda={legenda}
        colunas={cols}
        linhas={visiveis}
        chaveLinha={(l, i) => String(l[chave] ?? i)}
        vazio={vazio}
      />
      {resto > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="botao" onClick={() => setLimite((n) => n + porPagina)}>
            Mostrar mais {Math.min(porPagina, resto).toLocaleString("pt-BR")}
          </button>
          <button type="button" className="botao" onClick={() => setLimite(filtradas.length)}>
            Mostrar todos ({filtradas.length.toLocaleString("pt-BR")})
          </button>
        </div>
      ) : null}
    </div>
  );
}
