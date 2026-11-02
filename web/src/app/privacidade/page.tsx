import type { Metadata } from "next";
import { cadastroAtivo } from "@/features/conta/config";
import { Politica } from "@/features/privacidade/Politica";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o site trata dados, de acordo com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).",
};

/** Versão 2 (com o item "Cadastro") só quando o cadastro está ativo; sem ele, vale a versão 1. */
export default function PrivacidadePage() {
  return <Politica comCadastro={cadastroAtivo()} />;
}
