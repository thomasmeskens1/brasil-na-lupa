import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { ListaDeputadosSp } from "@/features/sao-paulo/componentes/ListaDeputadosSp";
import { getIndiceSp, votacoesPlenario } from "@/features/sao-paulo/dados";
import { formatarDataSp } from "@/features/sao-paulo/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Deputados estaduais de São Paulo",
  description: "Deputados da Assembleia Legislativa do Estado de São Paulo em exercício, com partido e os votos nas votações nominais.",
};

export default function DeputadosSpPage() {
  const ind = getIndiceSp();
  const plen = votacoesPlenario().length;
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/sao-paulo" className="lk">
            São Paulo
          </Link>
        </nav>
        <Figurinha nome="mapa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Deputados estaduais</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          {ind.deputados.length} deputados em exercício na Assembleia Legislativa do Estado de São Paulo (ALESP), segundo a
          lista oficial coletada em {formatarDataSp(ind.lista_atualizada_em)}. O partido é o da lista oficial. Na página de
          cada um estão os votos registrados nas {plen} votações nominais de Plenário e nas {ind.votacoes.length - plen}{" "}
          deliberações de comissões coletadas.
        </p>
        <p className="mt-2 text-sm text-gray-800">
          Um voto só é ligado a um deputado quando o nome impresso no documento oficial é idêntico ao da lista oficial. Nomes
          abreviados ou escritos de outra forma aparecem na votação como impressos, sem ligação com o perfil, e não entram
          nas contagens abaixo.
        </p>
      </header>

      <ListaDeputadosSp deputados={ind.deputados} />

      <Secao id="fonte" titulo="Fonte">
        <ListaFontes fontes={ind.lista_fonte ? [ind.lista_fonte] : []} />
      </Secao>
    </div>
  );
}
