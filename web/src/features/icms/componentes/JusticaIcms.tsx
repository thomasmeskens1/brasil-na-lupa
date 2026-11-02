import Link from "next/link";
import { Secao } from "@/components/Secao";
import { CartaoDecisao } from "@/components/decisao/CartaoDecisao";
import { tituloSimplesDe } from "@/components/decisao/rotulos";
import type { DadoChave, FonteResumo, TituloSimples } from "@/components/decisao/tipos";
import { ListaRecolhivel } from "@/components/lista/ListaRecolhivel";
import { getIndiceStf, getTemaStf, temasPorColecaoStj } from "@/features/justica/dados";
import { rotuloEtapa, rotuloOrgao, rotuloResultadoJulgamento } from "@/features/justica/rotulos";
import type { TemaStf } from "@/features/justica/tipos";
import { getTitulos } from "../dados";

/** Trecho literal curto para o cartão; o texto inteiro está na página do tema. */
function trecho(t: string, max = 240): string {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

interface CartaoJustica {
  chave: string;
  href: string;
  tituloOficial: string;
  simples: TituloSimples | null;
  subtitulo: string;
  caminho: "stj" | "stf";
  data: string | null;
  dado: DadoChave | null;
  quem: string;
  fonte: FonteResumo | null;
}

function nomeRelator(r: string | null | undefined): string | null {
  if (!r) return null;
  return r === r.toUpperCase() ? rotuloOrgao(r) : r;
}

/** Monta os cartões: temas do STJ e do STF e julgamentos do STF das coleções do ICMS. */
function cartoes(): CartaoJustica[] {
  const titStj = getTitulos("stj");
  const titStf = getTitulos("stf");
  const vistos = new Set<string>();
  const lista: CartaoJustica[] = [];

  for (const { temas } of temasPorColecaoStj()) {
    for (const t of temas) {
      if (vistos.has(`stj-${t.numero}`)) continue;
      vistos.add(`stj-${t.numero}`);
      const tipo = t.tipo_precedente ?? "Tema";
      const relator = nomeRelator(t.relator?.[0]);
      const f = t.fontes?.[0];
      lista.push({
        chave: `stj-${t.numero}`,
        href: `/justica/stj/temas/${t.numero}`,
        tituloOficial: t.questao ? trecho(t.questao, 160) : `${tipo} ${t.numero} do STJ`,
        simples: tituloSimplesDe(titStj, String(t.numero)),
        subtitulo: `${tipo} ${t.numero} do Superior Tribunal de Justiça (STJ)${t.situacao ? ` · situação: ${t.situacao.toLowerCase()}` : ""}`,
        caminho: "stj",
        data: t.datas?.julgamento ?? t.datas?.afetacao ?? null,
        dado: t.tese
          ? { tipo: "texto", rotulo: "Tese firmada (texto oficial)", texto: trecho(t.tese) }
          : { tipo: "texto", rotulo: "Tese", texto: "Ainda sem tese firmada na fonte oficial." },
        quem: [rotuloOrgao(t.orgao), relator ? `relator: ${relator}` : null].filter(Boolean).join(" · "),
        fonte: t.url_oficial
          ? { url: t.url_oficial, titulo: `Tema ${t.numero} no site do STJ`, orgao: "Superior Tribunal de Justiça", acessado_em: f?.acessado_em ?? null }
          : null,
      });
    }
  }

  const indice = getIndiceStf();
  const fonteStf = indice.fonte ? { ...indice.fonte, orgao: indice.fonte.orgao ?? "Supremo Tribunal Federal" } : null;
  const temasStf = indice.com_pagina
    .map(getTemaStf)
    .filter((t): t is TemaStf => !!t && (t.colecoes ?? []).some((c) => c.startsWith("icms")));
  for (const t of temasStf) {
    lista.push({
      chave: `stf-tema-${t.numero}`,
      href: `/justica/stf/temas/${t.numero}`,
      tituloOficial: t.titulo ? trecho(t.titulo, 160) : `Tema ${t.numero} de repercussão geral do STF`,
      simples: tituloSimplesDe(titStf, String(t.numero)),
      subtitulo: `Tema ${t.numero} de repercussão geral do Supremo Tribunal Federal (STF)`,
      caminho: "stf",
      data: t.data_tese ?? t.situacao?.data_andamento ?? null,
      dado: t.tese
        ? { tipo: "texto", rotulo: "Tese firmada (texto oficial)", texto: trecho(t.tese) }
        : { tipo: "texto", rotulo: "Andamento (texto oficial)", texto: t.situacao?.andamento ?? "Sem tese firmada na fonte oficial." },
      quem: ["Plenário do STF", nomeRelator(t.relator) ? `relator: ${nomeRelator(t.relator)}` : null].filter(Boolean).join(" · "),
      fonte: t.url ? { url: t.url, titulo: `Tema ${t.numero} no site do STF`, orgao: "Supremo Tribunal Federal", acessado_em: t.atualizado_em ?? fonteStf?.acessado_em ?? null } : fonteStf,
    });
  }

  for (const j of indice.julgamentos.filter((x) => (x.colecoes ?? []).some((c) => c.startsWith("icms")))) {
    const resultado = (j.resultados ?? [])
      .map((r) => `${rotuloEtapa(r.parte ?? null)}: ${(rotuloResultadoJulgamento(r.resultado) ?? "resultado não informado").toLowerCase()}`)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(" · ");
    lista.push({
      chave: `stf-julg-${j.id}`,
      href: `/justica/stf/julgamentos/${j.id}`,
      tituloOficial: `Julgamento do STF: ${j.identificacao ?? j.id}${j.tema ? ` (Tema ${j.tema} de repercussão geral)` : ""}`,
      simples: tituloSimplesDe(titStf, j.id),
      subtitulo: j.ambiente === "virtual" ? "Plenário Virtual do Supremo Tribunal Federal (STF)" : "Supremo Tribunal Federal (STF)",
      caminho: "stf",
      data: j.data_julgamento ?? null,
      dado: resultado ? { tipo: "texto", rotulo: "Resultado registrado na certidão", texto: resultado } : null,
      quem: ["Plenário do STF", nomeRelator(j.relator) ? `relator: ${nomeRelator(j.relator)}` : null].filter(Boolean).join(" · "),
      fonte: fonteStf,
    });
  }

  return lista.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || a.chave.localeCompare(b.chave));
}

