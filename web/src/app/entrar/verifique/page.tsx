import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cadastroAtivo } from "@/features/conta/config";

export const metadata: Metadata = {
  title: "Verifique seu e-mail",
  robots: { index: false, follow: false },
};

export default function VerifiquePage() {
  if (!cadastroAtivo()) notFound();
  return (
    <article className="max-w-2xl space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">Verifique seu e-mail</h1>
      <p className="text-sm leading-relaxed text-gray-800">
        Se o endereço informado estiver correto, você vai receber em instantes uma mensagem com o link de acesso. O
        link vale por 1 hora e só pode ser usado uma vez. Confira também a caixa de spam.
      </p>
      <p className="text-sm text-gray-800">
        Não recebeu?{" "}
        <Link href="/entrar" className="lk">
          Pedir um novo link
        </Link>
        .
      </p>
    </article>
  );
}
