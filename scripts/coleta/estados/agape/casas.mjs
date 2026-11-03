// Casas legislativas que usam o SPL da Ágape Consultoria e as bases de normas de cada estado.
// Cuidados registrados na pesquisa (docs/pesquisa/estados/se.md e ba.md):
//   - Alese: campo "arquivo" com domínio duplicado; sem endpoint de sessões (404); páginas exibem
//     "Resumo Gerado com Inteligência Artificial" — nunca usado (só ementa e texto oficial).
//   - ALBA: campo "situacao" desatualizado (PL já virado lei aparece "TRAMITANDO") — guardado
//     literal, com lacuna, e nunca usado para dizer se virou lei; detalhe de sessão dá HTTP 500.
//   - Nenhuma das duas publica o voto de cada deputado.
export const CASAS = {
  se: {
    uf: 'SE',
    casa: 'alese',
    nome: 'Assembleia Legislativa do Estado de Sergipe (Alese)',
    sigla: 'Alese',
    host: 'aleselegis.al.se.leg.br',
    dominios_email: ['al.se.leg.br'],
    situacao_confiavel: true,
    // Normas: LegisOn (Procuradoria-Geral do Estado) + legislação da Alese (liga lei → projeto).
    normas: {
      legison: { host: 'api.legislacao.se.gov.br', portal: 'https://legislacao.se.gov.br', orgao: 'Procuradoria-Geral do Estado de Sergipe (PGE-SE) — LegisOn' },
      alese_legislacao: true,
    },
  },
  ba: {
    uf: 'BA',
    casa: 'alba',
    nome: 'Assembleia Legislativa do Estado da Bahia (ALBA)',
    sigla: 'ALBA',
    host: 'albalegis.nopapercloud.com.br',
    dominios_email: ['alba.ba.gov.br', 'al.ba.gov.br'],
    situacao_confiavel: false,
    // Normas: Legisla Bahia (Casa Civil) só se o robots.txt permitir; senão, as leis citadas
    // na tramitação oficial da ALBA ("Promulgada a Lei nº …", "Publicada a Lei nº …").
    normas: {
      legisla_bahia: { host: 'www.legislabahia.ba.gov.br', orgao: 'Casa Civil do Estado da Bahia — Legisla Bahia' },
      da_tramitacao: true,
    },
  },
};

export const LACUNA_SITUACAO_ALBA =
  'Situação: o campo "situação" do sistema da ALBA está desatualizado (proposições já transformadas em lei aparecem como "TRAMITANDO"); usar a tramitação oficial.';

// Tipos de LegisOn (id da API → rótulo, prefixo do id e caminho da página pública).
export const TIPOS_LEGISON = [
  { id: 3, tipo: 'Lei Ordinária', prefixo: 'lei', slug: 'lei-ordinaria' },
  { id: 2, tipo: 'Lei Complementar', prefixo: 'lc', slug: 'lei-complementar' },
  { id: 8, tipo: 'Emenda Constitucional', prefixo: 'ec', slug: 'emenda-constitucional' },
  { id: 4, tipo: 'Decreto Numerado', prefixo: 'dec', slug: 'decreto-numerado' },
];
