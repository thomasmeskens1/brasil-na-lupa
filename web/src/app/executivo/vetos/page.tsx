import type { Metadata } from "next";
import { metadadosCompartilhamento } from "@/components/compartilhar";
import { Termo } from "@/components/glossario";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { ListaFiltros } from "@/features/executivo/componentes/ListaFiltros";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { getIndiceExecutivo } from "@/features/executivo/dados";
import { ATO_VETO, FACETAS_EXECUTIVO, itensExecutivo, numerosVetos } from "@/features/executivo/painel";
import { TERMOS_EXECUTIVO } from "@/features/executivo/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = metadadosCompartilhamento({
  titulo: "Vetos do Presidente da República",
  descricao:
    "Cada trecho vetado, a razão oficial do veto e o que o Congresso Nacional decidiu, com os votos registrados e a fonte oficial.",
  caminho: "/executivo/vetos",
});

export default function VetosPage() {
  const ind = getIndiceExecutivo();
  const termos = [
    TERMOS_EXECUTIVO.veto,
    TERMOS_EXECUTIVO.vetoTotalParcial,
    TERMOS_EXECUTIVO.dispositivo,
    TERMOS_EXECUTIVO.sessaoConjunta,
    TERMOS_EXECUTIVO.sobrestamento,
  ];

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <Migalhas itens={[{ href: "/executivo", rotulo: "Executivo" }]} />
        <Figurinha nome="caneta" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-1 text-2xl font-bold text-foreground md:text-3xl">Vetos</h1>
        <p className="mt-3 leading-relaxed">
          Quando o Presidente da República <Termo termo="Veto">veta</Termo> um projeto aprovado pelo Congresso, no todo ou em
          parte, publica as razões. Depois, deputados e senadores, em <Termo termo="Sessão conjunta">sessão conjunta</Termo>,
          decidem se mantêm ou derrubam cada trecho vetado.
        </p>
        <p className="meta mt-2">
          {ind.vetos.length} vetos · dados coletados em {formatarData(ind.atualizado_em)}.
        </p>
      </header>

      <ListaFiltros
        itens={itensExecutivo(ind, "veto")}
        numeros={[numerosVetos(ind)]}
        facetas={FACETAS_EXECUTIVO.map((f) => (f.chave === "tipoVeto" || f.chave === "trechos" ? { ...f, secundaria: false } : f))}
        fixos={{ ato: ATO_VETO }}
        busca={{ rotulo: "Buscar no assunto, na ementa ou no projeto", dica: "Ex.: orçamento, PL 4537" }}
        rotulo={{ singular: "veto", plural: "vetos" }}
        ordem="do mais recente para o mais antigo"
        tituloLista="Lista de vetos"
      />

      <TermosRecolhidos termos={termos} />

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes_vetos} />
      </Secao>
    </div>
  );
}
