import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { SeloFonte, destaquesAprovados, formatarData, type ArquivoDestaques, type Destaque } from "@/components/decisao";
import { TextoComSiglas } from "@/components/glossario/TextoComSiglas";

/**
 * Destaques da página inicial: escritos e aprovados por pessoa (dados/titulos/destaques.json),
 * cada frase apoiada em trecho da fonte oficial. Ordem só pela data da decisão, da mais recente
 * para a mais antiga (diretriz 6: o mesmo critério para todos, sem ranking).
 */
function lerDestaques(): Destaque[] {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "titulos", "destaques.json"), "utf8")) as ArquivoDestaques;
    return destaquesAprovados(a).sort((x, y) => y.data.localeCompare(x.data) || x.id.localeCompare(y.id));
  } catch {
    return [];
  }
}

/** Página do item no site; sem página própria, o documento oficial. */
function hrefDestaque(d: Destaque): string {
  const id = encodeURIComponent(d.item_id);
  switch (d.secao) {
    case "icms":
      return `/impostos/icms/${id}`;
    case "camara":
    case "senado":
      return `/congresso/votacoes/${d.secao}/${id}`;
    case "executivo":
      if (d.item_id.startsWith("mpv-")) return `/executivo/medidas-provisorias/${id}`;
      if (d.item_id.startsWith("veto-")) return `/executivo/vetos/${id}`;
      return d.fonte.url;
    case "stf":
      return `/justica/stf/julgamentos/${id}`;
    case "tribunais-contas": {
      const m = /^(tce-[a-z]{2}|tcu)-contas-governador-(\d{4})$/.exec(d.item_id);
      return m ? `/tribunais-de-contas/${m[1]}/contas-do-governador#exercicio-${m[2]}` : d.fonte.url;
    }
    default:
      return d.fonte.url;
  }
}

export function DestaquesInicio() {
  const itens = lerDestaques();
  if (!itens.length) return null;
  return (
    <section aria-labelledby="titulo-destaques">
      <h2 id="titulo-destaques" className="text-2xl">
        Destaques
      </h2>
      <p className="meta mt-1">
        Resumos escritos e revisados por pessoas, frase a frase conferidos no documento oficial. Da decisão mais recente para a
        mais antiga.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {itens.map((d) => {
          const href = hrefDestaque(d);
          const externo = /^https?:\/\//.test(href);
          return (
            <li key={d.id} className="cartao space-y-2">
              <p className="meta">
                {d.fonte.orgao ?? "Órgão não informado"} · {formatarData(d.data)}
              </p>
              <h3 className="text-lg font-bold leading-snug">
                {externo ? (
                  <a href={href} className="lk-titulo" target="_blank" rel="noopener noreferrer">
                    <TextoComSiglas explicar={false}>{d.titulo}</TextoComSiglas>
                    <span className="sr-only"> (abre o documento oficial em nova aba)</span>
                  </a>
                ) : (
                  <Link href={href} className="lk-titulo">
                    <TextoComSiglas explicar={false}>{d.titulo}</TextoComSiglas>
                  </Link>
                )}
              </h3>
              <p className="leading-relaxed">
                <TextoComSiglas texto={d.texto} />
              </p>
              <SeloFonte fonte={{ url: d.fonte.url, titulo: d.fonte.titulo, orgao: d.fonte.orgao, tipo: /\.pdf($|\?)/i.test(d.fonte.url) ? "pdf" : "oficial" }} compacto />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
