import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { Figurinha, type NomeFigurinha } from "@/components/marca/Figurinhas";
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
import { MeusFavoritos } from "@/features/conta/componentes/MeusFavoritos";
import { MinhasReacoes } from "@/features/conta/componentes/MinhasReacoes";
import { TelaConsentimento } from "@/features/conta/componentes/TelaConsentimento";
import { cadastroAtivo } from "@/features/conta/config";
import { listarReacoes, obterEstado } from "@/features/conta/dados";
import { obterSql } from "@/features/conta/db";
import { VERSAO_POLITICA } from "@/features/conta/regras";
import { usuarioAtual } from "@/features/conta/sessao";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

const dataBr = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const dataHoraBr = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

const FEITO: Record<string, string> = {
  "favoritos-apagados": "Todos os seus favoritos foram apagados.",
  "reacoes-apagadas": "Todas as suas reações foram apagadas.",
  "reacoes-revogado": "Consentimento das reações revogado. Suas reações foram apagadas.",
};

/** Bloco de seção no visual dos atalhos da página inicial. */
function Bloco({ id, titulo, figurinha, children }: { id: string; titulo: string; figurinha: NomeFigurinha; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="bloco-atalho scroll-mt-24 space-y-4">
      <div className="flex items-center gap-3">
        <Figurinha nome={figurinha} className="h-12 w-12 shrink-0" />
        <h2 id={`${id}-t`} className="font-titulo text-2xl font-extrabold">
          {titulo}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Atalho({ href, titulo, texto, figurinha }: { href: string; titulo: string; texto: string; figurinha: NomeFigurinha }) {
  return (
    <li>
      <a href={href} className="bloco-atalho group h-full">
        <Figurinha nome={figurinha} className="figurinha-flutua h-10 w-10" />
        <span className="mt-2 block font-titulo text-lg font-extrabold">{titulo}</span>
        <span className="mt-1 block text-sm text-[var(--cor-secundaria)]">{texto}</span>
        <span className="seta-atalho" aria-hidden="true">
          ↓
        </span>
      </a>
    </li>
  );
}

async function Painel({ searchParams }: { searchParams: PageProps<"/minha-conta">["searchParams"] }) {
  await connection();
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  const sql = obterSql();
  const [estado, reacoes] = await Promise.all([obterEstado(sql, usuario.id), listarReacoes(sql, usuario.id)]);
  if (!estado) redirect("/entrar");

  const { feito } = await searchParams;
  const aviso = typeof feito === "string" ? FEITO[feito] : undefined;
  const c = estado.consentimento;
  const prefs = estado.preferencias;
  const consentimentoValido = c?.versao === VERSAO_POLITICA && prefs;

  const dados = (
    <Bloco id="dados" titulo="Meus dados" figurinha="pessoas">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">E-mail da conta</dt>
          <dd className="break-all text-[var(--cor-secundaria)]">{estado.usuario.email}</dd>
        </div>
        <div>
          <dt className="font-semibold">Conta criada em</dt>
          <dd className="text-[var(--cor-secundaria)]">{dataBr(estado.usuario.criadoEm)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Consentimento para favoritos</dt>
          <dd className="text-[var(--cor-secundaria)]">
            {c ? `Dado em ${dataHoraBr(c.aceitoEm)} (Política de Privacidade, versão ${c.versao})` : "Não dado"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Consentimento para reações</dt>
          <dd className="text-[var(--cor-secundaria)]">
            {c?.reacoesAceitoEm ? `Dado em ${dataHoraBr(c.reacoesAceitoEm)}` : "Não dado (é pedido na primeira reação)"}
          </dd>
        </div>
      </dl>

      <details className="rounded-md border border-borda px-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">Trocar o e-mail</summary>
        <div className="pb-3">
          <p className="meta mb-3">Enviamos um código de 6 dígitos para o e-mail novo. A troca só vale depois do código.</p>
          <FormTrocaEmail />
        </div>
      </details>

      <div className="space-y-2">
        <h3 className="text-lg font-bold">Baixar meus dados</h3>
        <p className="text-sm text-[var(--cor-secundaria)]">
          Um arquivo com tudo o que guardamos sobre você: e-mail, datas, consentimentos, favoritos e reações.
        </p>
        <a href="/minha-conta/baixar-dados" className={BOTAO_SECUNDARIO} download>
          Baixar meus dados (arquivo JSON)
        </a>
      </div>

      {consentimentoValido ? (
        <div className="space-y-2 border-t border-borda pt-4">
          <h3 className="text-lg font-bold">Revogar todo o consentimento</h3>
          <p className="text-sm text-[var(--cor-secundaria)]">
            Apaga agora favoritos, escolhas e reações. A conta fica só com o e-mail e é excluída automaticamente em 7 dias, a
            menos que você dê um novo consentimento.
          </p>
          <form action={revogarConsentimentoAcao}>
            <button type="submit" className={BOTAO_SECUNDARIO}>
              Revogar consentimento e apagar favoritos e reações
            </button>
          </form>
        </div>
      ) : null}

      <p className="text-sm text-[var(--cor-secundaria)]">
        Os dados ficam com as empresas que prestam o serviço (hospedagem, banco de dados e envio de e-mail), listadas na{" "}
        <Link href="/privacidade#cadastro" className="lk">
          Política de Privacidade
        </Link>
        ; não são vendidos nem compartilhados com mais ninguém.
      </p>
      <form action={sairAcao}>
        <button type="submit" className={BOTAO_SECUNDARIO}>
          Sair da conta
        </button>
      </form>
    </Bloco>
  );

  const excluir = (
    <Bloco id="excluir" titulo="Excluir minha conta" figurinha="pino">
      <p className="text-sm leading-relaxed text-[var(--cor-secundaria)]">
        <strong className="text-foreground">Etapa 1 de 2.</strong> Excluir apaga a conta e tudo o que está ligado a ela
        (consentimentos, favoritos, escolhas e reações), na hora e sem volta. Na próxima tela você confirma.
      </p>
      <Link href="/minha-conta/excluir" className={BOTAO_SECUNDARIO} prefetch={false}>
        Continuar para excluir minha conta
      </Link>
    </Bloco>
  );

  if (!consentimentoValido || !c || !prefs) {
    return (
      <div className="space-y-8">
        <TelaConsentimento versao={VERSAO_POLITICA} revogado={feito === "revogado"} />
        {dados}
        {excluir}
      </div>
    );
  }

  const fav = { propostas: prefs.itens, politicos: prefs.politicos, ufs: prefs.ufs, temas: prefs.temas };
  const nFav = fav.propostas.length + fav.politicos.length + fav.ufs.length + fav.temas.length;
  const chaveFav = [fav.propostas, fav.politicos, fav.ufs, fav.temas].map((l) => l.join(",")).join("|");

  return (
    <div className="space-y-8">
      {aviso ? (
        <p role="status" className="aviso text-sm">
          {aviso}
        </p>
      ) : null}

      <nav aria-label="Partes da Minha conta">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Atalho href="#favoritos" figurinha="lupa" titulo="Meus favoritos" texto={`${nFav} ${nFav === 1 ? "favorito" : "favoritos"} e as atualizações das propostas`} />
          <Atalho href="#reacoes" figurinha="caneta" titulo="Minhas reações" texto={`${reacoes.length} ${reacoes.length === 1 ? "reação" : "reações"} de curtir e não curtir`} />
          <Atalho href="#dados" figurinha="pessoas" titulo="Meus dados" texto="E-mail, consentimentos e baixar meus dados" />
          <Atalho href="#excluir" figurinha="pino" titulo="Excluir minha conta" texto="Apaga tudo, em duas etapas" />
        </ul>
      </nav>

      <Bloco id="favoritos" titulo="Meus favoritos" figurinha="lupa">
        <MeusFavoritos key={chaveFav} inicial={fav} />
        <div className="space-y-3 border-t border-borda pt-4">
          <h3 className="text-lg font-bold">Estados, temas e alertas</h3>
          <p className="text-sm text-[var(--cor-secundaria)]">
            Escolha os estados e os temas que quer acompanhar. As decisões ligadas a eles aparecem no bloco “Seus favoritos” da{" "}
            <Link href="/" className="lk">
              página inicial
            </Link>
            .
          </p>
          <FormPreferencias key={chaveFav} inicial={prefs} />
        </div>
        {nFav ? (
          <form action={apagarFavoritosAcao} className="border-t border-borda pt-4">
            <button type="submit" className={BOTAO_SECUNDARIO}>
              Apagar todos os favoritos
            </button>
          </form>
        ) : null}
      </Bloco>

      <Bloco id="reacoes" titulo="Minhas reações" figurinha="caneta">
        {c.reacoesAceitoEm ? (
          <>
            <p className="text-sm text-[var(--cor-secundaria)]">
              Suas reações de curtir e não curtir. Os contadores das páginas mostram só totais: ninguém vê quem reagiu.
            </p>
            <MinhasReacoes key={reacoes.map((r) => r.proposta).join(",")} inicial={reacoes} />
            <div className="flex flex-wrap gap-2 border-t border-borda pt-4">
              {reacoes.length ? (
                <form action={apagarReacoesAcao}>
                  <button type="submit" className={BOTAO_SECUNDARIO}>
                    Apagar todas as reações
                  </button>
                </form>
              ) : null}
              <form action={revogarConsentimentoReacoesAcao}>
                <button type="submit" className={BOTAO_SECUNDARIO}>
                  Revogar o consentimento das reações
                </button>
              </form>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--cor-secundaria)]">
            Você ainda não reagiu a nenhuma proposta. O consentimento das reações é pedido na primeira vez que você curtir ou
            não curtir uma proposta.
          </p>
        )}
      </Bloco>

      {dados}
      {excluir}
    </div>
  );
}

export default function MinhaContaPage({ searchParams }: PageProps<"/minha-conta">) {
  if (!cadastroAtivo()) notFound();
  return (
    <article className="max-w-3xl space-y-8">
      <header>
        <Figurinha nome="pessoas" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Minha conta</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          Acompanhe as propostas, os políticos, os estados e os temas que você favoritou, veja as suas reações e cuide dos seus
          dados. Tudo aqui pode ser apagado quando você quiser.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-gray-800">Carregando…</p>}>
        <Painel searchParams={searchParams} />
      </Suspense>
    </article>
  );
}
