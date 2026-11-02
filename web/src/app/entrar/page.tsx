import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { entrarGoogleAcao } from "@/features/conta/acoes";
import { BOTAO_SECUNDARIO } from "@/features/conta/componentes/estilos";
import { FormEntrar } from "@/features/conta/componentes/FormEntrar";
import { cadastroAtivo, googleAtivo } from "@/features/conta/config";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default function EntrarPage() {
  if (!cadastroAtivo()) notFound();
  return (
    <article className="max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Entrar</h1>
        <p className="text-sm leading-relaxed text-gray-800">
          A conta é opcional: todo o conteúdo do site continua aberto, sem cadastro. Com uma conta você pode guardar
          os estados, temas, políticos e itens que quer acompanhar. Não há senha: enviamos um link de acesso para o
          seu e-mail.
        </p>
      </header>

      <FormEntrar />

      {googleAtivo() ? (
        <form action={entrarGoogleAcao} className="space-y-2 border-t border-borda pt-4">
          <p className="text-sm text-gray-800">Ou, se preferir:</p>
          <button type="submit" className={BOTAO_SECUNDARIO}>
            Entrar com Google
          </button>
          <p className="meta">Do Google recebemos apenas o seu e-mail e o seu nome.</p>
        </form>
      ) : null}

      <p className="text-sm text-gray-800">
        No primeiro acesso, pedimos o seu consentimento antes de guardar qualquer preferência. Veja a{" "}
        <Link href="/privacidade#cadastro" className="lk">
          Política de Privacidade
        </Link>
        .
      </p>
    </article>
  );
}
