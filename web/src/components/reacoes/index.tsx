/**
 * Botões da conta nas páginas de conteúdo (componentes de servidor). As páginas continuam
 * estáticas; o estado de cada pessoa é lido no navegador.
 *
 * Curtir / não curtir aparecem sempre (também com o cadastro desligado: o clique abre o aviso
 * "O cadastro estará disponível em breve", sem consulta ao servidor). O Favoritar só aparece com
 * o cadastro ligado.
 *
 * Uso:
 *   <Reacoes proposta={idVotacaoCongresso("camara", v.id)} />
 *   <Favoritar tipo="politico" valor={idParlamentar("camara", p.id)} nome="este deputado" />
 *   <AcoesProposta proposta={...} />   // Favoritar + reações, juntos no cabeçalho da decisão
 *   <ReacoesCartao proposta={...} />   // versão compacta, na linha de ações do Cartão de Decisão
 *
 * Os contadores de reação nunca aparecem em listas de políticos, comparador, crachá ou
 * ordenações (diretriz 4.1): só em páginas e cartões de uma proposta, e nunca ordenam nada.
 */
import { cadastroAtivo } from "@/features/conta/config";
import type { TipoFavorito } from "@/features/conta/ids";
import { BotaoFavoritar } from "./BotaoFavoritar";
import { BotoesReacao } from "./BotoesReacao";

export function Reacoes({ proposta }: { proposta: string }) {
  return <BotoesReacao proposta={proposta} />;
}

/** Versão compacta para os cartões das listas (componente de cliente; serve a servidor e cliente). */
export function ReacoesCartao({ proposta }: { proposta: string }) {
  return <BotoesReacao proposta={proposta} compacto />;
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
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
      {cadastroAtivo() ? <BotaoFavoritar tipo="proposta" valor={proposta} nome="esta proposta" /> : null}
      <BotoesReacao proposta={proposta} />
    </div>
  );
}
