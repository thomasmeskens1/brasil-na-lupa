import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cadastroAtivo } from "@/features/conta/config";

export const metadata: Metadata = {
  title: "Não foi possível entrar",
  robots: { index: false, follow: false },
};

const MENSAGENS: Record<string, string> = {
  Verification: "O link de acesso expirou ou já foi usado. Peça um novo link.",
  AccessDenied: "O acesso não foi autorizado. Se entrou com o Google, confira se o e-mail da conta está verificado.",
  OAuthAccountNotLinked: "Este e-mail já está ligado a outra forma de entrar. Use o link por e-mail.",
};
const PADRAO = "Não foi possível concluir a entrada agora. Tente novamente em alguns minutos.";

async function Motivo({ searchParams }: { searchParams: PageProps<"/entrar/erro">["searchParams"] }) {
  const { error } = await searchParams;
  const codigo = typeof error === "string" ? error : "";
  return <p className="text-sm leading-relaxed text-gray-800">{MENSAGENS[codigo] ?? PADRAO}</p>;
}

export default function ErroEntrarPage({ searchParams }: PageProps<"/entrar/erro">) {
  if (!cadastroAtivo()) notFound();
  return (
    <article className="max-w-2xl space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">Não foi possível entrar</h1>
      <Suspense fallback={<p className="text-sm text-gray-800">{PADRAO}</p>}>
        <Motivo searchParams={searchParams} />
      </Suspense>
      <p className="text-sm">
        <Link href="/entrar" className="lk">
          Voltar para Entrar
        </Link>
      </p>
    </article>
  );
}
