"use client";

/**
 * Lista de Cartões de Decisão com busca, filtros compactos e "Mostrar mais" (ordem recebida:
 * cronológica, do mais recente para o mais antigo). Recebe só dados serializáveis, então pode
 * ser chamada direto de uma página de servidor. Nada do que é digitado sai do navegador.
 *
 *   <ListaCartoes
 *     itens={[{ id, cartao: { href, tituloOficial, simples, subtituloOficial, caminho: "presidencia", … },
 *               busca: "texto onde buscar", filtros: { ano: "2025", situacao: "Em tramitação" } }]}
 *     filtros={[{ chave: "ano", rotulo: "Ano" }, { chave: "situacao", rotulo: "Situação" }]}
 *     busca={{ rotulo: "Buscar na ementa", dica: "Ex.: Pix" }}
 *     rotulo={{ singular: "medida provisória", plural: "medidas provisórias" }}
 *   />
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { CartaoDecisao, type CartaoDecisaoProps } from "@/components/decisao";
import { FiltrosCompactos, normalizarBusca } from "@/components/tabela";
import { montarCartao } from "../apresentacao";
import { MostrarMais } from "@/components/lista/MostrarMais";

export type DadosCartao = Omit<CartaoDecisaoProps, "as" | "children" | "className" | "quemDecidiu" | "nivelTitulo"> & {
  quemDecidiu?: string;
};

export interface ItemCartao {
  id: string;
  /** Campos do cartão; os que faltarem vêm de `padrao` (a fonte é mesclada campo a campo). */
  cartao: Partial<DadosCartao> & Pick<DadosCartao, "href" | "tituloOficial">;
  /** Texto extra para a busca, além do título, do título simples e do subtítulo (ex.: ementa). */
  busca?: string;
  /** Valor de cada filtro (chave → valor exibido). */
  filtros?: Record<string, string | null>;
  /** Linhas curtas abaixo do dado-chave (texto da fonte). */
  notas?: string[];
  /** Links extras (ex.: texto no Planalto, veto desta lei). */
  links?: { href: string; rotulo: string; externo?: boolean }[];
}

export interface ListaCartoesProps {
  itens: ItemCartao[];
  /** Campos comuns a todos os cartões (caminho, forma, quem decidiu, órgão da fonte…), enviados uma vez só. */
  padrao?: Partial<DadosCartao>;
  filtros?: { chave: string; rotulo: string; decrescente?: boolean }[];
  busca: { rotulo: string; dica?: string };
  rotulo: { singular: string; plural: string };
  porPagina?: number;
  vazio?: string;
  nivelTitulo?: 2 | 3 | 4;
  /** Ordem da lista, em texto (anunciada com a contagem). */
  ordem?: string;
}

export function ListaCartoes({
  itens,
  padrao,
  filtros = [],
  busca,
  rotulo,
  porPagina = 20,
  vazio,
  nivelTitulo = 3,
  ordem = "do mais recente para o mais antigo",
}: ListaCartoesProps) {
  const [termo, setTermo] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [limite, setLimite] = useState(porPagina);

  const indice = useMemo(
    () =>
      itens.map((i) =>
        normalizarBusca(`${i.cartao.tituloOficial} ${i.cartao.simples?.titulo ?? ""} ${i.cartao.subtituloOficial ?? ""} ${i.busca ?? ""}`),
      ),
    [itens],
  );
  const opcoes = useMemo(
    () =>
      Object.fromEntries(
        filtros.map((f) => {
          const v = [...new Set(itens.map((i) => i.filtros?.[f.chave]).filter((x): x is string => !!x))];
          v.sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
          return [f.chave, f.decrescente ? v.reverse() : v];
        }),
      ),
    [filtros, itens],
  );
  const partes = normalizarBusca(termo).split(/\s+/).filter(Boolean);
  const filtrados = itens.filter(
    (it, n) =>
      filtros.every((f) => !valores[f.chave] || it.filtros?.[f.chave] === valores[f.chave]) &&
      partes.every((p) => indice[n].includes(p)),
  );
  const visiveis = filtrados.slice(0, limite);
  const nome = (n: number) => (n === 1 ? rotulo.singular : rotulo.plural);

  if (!itens.length) return <p className="lacuna text-sm">{vazio ?? `Nenhum item coletado.`}</p>;

  return (
    <div className="space-y-4">
      <FiltrosCompactos
        busca={{
          valor: termo,
          aoMudar: (v) => {
            setTermo(v);
            setLimite(porPagina);
          },
          rotulo: busca.rotulo,
          dica: busca.dica,
        }}
        filtros={filtros.map((f) => ({
          id: f.chave,
          rotulo: f.rotulo,
          valor: valores[f.chave] ?? "",
          aoMudar: (v: string) => {
            setValores((s) => ({ ...s, [f.chave]: v }));
            setLimite(porPagina);
          },
          opcoes: opcoes[f.chave] ?? [],
        }))}
        contagem={`Mostrando ${visiveis.length.toLocaleString("pt-BR")} de ${filtrados.length.toLocaleString("pt-BR")} ${nome(
          filtrados.length,
        )}, ${ordem}`}
        aoLimpar={() => {
          setTermo("");
          setValores({});
          setLimite(porPagina);
        }}
      />
      {filtrados.length ? (
        <ul className="space-y-3">
          {visiveis.map((it) => (
            <CartaoDecisao key={it.id} as="li" nivelTitulo={nivelTitulo} {...montarCartao(padrao, it.cartao)}>
              {it.notas?.length || it.links?.length ? (
                <div className="space-y-1">
                  {it.notas?.map((n) => (
                    <p key={n} className="text-[var(--cor-secundaria)]">
                      {n}
                    </p>
                  ))}
                  {it.links?.length ? (
                    <p className="cartao-decisao__acima flex flex-wrap gap-x-4">
                      {it.links.map((l) =>
                        l.externo ? (
                          <a key={l.href} href={l.href} className="lk inline-flex min-h-11 items-center" target="_blank" rel="noopener noreferrer">
                            {l.rotulo}
                            <span aria-hidden="true">&nbsp;↗</span>
                            <span className="sr-only"> (abre em nova aba)</span>
                          </a>
                        ) : (
                          <Link key={l.href} href={l.href} prefetch={false} className="lk inline-flex min-h-11 items-center">
                            {l.rotulo}
                          </Link>
                        ),
                      )}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CartaoDecisao>
          ))}
        </ul>
      ) : (
        <p className="lacuna text-sm">Nenhum resultado com esses filtros. Tente limpar a busca ou os filtros.</p>
      )}
      <MostrarMais
        visiveis={visiveis.length}
        total={filtrados.length}
        passo={porPagina}
        itens={rotulo}
        todos={false}
        aoMostrar={setLimite}
      />
    </div>
  );
}
