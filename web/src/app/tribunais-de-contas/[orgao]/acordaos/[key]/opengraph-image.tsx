import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { resolverTitulo } from "@/components/decisao/rotulos";
import type { DadoChave } from "@/components/decisao/tipos";
import { getAcordao, getOrgao, getOrgaos, keysComPagina, ouMarcador, temAcordaos, tituloSimplesTc } from "@/features/tribunais-contas/dados";
import { BASE_TC, resumoParecerTcu } from "@/features/tribunais-contas/rotulos";

export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Acórdão do tribunal de contas: conclusão ou sumário oficial, quem decidiu e a fonte";

export function generateStaticParams() {
  return ouMarcador(
    getOrgaos()
      .itens.filter((o) => o.situacao_coleta === "ativa" && temAcordaos(o.id))
      .flatMap((o) => keysComPagina(o.id).map((key) => ({ orgao: o.id, key }))),
    { orgao: "sem-dados", key: "sem-dados" },
  );
}

export default async function Image({ params }: { params: Promise<{ orgao: string; key: string }> }) {
  const { orgao, key } = await params;
  const o = getOrgao(orgao);
  const a = o ? getAcordao(orgao, key) : null;
  if (!o || !a) return imagemDecisaoOG({ titulo: "Acórdão não encontrado", caminho: orgao, fonte: { orgao: null } });
  const sigla = o.id.toUpperCase();
  const oficial = `Acórdão ${a.numero} do ${a.orgao ?? "colegiado"} do ${sigla}`;
  const parecer = a.natureza === "parecer-previo" ? a.parecer : null;
  const t = resolverTitulo({
    tituloOficial: parecer?.exercicio
      ? `Contas do ${parecer.contas_de ?? "Presidente da República"} de ${parecer.exercicio}: ${resumoParecerTcu(parecer.conclusao) ?? "parecer prévio"}`
      : oficial,
    simples: tituloSimplesTc(a.id),
    subtituloOficial: parecer ? oficial : null,
  });
  const dado: DadoChave | null = parecer?.conclusao
    ? { tipo: "texto", rotulo: "Conclusão do parecer (texto oficial)", texto: parecer.conclusao }
    : a.sumario
      ? { tipo: "texto", rotulo: "Sumário (texto oficial)", texto: a.sumario }
      : null;
  const f = a.fontes[0];
  return imagemDecisaoOG({
    titulo: t.titulo,
    subtitulo: t.subtitulo,
    caminho: o.id,
    forma: "colegiado",
    data: a.data_julgamento,
    dado,
    fonte: { orgao: f?.orgao ?? o.nome, titulo: f?.titulo ?? null, acessado_em: f?.acessado_em ?? null },
    endereco: `${BASE_TC}/${o.id}/acordaos/${a.id}`,
  });
}
