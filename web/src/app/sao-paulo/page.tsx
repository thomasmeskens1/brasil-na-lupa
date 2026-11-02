import type { Metadata } from "next";
import { EmConstrucao } from "@/components/EmConstrucao";

export const metadata: Metadata = {
  title: "Estado de São Paulo",
  description: "Leis da Assembleia Legislativa e atos do governador do Estado de São Paulo.",
};

export default function SaoPauloPage() {
  return (
    <EmConstrucao
      titulo="Estado de São Paulo"
      introducao={
        <p>
          Esta seção vai acompanhar as decisões tomadas no Estado de São Paulo pela Assembleia
          Legislativa do Estado de São Paulo (ALESP), formada pelos deputados estaduais, e pelo
          governador.
        </p>
      }
      itens={[
        "Projetos e leis votados pela Assembleia Legislativa, com o tipo de votação e o placar oficial.",
        "O voto de cada deputado estadual, somente quando houver votação nominal registrada oficialmente.",
        "Decretos do governador e as sanções e vetos de leis, com as razões de veto publicadas.",
        "As justificativas registradas em documento oficial para cada decisão.",
      ]}
      fontes={[
        "Assembleia Legislativa do Estado de São Paulo (ALESP)",
        "Diário Oficial do Estado de São Paulo",
        "Secretaria da Fazenda e Planejamento do Estado de São Paulo",
      ]}
    />
  );
}
