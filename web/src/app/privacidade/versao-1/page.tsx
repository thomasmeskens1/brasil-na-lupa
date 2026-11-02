import type { Metadata } from "next";
import { Politica } from "@/features/privacidade/Politica";

export const metadata: Metadata = {
  title: "Política de Privacidade — versão 1",
  description: "Versão arquivada da Política de Privacidade, anterior ao cadastro opcional.",
  robots: { index: false, follow: true },
};

export default function PrivacidadeVersao1Page() {
  return <Politica comCadastro={false} arquivada />;
}
