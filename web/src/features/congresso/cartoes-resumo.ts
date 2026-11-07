/**
 * Monta os cartões do resumo do topo do perfil (mesma ordem e formato para todos os parlamentares).
 * Só texto vindo dos dados oficiais; lacuna explícita quando falta o número.
 */
import type { CartaoResumo } from "./componentes/ResumoParlamentar";
import type { Patrimonio, Propostas } from "./resumo-topo";
import { SUBSIDIO } from "./resumo-topo";
import type { ResumoNumero } from "./resumo-parlamentar";
import { NAO_DISPONIVEL, formatarData } from "./rotulos";
import type { Casa } from "./tipos";

const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numero = (n: number) => n.toLocaleString("pt-BR");
const ehLacuna = (v: string | null) => !v || v.startsWith("Informação");

export interface EntradaCartoes {
  casa: Casa;
  nominais: { comRegistro: number; total: number };
  presenca: ResumoNumero;
  gastos: ResumoNumero;
  patrimonio: Patrimonio;
  propostas: Propostas;
  coletaVotos: string | null;
}

export function cartoesResumo({ casa, nominais, presenca, gastos, patrimonio, propostas, coletaVotos }: EntradaCartoes): CartaoResumo[] {
  const camara = casa === "camara";
  const pi = patrimonio.item;
  const pc = propostas.contagem;
  const ano = Number(gastos.rotulo.match(/\d{4}/)?.[0]) || null;
  return [
    {
      ancora: "salario",
      rotulo: "Salário",
      valor: real(SUBSIDIO.valor),
      sufixo: "por mês",
      detalhe: `Mesmo valor para todos os deputados federais e senadores, desde ${formatarData(SUBSIDIO.desde)} (Decreto Legislativo 172/2022).`,
      fonte: SUBSIDIO.fonte,
    },
    {
      ancora: camara ? "cota" : null,
      rotulo: "Cota parlamentar",
      valor: ehLacuna(gastos.valor) ? null : gastos.valor,
      sufixo: ano ? `em ${ano}` : null,
      detalhe: ehLacuna(gastos.valor)
        ? null
        : `Gasto de 1º/1/${ano} até a data da coleta; ${gastos.detalhe ?? "valor oficial"}. Dinheiro para despesas do mandato, separado do salário.`,
      lacuna: gastos.valor && ehLacuna(gastos.valor) ? gastos.valor : "Não disponível nos dados coletados",
      fonte: gastos.fonte ?? null,
    },
    {
      ancora: "patrimonio",
      rotulo: "Patrimônio declarado",
      valor: pi ? real(pi.total) : null,
      sufixo: pi ? `em ${pi.eleicao}` : null,
      detalhe: pi
        ? `${pi.quantidade_bens ? `${numero(pi.quantidade_bens)} ${pi.quantidade_bens === 1 ? "bem declarado" : "bens declarados"}` : "Nenhum bem declarado"} ao TSE na candidatura de ${pi.eleicao}. Não é o patrimônio de hoje.`
        : null,
      lacuna: NAO_DISPONIVEL,
      fonte: patrimonio.fonte,
    },
    {
      ancora: camara ? "presenca" : "votos",
      rotulo: "Presença",
      valor: ehLacuna(presenca.valor) ? null : presenca.valor,
      detalhe: ehLacuna(presenca.valor) ? presenca.detalhe ?? null : `${presenca.rotulo}: ${presenca.detalhe ?? "registro oficial"}.`,
      lacuna: presenca.valor && ehLacuna(presenca.valor) ? presenca.valor : "Não disponível nos dados coletados",
      fonte: presenca.fonte ?? null,
    },
    {
      ancora: "propostas",
      rotulo: "Propostas",
      valor: pc ? numero(pc.total) : null,
      sufixo: pc ? (pc.total === 1 ? "apresentada" : "apresentadas") : null,
      detalhe: pc
        ? `Como autor ou coautor${camara && typeof pc.primeiro_signatario === "number" ? ` (${numero(pc.primeiro_signatario)} como primeiro signatário)` : ""}, de ${formatarData(propostas.periodo?.inicio)} a ${formatarData(propostas.periodo?.fim)}. Contam PEC, PLP, PL, PDL e ${camara ? "PRC" : "PRS"}; ${numero(propostas.viraramNorma.length)} ${propostas.viraramNorma.length === 1 ? "virou" : "viraram"} norma.`
        : null,
      lacuna: NAO_DISPONIVEL,
      fonte: propostas.fonte,
    },
    {
      ancora: "votos",
      rotulo: "Votações nominais",
      valor: `${numero(nominais.comRegistro)} de ${numero(nominais.total)}`,
      detalhe: `Votações nominais coletadas ${camara ? "da Câmara" : "do Senado"} em que há registro deste parlamentar${coletaVotos ? ` (coleta de ${formatarData(coletaVotos)})` : ""}.`,
      fonte: null,
    },
  ];
}
