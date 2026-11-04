import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { ListaFiltros } from "@/features/executivo/componentes/ListaFiltros";
import { TiposExplicados } from "@/features/executivo/componentes/TiposExplicados";
import { getIndiceExecutivo } from "@/features/executivo/dados";
import { FACETAS_EXECUTIVO, TIPOS_EXECUTIVO, itensExecutivo, numerosMpv, numerosVetos } from "@/features/executivo/painel";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Executivo federal",
  description:
    "Medidas provisórias, vetos e leis e decretos do Presidente da República em números oficiais e numa lista com filtros, com a justificativa oficial e o que o Congresso Nacional decidiu.",
};

export default function ExecutivoPage() {
  const ind = getIndiceExecutivo();
  const nTipo = (t: string) => Object.entries(ind.normas.por_ano_tipo).filter(([k]) => k.endsWith(`|${t}`)).reduce((s, [, n]) => s + n, 0);
  const vazio = !ind.mpvs.length && !ind.vetos.length;

  return (
    <div className="space-y-10">
      <header className="entrada max-w-3xl">
        <Figurinha nome="caneta" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Executivo federal</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          O Presidente da República decide por atos individuais, sem votação: edita medidas provisórias e veta, no todo ou em
          parte, projetos aprovados pelo Congresso Nacional. Depois, o Congresso vota esses atos. Os números abaixo são
          contagens dos dados oficiais; toque em um deles para ver os atos na lista.
        </p>
        <p className="meta mt-3">
          Dados coletados em {formatarData(ind.atualizado_em)}
          {ind.periodo?.inicio ? `; atos de ${formatarData(ind.periodo.inicio)} a ${formatarData(ind.periodo.fim)}` : ""}.
        </p>
      </header>

      {vazio ? (
        <p className="lacuna text-sm">Os dados do Executivo federal ainda não foram coletados.</p>
      ) : (
        <ListaFiltros
          itens={itensExecutivo(ind)}
          numeros={[numerosMpv(ind), numerosVetos(ind)]}
          facetas={FACETAS_EXECUTIVO}
          busca={{ rotulo: "Buscar na ementa, no número ou no projeto", dica: "Ex.: Pix, 1300, PL 4537" }}
          rotulo={{ singular: "ato", plural: "atos" }}
          ordem="do mais recente para o mais antigo"
          tituloLista="Medidas provisórias e vetos"
        >
          <TiposExplicados id="tipos" titulo="O que é cada tipo de ato" itens={TIPOS_EXECUTIVO} />
        </ListaFiltros>
      )}

      <nav aria-labelledby="mais-executivo" className="cartao">
        <h2 id="mais-executivo" className="text-lg font-bold text-foreground">
          Leis e decretos
        </h2>
        <p className="mt-1">
          {nTipo("Lei").toLocaleString("pt-BR")} leis, {nTipo("Lei Complementar").toLocaleString("pt-BR")} leis complementares e{" "}
          {nTipo("Decreto").toLocaleString("pt-BR")} decretos assinados pelo Presidente da República, com link para o texto no
          Planalto.
        </p>
        <p className="meta mt-1">
          Fonte: Legislação Federal do Senado Federal{ind.fontes_normas[0]?.acessado_em ? `, coletado em ${formatarData(ind.fontes_normas[0].acessado_em)}` : ""}.
        </p>
        <p className="mt-1">
          <Link href="/executivo/leis-e-decretos" className="lk inline-flex min-h-11 items-center">
            Buscar leis e decretos
          </Link>
        </p>
      </nav>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={[...ind.fontes_mpv, ...ind.fontes_vetos, ...ind.fontes_normas, ...ind.fontes.filter((f) => !f.url.includes("{"))]} />
      </Secao>
    </div>
  );
}
