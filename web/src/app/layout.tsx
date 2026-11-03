import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import { FaixaAtualizacao } from "@/components/FaixaAtualizacao";
import { NavPrincipal } from "@/components/NavPrincipal";
import { BotaoOuvir } from "@/components/ouvir";
import { ModalEntrar } from "@/components/reacoes/ModalEntrar";
import { BotaoConta } from "@/features/conta/BotaoConta";
import { cadastroAtivo } from "@/features/conta/config";
import { AvisoCookies } from "@/features/privacidade/AvisoCookies";
import { DM_Sans, Poppins } from "next/font/google";
import { AberturaMarca, SCRIPT_ABERTURA } from "@/components/marca/AberturaMarca";
import { Logo } from "@/components/marca/Logo";
import "./globals.css";

const fonteTitulo = Poppins({ subsets: ["latin"], weight: ["800", "900"], variable: "--fonte-titulo", display: "swap" });
const fonteTexto = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--fonte-texto", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Brasil na Lupa — acompanhamento político com fontes oficiais",
    template: "%s · Brasil na Lupa",
  },
  description:
    "O que é votado e decidido pelos políticos do Brasil: quem decidiu, como cada um votou e a justificativa oficial, sempre com link para o documento de origem.",
  // Padrão do site; páginas de detalhe completam com metadadosCompartilhamento()
  // (@/components/compartilhar), que repete estes campos porque o Next.js substitui o objeto inteiro.
  openGraph: {
    siteName: "Brasil na Lupa",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`h-full antialiased ${fonteTitulo.variable} ${fonteTexto.variable}`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ABERTURA }} />
        <AberturaMarca />
        {/* Atalhos do eMAG 3.1: Alt+1 conteúdo, Alt+2 menu, Alt+4 rodapé (página /acessibilidade). */}
        <nav aria-label="Atalhos de acessibilidade" className="pular-links">
          <a href="#conteudo" accessKey="1">
            Pular para o conteúdo <span aria-hidden="true">[1]</span>
          </a>
          <a href="#navegacao" accessKey="2">
            Ir para o menu <span aria-hidden="true">[2]</span>
          </a>
          <a href="#rodape" accessKey="4">
            Ir para o rodapé <span aria-hidden="true">[4]</span>
          </a>
        </nav>
        <header className="sticky top-0 z-40 border-b border-borda bg-superficie/95 backdrop-blur supports-[backdrop-filter]:bg-superficie/85">
          <div className="relative flex w-full flex-col gap-2 px-[5%] py-3 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="inline-flex min-h-11 items-center self-start text-lg font-bold text-foreground">
              <Logo />
              <span className="sr-only">, página inicial</span>
            </Link>
            <NavPrincipal />
            <BotaoConta />
          </div>
        </header>
        <aside aria-label="Atualização dos dados e leitura em voz alta" className="border-b border-borda bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1">
            <FaixaAtualizacao />
            <BotaoOuvir />
          </div>
        </aside>
        <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 focus:outline-none">
          {children}
        </main>
        <footer id="rodape" tabIndex={-1} className="border-t border-borda bg-superficie focus:outline-none">
          <div className="mx-auto max-w-6xl px-4 py-3 text-sm text-[var(--cor-secundaria)]">
            <p className="flex flex-wrap items-center gap-x-1">
              <span className="py-2.5">Site independente, sem ligação com governos ou partidos. Fontes oficiais citadas em cada informação.</span>
              <Link href="/metodologia" className="lk inline-flex min-h-11 items-center px-1">
                Metodologia
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/participar" className="lk inline-flex min-h-11 items-center px-1">
                Participar
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/privacidade" className="lk inline-flex min-h-11 items-center px-1">
                Privacidade
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/acessibilidade" className="lk inline-flex min-h-11 items-center px-1">
                Acessibilidade
              </Link>
            </p>
          </div>
        </footer>
        <AvisoCookies />
        {cadastroAtivo() ? <ModalEntrar /> : null}
        <Analytics />
      </body>
    </html>
  );
}
