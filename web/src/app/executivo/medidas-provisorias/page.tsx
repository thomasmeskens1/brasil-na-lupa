import type { Metadata } from "next";
import { metadadosCompartilhamento } from "@/components/compartilhar";
import { Termo } from "@/components/glossario";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { ListaCartoes } from "@/features/executivo/componentes/ListaCartoes";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { getIndiceExecutivo } from "@/features/executivo/dados";
import { cartaoMpv, padraoMpv } from "@/features/executivo/listas";
import { TERMOS_EXECUTIVO } from "@/features/executivo/rotulos";

export const metadata: Metadata = metadadosCompartilhamento({
  titulo: "Medidas provisórias",
  descricao:
    "Medidas provisórias do Presidente da República: ementa, situação, prazos, a exposição de motivos e as votações no Congresso Nacional, com fonte oficial.",
  caminho: "/executivo/medidas-provisorias",
});

export default function MedidasProvisoriasPage() {
  const ind = getIndiceExecutivo();
  const itens = ind.mpvs.map(cartaoMpv);
  const termos = [TERMOS_EXECUTIVO.mpv, TERMOS_EXECUTIVO.exposicao, TERMOS_EXECUTIVO.plv, TERMOS_EXECUTIVO.perdaEficacia];

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <Migalhas itens={[{ href: "/executivo", rotulo: "Executivo" }]} />
        <h1 className="mt-1 text-2xl font-bold text-foreground md:text-3xl">Medidas provisórias</h1>
        <p className="mt-3 leading-relaxed">
          A <Termo termo="Medida provisória">medida provisória</Termo> é editada pelo Presidente da República e vale desde a
          publicação, sem votação. Depois, o Congresso Nacional decide se a transforma em lei. Em cada uma estão a justificativa
          oficial (<Termo termo="Exposição de motivos">exposição de motivos</Termo>), os prazos e as votações.
        </p>
        <p className="meta mt-2">
          {ind.mpvs.length} medidas provisórias · dados coletados em {formatarData(ind.atualizado_em)}.
        </p>
      </header>

      <Secao id="lista" titulo="Lista de medidas provisórias">
        <ListaCartoes
          itens={itens}
          padrao={padraoMpv(ind)}
          filtros={[
            { chave: "ano", rotulo: "Ano de edição", decrescente: true },
            { chave: "situacao", rotulo: "Situação" },
          ]}
          busca={{ rotulo: "Buscar na ementa ou pelo número", dica: "Ex.: Pix, 1300" }}
          rotulo={{ singular: "medida provisória", plural: "medidas provisórias" }}
          vazio="Nenhuma medida provisória coletada."
        />
      </Secao>

      <TermosRecolhidos termos={termos} />

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes_mpv} />
      </Secao>
    </div>
  );
}
