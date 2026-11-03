import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FormCodigo } from "@/features/conta/componentes/FormCodigo";
import { cadastroAtivo, COOKIE_LOGIN } from "@/features/conta/config";
import { caminhoDeVolta } from "@/features/conta/ids";
import { normalizarEmail } from "@/features/conta/regras";

export const metadata: Metadata = {
  title: "Digite o código",
  robots: { index: false, follow: false },
};

/** E-mail e caminho de volta guardados no cookie temporário do pedido de código. */
async function Formulario() {
  const valor = (await cookies()).get(COOKIE_LOGIN)?.value ?? "";
  const [e, v] = valor.split("|");
  let email: string | null = null;
  try {
    email = normalizarEmail(decodeURIComponent(e ?? ""));
  } catch {
    email = null;
  }
  return (
    <>
      {email ? (
        <p className="text-sm text-gray-800">
          Código enviado para <strong className="text-gray-900">{email}</strong>.
        </p>
      ) : null}
      <FormCodigo email={email} voltar={caminhoDeVolta(v) ?? "/minha-conta"} />
    </>
  );
}

export default function VerifiquePage() {
  if (!cadastroAtivo()) notFound();
  return (
    <article className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Digite o código</h1>
      <p className="text-sm leading-relaxed text-gray-800">
        Se o endereço estiver correto, você vai receber em instantes um e-mail com um código de 6 dígitos e um link.
        Digite o código abaixo ou, se preferir, clique no link do e-mail. Confira também a caixa de spam.
      </p>
      <Suspense fallback={<p className="text-sm text-gray-800">Carregando…</p>}>
        <Formulario />
      </Suspense>
      <p className="text-sm text-gray-800">
        Não recebeu?{" "}
        <Link href="/entrar" className="lk">
          Pedir um novo código
        </Link>
        .
      </p>
    </article>
  );
}
