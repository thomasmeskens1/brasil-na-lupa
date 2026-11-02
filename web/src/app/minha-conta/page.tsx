import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { revogarConsentimentoAcao, sairAcao } from "@/features/conta/acoes";
import { BOTAO_SECUNDARIO } from "@/features/conta/componentes/estilos";
import { FormPreferencias } from "@/features/conta/componentes/FormPreferencias";
import { TelaConsentimento } from "@/features/conta/componentes/TelaConsentimento";
import { cadastroAtivo } from "@/features/conta/config";
import { obterEstado } from "@/features/conta/dados";
import { obterSql } from "@/features/conta/db";
import { VERSAO_POLITICA } from "@/features/conta/regras";
import { usuarioAtual } from "@/features/conta/sessao";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

const dataBr = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

async function Painel({ searchParams }: { searchParams: PageProps<"/minha-conta">["searchParams"] }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  const estado = await obterEstado(obterSql(), usuario.id);
  if (!estado) redirect("/entrar");

  const { revogado } = await searchParams;
  const consentimentoValido = estado.consentimento?.versao === VERSAO_POLITICA && estado.preferencias;

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-800">
        Conta: <strong className="text-gray-900">{estado.usuario.email}</strong>
      </p>

      {consentimentoValido ? (
        <>
          <section aria-labelledby="prefs-t" className="space-y-3">
            <h2 id="prefs-t" className="text-xl font-bold text-gray-900">
              Preferências
            </h2>
            <p className="meta">
              Consentimento dado em {dataBr(estado.consentimento!.aceitoEm)} (Política de Privacidade, versão{" "}
              {estado.consentimento!.versao}).
            </p>
            <FormPreferencias inicial={estado.preferencias!} />
          </section>

          <section aria-labelledby="revogar-t" className="space-y-2 border-t border-borda pt-6">
            <h2 id="revogar-t" className="text-lg font-bold text-gray-900">
              Revogar o consentimento
            </h2>
            <p className="text-sm text-gray-800">
              Apaga agora todas as suas preferências. A conta fica só com o e-mail e é excluída automaticamente em 7
              dias, a menos que você dê um novo consentimento.
            </p>
            <form action={revogarConsentimentoAcao}>
              <button type="submit" className={BOTAO_SECUNDARIO}>
                Revogar consentimento e apagar preferências
              </button>
            </form>
          </section>
        </>
      ) : (
        <TelaConsentimento versao={VERSAO_POLITICA} revogado={revogado === "1"} />
      )}

      <section aria-labelledby="dados-t" className="space-y-3 border-t border-borda pt-6">
        <h2 id="dados-t" className="text-lg font-bold text-gray-900">
          Seus dados
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="/minha-conta/baixar-dados" className="lk" download>
              Baixar meus dados
            </a>{" "}
            <span className="text-gray-800">(arquivo JSON com tudo o que guardamos sobre você)</span>
          </li>
          <li>
            <Link href="/minha-conta/excluir" className="lk" prefetch={false}>
              Excluir minha conta
            </Link>
          </li>
        </ul>
        <form action={sairAcao}>
          <button type="submit" className={BOTAO_SECUNDARIO}>
            Sair
          </button>
        </form>
      </section>
    </div>
  );
}

export default function MinhaContaPage({ searchParams }: PageProps<"/minha-conta">) {
  if (!cadastroAtivo()) notFound();
  return (
    <article className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Minha conta</h1>
      <Suspense fallback={<p className="text-sm text-gray-800">Carregando…</p>}>
        <Painel searchParams={searchParams} />
      </Suspense>
    </article>
  );
}
