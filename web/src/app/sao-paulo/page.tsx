import type { Metadata } from "next";
import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { getIndiceSp, votacoesPlenario } from "@/features/sao-paulo/dados";
import { TERMOS_SP, formatarDataSp, nomeSiglaSp } from "@/features/sao-paulo/rotulos";

export const metadata: Metadata = {
  title: "Estado de São Paulo",
  description:
    "Votações da Assembleia Legislativa do Estado de São Paulo (ALESP), o voto de cada deputado estadual, projetos e as leis, decretos e vetos do governador, com fonte oficial.",
};

export default function SaoPauloPage() {
  const ind = getIndiceSp();
  const plen = votacoesPlenario();
  const nComissoes = ind.votacoes.length - plen.length;
  const nTipo = (t: string) => Object.entries(ind.normas.por_ano_tipo).filter(([k]) => k.endsWith(`|${t}`)).reduce((s, [, n]) => s + n, 0);
  const cartoes = [
    {
      href: "/sao-paulo/deputados",
      titulo: "Deputados estaduais",
      texto: `${ind.deputados.length} deputados em exercício, com partido, link oficial e o voto de cada um nas votações nominais.`,
    },
    {
      href: "/sao-paulo/votacoes",
      titulo: "Votações",
      texto: `${plen.length} votações nominais em Plenário e ${nComissoes} deliberações de comissões com o voto de cada membro.`,
    },
    {
      href: "/sao-paulo/projetos",
      titulo: "Projetos",
      texto: `${ind.projetos.total} proposições apresentadas na Assembleia (projetos de lei, de lei complementar, de decreto legislativo, de resolução e propostas de emenda à Constituição).`,
    },
    {
      href: "/sao-paulo/leis-e-decretos",
      titulo: "Leis, decretos e vetos",
      texto: `${nTipo("Lei") + nTipo("Lei Complementar")} leis, ${nTipo("Decreto")} decretos e ${ind.normas.vetos} vetos do governador publicados no Diário Oficial do Estado, com as razões dos vetos.`,
    },
  ];
  const termos = [TERMOS_SP.alesp, TERMOS_SP.verificacao, TERMOS_SP.comissao, TERMOS_SP.veto, TERMOS_SP.decreto, TERMOS_SP.doe];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Estado de São Paulo</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          As leis estaduais são votadas pela Assembleia Legislativa do Estado de São Paulo (ALESP), formada por 94 deputados
          estaduais, e depois sancionadas ou vetadas pelo governador. O governador também decide sozinho, por decreto, sem
          votação. Aqui estão as votações da Assembleia com o voto de cada deputado, quando registrado oficialmente, os
          projetos apresentados e as leis, decretos e vetos publicados no Diário Oficial do Estado.
        </p>
        <p className="mt-2 text-sm text-gray-800">
          No Plenário, só há voto individual quando um deputado pede verificação de votação; as votações simbólicas não têm
          voto de cada um e não aparecem na lista de votações. Nas comissões, a ALESP registra o voto de cada membro como
          texto, reproduzido como publicado.
        </p>
        <p className="meta mt-3">
          Dados coletados em {formatarDataSp(ind.atualizado_em)}
          {ind.normas.atualizado_em ? `; atos do governador coletados em ${formatarDataSp(ind.normas.atualizado_em)}` : ""}.
        </p>
      </header>

      {!ind.votacoes.length && !ind.normas.total ? (
        <p className="lacuna text-sm">Os dados do Estado de São Paulo ainda não foram coletados.</p>
      ) : null}

      <nav aria-label="Seções de São Paulo" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cartoes.map((c) => (
          <Link key={c.href} href={c.href} className="cartao block hover:bg-superficie">
            <span className="block text-base font-semibold text-[var(--cor-link)] underline underline-offset-2">{c.titulo}</span>
            <span className="mt-1 block text-sm text-gray-800">{c.texto}</span>
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Secao id="plenario-recentes" titulo="Votações nominais mais recentes em Plenário">
          <ul className="space-y-3">
            {plen.slice(0, 5).map((v) => (
              <li key={v.id} className="cartao">
                <p className="meta flex flex-wrap gap-x-2">
                  <span className="font-semibold text-gray-900">{formatarDataSp(v.data)}</span>
                  {v.resultado ? <span className="selo">{v.resultado}</span> : null}
                </p>
                <h3 className="mt-2 text-base font-semibold">
                  <Link href={`/sao-paulo/votacoes/${v.id}`} className="lk">
                    {v.proposicao?.rotulo ?? v.descricao ?? "Votação"}
                  </Link>
                  {v.proposicao?.sigla ? <span className="meta ml-2 font-normal">{nomeSiglaSp(v.proposicao.sigla)}</span> : null}
                </h3>
                <p className="mt-1 text-sm text-gray-800">{v.proposicao?.ementa ?? v.descricao ?? "Ementa não disponível em fonte oficial"}</p>
                {v.placar ? (
                  <p className="meta mt-1">
                    Placar oficial: {v.placar.votos_sim ?? "?"} Sim, {v.placar.votos_nao ?? "?"} Não
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Secao>
        <Secao id="atos-recentes" titulo="Atos mais recentes do governador">
          <ul className="space-y-3">
            {ind.normas.recentes.map((n) => (
              <li key={n.id} className="cartao">
                <p className="meta flex flex-wrap gap-x-2">
                  <span className="font-semibold text-gray-900">Publicado em {formatarDataSp(n.data_publicacao)}</span>
                  <span className="selo">{n.tipo}</span>
                </p>
                <h3 className="mt-2 text-base font-semibold text-gray-900">{n.titulo ?? "Título não informado"}</h3>
                <p className="mt-1 text-sm text-gray-800">{n.ementa ?? "Ementa não disponível em fonte oficial"}</p>
                {n.url ? (
                  <p className="mt-2">
                    <FonteLink href={n.url} tipo="oficial">
                      Diário Oficial do Estado
                    </FonteLink>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            <Link href="/sao-paulo/leis-e-decretos" className="lk">
              Ver todas as leis, decretos e vetos
            </Link>
          </p>
        </Secao>
      </div>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={[...(ind.lista_fonte ? [ind.lista_fonte] : []), ...ind.fontes_votacoes, ...ind.fontes_projetos.slice(0, 1), ...ind.normas.fontes]} />
      </Secao>
    </div>
  );
}
