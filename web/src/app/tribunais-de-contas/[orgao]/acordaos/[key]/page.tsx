import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { Ficha, Fontes, Lacunas, Literal, Termos, Trilha } from "@/features/tribunais-contas/componentes/Basicos";
import { JulgamentoCongressoBloco } from "@/features/tribunais-contas/componentes/JulgamentoPolitico";
import { colecoesAcordaos, getAcordao, getOrgao, getOrgaos, keysComPagina, ouMarcador, temAcordaos } from "@/features/tribunais-contas/dados";
import { BASE_TC, NAO_DISPONIVEL, TERMOS_TC, formatarDataTc, nomeProprio, resumoParecerTcu } from "@/features/tribunais-contas/rotulos";
import type { AcordaoTcu } from "@/features/tribunais-contas/tipos";

export function generateStaticParams() {
  return ouMarcador(
    getOrgaos()
      .itens.filter((o) => o.situacao_coleta === "ativa" && temAcordaos(o.id))
      .flatMap((o) => keysComPagina(o.id).map((key) => ({ orgao: o.id, key }))),
    { orgao: "sem-dados", key: "sem-dados" },
  );
}

const COLECAO: Record<string, string> = { impostos: "Decisões sobre impostos", "contas-do-presidente": "Contas do Presidente da República" };

function titulo(a: AcordaoTcu, sigla: string): string {
  return `Acórdão ${a.numero} do ${a.orgao ?? "colegiado"} do ${sigla}`;
}

export async function generateMetadata({ params }: PageProps<"/tribunais-de-contas/[orgao]/acordaos/[key]">): Promise<Metadata> {
  const { orgao, key } = await params;
  const o = getOrgao(orgao);
  const a = o ? getAcordao(orgao, key) : null;
  if (!o || !a) return { title: "Acórdão não encontrado" };
  return { title: titulo(a, o.id.toUpperCase()), description: a.sumario?.slice(0, 200) ?? undefined };
}

export default async function AcordaoPage({ params }: PageProps<"/tribunais-de-contas/[orgao]/acordaos/[key]">) {
  const { orgao, key } = await params;
  const o = getOrgao(orgao);
  const a = o ? getAcordao(orgao, key) : null;
  if (!o || !a) notFound();
  const sigla = o.id.toUpperCase();
  const parecer = a.natureza === "parecer-previo" ? a.parecer : null;
  const colecoes = colecoesAcordaos(orgao).filter((c) => c.itens.some((i) => i.id === a.id));
  const termos = [
    TERMOS_TC.acordao,
    TERMOS_TC.sumario,
    TERMOS_TC.plenarioCamaras,
    TERMOS_TC.relator,
    ...(parecer ? [TERMOS_TC.parecerPrevio, TERMOS_TC.julgamentoPolitico, TERMOS_TC.cmo] : []),
  ];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Trilha
          itens={[
            { href: `${BASE_TC}/${o.id}`, rotulo: sigla },
            { href: `${BASE_TC}/${o.id}/acordaos`, rotulo: "Acórdãos" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">{titulo(a, sigla)}</h1>
        <p className="mt-2 text-base text-[#3e4c59]">
          {parecer ? `Parecer prévio sobre as contas do ${parecer.contas_de ?? "Presidente da República"} de ${parecer.exercicio ?? "exercício não informado"}` : "Decisão colegiada"}
          {colecoes.length ? ` · ${colecoes.map((c) => COLECAO[c.id] ?? c.titulo).join(" · ")}` : ""}
        </p>
      </header>

      {a.sumario ? (
        <Secao id="sumario" titulo="Sumário (texto oficial)">
          <div className="max-w-3xl">
            <Literal>{a.sumario}</Literal>
          </div>
        </Secao>
      ) : null}

      <Secao id="ficha" titulo="Quem decidiu e quando">
        <Ficha
          itens={[
            ["Colegiado", a.orgao ?? NAO_DISPONIVEL],
            ["Relator", nomeProprio(a.relator)],
            ["Data da sessão", formatarDataTc(a.data_julgamento)],
            ["Ata", a.ata ?? NAO_DISPONIVEL],
            ["Tipo", a.tipo === "ACÓRDÃO" ? "Acórdão" : (a.tipo ?? NAO_DISPONIVEL)],
            ["Situação na fonte", a.situacao ? a.situacao.charAt(0) + a.situacao.slice(1).toLowerCase() : NAO_DISPONIVEL],
            ["Caminho da decisão", "Decisão de órgão colegiado do tribunal"],
            ["Resultado (unanimidade ou maioria)", NAO_DISPONIVEL],
            ["Ministros presentes e vencidos", NAO_DISPONIVEL],
            ["Publicação", formatarDataTc(a.data_publicacao)],
          ]}
        />
        {a.documentos.length ? (
          <ul className="mt-4 space-y-2">
            {a.documentos.map((d) => (
              <li key={d.url} className="inline-flex min-h-11 items-center">
                <FonteLink href={d.url} tipo="pdf" className="text-base!">
                  {d.titulo}
                </FonteLink>
              </li>
            ))}
          </ul>
        ) : null}
      </Secao>

      {parecer ? (
        <Secao id="parecer" titulo="Conclusão do parecer prévio">
          <div className="max-w-3xl space-y-3">
            {parecer.conclusao ? <Literal fonte="Texto oficial">{parecer.conclusao}</Literal> : <p className="lacuna text-base">{NAO_DISPONIVEL}</p>}
            {parecer.exercicio ? (
              <p className="text-base">
                <Link href={`${BASE_TC}/${o.id}/contas-do-presidente#exercicio-${parecer.exercicio}`} className="lk inline-flex min-h-11 items-center">
                  Ver as ressalvas, os alertas e o julgamento no Congresso ({resumoParecerTcu(parecer.conclusao) ?? "contas"} de {parecer.exercicio})
                </Link>
              </p>
            ) : null}
          </div>
        </Secao>
      ) : null}

      {parecer && a.julgamento_politico ? (
        <Secao id="julgamento-politico" titulo="Julgamento político: Congresso Nacional">
          <div className="max-w-3xl">
            <JulgamentoCongressoBloco jp={a.julgamento_politico} />
          </div>
        </Secao>
      ) : null}

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <Lacunas lacunas={[a.lacunas]} />
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <Termos termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <Fontes fontes={[...a.fontes, a.julgamento_politico?.fonte]} />
      </Secao>
    </div>
  );
}