/** "O que a Justiça decidiu sobre o ICMS": temas e julgamentos do STJ e do STF em cartões. */
export function JusticaIcms() {
  const lista = cartoes();
  if (!lista.length) return null;
  return (
    <Secao
      id="justica"
      titulo="O que a Justiça decidiu sobre o ICMS"
      descricao={
        <span className="text-base">
          Teses e julgamentos do Superior Tribunal de Justiça (STJ) e do Supremo Tribunal Federal (STF) sobre o ICMS, do mais
          recente para o mais antigo. Cada cartão leva à página com a questão, a tese e o resultado.
        </span>
      }
    >
      <ListaRecolhivel
        rotulo={{ singular: "decisão judicial", plural: "decisões judiciais" }}
        inicial={6}
        className="grid grid-cols-1 gap-3 lg:grid-cols-2"
        itens={lista.map((c) => (
          <CartaoDecisao
            key={c.chave}
            as="div"
            href={c.href}
            tituloOficial={c.tituloOficial}
            simples={c.simples}
            subtituloOficial={c.subtitulo}
            caminho={c.caminho}
            data={c.data}
            forma="julgamento"
            dado={c.dado}
            quemDecidiu={c.quem}
            fonte={c.fonte}
            className="h-full"
          />
        ))}
      />
      <p className="mt-3">
        <Link href="/justica" className="lk inline-flex min-h-11 items-center">
          Ver a seção Justiça
        </Link>
      </p>
    </Secao>
  );
}
