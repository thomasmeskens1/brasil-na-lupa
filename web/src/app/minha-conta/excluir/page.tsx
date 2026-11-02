import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { FormExcluir } from "@/features/conta/componentes/FormExcluir";
import { cadastroAtivo } from "@/features/conta/config";
import { usuarioAtual } from "@/features/conta/sessao";

export const metadata: Metadata = {
  title: "Excluir minha conta",
  robots: { index: false, follow: false },
};

async function Confirmacao() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-gray-800">
        A conta <strong className="text-gray-900">{usuario.email}</strong> será apagada do banco de dados na hora,
        junto com o consentimento, as preferências e as sessões abertas. Se quiser uma cópia antes, use{" "}
        <a href="/minha-conta/baixar-dados" className="lk" download>
          Baixar meus dados
        </a>
        .
      </p>
      <FormExcluir />
      <p className="text-sm">
        <Link href="/minha-conta" className="lk">
          Cancelar e voltar para Minha conta
        </Link>
      </p>
    </div>
  );
}

export default function ExcluirContaPage() {
  if (!cadastroAtivo()) notFound();
  return (
    <article className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Excluir minha conta</h1>
      <Suspense fallback={<p className="text-sm text-gray-800">Carregando…</p>}>
        <Confirmacao />
      </Suspense>
    </article>
  );
}
