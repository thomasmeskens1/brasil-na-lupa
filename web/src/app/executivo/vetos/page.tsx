import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { FiltroLista, type ItemFiltravel } from "@/features/executivo/componentes/FiltroLista";
import { getIndiceExecutivo } from "@/features/executivo/dados";
import { TERMOS_EXECUTIVO, explicarSigla, rotuloSituacaoFonte, rotuloTipoVeto } from "@/features/executivo/rotulos";

export const metadata: Metadata = {
  title: "Vetos",
  description:
    "Vetos do Presidente da República: cada trecho vetado, a razão oficial do veto e o que o Congresso Nacional decidiu, com os votos registrados.",
};

export default function VetosPage() {
  const ind = getIndiceExecutivo();
  const itens: ItemFiltravel[] = ind.vetos.map((v) => ({
    id: v.id,
    href: `/executivo/vetos/${v.id}`,
    titulo: `Veto ${v.numero}/${v.ano}${v.materia_vetada ? ` — ${explicarSigla(v.materia_vetada)}` : ""}`,
    data: v.data_publicacao,
    ano: String(v.ano),
    grupo: rotuloTipoVeto(v.tipo),
    etiquetas: [rotuloTipoVeto(v.tipo), `${v.dispositivos} ${v.dispositivos === 1 ? "dispositivo" : "dispositivos"}`],
    texto: v.ementa,
    detalhe: [
      v.norma ? `Norma: ${v.norma}` : null,
      Object.entries(v.situacao_dispositivos ?? {})
        .map(([k, n]) => `${rotuloSituacaoFonte(k)}: ${n}`)
        .join(" · ") || null,
    ]
      .filter(Boolean)
      .join(" — "),
  }));
  const termos = [
    TERMOS_EXECUTIVO.veto,
    TERMOS_EXECUTIVO.vetoTotalParcial,
    TERMOS_EXECUTIVO.dispositivo,
    TERMOS_EXECUTIVO.sessaoConjunta,
    TERMOS_EXECUTIVO.sobrestamento,
  ];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/executivo" className="lk">
            Executivo
          </Link>
        </nav>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Vetos</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          Quando o Presidente da República veta um projeto aprovado pelo Congresso, no todo ou em parte, publica as razões do
          veto. Depois, deputados e senadores, em sessão conjunta do Congresso Nacional, decidem se mantêm ou derrubam cada
          trecho vetado. Em cada veto estão o texto vetado, a razão oficial e a situação de cada dispositivo.
        </p>
        <p className="meta mt-3">Dados coletados em {formatarData(ind.atualizado_em)}.</p>
      </header>

      <Secao id="lista" titulo="Lista de vetos" descricao="Filtre por ano e tipo de veto, ou busque na ementa e no projeto vetado.">
        <FiltroLista
          itens={itens}
          rotuloGrupo="Tipo de veto"
          grupos={[...new Set(itens.map((i) => i.grupo))].sort()}
          rotuloBusca="Buscar na ementa, no projeto ou na lei"
          exemplo="Ex.: orçamento, PL 4537"
          vazio={<p className="lacuna text-sm">Nenhum veto coletado.</p>}
        />
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes_vetos} />
      </Secao>
    </div>
  );
}
