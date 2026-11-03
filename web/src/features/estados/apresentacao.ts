/**
 * Conversão dos dados da seção Estados para o Cartão de Decisão (funções puras, seguras no
 * navegador). Nada é preenchido por dedução: sem placar oficial, o cartão não mostra placar.
 */
import { NAO_DISPONIVEL, placarOficial, type DadoChave } from "@/components/decisao";
import type { FormaVotacao } from "./tipos";

/** Forma da decisão para o cartão (diretriz 5). Comissões com voto registrado contam como nominais. */
export function formaDecisao(f: FormaVotacao): "votacao-nominal" | "votacao-simbolica" | "votacao-secreta" | null {
  if (f === "nominal") return "votacao-nominal";
  if (f === "simbolica") return "votacao-simbolica";
  if (f === "secreta") return "votacao-secreta";
  return null;
}

/** Dado-chave de uma votação: placar só quando a fonte o publica e a votação não é simbólica. */
export function dadoVotacao(v: {
  forma: FormaVotacao;
  placar: Record<string, number> | null;
  resultado: string | null;
  descricao: string | null;
  plenario: boolean;
}): DadoChave {
  if (v.forma === "simbolica") return { tipo: "simbolica", resultado: v.resultado };
  if (v.placar && Object.keys(v.placar).length && (v.forma === "nominal" || v.forma === "secreta")) {
    return { tipo: "placar", itens: placarOficial(v.placar), resultado: v.resultado };
  }
  if (!v.plenario) return { tipo: "texto", rotulo: "Deliberação (texto oficial)", texto: v.descricao || NAO_DISPONIVEL };
  return { tipo: "texto", rotulo: "Resultado (texto oficial)", texto: v.resultado || NAO_DISPONIVEL };
}

/** Dado-chave de uma norma do governador: o caminho pelo qual foi decidida. */
export function dadoNorma(tipo: string, governo: string): DadoChave {
  if (tipo === "Decreto") return { tipo: "sem-votacao", caminho: `ato individual do ${governo.charAt(0).toLowerCase()}${governo.slice(1)}` };
  if (/^Veto/i.test(tipo)) return { tipo: "sem-votacao", caminho: "ato individual do governador sobre projeto aprovado pelo Legislativo", detalhe: "O Legislativo pode manter ou derrubar o veto." };
  return { tipo: "texto", rotulo: "Caminho", texto: "Lei aprovada pelo Legislativo e publicada no Diário Oficial" };
}
