import type { Metadata } from "next";
import { PaginaLista } from "@/features/congresso/componentes/PaginaLista";

export const metadata: Metadata = {
  title: "Deputados federais",
  description: "Deputados federais em exercício, com partido, estado e os votos registrados em votações nominais da Câmara dos Deputados.",
};

export default function DeputadosPage() {
  return <PaginaLista casa="camara" />;
}
