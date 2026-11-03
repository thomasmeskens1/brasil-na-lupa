/**
 * Tipos do Cartão de Decisão e do cabeçalho de detalhe (sem acesso a dados; seguros no navegador).
 *
 * As seções convertem os próprios dados para estes tipos. Nada aqui é preenchido por dedução
 * (diretriz 1): campo ausente fica ausente e a interface mostra a lacuna.
 */

/** Fonte oficial no formato do esquema (dados/esquema.json → "fonte"). */
export interface FonteResumo {
  url: string;
  /** Nome legível do documento (sem códigos técnicos — diretriz 10). */
  titulo?: string | null;
  /** Órgão de origem (ex.: "Câmara dos Deputados"). */
  orgao?: string | null;
  /** Data da coleta, AAAA-MM-DD (diretrizes 2 e 13). */
  acessado_em?: string | null;
  /** Tipo do selo; padrão "oficial". "reportagem" só como pista, nunca fato (diretriz 3). */
  tipo?: "oficial" | "pdf" | "reportagem";
}

/** Título em linguagem simples (dados/esquema.json → "titulo_simples"; dados/titulos/<secao>.json). */
export interface TituloSimples {
  titulo: string;
  /** Nome oficial por extenso e etapa (ex.: "Projeto de Lei Complementar 108/2024"). */
  subtitulo?: string | null;
  origem?: OrigemTitulo | string | null;
  /** Link do texto usado (notícia da agência ou campo oficial). */
  fonte?: string | { url: string; titulo?: string | null } | null;
  /** Tema do dia a dia (ex.: "Impostos e preços"). */
  tema?: string | null;
  /** Etiqueta curta de campos estruturados (ex.: "Aprovado 312 × 140", "Veto mantido"). */
  etiqueta?: string | null;
  /** Modelo fixo usado quando origem = "estruturado" (credito | icms-mudanca | contas-tce). */
  modelo?: string | null;
  verificacao?: {
    numeros_e_datas_conferidos?: boolean | null;
    verbo_permitido?: boolean | null;
    palavras_proibidas?: string[] | null;
    veto_vies?: unknown;
    texto_oficial_literal?: boolean | null;
    /** true quando scripts/coleta/titulos/verificar.mjs aprovou o registro. */
    aprovado_pelo_verificador?: boolean | null;
  } | null;
}

/**
 * "estruturado" e "oficial" são as únicas origens geradas hoje. As demais ficam no tipo só para
 * arquivos antigos; nunca aparecem no lugar do título oficial (ver tituloAprovado).
 */
export type OrigemTitulo =
  | "estruturado"
  | "oficial"
  | "apelido-oficial"
  | "explicacao-oficial"
  | "agencia-camara"
  | "agencia-senado"
  | "modelo";

/** Arquivo dados/titulos/<secao>.json. */
export interface ArquivoTitulos {
  atualizado_em?: string;
  itens: Record<string, TituloSimples>;
}

/** Destaque da página inicial escrito por pessoa (dados/titulos/destaques.json). */
export interface Destaque {
  id: string;
  /** Só "aprovado" aparece no site. */
  status: "rascunho" | "aprovado";
  secao: string;
  item_id: string;
  titulo: string;
  /** Até 2 frases. */
  texto: string;
  /** Uma entrada por frase, com o trecho citado da fonte. */
  apoio: { frase: string; trecho: string; tipo_trecho?: string | null; fonte: string }[];
  fonte: { url: string; titulo?: string | null; orgao?: string | null };
  /** Data da decisão, AAAA-MM-DD. */
  data: string;
  redigido_em?: string | null;
  aprovado_por?: string | null;
}

export interface ArquivoDestaques {
  atualizado_em?: string;
  itens: Destaque[];
}

/**
 * Caminho (órgão) pelo qual a decisão foi tomada. Valores conhecidos têm rótulo pronto;
 * qualquer outro texto é aceito e exibido como veio (passe também `rotuloCaminho`).
 */
export type Caminho =
  | "camara"
  | "senado"
  | "congresso"
  | "presidencia"
  | "confaz"
  | "alesp"
  | "governador-sp"
  | "stf"
  | "stj"
  | "tcu"
  | "tce-sp"
  | "camara-atibaia"
  | "prefeitura-atibaia"
  | (string & {});

/** Forma da decisão (diretriz 5). */
export type FormaDecisao =
  | "votacao-nominal"
  | "votacao-simbolica"
  | "votacao-secreta"
  | "colegiado"
  | "ato-individual"
  | "julgamento";

/** Uma parte do placar, na ordem oficial fixa (use placarOficial() para montar). */
export interface ItemPlacar {
  rotulo: string;
  valor: number;
}

/**
 * Dado-chave do cartão — escolha UM:
 * - "mudanca": antes → depois, com os números do documento;
 * - "placar": SÓ votação nominal (diretriz 5), placar completo;
 * - "simbolica": votação simbólica, sem voto individual;
 * - "sem-votacao": decisão de colegiado ou ato individual ("Decisão sem votação: <caminho>");
 * - "contagem": contagens oficiais que não são votos (ex.: trechos de veto derrubados/mantidos);
 * - "texto": frase literal curta da fonte (ex.: tese, situação).
 */
export type DadoChave =
  | {
      tipo: "mudanca";
      antes: string | null;
      depois: string | null;
      /** Ex.: "por litro". */
      unidade?: string | null;
      /** Ex.: "Gasolina". */
      item?: string | null;
      /** Início da vigência, AAAA-MM-DD. */
      vigencia?: string | null;
    }
  | {
      tipo: "placar";
      itens: ItemPlacar[];
      /** Palavra do órgão (ex.: "aprovada"). */
      resultado?: string | null;
    }
  | { tipo: "simbolica"; resultado?: string | null }
  | {
      tipo: "sem-votacao";
      /** Ex.: "ato individual do presidente da República". */
      caminho: string;
      detalhe?: string | null;
    }
  | { tipo: "contagem"; itens: ItemPlacar[]; legenda?: string | null }
  | { tipo: "texto"; texto: string; rotulo?: string | null };
