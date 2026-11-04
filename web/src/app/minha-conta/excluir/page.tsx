import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Figurinha } from "@/components/marca/Figurinhas";
import { FormExcluir } from "@/features/conta/componentes/FormExcluir";
import { cadastroAtivo } from "@/features/conta/config";
import { usuarioAtual } from "@/features/conta/sessao";

export const metadata: Metadata = {
  title: "Excluir minha conta",
  robots: { index: false, follow: false },
};

async function Confirmacao() {
  await connection();
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  return (
    <div className="bloco-atalho space-y-4">
      <p className="text-sm leading-relaxed">
        <strong>Etapa 2 de 2.</strong> A conta <strong className="break-all">{usuario.email}</strong> será apagada agora,
        sem volta. Isto também apaga:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--cor-secundaria)]">
        <li>os seus favoritos (propostas, políticos, estados e temas) e os alertas escolhidos;</li>
        <li>as suas reações de curtir e não curtir (os totais das páginas são descontados);</li>
        <li>os seus consentimentos e as sessões abertas em outros aparelhos.</li>
      </ul>
      <p className="text-sm text-[var(--cor-secundaria)]">
        Quer guardar uma cópia antes?{" "}
        <a href="/minha-conta/baixar-dados" className="lk" download>
          Baixar meus dados
        </a>
        .
      </p>
      <FormExcluir />
      <p className="text-sm">
        <Link href="/minha-conta" className="lk inline-flex min-h-11 items-center">
          Cancelar e voltar para Minha conta
        </Link>
      </p>
    </div>
  );
}

export default function ExcluirContaPage() {
  if (!cadastroAtivo()) notFound();
  return (
    <article className="max-w-2xl space-y-6">
      <header>
        <Figurinha nome="pino" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Excluir minha conta</h1>
      </header>
      <Suspense fallback={<p className="text-sm text-gray-800">Carregando…</p>}>
        <Confirmacao />
      </Suspense>
    </article>
  );
}
