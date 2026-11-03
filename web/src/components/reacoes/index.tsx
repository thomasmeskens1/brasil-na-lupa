/**
 * Botões da conta nas páginas de conteúdo (componentes de servidor). Com o cadastro desligado
 * não renderizam nada: sem botão quebrado e sem consulta ao servidor. As páginas continuam
 * estáticas; o estado de cada pessoa é lido no navegador.
 *
 * Uso:
 *   <Reacoes proposta={idVotacaoCongresso("camara", v.id)} />
 *   <Favoritar tipo="politico" valor={idParlamentar("camara", p.id)} nome="este deputado" />
 *   <AcoesProposta proposta={...} />   // Favoritar + reações, juntos no cabeçalho da decisão
 *
 * Os contadores de reação nunca aparecem em listas de políticos, comparador, crachá ou
 * ordenações (diretriz 4.1): este componente só é montado em páginas de uma proposta.
 */
import { cadastroAtivo } from "@/features/conta/config";
import type { TipoFavorito } from "@/features/conta/ids";
import { BotaoFavoritar } from "./BotaoFavoritar";
import { BotoesReacao } from "./BotoesReacao";

export function Reacoes({ proposta }: { proposta: string }) {
  if (!cadastroAtivo()) return null;
  return <BotoesReacao proposta={proposta} />;
}

export function Favoritar({ tipo, valor, nome, className }: { tipo: TipoFavorito; valor: string; nome: string; className?: string }) {
  if (!cadastroAtivo()) return null;
  return (
    <div className={className}>
      <BotaoFavoritar tipo={tipo} valor={valor} nome={nome} />
    </div>
  );
}

/** Favoritar a proposta e reagir a ela, lado a lado (cabeçalho das páginas de decisão). */
export function AcoesProposta({ proposta }: { proposta: string }) {
  if (!cadastroAtivo()) return null;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
      <BotaoFavoritar tipo="proposta" valor={proposta} nome="esta proposta" />
      <BotoesReacao proposta={proposta} />
    </div>
  );
}
