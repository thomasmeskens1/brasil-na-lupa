import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Secao } from "@/components/Secao";
import { textoLegivel } from "@/features/comum/texto";
import { Fontes, Termos, Trilha } from "@/features/tribunais-contas/componentes/Basicos";
import { ExercicioPrefeitoItem, tituloPrefeito } from "@/features/tribunais-contas/componentes/Exercicios";
import { getContasPrefeitos, getOrgao, getOrgaos, municipiosComContas, ouMarcador } from "@/features/tribunais-contas/dados";
import { BASE_TC, TERMOS_TC, formatarDataTc } from "@/features/tribunais-contas/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

/** Municípios com seção própria no site. */
const SECAO_MUNICIPIO: Record<string, string> = { atibaia: "/atibaia" };

export function generateStaticParams() {
  return ouMarcador(
    getOrgaos()
      .itens.filter((o) => o.situacao_coleta === "ativa")
      .flatMap((o) => municipiosComContas(o.id).map((m) => ({ orgao: o.id, municipio: m.id }))),
    { orgao: "sem-dados", municipio: "sem-dados" },
  );
}

export async function generateMetadata({ params }: PageProps<"/tribunais-de-contas/[orgao]/prefeitos/[municipio]">): Promise<Metadata> {
  const { orgao, municipio } = await params;
  const d = getOrgao(orgao) ? getContasPrefeitos(orgao, municipio) : null;
  if (!d) return { title: "Página não encontrada" };
  return {
    title: `Contas do Prefeito de ${d.municipio.nome}`,
    description: `Parecer prévio do tribunal de contas sobre as contas do Prefeito de ${d.municipio.nome}, exercício por exercício, com fonte oficial.`,
  };
}

export default async function ContasPrefeitoPage({ params }: PageProps<"/tribunais-de-contas/[orgao]/prefeitos/[municipio]">) {
  const { orgao, municipio } = await params;
  const o = getOrgao(orgao);
  const d = o ? getContasPrefeitos(orgao, municipio) : null;
  if (!o || !d) notFound();
  const nome = d.municipio.nome;
  const comParecer = d.itens.filter((p) => p.parecer.conclusao);
  const semParecer = d.itens.filter((p) => !p.parecer.conclusao);
  const anos = (l: typeof d.itens) => l.map((p) => p.parecer.exercicio).sort();
  const faixa = (l: string[]) => (l.length ? (l.length > 1 ? `${l[0]} a ${l[l.length - 1]}` : l[0]) : "nenhum");
  const termos = [TERMOS_TC.parecerPrevio, TERMOS_TC.julgamentoPolitico, TERMOS_TC.transito, TERMOS_TC.relator, TERMOS_TC.lai];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Trilha itens={[{ href: `${BASE_TC}/${o.id}`, rotulo: o.id.toUpperCase() }]} />
        <Figurinha nome="lupa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Contas do Prefeito de {nome}</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-800">
          O {o.nome} ({o.id.toUpperCase()}) emite todo ano um parecer prévio sobre as contas do Prefeito de {nome}. O
          julgamento político é feito pela Câmara Municipal.
          {SECAO_MUNICIPIO[municipio] ? (
            <>
              {" "}Veja também a seção{" "}
              <Link href={SECAO_MUNICIPIO[municipio]} className="lk">
                {nome}
              </Link>{" "}
              do site, com leis, decretos e finanças do município.
            </>
          ) : null}
        </p>
        <p className="aviso mt-3 text-base">
          {comParecer.length} {comParecer.length === 1 ? "exercício tem" : "exercícios têm"} parecer em fonte aberta ({faixa(anos(comParecer))}).{" "}
          {semParecer.length ? `${semParecer.length} ${semParecer.length === 1 ? "exercício" : "exercícios"} (${faixa(anos(semParecer))}) não ${semParecer.length === 1 ? "está publicado" : "estão publicados"} em fonte aberta.` : ""}
        </p>
        {d.observacoes?.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-base leading-relaxed text-gray-800">
            {d.observacoes.map((t) => (
              <li key={t}>{textoLegivel(t)}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-base text-[var(--cor-secundaria)]">Dados coletados em {formatarDataTc(d.atualizado_em)}. Exercícios do mais recente para o mais antigo.</p>
      </header>

      <nav aria-label="Exercícios" className="max-w-3xl">
        <h2 className="text-lg font-semibold text-gray-900">Resumo por exercício</h2>
        <ul className="mt-2 grid grid-cols-1 gap-x-6 md:grid-cols-2">
          {d.itens.map((p) => (
            <li key={p.id}>
              <Link href={`#exercicio-${p.parecer.exercicio}`} className="lk inline-flex min-h-11 items-center text-base">
                {tituloPrefeito(p, nome).replace(`Contas do Prefeito de ${nome} de `, "")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ol className="space-y-10" aria-label={`Linha do tempo das contas do Prefeito de ${nome}`}>
        {d.itens.map((p) => (
          <ExercicioPrefeitoItem key={p.id} p={p} o={o} municipio={nome} />
        ))}
      </ol>

      <Secao id="termos" titulo="Termos explicados">
        <Termos termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <Fontes fontes={[...d.fontes, ...o.fontes]} />
      </Secao>
    </div>
  );
}
