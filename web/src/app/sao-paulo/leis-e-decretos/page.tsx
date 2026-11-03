import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { BuscaNormasSp } from "@/features/sao-paulo/componentes/BuscaNormasSp";
import { getIndiceSp } from "@/features/sao-paulo/dados";
import { TERMOS_SP, formatarDataSp } from "@/features/sao-paulo/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Leis, decretos e vetos do Estado de São Paulo",
  description: "Leis, leis complementares, decretos e vetos do governador de São Paulo publicados no Diário Oficial do Estado, com as razões dos vetos.",
};

export default function LeisEDecretosSpPage() {
  const ind = getIndiceSp();
  const termos = [TERMOS_SP.veto, TERMOS_SP.sancao, TERMOS_SP.decreto, TERMOS_SP.doe, TERMOS_SP.retificacao, TERMOS_SP.ementa];
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/sao-paulo" className="lk">
            São Paulo
          </Link>
        </nav>
        <Figurinha nome="mapa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Leis, decretos e vetos</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          Atos publicados na seção do Poder Executivo do Diário Oficial do Estado de São Paulo. As leis vêm de projetos
          aprovados pela Assembleia Legislativa; os decretos e os vetos são atos individuais do governador, sem votação. Nos
          vetos aparecem as razões publicadas pelo governador, em texto integral, e o projeto vetado, com link para a
          Assembleia.
        </p>
        <p className="mt-2 text-sm text-gray-800">
          A ementa é o trecho do texto publicado entre o título e a fórmula “O GOVERNADOR DO ESTADO…”; quando não foi
          possível identificá-la, aparece “Ementa não disponível em fonte oficial”.
        </p>
        <p className="meta mt-3">
          {ind.normas.total} atos · dados coletados em {formatarDataSp(ind.normas.atualizado_em)}.
        </p>
      </header>

      <Secao id="lista" titulo="Buscar leis, decretos e vetos" descricao="A lista é baixada pelo seu navegador e a busca roda nele: o que você digita não é enviado a nenhum servidor.">
        <BuscaNormasSp />
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.normas.fontes} />
      </Secao>
    </div>
  );
}
