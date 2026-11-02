"use client";

import { useMemo, useState } from "react";
import { CartaoDecisao, type Caminho } from "@/components/decisao";
import { FiltrosCompactos, normalizarBusca } from "@/components/tabela";
import { encurtar } from "@/features/executivo/apresentacao";

/** Tema já decodificado do índice estático (STJ ou STF). */
export interface TemaBusca {
  numero: string;
  tipo: string | null;
  situacao: string | null;
  orgao: string | null;
  relator: string | null;
  /** Título oficial do tema (STF). */
  titulo: string | null;
  /** Título em linguagem simples aprovado, quando reformula o texto oficial. */
  tituloSimples?: string | null;
  questao: string | null;
  tese: string | null;
  colecoes: string[];
  href: string | null;
  url: string | null;
  data: string | null;
  /** Linha extra de contexto (ex.: processo paradigma). */
  extra?: string | null;
}

const POR_PAGINA = 20;

function opcoes(v: (string | null)[]) {
  return [...new Set(v.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Busca de temas no navegador sobre um índice estático baixado só quando o leitor usa a busca.
 * `decodificar` converte o formato compacto do arquivo; nada do que é digitado sai do navegador.
 * Cada resultado é um Cartão de Decisão: título simples (ou a tese/questão literal encurtada),
 * nome oficial por extenso, situação e fonte.
 */
export function BuscaTemas<T>({
  arquivo,
  decodificar,
  caminho,
  nomeTribunal,
  colecoes,
  coletadoEm,
}: {
  arquivo: string;
  decodificar: (j: T) => TemaBusca[];
  caminho: Caminho;
  nomeTribunal: string;
  colecoes: Record<string, string>;
  coletadoEm?: string | null;
}) {
  const [temas, setTemas] = useState<(TemaBusca & { _b: string })[] | null>(null);
  const [erro, setErro] = useState(false);
  const [pedido, setPedido] = useState(false);
  const [texto, setTexto] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [limite, setLimite] = useState(POR_PAGINA);

  function carregar() {
    if (pedido) return;
    setPedido(true);
    fetch(arquivo)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: T) =>
        setTemas(
          decodificar(j).map((t) => ({
            ...t,
            _b: normalizarBusca(`${t.numero} ${t.titulo ?? ""} ${t.tituloSimples ?? ""} ${t.questao ?? ""} ${t.tese ?? ""} ${t.relator ?? ""}`),
          })),
        ),
      )
      .catch(() => {
        setPedido(false);
        setErro(true);
      });
  }

  const ops = useMemo(
    () => ({
      situacao: opcoes((temas ?? []).map((t) => t.situacao)),
      orgao: opcoes((temas ?? []).map((t) => t.orgao)),
      tipo: opcoes((temas ?? []).map((t) => t.tipo)),
    }),
    [temas],
  );
  const termos = normalizarBusca(texto).split(/\s+/).filter(Boolean);
  const ativo = termos.length > 0 || Object.values(f).some(Boolean);
  const filtrados =
    temas && ativo
      ? temas.filter(
          (t) =>
            (!f.situacao || t.situacao === f.situacao) &&
            (!f.orgao || t.orgao === f.orgao) &&
            (!f.tipo || t.tipo === f.tipo) &&
            (!f.colecao || t.colecoes.includes(f.colecao)) &&
            termos.every((x) => (/^\d+$/.test(x) ? t.numero === x || t._b.includes(x) : t._b.includes(x))),
        )
      : [];

  function mudar(k: string, v: string) {
    carregar();
    setLimite(POR_PAGINA);
    setF((s) => ({ ...s, [k]: v }));
  }

  const filtros = [
    { id: "situacao", rotulo: "Situação", valor: f.situacao ?? "", aoMudar: (v: string) => mudar("situacao", v), opcoes: ops.situacao },
    { id: "orgao", rotulo: "Órgão julgador", valor: f.orgao ?? "", aoMudar: (v: string) => mudar("orgao", v), opcoes: ops.orgao },
    { id: "tipo", rotulo: "Tipo", valor: f.tipo ?? "", aoMudar: (v: string) => mudar("tipo", v), opcoes: ops.tipo },
    {
      id: "colecao",
      rotulo: "Coleção acompanhada",
      valor: f.colecao ?? "",
      aoMudar: (v: string) => mudar("colecao", v),
      opcoes: Object.entries(colecoes).map(([valor, rotulo]) => ({ valor, rotulo })),
      todos: "Todas",
    },
  ].filter((x) => !temas || x.opcoes.length > 1 || x.id === "colecao");

  const contagem = erro
    ? null
    : !ativo
      ? "Digite um termo ou escolha um filtro para ver os temas encontrados."
      : !temas
        ? "Carregando o índice de temas…"
        : `Mostrando ${Math.min(limite, filtrados.length).toLocaleString("pt-BR")} de ${filtrados.length.toLocaleString("pt-BR")} ${
            filtrados.length === 1 ? "tema" : "temas"
          }, do número mais alto para o mais baixo`;

  return (
    <div className="space-y-4" onFocus={carregar}>
      <FiltrosCompactos
        busca={{
          valor: texto,
          aoMudar: (v) => {
            carregar();
            setLimite(POR_PAGINA);
            setTexto(v);
          },
          rotulo: "Buscar pelo número ou por palavras da questão, da tese ou do relator",
          dica: "Ex.: ICMS, honorários, 1369",
        }}
        filtros={filtros}
        contagem={contagem}
        aoLimpar={() => {
          setTexto("");
          setF({});
          setLimite(POR_PAGINA);
        }}
      />
      {erro ? <p className="lacuna text-sm">Não foi possível carregar o índice de temas. Tente recarregar a página.</p> : null}
      <ul className="space-y-3">
        {filtrados.slice(0, limite).map((t) => {
          const oficial = t.url ? { url: t.url, titulo: "Página oficial do tema", orgao: nomeTribunal, acessado_em: coletadoEm ?? null } : null;
          return (
            <CartaoDecisao
              key={t.numero}
              as="li"
              href={t.href ?? t.url ?? "#"}
              tituloOficial={encurtar(t.tese, 140) ?? encurtar(t.titulo, 140) ?? encurtar(t.questao, 140) ?? `${t.tipo ?? "Tema"} ${t.numero}`}
              simples={t.tituloSimples ? { titulo: t.tituloSimples } : null}
              subtituloOficial={[`${t.tipo ?? "Tema"} ${t.numero}`, t.orgao, nomeTribunal].filter(Boolean).join(" · ")}
              caminho={caminho}
              data={t.data}
              forma="julgamento"
              dado={t.situacao ? { tipo: "texto", rotulo: "Situação", texto: t.situacao } : null}
              quemDecidiu={`${t.orgao ?? "Órgão colegiado"} do ${nomeTribunal}${t.relator ? ` · relator: ${t.relator}` : ""}`}
              fonte={oficial}
              compartilhar={!!t.href}
            >
              {!t.tese ? <p className="text-[var(--cor-secundaria)]">Sem tese registrada na fonte oficial.</p> : null}
              {t.extra ? <p className="text-[var(--cor-secundaria)]">{t.extra}</p> : null}
              {!t.href ? <p className="text-[var(--cor-secundaria)]">Este tema não tem página própria no site: o link leva à página oficial.</p> : null}
            </CartaoDecisao>
          );
        })}
      </ul>
      {filtrados.length > limite ? (
        <button type="button" className="botao" onClick={() => setLimite((n) => n + POR_PAGINA)}>
          Mostrar mais {Math.min(POR_PAGINA, filtrados.length - limite)} de {filtrados.length - limite} restantes
        </button>
      ) : null}
    </div>
  );
}
