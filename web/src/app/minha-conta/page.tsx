import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import {
  apagarFavoritosAcao,
  apagarReacoesAcao,
  revogarConsentimentoAcao,
  revogarConsentimentoReacoesAcao,
  sairAcao,
} from "@/features/conta/acoes";
import { BOTAO_SECUNDARIO } from "@/features/conta/componentes/estilos";
import { FormPreferencias } from "@/features/conta/componentes/FormPreferencias";
import { FormTrocaEmail } from "@/features/conta/componentes/FormTrocaEmail";
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

const FEITO: Record<string, string> = {
  "favoritos-apagados": "Todos os seus favoritos foram apagados.",
  "reacoes-apagadas": "Todas as suas reações foram apagadas.",
  "reacoes-revogado": "Consentimento das reações revogado. Suas reações foram apagadas.",
};

async function Painel({ searchParams }: { searchParams: PageProps<"/minha-conta">["searchParams"] }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  const estado = await obterEstado(obterSql(), usuario.id);
  if (!estado) redirect("/entrar");

  const { feito } = await searchParams;
  const aviso = typeof feito === "string" ? FEITO[feito] : undefined;
  const c = estado.consentimento;
  const consentimentoValido = c?.versao === VERSAO_POLITICA && estado.preferencias;

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-800">
        Conta: <strong className="text-gray-900">{estado.usuario.email}</strong> · criada em{" "}
        {dataBr(estado.usuario.criadoEm)}
      </p>
      {aviso ? (
        <p role="status" className="aviso text-sm text-gray-900">
          {aviso}
        </p>
      ) : null}

      {consentimentoValido && c ? (
        <>
          <section aria-labelledby="prefs-t" className="space-y-3">
            <h2 id="prefs-t" className="text-xl font-bold text-gray-900">
              Favoritos e preferências
            </h2>
            <p className="meta">
              Consentimento dado em {dataBr(c.aceitoEm)} (Política de Privacidade, versão {c.versao}).
            </p>
            <FormPreferencias inicial={estado.preferencias!} />
            <form action={apagarFavoritosAcao} className="pt-2">
              <button type="submit" className={BOTAO_SECUNDARIO}>
                Apagar todos os favoritos
              </button>
            </form>
          </section>

          <section aria-labelledby="reacoes-t" className="space-y-2 border-t border-borda pt-6">
            <h2 id="reacoes-t" className="text-lg font-bold text-gray-900">
              Reações (curtir e não curtir)
            </h2>
            {c.reacoesAceitoEm ? (
              <>
                <p className="text-sm text-gray-800">
                  Consentimento específico das reações dado em {dataBr(c.reacoesAceitoEm)}. Os contadores mostram só
                  totais; ninguém vê quem reagiu.
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={apagarReacoesAcao}>
                    <button type="submit" className={BOTAO_SECUNDARIO}>
                      Apagar todas as reações
                    </button>
                  </form>
                  <form action={revogarConsentimentoReacoesAcao}>
                    <button type="submit" className={BOTAO_SECUNDARIO}>
                      Revogar o consentimento das reações
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-800">
                Você ainda não deu o consentimento das reações. Ele é pedido na primeira vez que você curtir ou não curtir
                uma proposta.
              </p>
            )}
          </section>

          <section aria-labelledby="revogar-t" className="space-y-2 border-t border-borda pt-6">
            <h2 id="revogar-t" className="text-lg font-bold text-gray-900">
              Revogar todo o consentimento
            </h2>
            <p className="text-sm text-gray-800">
              Apaga agora favoritos, preferências e reações. A conta fica só com o e-mail e é excluída automaticamente em
              7 dias, a menos que você dê um novo consentimento.
            </p>
            <form action={revogarConsentimentoAcao}>
              <button type="submit" className={BOTAO_SECUNDARIO}>
                Revogar consentimento e apagar favoritos e reações
              </button>
            </form>
          </section>
        </>
      ) : (
        <TelaConsentimento versao={VERSAO_POLITICA} revogado={feito === "revogado"} />
      )}

      <section aria-labelledby="email-t" className="space-y-3 border-t border-borda pt-6">
        <h2 id="email-t" className="text-lg font-bold text-gray-900">
          Corrigir o e-mail
        </h2>
        <FormTrocaEmail />
      </section>

      <section aria-labelledby="dados-t" className="space-y-3 border-t border-borda pt-6">
        <h2 id="dados-t" className="text-lg font-bold text-gray-900">
          Seus dados e seus direitos
        </h2>
        <p className="text-sm text-gray-800">
          Guardamos sobre você só o que aparece nesta página e no arquivo abaixo. Os dados ficam com as empresas que
          prestam o serviço (hospedagem, banco de dados e envio de e-mail), listadas com o país de tratamento na{" "}
          <Link href="/privacidade#cadastro" className="lk">
            Política de Privacidade
          </Link>
          ; não são vendidos nem compartilhados com mais ninguém.
        </p>
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
