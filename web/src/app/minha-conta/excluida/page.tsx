import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cadastroAtivo } from "@/features/conta/config";

export const metadata: Metadata = {
  title: "Conta excluída",
  robots: { index: false, follow: false },
};

export default function ContaExcluidaPage() {
  if (!cadastroAtivo()) notFound();
  return (
    <article className="max-w-2xl space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">Conta excluída</h1>
      <p className="text-sm leading-relaxed text-gray-800">
        Sua conta, o consentimento, as preferências, os favoritos e as reações foram apagados do nosso banco de dados. Todo o conteúdo do site
        continua disponível sem cadastro.
      </p>
      <p className="text-sm">
        <Link href="/" className="lk">
          Ir para o início
        </Link>
      </p>
    </article>
  );
}
