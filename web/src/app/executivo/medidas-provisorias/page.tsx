import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { FiltroLista, type ItemFiltravel } from "@/features/executivo/componentes/FiltroLista";
import { getIndiceExecutivo } from "@/features/executivo/dados";
import { TERMOS_EXECUTIVO, rotuloSituacaoMpv } from "@/features/executivo/rotulos";

export const metadata: Metadata = {
  title: "Medidas provisórias",
  description:
    "Medidas provisórias do Presidente da República: ementa, situação, prazos, a exposição de motivos e as votações no Congresso Nacional.",
};

export default function MedidasProvisoriasPage() {
  const ind = getIndiceExecutivo();
  const itens: ItemFiltravel[] = ind.mpvs.map((m) => ({
    id: m.id,
    href: `/executivo/medidas-provisorias/${m.id}`,
    titulo: `Medida Provisória ${m.numero}/${m.ano}`,
    data: m.data,
    ano: String(m.ano),
    grupo: rotuloSituacaoMpv(m.situacao),
    etiquetas: [rotuloSituacaoMpv(m.situacao), ...(m.votacoes ? [`${m.votacoes} votações coletadas`] : [])],
    texto: m.ementa,
    detalhe: m.norma_gerada ? `Norma gerada: ${m.norma_gerada}` : null,
  }));
  const grupos = [...new Set(itens.map((i) => i.grupo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const termos = [TERMOS_EXECUTIVO.mpv, TERMOS_EXECUTIVO.exposicao, TERMOS_EXECUTIVO.plv, TERMOS_EXECUTIVO.perdaEficacia];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/executivo" className="lk">
            Executivo
          </Link>
        </nav>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Medidas provisórias</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          A medida provisória (MPV) é editada pelo Presidente da República e vale desde a publicação, sem votação. Depois, o
          Congresso Nacional decide se a transforma em lei, com ou sem mudanças. Em cada uma estão a justificativa oficial
          (exposição de motivos), os prazos e as votações registradas na Câmara dos Deputados e no Senado Federal.
        </p>
        <p className="meta mt-3">Dados coletados em {formatarData(ind.atualizado_em)}.</p>
      </header>

      <Secao id="lista" titulo="Lista de medidas provisórias" descricao="Filtre por ano de edição e situação, ou busque na ementa.">
        <FiltroLista
          itens={itens}
          rotuloGrupo="Situação"
          grupos={grupos}
          rotuloBusca="Buscar na ementa ou pelo número"
          exemplo="Ex.: crédito extraordinário, 1291"
          vazio={<p className="lacuna text-sm">Nenhuma medida provisória coletada.</p>}
        />
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes_mpv} />
      </Secao>
    </div>
  );
}
