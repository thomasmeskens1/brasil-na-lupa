/** Ícone de pessoa do botão de conta do cabeçalho (decorativo: o nome vem do aria-label do botão). */
export function IconeConta() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="7" r="3.25" />
      <path d="M3.5 17c.9-3.2 3.4-4.75 6.5-4.75S15.6 13.8 16.5 17" strokeLinecap="round" />
    </svg>
  );
}

/** No celular fica ao lado do botão "Menu"; a partir de md, à direita do menu, só o ícone. */
export const CLASSE_BOTAO_CONTA =
  "absolute right-[7.25rem] top-2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--cor-borda-forte)] bg-white text-foreground transition-colors hover:border-[var(--cor-acento)] hover:text-[var(--cor-acento)] md:static";
