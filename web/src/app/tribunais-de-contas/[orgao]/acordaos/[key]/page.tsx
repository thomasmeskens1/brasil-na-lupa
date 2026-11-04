import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { TextoComSiglas } from "@/components/glossario";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { CabecalhoDecisao } from "@/components/decisao/CabecalhoDecisao";
import { resolverTitulo } from "@/components/decisao/rotulos";
import type { DadoChave, FonteResumo } from "@/components/decisao/tipos";
import { Ficha, Fontes, Lacunas, Literal, Termos, Trilha } from "@/features/tribunais-contas/componentes/Basicos";
import { JulgamentoCongressoBloco } from "@/features/tribunais-contas/componentes/JulgamentoPolitico";
import { colecoesAcordaos, getAcordao, getOrgao, getOrgaos, keysComPagina, ouMarcador, temAcordaos, tituloSimplesTc } from "@/features/tribunais-contas/dados";
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

/** Cabeçalho "resposta primeiro": título, conclusão (parecer) ou sumário literal, quem decidiu e fonte. */
function resumo(a: AcordaoTcu, sigla: string) {
  const parecer = a.natureza === "parecer-previo" ? a.parecer : null;
  const tituloOficial = parecer?.exercicio
    ? `Contas do ${parecer.contas_de ?? "Presidente da República"} de ${parecer.exercicio}: ${resumoParecerTcu(parecer.conclusao) ?? "parecer prévio"}`
    : titulo(a, sigla);
  const t = resolverTitulo({ tituloOficial, simples: tituloSimplesTc(a.id), subtituloOficial: parecer ? titulo(a, sigla) : null });
  const dado: DadoChave | null = parecer?.conclusao
    ? { tipo: "texto", rotulo: "Conclusão do parecer (texto oficial)", texto: parecer.conclusao }
    : a.sumario
      ? { tipo: "texto", rotulo: "Sumário (texto oficial)", texto: a.sumario.length > 320 ? `${a.sumario.slice(0, 319).trimEnd()}…` : a.sumario }
      : null;
  const f = a.fontes[0];
  const fonte: FonteResumo | null = f?.url ? { url: f.url, titulo: f.titulo, orgao: f.orgao ?? "Tribunal de Contas da União", acessado_em: f.acessado_em ?? null } : null;
  return { t, tituloOficial, dado, fonte, quem: `${a.orgao ?? "Colegiado"} do ${sigla} · relator: ${nomeProprio(a.relator)}` };
}

export async function generateMetadata({ params }: PageProps<"/tribunais-de-contas/[orgao]/acordaos/[key]">): Promise<Metadata> {
  const { orgao, key } = await params;
  const o = getOrgao(orgao);
  const a = o ? getAcordao(orgao, key) : null;
  if (!o || !a) return { title: "Acórdão não encontrado" };
  const r = resumo(a, o.id.toUpperCase());
  return metadadosCompartilhamento({
    titulo: r.t.titulo,
    descricao: [r.t.subtitulo, `Fonte: ${r.fonte?.orgao ?? o.nome}`, r.fonte?.acessado_em ? `coletado em ${formatarDataTc(r.fonte.acessado_em)}` : null],
    caminho: `${BASE_TC}/${o.id}/acordaos/${a.id}`,
  });
}

export default async function AcordaoPage({ params }: PageProps<"/tribunais-de-contas/[orgao]/acordaos/[key]">) {
  const { orgao, key } = await params;
  const o = getOrgao(orgao);
  const a = o ? getAcordao(orgao, key) : null;
  if (!o || !a) notFound();
  const sigla = o.id.toUpperCase();
  const r = resumo(a, sigla);
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
      <div className="max-w-3xl">
        <Trilha
          itens={[
            { href: `${BASE_TC}/${o.id}`, rotulo: sigla },
            { href: `${BASE_TC}/${o.id}/acordaos`, rotulo: "Acórdãos" },
          ]}
        />
        <CabecalhoDecisao
          className="mt-2"
          tituloOficial={r.tituloOficial}
          simples={tituloSimplesTc(a.id)}
          subtituloOficial={parecer ? titulo(a, sigla) : colecoes.map((c) => COLECAO[c.id] ?? c.titulo).join(" · ") || null}
          caminho={o.id}
          data={a.data_julgamento}
          forma="colegiado"
          dado={r.dado}
          quemDecidiu={r.quem}
          fontePrincipal={r.fonte}
          url={`${BASE_TC}/${o.id}/acordaos/${a.id}`}
          atalhos={[
            ...(a.sumario ? [{ href: "#sumario", rotulo: "Sumário" }] : []),
            ...(parecer && a.julgamento_politico ? [{ href: "#julgamento-politico", rotulo: "Julgamento no Congresso" }] : []),
            { href: "#fontes", rotulo: "Fontes" },
          ]}
        />
      </div>

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
                  <TextoComSiglas explicar={false}>{d.titulo}</TextoComSiglas>
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
