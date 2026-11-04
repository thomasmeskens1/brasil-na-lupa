import type { Metadata } from "next";
import Link from "next/link";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/estados/rotulos";
import { UFS } from "@/features/estados/ufs";
import { BuscaMunicipios } from "@/features/municipios/componentes/BuscaMunicipios";
import { getIndiceMunicipios } from "@/features/municipios/dados";
import { TERMOS_MUNICIPIOS } from "@/features/municipios/termos";

export const metadata: Metadata = {
  title: "Municípios",
  description:
    "Busque o seu município: votações e votos dos vereadores quando a Câmara publica em dados abertos, leis e decretos, e as receitas e despesas declaradas ao Tesouro Nacional, sempre com fonte oficial.",
  alternates: { canonical: "/municipios" },
};

const n = (v: number | undefined) => (v ?? 0).toLocaleString("pt-BR");

export default function MunicipiosPage() {
  const ind = getIndiceMunicipios();
  const c = ind.contagens;
  const camaras = ind.presentes.filter((p) => p.tem.camara);
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Figurinha nome="cidade" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Municípios</h1>
        <p>
          Em cada município, as leis são votadas pela Câmara Municipal, formada por vereadores, e sancionadas ou vetadas pelo
          prefeito, que também decide sozinho, por decreto. Aqui aparecem os municípios dos quais já coletamos pelo menos uma
          fonte oficial em formato aberto: as votações e os projetos da Câmara, as leis e decretos, ou as finanças declaradas
          ao Tesouro Nacional.
        </p>
        <p>
          {ind.total_municipios
            ? `Dos ${n(ind.total_municipios)} municípios do país, ${n(c?.com_dados)} já têm dados nesta seção: ${n(c?.com_votacoes)} com votações da Câmara, ${n(c?.com_leis)} com leis e ${n(c?.com_financas)} com finanças. Os demais aparecem como “Em breve”.`
            : "Em breve."}
        </p>
      </header>

      <Secao
        id="busca"
        titulo="Encontre o município"
        descricao="Busque pelo nome, escolha o estado ou mostre só os municípios com um tipo de dado. A lista é baixada pelo seu navegador e a busca roda nele."
      >
        <BuscaMunicipios ufs={UFS.map((u) => ({ uf: u.uf, sigla: u.sigla, nome: u.nome }))} />
        <noscript>
          <p className="lacuna">A busca precisa de JavaScript. Abaixo estão os municípios com dados da Câmara Municipal.</p>
        </noscript>
      </Secao>

      {camaras.length ? (
        <Secao id="camaras" titulo="Câmaras Municipais com dados" descricao="Municípios em que já coletamos a Câmara Municipal, em ordem alfabética.">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {camaras.map((m) => (
              <li key={`${m.uf}/${m.slug}`}>
                <Link href={`/municipios/${m.uf}/${m.slug}`} className="bloco-secao min-h-11 flex-col gap-1">
                  <span className="block font-semibold text-foreground">
                    {m.nome} <span className="font-normal text-[var(--cor-texto-apoio)]">({m.uf.toUpperCase()})</span>
                  </span>
                  <span className="block text-sm text-[var(--cor-texto-apoio)]">
                    {[m.tem.votacoes ? "votações" : "Câmara", m.tem.leis ? "leis" : null, m.tem.financas ? "finanças" : null].filter(Boolean).join(", ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao id="como" titulo="Como escolhemos os municípios">
        <div className="cartao space-y-2 text-sm">
          <p>
            Um município entra nesta seção quando há pelo menos uma fonte oficial em formato estruturado já coletada. Não
            copiamos números de reportagens nem completamos lacunas: quando a fonte não traz a informação, a página diz
            “Informação não disponível em fonte oficial”.
          </p>
          <p>
            As Câmaras Municipais vêm da lista oficial do Interlegis, programa do Senado Federal que oferece às Câmaras o
            Sistema de Apoio ao Processo Legislativo (SAPL), com dados abertos de projetos, sessões e votações.
            {c ? ` São ${n(c.camaras_sapl_registradas)} Câmaras com o sistema registrado; ${n(c.camaras_sapl_verificadas)} já foram conferidas e, nelas, ${n(c.camaras_sapl_com_votos)} publicam o voto de cada vereador.` : ""}{" "}
            As finanças vêm do Siconfi, sistema do Tesouro Nacional em que cada prefeitura declara as receitas e despesas,
            coletado aos poucos para todos os municípios.
          </p>
          {ind.registro_atualizado_em ? <p className="meta">Lista de Câmaras atualizada em {formatarData(ind.registro_atualizado_em)}; finanças atualizadas em {formatarData(ind.financas_atualizado_em)}.</p> : null}
        </div>
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={TERMOS_MUNICIPIOS} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes} />
      </Secao>
    </div>
  );
}
