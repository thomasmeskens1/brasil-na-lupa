/**
 * Comparação "hoje (2026) × a partir de 2027" de todos os impostos. Usa a TabelaResponsiva do
 * site: no computador é tabela; abaixo de 640 px cada linha vira um cartão "Rótulo: valor".
 */
import Link from "next/link";
import { TabelaResponsiva } from "@/components/tabela";
import { IMPOSTOS, esferasPorExtenso } from "../dados";

export function TabelaComparacao() {
  return (
    <TabelaResponsiva
      legenda="Cada imposto hoje (2026) e a partir de 2027"
      legendaOculta
      /* No celular, textos longos: rótulo em cima e texto alinhado à esquerda. */
      className="max-sm:[&_td[data-rotulo]]:flex-col max-sm:[&_td[data-rotulo]]:gap-0.5 max-sm:[&_td[data-rotulo]]:text-left"
      linhas={IMPOSTOS}
      chaveLinha={(i) => i.slug}
      colunas={[
        {
          chave: "imposto",
          rotulo: "Imposto",
          principal: true,
          celula: (i) => (
            <Link href={`/impostos/${i.slug}`} className="lk">
              {i.sigla}
            </Link>
          ),
        },
        { chave: "quem", rotulo: "Quem cobra", celula: (i) => esferasPorExtenso(i.esferas) },
        { chave: "hoje", rotulo: "Hoje (2026)", celula: (i) => i.hoje },
        { chave: "depois", rotulo: "A partir de 2027", celula: (i) => i.depois2027 },
      ]}
    />
  );
}
