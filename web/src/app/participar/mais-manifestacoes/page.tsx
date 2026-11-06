import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cadastroAtivo } from "@/features/conta/config";
import { MINIMO_PESSOAS } from "@/features/conta/manifestacoes";
import { MaisManifestacoes } from "@/features/participacao/MaisManifestacoes";

export const metadata: Metadata = {
  title: "Propostas com mais manifestações",
  description:
    "As propostas com mais reações de curtir e não curtir de quem tem conta no site, no Brasil ou por estado. Só totais, a partir de 10 pessoas.",
};

/** Página estática; a lista é carregada no navegador e só para quem tem conta (Política de Privacidade, item 9.2). */
export default function MaisManifestacoesPage() {
  if (!cadastroAtivo()) notFound();
  return (
    <article className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Propostas com mais manifestações</h1>
        <p className="mt-2">
          As propostas com mais reações de curtir e não curtir de quem tem conta no site. A ordem segue um critério único e
          público: o número de reações, com curtir e não curtir somados e o mesmo peso para os dois lados. Só entram
          propostas com {MINIMO_PESSOAS} pessoas ou mais.
        </p>
        <p className="meta mt-2">
          É opinião de usuários do site, não pesquisa nem dado oficial: mostra só quem quis participar. Ninguém vê quem
          reagiu. Para o seu pedido chegar oficialmente ao Congresso, use também a consulta do Senado e a enquete da Câmara
          de cada proposta (
          <Link href="/participar" className="lk">
            como participar pelos canais oficiais
          </Link>
          ).
        </p>
      </header>
      <MaisManifestacoes />
    </article>
  );
}
