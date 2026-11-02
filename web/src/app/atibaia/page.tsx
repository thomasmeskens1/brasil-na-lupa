import type { Metadata } from "next";
import { EmConstrucao } from "@/components/EmConstrucao";

export const metadata: Metadata = {
  title: "Atibaia",
  description: "Decisões da Câmara Municipal e da Prefeitura de Atibaia-SP.",
};

export default function AtibaiaPage() {
  return (
    <EmConstrucao
      titulo="Atibaia (SP)"
      introducao={
        <p>
          Esta seção vai acompanhar as decisões tomadas no município de Atibaia, no Estado de São
          Paulo, pela Câmara Municipal, formada pelos vereadores, e pela Prefeitura.
        </p>
      }
      itens={[
        "Projetos e leis votados pela Câmara Municipal, com o tipo de votação e o resultado oficial.",
        "O voto de cada vereador, somente quando houver votação nominal registrada oficialmente.",
        "Decretos do prefeito e as sanções e vetos de leis, com as razões publicadas.",
        "As justificativas registradas em documento oficial para cada decisão.",
      ]}
      fontes={[
        "Câmara Municipal de Atibaia",
        "Prefeitura de Atibaia",
        "Diário Oficial do Município de Atibaia",
      ]}
    />
  );
}
