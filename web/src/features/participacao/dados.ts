import fs from "node:fs";
import path from "node:path";

/**
 * Leitura (somente servidor / build) dos canais oficiais de participação de uma proposição,
 * em content/participacao/{senado,camara}/<id>.json (copiado de ../dados/participacao pelo
 * sync-data). Arquivo ausente → null: o bloco mostra só o atalho geral para /participar.
 *
 * Ids: Senado = código da matéria (proposicao.codigo_materia); Câmara = id da proposição
 * nos Dados Abertos (proposicao.id).
 */
export type CasaParticipacao = "senado" | "camara";

export interface FonteParticipacao {
  titulo: string;
  url: string;
  orgao: string;
  acessado_em: string;
}

export interface CanalOficial {
  nome: string;
  orgao: string;
  url: string;
}

export interface ConsultaSenado {
  situacao: "aberta" | "encerrada" | "nao_passivel" | "desconhecida";
  rotulo_oficial: string | null;
  frase_oficial: string | null;
  apurado_ate: string | null;
  sim: number;
  nao: number;
}

export interface OpcaoEnquete {
  opcao: string;
  participacoes: number;
  percentual: string | null;
}

export interface EnqueteCamara {
  situacao: "aberta" | "encerrada" | "desconhecida";
  rotulo_oficial: string | null;
  desde: string | null;
  opcoes: OpcaoEnquete[];
}

export interface ParticipacaoSenado {
  casa: "senado";
  proposicao: { id: string; identificacao: string | null };
  canal: CanalOficial;
  consulta: ConsultaSenado | null;
  situacao: string;
  observacao_oficial: string | null;
  lacuna: string | null;
  fonte: FonteParticipacao;
}

export interface ParticipacaoCamara {
  casa: "camara";
  proposicao: { id: string; identificacao: string | null };
  canal: CanalOficial;
  enquete: EnqueteCamara | null;
  situacao: string;
  lacuna: string | null;
  fonte: FonteParticipacao;
}

export type Participacao = ParticipacaoSenado | ParticipacaoCamara;

const cache = new Map<string, Participacao | null>();

function lerOpcional<T>(arquivo: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return null;
  }
}

export function getParticipacao(casa: "senado", id: string | number | null | undefined): ParticipacaoSenado | null;
export function getParticipacao(casa: "camara", id: string | number | null | undefined): ParticipacaoCamara | null;
export function getParticipacao(casa: CasaParticipacao, id: string | number | null | undefined): Participacao | null;
export function getParticipacao(casa: CasaParticipacao, id: string | number | null | undefined): Participacao | null {
  if (id === null || id === undefined) return null;
  const chave = String(id);
  if (!/^\d+$/.test(chave)) return null;
  const k = `${casa}/${chave}`;
  if (cache.has(k)) return cache.get(k) ?? null;
  const lido = lerOpcional<Participacao>(path.join(process.cwd(), "content", "participacao", casa, `${chave}.json`));
  const valido = lido && lido.casa === casa && lido.canal?.url ? lido : null;
  cache.set(k, valido);
  return valido;
}
