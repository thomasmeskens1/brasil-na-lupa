import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { BuscaProjetosSp } from "@/features/sao-paulo/componentes/BuscaProjetosSp";
import { getIndiceSp } from "@/features/sao-paulo/dados";
import { SIGLAS_SP, TERMOS_SP, formatarDataSp } from "@/features/sao-paulo/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Projetos na Assembleia Legislativa de São Paulo",
  description: "Projetos de lei, de lei complementar, de decreto legislativo, de resolução e propostas de emenda à Constituição apresentados na ALESP.",
};

export default function ProjetosSpPage() {
  const ind = getIndiceSp();
  const termos = [TERMOS_SP.pl, TERMOS_SP.plc, TERMOS_SP.pec, TERMOS_SP.pdl, TERMOS_SP.pr, TERMOS_SP.ementa];
  const contagem = Object.keys(SIGLAS_SP)
    .filter((s) => ind.projetos.por_sigla[s])
    .map((s) => `${ind.projetos.por_sigla[s]} ${s}`)
    .join(", ");
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/sao-paulo" className="lk">
            São Paulo
          </Link>
        </nav>
        <Figurinha nome="mapa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Projetos</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          {ind.projetos.total} proposições apresentadas na Assembleia Legislativa do Estado de São Paulo (ALESP) ({contagem}),
          com a ementa, a autoria e a última tramitação registradas pela Assembleia. Quando houver, há link para as votações
          nominais coletadas e para a norma publicada.
        </p>
        <p className="meta mt-3">Dados coletados em {formatarDataSp(ind.atualizado_em)}.</p>
      </header>

      <Secao id="lista" titulo="Buscar projetos" descricao="A lista é baixada pelo seu navegador e a busca roda nele: o que você digita não é enviado a nenhum servidor.">
        <BuscaProjetosSp />
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes_projetos} />
      </Secao>
    </div>
  );
}
