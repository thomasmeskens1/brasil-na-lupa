import type { Metadata } from "next";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { BuscaTemasStf } from "@/features/justica/componentes/BuscasTribunais";
import { CartaoDecisao } from "@/components/decisao";
import { Migalhas } from "@/features/executivo/componentes/Migalhas";
import { cartaoTemaStf } from "@/features/justica/cartoes";
import { ListaJulgamentosStf } from "@/features/justica/componentes/ListaJulgamentosStf";
import { getIndiceStf, getSumulasVinculantes, getTemaStf } from "@/features/justica/dados";
import { COLECOES, TERMOS_JUSTICA } from "@/features/justica/rotulos";
import type { TemaStf } from "@/features/justica/tipos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Supremo Tribunal Federal (STF)",
  description:
    "Temas de repercussão geral do Supremo Tribunal Federal: a questão, a tese firmada, o relator e o resultado dos julgamentos, com fonte oficial.",
};

export default function StfPage() {
  const ind = getIndiceStf();
  const destaques = ind.com_pagina.map(getTemaStf).filter((t): t is TemaStf => !!t);
  const colecoes = [...new Set([...destaques.flatMap((t) => t.colecoes ?? []), ...ind.julgamentos.flatMap((j) => j.colecoes ?? [])])];
  const sumulas = getSumulasVinculantes();
  const termos = [
    TERMOS_JUSTICA.repercussao,
    TERMOS_JUSTICA.controleConcentrado, TERMOS_JUSTICA.tese, TERMOS_JUSTICA.plenarioVirtual, TERMOS_JUSTICA.sumulaVinculante, TERMOS_JUSTICA.certidao, TERMOS_JUSTICA.relator];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Migalhas itens={[{ href: "/justica", rotulo: "Justiça" }]} />
        <Figurinha nome="balanca" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">Supremo Tribunal Federal (STF)</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          O STF é o guardião da Constituição. Nos temas de repercussão geral, julga uma questão constitucional que se repete
          em muitos processos e fixa uma tese que vale para casos iguais. Nos julgamentos do Plenário Virtual, o tribunal
          publica o voto registrado por cada ministro; nas sessões presenciais, o site mostra só a certidão de julgamento.
        </p>
        {ind.total ? <p className="meta mt-3">Dados coletados em {formatarData(ind.atualizado_em)}.</p> : null}
      </header>

      {!ind.total ? (
        <div className="max-w-3xl space-y-3">
          <p className="selo">Em construção</p>
          <p className="lacuna text-sm">
            Os dados do STF ainda estão sendo coletados. Esta seção vai mostrar os temas de repercussão geral, as teses, as
            súmulas vinculantes e os julgamentos, começando pelos que tratam do ICMS.
          </p>
        </div>
      ) : null}

      {colecoes.map((c) => (
        <Secao key={c} id={`colecao-${c}`} titulo={`Destaque: ${COLECOES[c]?.titulo ?? c}`} descricao={COLECOES[c]?.explicacao}>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {destaques
              .filter((t) => (t.colecoes ?? []).includes(c))
              .map((t) => (
                <CartaoDecisao key={String(t.numero)} as="li" {...cartaoTemaStf(t)} />
              ))}
          </ul>
        </Secao>
      ))}

      {ind.julgamentos.length ? (
        <Secao
          id="julgamentos"
          titulo="Julgamentos acompanhados"
          descricao="Julgamentos das coleções acompanhadas (como o ICMS), com o resultado escrito na certidão. Nos julgamentos do Plenário Virtual, a página de cada um traz o voto registrado por ministro."
        >
          <ListaJulgamentosStf itens={ind.julgamentos} />
        </Secao>
      ) : null}

      {ind.total ? (
        <Secao id="buscar" titulo="Buscar temas de repercussão geral" descricao="A busca roda no seu navegador: o que você digita não é enviado a nenhum servidor.">
          <BuscaTemasStf colecoes={Object.fromEntries(colecoes.map((c) => [c, COLECOES[c]?.titulo ?? c]))} coletadoEm={ind.atualizado_em} />
        </Secao>
      ) : null}

      {sumulas.itens.length ? (
        <Secao id="sumulas" titulo="Súmulas vinculantes" descricao={TERMOS_JUSTICA.sumulaVinculante.explicacao}>
          <details className="cartao">
            <summary>Mostrar as {sumulas.itens.length} súmulas vinculantes (texto oficial)</summary>
            <ol className="mt-3 space-y-3">
              {[...sumulas.itens]
                .sort((x, y) => Number(y.numero ?? 0) - Number(x.numero ?? 0))
                .map((s, i) => (
                  <li key={String(s.numero ?? i)} className="border-t border-borda pt-2">
                    <p className="font-semibold text-gray-900">
                      Súmula Vinculante {s.numero ?? "sem número informado"}
                      {s.situacao ? <span className="meta ml-2 font-normal">{s.situacao}</span> : null}
                    </p>
                    <p className="mt-1 text-gray-800">{s.texto ?? "Texto não disponível em fonte oficial"}</p>
                    <p className="meta mt-1">
                      Aprovada em {formatarData(s.julgamento_data)} · publicada em {formatarData(s.publicacao_data)}
                    </p>
                  </li>
                ))}
            </ol>
          </details>
          {sumulas.lacunas.map((l) => (
            <p key={l} className="lacuna mt-2 text-sm">
              {l}
            </p>
          ))}
          {sumulas.fonte ? (
            <div className="mt-2">
              <ListaFontes fontes={[sumulas.fonte]} />
            </div>
          ) : null}
        </Secao>
      ) : null}

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      {ind.fonte?.url || ind.fontes.length ? (
        <Secao id="fontes" titulo="Fontes">
          <ListaFontes fontes={ind.fontes.length ? ind.fontes : [ind.fonte!]} />
        </Secao>
      ) : null}
    </div>
  );
}
