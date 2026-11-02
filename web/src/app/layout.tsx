import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import { FaixaAtualizacao } from "@/components/FaixaAtualizacao";
import { NavPrincipal } from "@/components/NavPrincipal";
import { BotaoOuvir } from "@/components/ouvir";
import { BotaoConta } from "@/features/conta/BotaoConta";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Placar do Poder — acompanhamento político com fontes oficiais",
    template: "%s · Placar do Poder",
  },
  description:
    "O que é votado e decidido pelos políticos do Brasil: quem decidiu, como cada um votou e a justificativa oficial, sempre com link para o documento de origem.",
  // Padrão do site; páginas de detalhe completam com metadadosCompartilhamento()
  // (@/components/compartilhar), que repete estes campos porque o Next.js substitui o objeto inteiro.
  openGraph: {
    siteName: "Placar do Poder",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-foreground">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        >
          Pular para o conteúdo
        </a>
        <header className="sticky top-0 z-40 border-b border-borda bg-superficie/95 backdrop-blur supports-[backdrop-filter]:bg-superficie/85">
          <div className="relative mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="inline-flex min-h-11 items-center self-start text-lg font-bold text-foreground">
              Placar do Poder
            </Link>
            <NavPrincipal />
            <BotaoConta />
          </div>
        </header>
        <div className="border-b border-borda bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1">
            <FaixaAtualizacao />
            <BotaoOuvir />
          </div>
        </div>
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-borda bg-superficie">
          <div className="mx-auto max-w-6xl px-4 py-3 text-sm text-[#323f4b]">
            <p className="flex flex-wrap items-center gap-x-1">
              <span className="py-2.5">Fontes oficiais citadas em cada informação.</span>
              <Link href="/metodologia" className="lk inline-flex min-h-11 items-center px-1">
                Metodologia
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/privacidade" className="lk inline-flex min-h-11 items-center px-1">
                Privacidade
              </Link>
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
