import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { Fontes, Literal, Termos } from "@/features/tribunais-contas/componentes/Basicos";
import { tituloGovernador, tituloPresidente } from "@/features/tribunais-contas/componentes/Exercicios";
import { ListaOrgaos } from "@/features/tribunais-contas/componentes/ListaOrgaos";
import {
  colecoesAcordaos,
  getContasGovernador,
  getContasPrefeitos,
  getContasPresidente,
  getOrgao,
  getOrgaos,
} from "@/features/tribunais-contas/dados";
import { BASE_TC, TERMOS_TC, formatarDataTc, plural } from "@/features/tribunais-contas/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Tribunais de Contas",
  description:
    "O que fazem os tribunais de contas, a diferença entre parecer prévio e julgamento político, as contas do Presidente, do Governador de SP e do prefeito de Atibaia e os acórdãos do TCU, com fonte oficial.",
};

const QUEM_JULGA: [string, string, string][] = [
  ["Presidente da República", "Tribunal de Contas da União (TCU)", "Congresso Nacional"],
  ["Governador", "Tribunal de Contas do Estado (TCE)", "Assembleia Legislativa"],
  ["Prefeito", "Tribunal de Contas do Estado ou, onde houver, Tribunal de Contas do Município (TCM) ou dos Municípios", "Câmara Municipal"],
];

export default function TribunaisDeContasPage() {
  const reg = getOrgaos();
  const ativos = reg.itens.filter((o) => o.situacao_coleta === "ativa").length;
  const presidente = getContasPresidente("tcu");
  const ultPres = presidente?.exercicios.find((e) => e.acordao);
  const tceSp = getOrgao("tce-sp");
  const gov = tceSp ? getContasGovernador("tce-sp").find((p) => p.data_julgamento) : null;
  const atibaia = getContasPrefeitos("tce-sp", "atibaia");
  const impostos = colecoesAcordaos("tcu").find((c) => c.id === "impostos");

  const destaques = [
    presidente && ultPres
      ? { href: `${BASE_TC}/tcu/contas-do-presidente`, titulo: "Contas do Presidente", texto: `${tituloPresidente(ultPres)}. No Congresso Nacional, a situação de cada exercício.` }
      : null,
    tceSp && gov
      ? { href: `${BASE_TC}/tce-sp/contas-do-governador`, titulo: "Contas do Governador de SP", texto: `${tituloGovernador(gov, tceSp)}. Com a votação na Assembleia Legislativa.` }
      : null,
    atibaia
      ? {
          href: `${BASE_TC}/tce-sp/prefeitos/atibaia`,
          titulo: "Contas do prefeito de Atibaia",
          texto: `${plural(atibaia.itens.length, "exercício", "exercícios")}: ${atibaia.contagens?.com_parecer_em_fonte_aberta ?? 0} com parecer em fonte aberta e ${atibaia.contagens?.sem_fonte_aberta ?? 0} sem fonte aberta.`,
        }
      : null,
    impostos
      ? { href: `${BASE_TC}/tcu/acordaos#impostos`, titulo: "Decisões sobre impostos", texto: `${plural(impostos.itens.length, "acórdão", "acórdãos")} do TCU sobre renúncias e benefícios tributários e a reforma tributária.` }
      : null,
  ].filter((d): d is { href: string; titulo: string; texto: string } => !!d);

  const termos = [TERMOS_TC.tribunalContas, TERMOS_TC.parecerPrevio, TERMOS_TC.julgamentoPolitico, TERMOS_TC.ressalva, TERMOS_TC.alerta, TERMOS_TC.determinacao, TERMOS_TC.acordao, TERMOS_TC.colegiado];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Figurinha nome="lupa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Tribunais de Contas</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-800 lg:text-lg">
          Os tribunais de contas fiscalizam como o dinheiro público é usado. Eles auxiliam o Poder Legislativo nessa fiscalização e
          não fazem parte do Poder Judiciário. Todo ano, analisam as contas do chefe do Poder Executivo e emitem um{" "}
          <strong>parecer prévio</strong>: uma opinião técnica, que pode trazer ressalvas, alertas e recomendações.
        </p>
        <p className="mt-3 text-base leading-relaxed text-gray-800 lg:text-lg">
          O parecer prévio <strong>não é o julgamento final</strong>. Quem julga as contas do Presidente, do Governador e do
          Prefeito é o Poder Legislativo, numa votação própria: é o <strong>julgamento político</strong>. Por isso, cada
          página mostra as duas etapas lado a lado, com o que estava registrado em cada uma na data da coleta.
        </p>
        <p className="mt-3 text-base text-[var(--cor-secundaria)]">Registro dos tribunais atualizado em {formatarDataTc(reg.atualizado_em)}.</p>
      </header>

      <Secao id="quem-julga" titulo="Quem julga as contas de quem">
        <div className="overflow-x-auto" role="region" aria-label="Quem emite o parecer e quem julga" tabIndex={0}>
          <table className="tabela text-base!">
            <thead>
              <tr>
                <th scope="col">Contas do</th>
                <th scope="col">Parecer prévio (opinião técnica)</th>
                <th scope="col">Julgamento político (decisão final)</th>
              </tr>
            </thead>
            <tbody>
              {QUEM_JULGA.map(([a, b, c]) => (
                <tr key={a}>
                  <th scope="row" className="font-semibold">
                    {a}
                  </th>
                  <td>{b}</td>
                  <td>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-800">
          Além do parecer sobre o chefe do Executivo, os tribunais julgam diretamente as contas de quem administra dinheiro
          público (ministérios, secretarias, empresas estatais) e publicam essas decisões em acórdãos.
        </p>
        {presidente?.descricao ? (
          <div className="mt-3 max-w-3xl">
            <Literal fonte="Descrição registrada na coleta das Contas do Presidente">{presidente.descricao}</Literal>
          </div>
        ) : null}
      </Secao>

      {destaques.length ? (
        <Secao id="destaques" titulo="Em destaque">
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {destaques.map((d) => (
              <li key={d.href}>
                <Link href={d.href} className="cartao block min-h-11 hover:bg-superficie">
                  <span className="block text-lg font-semibold text-[var(--cor-link)] underline underline-offset-2">{d.titulo}</span>
                  <span className="mt-1 block text-base text-gray-800">{d.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao
        id="tribunais"
        titulo="Os tribunais de contas do Brasil"
        descricao={
          <span className="text-base">
            {plural(reg.itens.length, "tribunal", "tribunais")}: {plural(ativos, "com dados disponíveis", "com dados disponíveis")} e{" "}
            {reg.itens.length - ativos} em breve. Cada um tem uma ficha com o site oficial e as fontes que serão usadas.
          </span>
        }
      >
        {reg.itens.length ? <ListaOrgaos orgaos={reg.itens} /> : <p className="lacuna text-base">O registro dos tribunais de contas ainda não foi coletado.</p>}
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <Termos termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <Fontes fontes={reg.itens.filter((o) => o.situacao_coleta === "ativa").flatMap((o) => o.fontes)} />
      </Secao>
    </div>
  );
}
