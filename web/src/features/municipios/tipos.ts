/** Tipos dos índices gerados por scripts/gerar-municipios.mjs (content/_gerado/municipios). */

export interface FonteMunicipio {
  titulo?: string | null;
  url: string;
  orgao?: string | null;
  acessado_em?: string | null;
}

export interface TemDados {
  votacoes: boolean;
  leis: boolean;
  financas: boolean;
  camara: boolean;
}

export interface MunicipioPresente {
  uf: string;
  slug: string;
  nome: string;
  cod_ibge: number;
  capital: boolean;
  tem: TemDados;
  atibaia: boolean;
}

export interface IndiceMunicipios {
  gerado_em: string | null;
  total_municipios: number;
  presentes: MunicipioPresente[];
  contagens?: {
    com_dados: number;
    com_votacoes: number;
    com_leis: number;
    com_financas: number;
    camaras_sapl_registradas: number;
    camaras_sapl_verificadas: number;
    camaras_sapl_api_ok: number;
    camaras_sapl_com_votos: number;
  };
  fontes: FonteMunicipio[];
  financas_relatorios: string[];
  financas_atualizado_em: string | null;
  registro_atualizado_em: string | null;
}

export type TipoVotacaoMun = "nominal" | "simbolica" | "secreta" | null;

export interface ResumoVotacaoMun {
  id: string;
  data: string | null;
  hora: string | null;
  sessao: string | null;
  proposicao: { sigla: string | null; numero: string | number | null; ano: number | null; ementa: string | null; url: string | null } | null;
  descricao: string | null;
  resultado_oficial: string | null;
  tipo: TipoVotacaoMun;
  placar: { sim?: number | null; nao?: number | null; abstencao?: number | null } | null;
  votos_situacao: string | null;
  n_votos: number;
  url: string | null;
}

export interface VotacaoMun extends ResumoVotacaoMun {
  etapa: string | null;
  resultado_pauta: string | null;
  observacao_oficial: string | null;
  conferencia_placar: string | null;
  totais_registrados: { sim?: number | null; nao?: number | null; abstencao?: number | null } | null;
  votos: { id: string | null; nome: string | null; partido: string | null; voto: string | null }[];
  fonte: FonteMunicipio | null;
  fonte_votos: FonteMunicipio | null;
  lacunas: string[];
}

export interface ProposicaoMun {
  id: string;
  identificacao: string | null;
  tipo: string | null;
  ementa: string | null;
  data: string | null;
  autores: string[];
  situacao: { texto: string | null; status: string | null; data: string | null } | null;
  url: string | null;
}

export interface NormaMun {
  id: string;
  tipo: string | null;
  numero: string | number | null;
  ano: number | null;
  data: string | null;
  ementa: string | null;
  url: string | null;
}

export interface CamaraMun {
  nome: string | null;
  host: string | null;
  atualizado_em: string | null;
  periodo: { inicio: string | null; fim: string | null } | null;
  fontes: FonteMunicipio[];
  cobertura: Record<string, { desde: string | null; concluida: boolean }> | null;
  observacoes: string[];
  legislatura: { numero: number; inicio: string; fim: string } | null;
  fonte_vereadores: FonteMunicipio | null;
  vereadores: { id: string; nome: string; partido: string | null; em_exercicio: boolean | null; url_oficial: string | null }[];
  votacoes: ResumoVotacaoMun[];
  proposicoes: { total: number; por_sigla: Record<string, number>; recentes: ProposicaoMun[] };
  normas: { total: number; por_tipo: Record<string, number>; recentes: NormaMun[] };
}

/** [rótulo do site, rótulo da fonte, valores…] */
export type LinhaFinanca = [string, string | null, ...(number | null)[]];

export interface RelatorioFinancas {
  chave: string;
  exercicio: number;
  periodo: number;
  consultado_em: string | null;
  instituicao: string | null;
  /** [rótulo, rótulo da fonte, prevista, realizada] */
  receitas: LinhaFinanca[];
  /** [rótulo, rótulo da fonte, dotação, empenhada, liquidada, paga] */
  despesas: LinhaFinanca[];
  /** [função, dotação, empenhada, liquidada] */
  funcoes: [string, number | null, number | null, number | null][] | null;
  url: string;
  url_funcoes: string;
}

export interface CidadeMun {
  uf: string;
  slug: string;
  nome: string;
  cod_ibge: number;
  capital: boolean;
  populacao: number | null;
  populacao_fonte: FonteMunicipio | null;
  populacao_exercicio: number | null;
  atibaia: boolean;
  sapl: {
    host: string;
    url: string;
    casa: string | null;
    verificacao: {
      em: string;
      api_responde: boolean | null;
      api_permitida: boolean | null;
      votos_nominais_publicados: boolean | null;
      totais: Record<string, number | null>;
    } | null;
  } | null;
  registro_fonte: FonteMunicipio | null;
  camara: CamaraMun | null;
  financas: RelatorioFinancas[];
  financas_fonte: FonteMunicipio | null;
}
