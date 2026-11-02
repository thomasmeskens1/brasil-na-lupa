/**
 * Tabela que vira lista de itens abaixo de 640 px (sem rolagem horizontal nem rolagem dentro
 * de rolagem). Um único HTML: no celular cada linha vira um cartão "Rótulo: valor"; a coluna
 * `principal` aparece como título do item, sem rótulo. Funciona em componente de servidor
 * (aceita funções em `celula`) e dentro de componente cliente.
 *
 *   <TabelaResponsiva
 *     legenda="O que mudou"
 *     linhas={d.mudancas}
 *     chaveLinha={(m, i) => `${m.item}-${i}`}
 *     colunas={[
 *       { chave: "item", rotulo: "Item", principal: true, celula: (m) => m.item },
 *       { chave: "antes", rotulo: "Antes", celula: (m) => m.antes ?? NAO_DISPONIVEL },
 *       { chave: "depois", rotulo: "Depois", celula: (m) => <strong>{m.depois}</strong> },
 *       { chave: "vig", rotulo: "A partir de", celula: (m) => formatarData(m.vigencia) },
 *     ]}
 *   />
 *
 * Para dados grandes com busca e filtros, use TabelaFiltravel (componente cliente).
 */
import type { ReactNode } from "react";

export interface ColunaTabela<T> {
  chave: string;
  rotulo: string;
  celula: (linha: T, indice: number) => ReactNode;
  /** Título do item no celular (sem rótulo). Use em uma coluna. */
  principal?: boolean;
  /** Alinha à direita no computador (números). */
  numerica?: boolean;
}

export interface TabelaResponsivaProps<T> {
  /** Legenda da tabela (caption). */
  legenda: ReactNode;
  /** Esconde a legenda visualmente (continua para leitor de tela). */
  legendaOculta?: boolean;
  colunas: ColunaTabela<T>[];
  linhas: readonly T[];
  chaveLinha: (linha: T, indice: number) => string;
  /** Mensagem quando não há linhas. */
  vazio?: ReactNode;
  className?: string;
}

export function TabelaResponsiva<T>({
  legenda,
  legendaOculta = false,
  colunas,
  linhas,
  chaveLinha,
  vazio = "Nenhum registro.",
  className = "",
}: TabelaResponsivaProps<T>) {
  if (!linhas.length) return <p className="lacuna text-sm">{vazio}</p>;
  return (
    <div className={`tabela-resp-caixa ${className}`}>
      <table className="tabela tabela-resp" role="table">
        <caption className={legendaOculta ? "sr-only" : "pb-2 text-left font-semibold text-foreground"}>{legenda}</caption>
        <thead role="rowgroup">
          <tr role="row">
            {colunas.map((c) => (
              <th key={c.chave} scope="col" role="columnheader" className={c.numerica ? "sm:text-right" : ""}>
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {linhas.map((l, i) => (
            <tr key={chaveLinha(l, i)} role="row">
              {colunas.map((c) =>
                c.principal ? (
                  <th key={c.chave} scope="row" role="rowheader" className="tabela-resp__principal font-medium">
                    {c.celula(l, i)}
                  </th>
                ) : (
                  <td
                    key={c.chave}
                    role="cell"
                    data-rotulo={c.rotulo}
                    className={c.numerica ? "tabular-nums sm:text-right" : ""}
                  >
                    {c.celula(l, i)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
