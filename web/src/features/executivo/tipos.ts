/** Tipos do contrato de dados (dados/esquema.json → medida_provisoria, veto, voto_veto, norma). */
import type { FonteCongresso, PlacarCongresso } from "@/features/congresso/tipos";

export type Fonte = FonteCongresso;

export interface ResumoMpv {
  id: string;
  numero: number;
  ano: number;
  data: string | null;
  ementa: string | null;
  situacao: string | null;
  situacao_oficial: string | null;
  norma_gerada: string | null;
  exposicao_motivos: boolean;
  votacoes: number;
  url: string | null;
}

export interface ResumoVeto {
  id: string;
  numero: number;
  ano: number;
  tipo: string | null;
  materia_vetada: string | null;
  norma: string | null;
  data_publicacao: string | null;
  ementa: string | null;
  /** Assunto registrado pelo Congresso Nacional (copiado do detalhe pelo gerador). */
  assunto_congresso?: string | null;
  dispositivos: number;
  situacao_dispositivos: Record<string, number>;
  situacao_oficial: string | null;
  sobrestando_pauta: boolean | null;
  url: string | null;
}

/** content/_gerado/executivo.json (scripts/gerar-executivo-justica.mjs). */
export interface IndiceExecutivo {
  atualizado_em: string | null;
  periodo: { inicio?: string; fim?: string } | null;
  fontes: Fonte[];
  contagens: {
    medidas_provisorias?: { total?: number };
    normas?: { total?: number; por_tipo?: Record<string, number> };
    vetos?: { total?: number; dispositivos?: number };
  } | null;
  fontes_mpv: Fonte[];
  fontes_vetos: Fonte[];
  fontes_normas: Fonte[];
  abrangencia_normas: string | null;
  mpvs: ResumoMpv[];
  vetos: ResumoVeto[];
  normas: { total: number; anos: number[]; por_ano_tipo: Record<string, number> };
}

export interface PrazoMpv {
  tipo: string | null;
  inicio: string | null;
  fim: string | null;
  fundamento_legal: string | null;
  prorrogado: string | null;
  fase: string | null;
  colegiado: string | null;
}

export interface TrechoExposicao {
  paragrafo: number | null;
  texto: string;
  truncado?: boolean;
}

export interface VotacaoMpv {
  casa: "camara" | "senado";
  votacao_ref: string;
  data: string | null;
  orgao?: string | null;
  descricao: string | null;
  tipo: string | null;
  resultado: string | null;
  placar: PlacarCongresso | null;
}

export interface MedidaProvisoria {
  id: string;
  numero: number;
  ano: number;
  identificacao: string | null;
  ementa: string | null;
  apelido_senado?: string | null;
  autoria?: string | null;
  mensagem?: string | null;
  forma?: string | null;
  datas?: { edicao?: string | null; publicacao?: string | null; situacao?: string | null } | null;
  situacao: string | null;
  situacao_oficial: string | null;
  tramitando?: boolean | null;
  deliberacao?: { data?: string | null; tipo?: string | null; destino?: string | null } | null;
  norma_gerada?: {
    descricao?: string | null;
    data_assinatura?: string | null;
    data_publicacao?: string | null;
    publicacao?: string | null;
  } | null;
  comissao_mista?: string | null;
  prazos?: PrazoMpv[];
  links?: Record<string, string | null | undefined>;
  exposicao_motivos?: {
    url?: string | null;
    acessado_em?: string | null;
    documento?: string | null;
    data_texto?: string | null;
    paragrafos_total?: number | null;
    trechos?: TrechoExposicao[];
  } | null;
  votacoes?: VotacaoMpv[];
  fontes?: Fonte[];
  lacunas?: (string | Record<string, unknown>)[];
  atualizado_em?: string | null;
}

export interface PlacarCasaVeto extends PlacarCongresso {
  detalhe?: Record<string, number> | null;
}

export interface DispositivoVeto {
  codigo: string;
  identificador: string | null;
  dispositivo: string | null;
  texto_vetado: string | null;
  assunto_congresso?: string | null;
  origem?: string | null;
  razao_veto: string | null;
  situacao: string | null;
  situacao_oficial: string | null;
  tipo_votacao: string | null;
  data_sessao: string | null;
  votacao: {
    sessao?: string | null;
    tipo?: string | null;
    tipo_votacao_fonte?: string | null;
    placar?: { camara?: PlacarCasaVeto | null; senado?: PlacarCasaVeto | null } | null;
    votos_ref?: string | null;
    url?: string | null;
  } | null;
}

export interface Veto {
  id: string;
  numero: number;
  ano: number;
  identificacao: string | null;
  ementa: string | null;
  assunto_congresso?: string | null;
  tipo: string | null;
  forma?: string | null;
  materia_vetada?: { identificacao?: string | null; ementa?: string | null } | null;
  norma?: { descricao?: string | null; data_assinatura?: string | null; data_publicacao?: string | null; publicacao?: string | null } | null;
  mensagem?: { identificacao?: string | null; url_planalto?: string | null } | null;
  datas?: { publicacao?: string | null; recebimento_congresso?: string | null; sobrestamento_pauta?: string | null } | null;
  sobrestando_pauta?: boolean | null;
  em_tramitacao?: boolean | null;
  situacao_oficial?: string | null;
  quantidade_dispositivos_fonte?: number | null;
  situacao_dispositivos?: Record<string, number>;
  resultado_pdfs?: { descricao?: string | null; url: string }[];
  links?: Record<string, string | null | undefined>;
  dispositivos: DispositivoVeto[];
  fontes?: Fonte[];
  lacunas?: (string | Record<string, unknown>)[];
  atualizado_em?: string | null;
}

/** Linha do índice compacto public/executivo/normas.json. */
export type LinhaNorma = [
  id: string,
  tipo: number | string,
  nome: string | null,
  data: string,
  ementa: string,
  apelido: string | null,
  planalto: string | null,
  dou: string[],
  projetos: string[],
  veto: string | null,
  senado: string | null,
  /** Título em linguagem simples aprovado (dados/titulos/executivo.json), quando reformula a ementa. */
  tituloSimples?: string | null,
];

/** Resumo de um dispositivo de veto enviado à lista recolhível (o texto vem sob demanda). */
export interface ResumoDispositivo {
  codigo: string;
  ordem: number;
  identificador: string | null;
  dispositivo: string | null;
  assunto: string | null;
  /** Chave padronizada ("derrubado", "mantido", "não apreciado", "prejudicado"). */
  situacao: string | null;
  situacaoRotulo: string;
  dataSessao: string | null;
  temVotos: boolean;
}

/** public/executivo/vetos/dispositivos/<codigo>.json (scripts/gerar-executivo-justica.mjs). */
export interface DetalheDispositivoArquivo {
  texto_vetado: string | null;
  razao_veto: string | null;
  origem: string | null;
  tipo_votacao: string | null;
  votacao: DispositivoVeto["votacao"];
}

/** public/executivo/vetos/votos/<codigo>.json: [casa (0 Câmara, 1 Senado), nome, partido na fonte, UF, voto, id]. */
export interface VotosDispositivoArquivo {
  fonte: Fonte | null;
  sessao: string | null;
  v: [number, string, string | null, string | null, string | null, string | null][];
}
