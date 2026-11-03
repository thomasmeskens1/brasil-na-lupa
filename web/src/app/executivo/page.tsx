import type { Metadata } from "next";
import Link from "next/link";
import { CartaoDecisao } from "@/components/decisao";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { getIndiceExecutivo } from "@/features/executivo/dados";
import { montarCartao } from "@/features/executivo/apresentacao";
import { cartaoMpv, cartaoVeto, padraoMpv, padraoVeto } from "@/features/executivo/listas";
import { TERMOS_EXECUTIVO } from "@/features/executivo/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Executivo federal",
  description:
    "Medidas provisórias, vetos e leis e decretos do Presidente da República, com a justificativa oficial e o que o Congresso Nacional decidiu.",
};

export default function ExecutivoPage() {
  const ind = getIndiceExecutivo();
  const nTipo = (t: string) => Object.entries(ind.normas.por_ano_tipo).filter(([k]) => k.endsWith(`|${t}`)).reduce((s, [, n]) => s + n, 0);
  const cartoes = [
    {
      href: "/executivo/medidas-provisorias",
      titulo: "Medidas provisórias",
      texto: `${ind.mpvs.length} medidas provisórias, com a exposição de motivos (a justificativa oficial), os prazos e as votações no Congresso.`,
    },
    {
      href: "/executivo/vetos",
      titulo: "Vetos",
      texto: `${ind.vetos.length} vetos do Presidente da República, com cada trecho vetado, a razão oficial do veto e o que o Congresso decidiu.`,
    },
    {
      href: "/executivo/leis-e-decretos",
      titulo: "Leis e decretos",
      texto: `${nTipo("Lei")} leis, ${nTipo("Lei Complementar")} leis complementares e ${nTipo("Decreto")} decretos, com link para o texto no Planalto.`,
    },
  ];
  const termos = [TERMOS_EXECUTIVO.mpv, TERMOS_EXECUTIVO.veto, TERMOS_EXECUTIVO.vetoTotalParcial, TERMOS_EXECUTIVO.decreto];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Figurinha nome="caneta" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Executivo federal</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          O Presidente da República decide por atos individuais, sem votação: edita medidas provisórias e decretos e sanciona
          ou veta os projetos aprovados pelo Congresso Nacional. Medidas provisórias e vetos depois passam pelo Congresso,
          que pode aprová-los, rejeitá-los ou derrubá-los. Aqui estão esses atos, com a justificativa oficial e o que o
          Congresso decidiu.
        </p>
        <p className="meta mt-3">
          Dados coletados em {formatarData(ind.atualizado_em)}
          {ind.periodo?.inicio ? `; atos de ${formatarData(ind.periodo.inicio)} a ${formatarData(ind.periodo.fim)}` : ""}.
        </p>
      </header>

      {!ind.mpvs.length && !ind.vetos.length ? (
        <p className="lacuna text-sm">Os dados do Executivo federal ainda não foram coletados.</p>
      ) : null}

      <nav aria-label="Atos do Executivo" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cartoes.map((c) => (
          <Link key={c.href} href={c.href} className="cartao block min-h-11 hover:bg-superficie">
            <span className="block text-base font-semibold text-[var(--cor-link)] underline underline-offset-2">{c.titulo}</span>
            <span className="mt-1 block text-gray-800">{c.texto}</span>
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Secao id="mpvs-recentes" titulo="Medidas provisórias mais recentes">
          <ul className="space-y-3">
            {ind.mpvs.slice(0, 5).map((m) => (
              <CartaoDecisao key={m.id} as="li" {...montarCartao(padraoMpv(ind), cartaoMpv(m).cartao)} />
            ))}
          </ul>
        </Secao>
        <Secao id="vetos-recentes" titulo="Vetos mais recentes">
          <ul className="space-y-3">
            {ind.vetos.slice(0, 5).map((v) => (
              <CartaoDecisao key={v.id} as="li" {...montarCartao(padraoVeto(ind), cartaoVeto(v).cartao)} />
            ))}
          </ul>
        </Secao>
      </div>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={[...ind.fontes_mpv, ...ind.fontes_vetos, ...ind.fontes_normas, ...ind.fontes.filter((f) => !f.url.includes("{"))]} />
      </Secao>
    </div>
  );
}
