/** Tipos da seção São Paulo (ALESP e governador), como gerados por scripts/gerar-sao-paulo.mjs. */

export interface FonteSp {
  titulo: string;
  url: string;
  orgao?: string | null;
  acessado_em?: string | null;
}

export interface DeputadoSp {
  id: string;
  nome: string;
  partido: string | null;
  foto: string | null;
  url_oficial: string | null;
  n_plenario: number;
  n_comissao: number;
}

export interface PlacarRelatorio {
  votos_sim?: number | null;
  votos_nao?: number | null;
  abstencao?: number | null;
  em_branco?: number | null;
  presidente?: number | null;
  total?: number | null;
}

export interface ResumoVotacaoSp {
  id: string;
  plenario: boolean;
  data: string | null;
  hora: string | null;
  orgao: string | null;
  sessao: string | null;
  proposicao: { id: string | null; rotulo: string | null; sigla: string | null; ementa: string | null; url: string | null } | null;
  descricao: string | null;
  resultado: string | null;
  placar: PlacarRelatorio | null;
  n_votos: number;
  url: string | null;
}

export interface LigacaoSp {
  rotulo: string;
  href: string;
}

export interface IndiceSp {
  atualizado_em: string | null;
  periodo: { inicio: string; fim: string } | null;
  lista_fonte: FonteSp | null;
  lista_atualizada_em: string | null;
  observacoes_lista: string[];
  fontes_votacoes: FonteSp[];
  contagens_votacoes: Record<string, { votacoes: number; plenario: number; comissoes: number; votos: number }> | null;
  fontes_projetos: FonteSp[];
  observacoes_projetos: string[];
  projetos: { total: number; por_sigla: Record<string, number> };
  normas: {
    total: number;
    por_ano_tipo: Record<string, number>;
    atualizado_em: string | null;
    fontes: FonteSp[];
    observacoes: string[];
    recentes: { id: string; tipo: string; titulo: string | null; data_publicacao: string | null; ementa: string | null; url: string | null }[];
    vetos: number;
  };
  deputados: DeputadoSp[];
  votacoes: ResumoVotacaoSp[];
  /** Deputado → [índice da votação, voto(s) como na fonte, nº de registros, letra impressa antes do nome]. */
  votos_por_deputado: Record<string, [number, string, number, string | null][]>;
  ligacoes_icms: Record<string, LigacaoSp[]>;
}

export interface VotoSp {
  parlamentar_id: string | null;
  nome: string;
  partido: string | null;
  uf?: string | null;
  voto: string;
  marcador_relatorio?: string;
}

/** Arquivo de uma votação de Plenário (content/alesp/votacoes/<id>.json). */
export interface VotacaoPlenarioSp {
  id: string;
  data: string | null;
  hora: string | null;
  orgao: string | null;
  orgao_nome: string | null;
  sessao: { titulo?: string | null; tipo?: string | null; numero?: number | null } | null;
  proposicao: { id: string; tipo: string | null; sigla: string; numero: number; ano: number; ementa: string | null; url: string | null } | null;
  descricao: string | null;
  descricao_abertura: string | null;
  resultado: string | null;
  resultado_texto_oficial: string | null;
  placar: { sim?: number | null; nao?: number | null; abstencao?: number | null; obstrucao?: number | null; outros?: number | null } | null;
  placar_oficial_relatorio: PlacarRelatorio | null;
  partidos_em_obstrucao: string | null;
  conferencia_placar: string | null;
  votos: VotoSp[];
  fonte: FonteSp | null;
  url: string | null;
  lacunas: string[];
}
