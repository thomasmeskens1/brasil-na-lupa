/**
 * Link para uma fonte da seção Impostos, com o tipo (Oficial, PDF ou Notícia do órgão), quem
 * publica e a data da consulta (diretriz 2). Abre em nova aba, com aviso para leitor de tela.
 * Com `curto`, mostra só o nome curto e o tipo (listas com muitas referências).
 */
import { CURTO, FONTES, dataCurta, type FonteImposto } from "../fontes";
import type { ChaveFonte } from "../tipos";

const TAG: Record<FonteImposto["tipo"], string> = { oficial: "Oficial", pdf: "PDF", noticia: "Notícia" };

export function LinkFonte({ chave, curto = false }: { chave: ChaveFonte; curto?: boolean }) {
  const f = FONTES[chave];
  const nome = curto ? (CURTO[chave] ?? f.rotulo) : f.rotulo;
  return (
    <span className="text-sm">
      <a href={f.url} target="_blank" rel="noopener noreferrer" className="lk lk-discreto">
        <span className="tag-fonte">{TAG[f.tipo]}</span> {nome}
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
      {curto ? null : (
        <span className="text-[var(--cor-secundaria)]">
          {" "}
          · {f.orgao} · consultado em {dataCurta(f.consultado)}
        </span>
      )}
    </span>
  );
}

/** Lista de fontes sem repetição, com quem publica e data da consulta. */
export function ListaFontesImposto({ chaves }: { chaves: ChaveFonte[] }) {
  const unicas = [...new Set(chaves)];
  return (
    <ul className="space-y-2">
      {unicas.map((c) => (
        <li key={c}>
          <LinkFonte chave={c} />
        </li>
      ))}
    </ul>
  );
}
