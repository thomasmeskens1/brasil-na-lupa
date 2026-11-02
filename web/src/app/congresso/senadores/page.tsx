import type { Metadata } from "next";
import { PaginaLista } from "@/features/congresso/componentes/PaginaLista";

export const metadata: Metadata = {
  title: "Senadores",
  description: "Senadores em exercício, com partido, estado e os votos registrados em votações nominais do Senado Federal.",
};

export default function SenadoresPage() {
  return <PaginaLista casa="senado" />;
}
