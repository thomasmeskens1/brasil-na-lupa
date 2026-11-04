/** Tipos da seção Estados, como gerados por scripts/gerar-estados.mjs. */

export interface FonteEstado {
  titulo: string;
  url: string;
  orgao?: string | null;
  acessado_em?: string | null;
}

export interface DeputadoEstado {
  id: string;
  nome: string;
  partido: string | null;
  foto: string | null;
  url_oficial: string | null;
  em_exercicio: boolean | null;
  n_plenario: number;
  n_comissao: number;
}

export type FormaVotacao = "nominal" | "simbolica" | "secreta" | null;

/** Placar oficial: chaves sim/nao/abstencao/obstrucao/outros e extras com o rótulo da fonte. */
export interface PlacarEstado {
  itens: Record<string, number>;
  total: number | null;
}

export interface ResumoVotacao {
  id: string;
  plenario: boolean;
  forma: FormaVotacao;
  /** Tipo de votação como a fonte escreve (ex.: "Votação ostensiva"). */
  tipo_texto?: string | null;
  data: string | null;
  hora: string | null;
  orgao: string | null;
  sessao: string | null;
  proposicao: { id: string | null; rotulo: string | null; sigla: string | null; ementa: string | null; url: string | null } | null;
  descricao: string | null;
  resultado: string | null;
  placar: PlacarEstado | null;
  n_votos: number;
  url: string | null;
  acessado_em: string | null;
}

export interface LigacaoEstado {
  rotulo: string;
  href: string;
}

export interface NormaRecente {
  id: string;
  tipo: string;
  titulo: string | null;
  data_ato: string | null;
  data_publicacao: string | null;
  ementa: string | null;
  url: string | null;
  acessado_em: string | null;
}

export interface IndiceEstado {
  uf: string;
  atualizado_em: string | null;
  periodo: { inicio: string; fim: string } | null;
  lista_fonte: FonteEstado | null;
  lista_atualizada_em: string | null;
  observacoes_lista: string[];
  fontes_votacoes: FonteEstado[];
  fontes_projetos: FonteEstado[];
  observacoes_projetos: string[];
  /** Sigla → nome do tipo de proposição, como a fonte informa. */
  siglas: Record<string, string>;
  projetos: { total: number; por_sigla: Record<string, number> };
  normas: {
    total: number;
    por_ano_tipo: Record<string, number>;
    atualizado_em: string | null;
    fontes: FonteEstado[];
    observacoes: string[];
    recentes: NormaRecente[];
    vetos: number;
  };
  deputados: DeputadoEstado[];
  votacoes: ResumoVotacao[];
  /** Deputado → [índice da votação, voto(s) como na fonte, nº de registros, letra impressa antes do nome]. */
  votos_por_deputado: Record<string, [number, string, number, string | null][]>;
  ligacoes_icms: Record<string, LigacaoEstado[]>;
  /** Assembleia sem coleta (ex.: GO): motivo oficial e fonte, gravados pelo coletor. Ausente = Assembleia coletada. */
  assembleia_indisponivel?: AssembleiaIndisponivel | null;
}

export interface AssembleiaIndisponivel {
  motivo: string;
  pedido_lai?: string | null;
  fonte?: FonteEstado | null;
}

/** Contagens de uma UF presente (content/_gerado/estados/indice.json). */
export interface ResumoUf {
  atualizado_em: string | null;
  normas_atualizado_em: string | null;
  deputados: number;
  votacoes: number;
  plenario: number;
  plenario_nominal: number;
  comissoes: number;
  projetos: number;
  normas: number;
  assembleia_indisponivel?: boolean;
}

export interface VotoEstado {
  parlamentar_id: string | null;
  nome: string;
  partido: string | null;
  uf?: string | null;
  voto: string;
  marcador_relatorio?: string;
}

/** Arquivo de uma votação de Plenário (dados/esquema.json → votacao; em SP, dados/alesp/votacoes/<id>.json). */
export interface VotacaoPlenario {
  id: string;
  casa?: string | null;
  uf?: string | null;
  tipo?: string | null;
  tipo_texto_oficial?: string | null;
  data: string | null;
  hora: string | null;
  orgao: string | null;
  orgao_sigla?: string | null;
  orgao_nome: string | null;
  sessao: { titulo?: string | null; tipo?: string | null; numero?: number | null } | null;
  proposicao: { id: string; tipo: string | null; sigla: string; numero: number; ano: number; ementa: string | null; url: string | null } | null;
  descricao: string | null;
  descricao_abertura: string | null;
  resultado: string | null;
  resultado_texto_oficial?: string | null;
  placar: { sim?: number | null; nao?: number | null; abstencao?: number | null; obstrucao?: number | null; outros?: number | null } | null;
  placar_oficial_relatorio?: { votos_sim?: number | null; votos_nao?: number | null; abstencao?: number | null; em_branco?: number | null; presidente?: number | null; total?: number | null } | null;
  partidos_em_obstrucao?: string | null;
  conferencia_placar?: string | null;
  votos: VotoEstado[];
  fonte: FonteEstado | null;
  url: string | null;
  lacunas: (string | Record<string, unknown>)[];
}
