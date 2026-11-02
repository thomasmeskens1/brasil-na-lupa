import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { BuscaVotacoesSp } from "@/features/sao-paulo/componentes/BuscaVotacoesSp";
import { getIndiceSp, votacoesPlenario } from "@/features/sao-paulo/dados";
import { TERMOS_SP, formatarDataSp } from "@/features/sao-paulo/rotulos";

export const metadata: Metadata = {
  title: "Votações da Assembleia Legislativa de São Paulo",
  description: "Votações nominais do Plenário e das comissões da ALESP, com o placar oficial e o voto de cada deputado estadual.",
};

export default function VotacoesSpPage() {
  const ind = getIndiceSp();
  const plen = votacoesPlenario().length;
  const anos = [...new Set(ind.votacoes.map((v) => v.data?.slice(0, 4)).filter(Boolean))].sort();
  const termos = [TERMOS_SP.verificacao, TERMOS_SP.comissao, TERMOS_SP.votoRelator, TERMOS_SP.ccjr, TERMOS_SP.substitutivo, TERMOS_SP.semLegenda];
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/sao-paulo" className="lk">
            São Paulo
          </Link>
        </nav>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Votações</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          {plen} votações nominais do Plenário e {ind.votacoes.length - plen} deliberações de comissões da Assembleia
          Legislativa do Estado de São Paulo (ALESP), realizadas em {anos.length > 1 ? `${anos.slice(0, -1).join(", ")} e ${anos[anos.length - 1]}` : (anos[0] ?? "período não informado")}.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800">
          <li>
            <strong>Plenário:</strong> só há voto individual quando houve verificação de votação. Cada votação tem página
            própria, com o placar oficial do relatório e os votos de cada deputado, quando conferidos.
          </li>
          <li>
            <strong>Comissões:</strong> a ALESP registra o voto de cada membro como texto oficial (por exemplo, “Favorável ao
            voto do relator”), mostrado aqui sem conversão para sim ou não. Abra “Ver os votos registrados” em cada item.
          </li>
          <li>Votações simbólicas não têm voto individual registrado e não aparecem nesta lista.</li>
        </ul>
        <p className="meta mt-3">Dados coletados em {formatarDataSp(ind.atualizado_em)}.</p>
      </header>

      <Secao id="lista" titulo="Buscar votações" descricao="A lista é baixada pelo seu navegador e a busca roda nele: o que você digita não é enviado a nenhum servidor.">
        <BuscaVotacoesSp />
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes_votacoes} />
      </Secao>
    </div>
  );
}
