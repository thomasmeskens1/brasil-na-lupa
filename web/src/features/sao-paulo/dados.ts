/**
 * Compatibilidade: a seção São Paulo virou a UF "sp" da seção Estados (@/features/estados).
 * Mantido só para quem ainda importa daqui (Tribunais de Contas → julgamento das contas na ALESP).
 */
import { getVotacaoPlenario as getVotacao } from "@/features/estados/dados";

export function getVotacaoPlenario(id: string) {
  return getVotacao("sp", id);
}
