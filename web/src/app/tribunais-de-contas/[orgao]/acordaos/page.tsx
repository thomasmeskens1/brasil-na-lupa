import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Secao } from "@/components/Secao";
import { Fontes, Lacunas, Termos, Trilha } from "@/features/tribunais-contas/componentes/Basicos";
import { BuscaAcordaos } from "@/features/tribunais-contas/componentes/BuscaAcordaos";
import { anosAcordaos, colecoesAcordaos, getMetaTcu, getOrgao, getOrgaos, getResumoAcordaos, keysComPagina, ouMarcador, temAcordaos } from "@/features/tribunais-contas/dados";
import { BASE_TC, TERMOS_TC, formatarDataTc, nomeProprio } from "@/features/tribunais-contas/rotulos";

export function generateStaticParams() {
  return ouMarcador(
    getOrgaos()
      .itens.filter((o) => o.situacao_coleta === "ativa" && temAcordaos(o.id))
      .map((o) => ({ orgao: o.id })),
    { orgao: "sem-dados" },
  );
}

export async function generateMetadata({ params }: PageProps<"/tribunais-de-contas/[orgao]/acordaos">): Promise<Metadata> {
  const { orgao } = await params;
  const o = getOrgao(orgao);
  if (!o || !temAcordaos(orgao)) return { title: "Página não encontrada" };
  return { title: `Acórdãos do ${o.id.toUpperCase()}`, description: `Busca nos acórdãos do ${o.nome} e as decisões sobre impostos, com link para o documento oficial.` };
}

/** Ordem de exibição das coleções: impostos primeiro (destaque da seção), depois as demais. */
const ORDEM = ["impostos", "contas-do-presidente"];
const TITULO_COLECAO: Record<string, string> = { impostos: "Decisões sobre impostos", "contas-do-presidente": "Contas do Presidente da República" };

export default async function AcordaosPage({ params }: PageProps<"/tribunais-de-contas/[orgao]/acordaos">) {
  const { orgao } = await params;
  const o = getOrgao(orgao);
  if (!o || !temAcordaos(orgao)) notFound();
  const meta = getMetaTcu(orgao);
  const anos = anosAcordaos(orgao);
  const resumo = getResumoAcordaos(orgao);
  const posicao = (id: string) => (ORDEM.includes(id) ? ORDEM.indexOf(id) : ORDEM.length);
  const colecoes = colecoesAcordaos(orgao).sort((a, b) => posicao(a.id) - posicao(b.id));
  const porAno = meta?.contagens?.por_ano ?? {};
  const termos = [TERMOS_TC.acordao, TERMOS_TC.acordaoRelacao, TERMOS_TC.sumario, TERMOS_TC.colegiado, TERMOS_TC.plenarioCamaras, TERMOS_TC.relator, TERMOS_TC.transito];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Trilha itens={[{ href: `${BASE_TC}/${o.id}`, rotulo: o.id.toUpperCase() }]} />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Acórdãos do {o.id.toUpperCase()}</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-800">
          Acórdão é a decisão tomada por um colegiado do {o.nome}: o Plenário ou uma das Câmaras. Aqui estão todos os acórdãos
          publicados na fonte oficial desde {anos[anos.length - 1] ?? "o início da coleta"}, com número, colegiado, data,
          relator e sumário, e uma seleção com página própria.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-base text-gray-800">
          {Object.entries(porAno)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([ano, c]) => (
              <li key={ano}>
                {ano}: {c.total.toLocaleString("pt-BR")} acórdãos
                {c.por_colegiado
                  ? ` (${Object.entries(c.por_colegiado)
                      .map(([k, n]) => `${k}: ${n.toLocaleString("pt-BR")}`)
                      .join("; ")})`
                  : ""}
              </li>
            ))}
        </ul>
        <p className="mt-3 text-base text-[#3e4c59]">Dados coletados em {formatarDataTc(meta?.atualizado_em)}.</p>
      </header>

      {colecoes.map((c) => (
        <Secao key={c.id} id={c.id} titulo={TITULO_COLECAO[c.id] ?? c.titulo} descricao={<span className="text-base">{c.titulo}: {c.itens.length} {c.itens.length === 1 ? "acórdão" : "acórdãos"}, do mais recente para o mais antigo.</span>}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {c.itens.map((i) => (
              <li key={i.id}>
                <Link href={`${BASE_TC}/${o.id}/acordaos/${i.id}`} className="cartao block min-h-11 hover:bg-superficie">
                  <span className="block text-base font-semibold text-[#234a73] underline underline-offset-2">
                    Acórdão {i.numero} — {i.orgao}
                  </span>
                  <span className="mt-1 block text-base text-gray-800">
                    Julgado em {formatarDataTc(i.data_julgamento)} · Relator: {nomeProprio(i.relator)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      ))}

      <Secao
        id="busca"
        titulo="Buscar em todos os acórdãos"
        descricao={
          <span className="text-base">
            A lista de cada ano é baixada pelo seu navegador e a busca roda nele: o que você digita não é enviado a nenhum servidor.
            Cada resultado leva ao acórdão no site do tribunal.
          </span>
        }
      >
        <BuscaAcordaos orgao={o.id} anos={anos} comPagina={keysComPagina(orgao)} />
      </Secao>

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <Lacunas lacunas={[resumo?.lacunas]} />
        {resumo?.anos.some((x) => x.sem_sumario_por_privacidade) ? (
          <p className="mt-3 text-base text-gray-800">
            Sumários omitidos por trazerem nomes ou documentos de particulares em vez do resumo da decisão:{" "}
            {resumo.anos.map((x) => `${x.sem_sumario_por_privacidade} em ${x.ano}`).join("; ")}. Nesses casos, o texto está no documento oficial.
          </p>
        ) : null}
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <Termos termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <Fontes fontes={[...(resumo?.fontes ?? []), ...(meta?.fontes ?? o.fontes)]} />
      </Secao>
    </div>
  );
}
