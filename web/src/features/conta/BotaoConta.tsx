import Link from "next/link";
import { BotaoContaEmBreve } from "./BotaoContaEmBreve";
import { cadastroAtivo } from "./config";
import { CLASSE_BOTAO_CONTA, IconeConta } from "./IconeConta";

/**
 * Ícone "Minha conta" do cabeçalho, sempre visível. Não lê cookies nem sessão (o layout continua
 * estático e nenhuma requisição extra é feita por página). Com o cadastro ligado, leva a
 * /minha-conta (que pede login se preciso); sem ele, o clique explica que as contas abrem em breve.
 */
export function BotaoConta() {
  if (!cadastroAtivo()) return <BotaoContaEmBreve />;
  return (
    <Link href="/minha-conta" prefetch={false} className={CLASSE_BOTAO_CONTA} aria-label="Minha conta" title="Minha conta">
      <IconeConta />
    </Link>
  );
}
