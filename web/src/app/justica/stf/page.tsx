import type { Metadata } from "next";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { Migalhas } from "@/features/executivo/componentes/Migalhas";
import { TiposExplicados } from "@/features/executivo/componentes/TiposExplicados";
import { ListaJustica } from "@/features/justica/componentes/ListaJustica";
import { getIndiceStf, getSumulasVinculantes } from "@/features/justica/dados";
import { TIPOS_COMUNS, TIPOS_STF, itensJulgamentosStf, numerosStf } from "@/features/justica/painel";
import { TERMOS_JUSTICA } from "@/features/justica/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Supremo Tribunal Federal (STF)",
  description:
    "Temas de repercussão geral e julgamentos do Supremo Tribunal Federal em números oficiais e numa lista com filtros: a tese firmada, o relator e o resultado, com fonte oficial.",
};

export default function StfPage() {
  const ind = getIndiceStf();
  const sumulas = getSumulasVinculantes();
  const numeros = numerosStf(ind);

  return (
    <div className="space-y-10">
      <header className="entrada max-w-3xl">
        <Migalhas itens={[{ href: "/justica", rotulo: "Justiça" }]} />
        <Figurinha nome="balanca" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-1 text-2xl font-bold text-foreground md:text-3xl">Supremo Tribunal Federal (STF)</h1>
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

      {ind.total ? (
        <ListaJustica
          stj={{ ativo: false, coletadoEm: null }}
          stf={{ ativo: true, coletadoEm: ind.atualizado_em }}
          julgamentos={itensJulgamentosStf(ind)}
          numeros={numeros ? [numeros] : []}
          tituloLista="Temas e julgamentos do STF"
        >
          <TiposExplicados id="tipos" titulo="O que é cada tipo de julgamento" itens={[...TIPOS_STF, ...TIPOS_COMUNS]} />
        </ListaJustica>
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

      {ind.fonte?.url || ind.fontes.length ? (
        <Secao id="fontes" titulo="Fontes">
          <ListaFontes fontes={ind.fontes.length ? ind.fontes : [ind.fonte!]} />
        </Secao>
      ) : null}
    </div>
  );
}
