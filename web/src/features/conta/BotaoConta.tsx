import Link from "next/link";
import { cadastroAtivo } from "./config";

/**
 * Link "Minha conta" do cabeçalho. Não lê cookies nem sessão (o layout continua estático e
 * nenhuma requisição extra é feita por página): só aparece quando o cadastro está ativo.
 * No celular fica como ícone ao lado do botão "Menu"; a partir de md, como texto.
 */
export function BotaoConta() {
  if (!cadastroAtivo()) return null;
  return (
    <Link
      href="/minha-conta"
      prefetch={false}
      className="absolute right-[7.25rem] top-2 inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded border border-[var(--cor-borda-forte)] bg-white px-2 text-sm font-medium text-foreground md:static md:min-w-0 md:px-3"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 md:hidden" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="10" cy="7" r="3.25" />
        <path d="M3.5 17c.9-3.2 3.4-4.75 6.5-4.75S15.6 13.8 16.5 17" strokeLinecap="round" />
      </svg>
      <span className="sr-only md:not-sr-only">Minha conta</span>
    </Link>
  );
}
