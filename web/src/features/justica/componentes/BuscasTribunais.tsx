"use client";

import type { LinhaTemaStf, LinhaTemaStj } from "../tipos";
import { BuscaTemas, type TemaBusca } from "./BuscaTemas";

interface ArquivoStj {
  url_modelo: string;
  t: LinhaTemaStj[];
}

function decodificarStj(j: ArquivoStj): TemaBusca[] {
  return j.t.map(([numero, tipo, situacao, orgao, relator, questao, tese, colecoes, comPagina, data, url]) => ({
    numero,
    tipo,
    situacao,
    orgao,
    relator,
    titulo: null,
    questao,
    tese,
    colecoes,
    href: comPagina ? `/justica/stj/temas/${numero}` : null,
    url: url === 1 ? j.url_modelo.replaceAll("{n}", numero) : url,
    data,
  }));
}

function decodificarStf(j: { t: LinhaTemaStf[] }): TemaBusca[] {
  return j.t.map(([numero, titulo, situacao, andamento, relator, leadingCase, tese, colecoes, comPagina, url, descricao]) => ({
    numero,
    tipo: "Tema de repercussão geral",
    situacao: andamento ?? situacao,
    orgao: null,
    extra: leadingCase ? `Processo paradigma: ${leadingCase}` : null,
    relator,
    titulo,
    questao: descricao,
    tese,
    colecoes,
    href: comPagina ? `/justica/stf/temas/${numero}` : null,
    url,
    data: null,
  }));
}

export function BuscaTemasStj({ colecoes }: { colecoes: Record<string, string> }) {
  return (
    <BuscaTemas<ArquivoStj>
      arquivo="/justica/stj-temas.json"
      decodificar={decodificarStj}
      rotuloTribunal="Superior Tribunal de Justiça"
      rotuloQuestao="Questão submetida a julgamento"
      colecoes={colecoes}
    />
  );
}

export function BuscaTemasStf({ colecoes }: { colecoes: Record<string, string> }) {
  return (
    <BuscaTemas<{ t: LinhaTemaStf[] }>
      arquivo="/justica/stf-temas.json"
      decodificar={decodificarStf}
      rotuloTribunal="Supremo Tribunal Federal"
      rotuloQuestao="Descrição oficial"
      colecoes={colecoes}
    />
  );
}
