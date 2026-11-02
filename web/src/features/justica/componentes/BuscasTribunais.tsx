"use client";

import type { LinhaTemaStf, LinhaTemaStj } from "../tipos";
import { rotuloOrgao } from "../rotulos";
import { BuscaTemas, type TemaBusca } from "./BuscaTemas";

interface ArquivoStj {
  url_modelo: string;
  t: LinhaTemaStj[];
}

function decodificarStj(j: ArquivoStj): TemaBusca[] {
  return j.t.map(([numero, tipo, situacao, orgao, relator, questao, tese, colecoes, comPagina, data, url, titulo]) => ({
    numero,
    tipo,
    situacao,
    orgao: orgao ? rotuloOrgao(orgao) : null,
    relator,
    titulo: null,
    tituloSimples: titulo ?? null,
    questao,
    tese,
    colecoes,
    href: comPagina ? `/justica/stj/temas/${numero}` : null,
    url: url === 1 ? j.url_modelo.replaceAll("{n}", numero) : url,
    data,
  }));
}

function decodificarStf(j: { t: LinhaTemaStf[] }): TemaBusca[] {
  return j.t.map(([numero, titulo, situacao, andamento, relator, leadingCase, tese, colecoes, comPagina, url, descricao, simples]) => ({
    numero,
    tipo: "Tema de repercussão geral",
    situacao: andamento ?? situacao,
    orgao: null,
    extra: leadingCase ? `Processo paradigma: ${leadingCase}` : null,
    relator,
    titulo,
    tituloSimples: simples ?? null,
    questao: descricao,
    tese,
    colecoes,
    href: comPagina ? `/justica/stf/temas/${numero}` : null,
    url,
    data: null,
  }));
}

export function BuscaTemasStj({ colecoes, coletadoEm }: { colecoes: Record<string, string>; coletadoEm?: string | null }) {
  return (
    <BuscaTemas<ArquivoStj>
      arquivo="/justica/stj-temas.json"
      decodificar={decodificarStj}
      caminho="stj"
      nomeTribunal="Superior Tribunal de Justiça"
      colecoes={colecoes}
      coletadoEm={coletadoEm}
    />
  );
}

export function BuscaTemasStf({ colecoes, coletadoEm }: { colecoes: Record<string, string>; coletadoEm?: string | null }) {
  return (
    <BuscaTemas<{ t: LinhaTemaStf[] }>
      arquivo="/justica/stf-temas.json"
      decodificar={decodificarStf}
      caminho="stf"
      nomeTribunal="Supremo Tribunal Federal"
      colecoes={colecoes}
      coletadoEm={coletadoEm}
    />
  );
}
