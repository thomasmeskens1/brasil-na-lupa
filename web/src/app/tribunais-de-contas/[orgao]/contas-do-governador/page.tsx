import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Secao } from "@/components/Secao";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { textoLegivel } from "@/features/comum/texto";
import { Fontes, Termos, Trilha } from "@/features/tribunais-contas/componentes/Basicos";
import { ExercicioGovernadorItem, tituloGovernador } from "@/features/tribunais-contas/componentes/Exercicios";
import { getContasGovernador, getMetaTce, getOrgao, getOrgaos, ouMarcador, temContasGovernador } from "@/features/tribunais-contas/dados";
import { BASE_TC, TERMOS_TC, formatarDataTc } from "@/features/tribunais-contas/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";
import { getUf } from "@/features/estados/ufs";

export function generateStaticParams() {
  return ouMarcador(
    getOrgaos()
      .itens.filter((o) => o.situacao_coleta === "ativa" && temContasGovernador(o.id))
      .map((o) => ({ orgao: o.id })),
    { orgao: "sem-dados" },
  );
}

export async function generateMetadata({ params }: PageProps<"/tribunais-de-contas/[orgao]/contas-do-governador">): Promise<Metadata> {
  const { orgao } = await params;
  const o = getOrgao(orgao);
  if (!o || !temContasGovernador(orgao)) return { title: "Página não encontrada" };
  const p = getContasGovernador(orgao).find((x) => x.parecer.conclusao);
  return metadadosCompartilhamento({
    titulo: p ? tituloGovernador(p, o) : `Contas do Governador${o.uf ? ` de ${o.uf}` : ""}`,
    descricao: [`Parecer prévio do ${o.nome} e julgamento pela ${getUf(o.uf)?.casa.nome ?? "Assembleia Legislativa"}`, p?.coletado_em ? `coletado em ${formatarDataTc(p.coletado_em)}` : null],
    caminho: `${BASE_TC}/${orgao}/contas-do-governador`,
  });
}

export default async function ContasGovernadorPage({ params }: PageProps<"/tribunais-de-contas/[orgao]/contas-do-governador">) {
  const { orgao } = await params;
  const o = getOrgao(orgao);
  const lista = o ? getContasGovernador(orgao) : [];
  if (!o || !lista.length) notFound();
  const meta = getMetaTce(orgao);
  const sp = o.uf === "SP";
  // Nome da casa que julga as contas (no DF, a Câmara Legislativa), pelo cadastro das UFs.
  const casaUf = getUf(o.uf)?.casa;
  const casa = sp ? "Assembleia Legislativa do Estado de São Paulo (ALESP)" : (casaUf?.nome ?? "Assembleia Legislativa");
  const siglaCasa = sp ? "ALESP" : (casaUf?.sigla ?? "Assembleia Legislativa");
  const termos = [
    TERMOS_TC.parecerPrevio,
    TERMOS_TC.julgamentoPolitico,
    TERMOS_TC.ressalva,
    TERMOS_TC.determinacao,
    TERMOS_TC.tribunalPleno,
    TERMOS_TC.relator,
    TERMOS_TC.conselheiroSubstituto,
    TERMOS_TC.quorum,
    TERMOS_TC.ministerioPublicoContas,
    TERMOS_TC.pdl,
  ];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Trilha itens={[{ href: `${BASE_TC}/${o.id}`, rotulo: o.id.toUpperCase() }]} />
        <Figurinha nome="lupa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Contas do Governador{o.uf ? ` de ${o.uf}` : ""}</h1>
        <p className="mt-2 text-base leading-relaxed text-gray-800">
          O parecer prévio do {o.nome} ({o.id.toUpperCase()}) e o julgamento pela {casa}, exercício por exercício.
        </p>
        <p className="mt-2 text-base text-[var(--cor-secundaria)]">
          Dados coletados em {formatarDataTc(meta?.atualizado_em ?? lista[0].coletado_em)}. Do mais recente para o mais antigo.
        </p>
        <details className="mt-3 rounded-md border border-borda bg-white">
          <summary className="pr-3">Como as contas do Governador são julgadas</summary>
          <p className="border-t border-borda px-3 pb-3 pt-2 text-base leading-relaxed text-gray-800">
            O {o.nome} ({o.id.toUpperCase()}) analisa todo ano as contas do Governador e emite um parecer prévio, votado pelo
            Tribunal Pleno. O julgamento político é feito depois pela {siglaCasa}, que vota um Projeto de
            Decreto Legislativo (PDL) sobre as contas
            {sp ? (
              <>
                ; as votações aparecem também na seção{" "}
                <Link href="/estados/sp/votacoes" className="lk">
                  votações da ALESP
                </Link>
              </>
            ) : null}
            .
          </p>
        </details>
      </header>

      <nav aria-label="Exercícios" className="max-w-3xl">
        <ul className="flex flex-wrap gap-2">
          {lista.map((p) => (
            <li key={p.id}>
              <Link href={`#exercicio-${p.parecer.exercicio}`} className="botao">
                {p.parecer.exercicio}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ol className="space-y-12" aria-label="Linha do tempo das contas do Governador">
        {lista.map((p) => (
          <ExercicioGovernadorItem key={p.id} p={p} o={o} />
        ))}
      </ol>

      {meta?.observacoes?.length ? (
        <Secao id="como" titulo="Como os dados foram lidos">
          <ul className="max-w-3xl list-disc space-y-2 pl-5 text-base leading-relaxed text-gray-800">
            {meta.observacoes.map((t) => (
              <li key={t}>{textoLegivel(t)}</li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao id="termos" titulo="Termos explicados">
        <Termos termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <Fontes fontes={[...(meta?.fontes ?? []), ...o.fontes]} />
      </Secao>
    </div>
  );
}
