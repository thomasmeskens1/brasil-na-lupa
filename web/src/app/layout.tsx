import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import { NavPrincipal } from "@/components/NavPrincipal";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Placar do Poder — acompanhamento político com fontes oficiais",
    template: "%s · Placar do Poder",
  },
  description:
    "O que é votado e decidido pelos políticos do Brasil: quem decidiu, como cada um votou e a justificativa oficial, sempre com link para o documento de origem.",
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
            <Link href="/" className="self-start py-1 text-lg font-bold text-foreground">
              Placar do Poder
            </Link>
            <NavPrincipal />
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-borda bg-superficie">
          <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-[#323f4b]">
            <p>
              Fontes oficiais citadas em cada informação.{" "}
              <Link href="/metodologia" className="lk">
                Metodologia
              </Link>
              {" · "}
              <Link href="/privacidade" className="lk">
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
