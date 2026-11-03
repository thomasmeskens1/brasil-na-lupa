// Tabela pública de correspondência: classificação oficial → tema do dia a dia.
// A primeira regra que casar, na ordem da lista, define o tema (as específicas vêm antes das gerais).
// Nenhuma regra lê o conteúdo para "adivinhar" o assunto: só rótulos oficiais (Câmara: temas e
// palavras-chave da indexação; Senado: classificações; STJ/STF: assuntos da tabela do CNJ) ou o
// tipo do ato/decisão quando a fonte não classifica.

export const TEMAS = [
  'Impostos e preços', 'Trabalho e renda', 'Saúde', 'Educação', 'Segurança', 'Meio ambiente',
  'Transporte e cidades', 'Previdência e assistência', 'Economia e empresas', 'Direitos e cidadania',
  'Governo e instituições', 'Outros',
];

// fonte: camara-tema | camara-palavra-chave | senado-classificacao | assunto-judicial | tipo
export const REGRAS = [
  // Impostos e preços
  { fonte: 'camara-palavra-chave', padrao: '\\b(imposto|tributo|tributári[ao]|tributação|ICMS|IPI|IOF|IPVA|IPTU|ISS|IBS|CBS|Cofins|PIS/Pasep|alíquota|imposto de renda|Imposto Seletivo|substituição tributária)\\b', tema: 'Impostos e preços' },
  { fonte: 'senado-classificacao', padrao: '\\bTribut', tema: 'Impostos e preços' },
  { fonte: 'assunto-judicial', padrao: 'DIREITO TRIBUTÁRIO', tema: 'Impostos e preços' },
  { fonte: 'tipo', padrao: '^icms$', tema: 'Impostos e preços' },
  // Saúde
  { fonte: 'camara-tema', padrao: '^Saúde$', tema: 'Saúde' },
  { fonte: 'senado-classificacao', padrao: '(^|/ )Saúde\\b', tema: 'Saúde' },
  { fonte: 'assunto-judicial', padrao: 'DIREITO DA SAÚDE|Sistema Único de Saúde|Planos de Saúde|Saúde Suplementar', tema: 'Saúde' },
  // Educação
  { fonte: 'camara-tema', padrao: '^Educação$', tema: 'Educação' },
  { fonte: 'senado-classificacao', padrao: '(^|/ )Educação\\b', tema: 'Educação' },
  { fonte: 'assunto-judicial', padrao: 'Ensino|Educação|DIREITO EDUCACIONAL', tema: 'Educação' },
  // Segurança
  { fonte: 'camara-tema', padrao: '^(Defesa e Segurança|Direito Penal e Processual Penal)$', tema: 'Segurança' },
  { fonte: 'senado-classificacao', padrao: 'Segurança Pública|Direito Penal|Defesa Nacional|Crimes?\\b', tema: 'Segurança' },
  { fonte: 'assunto-judicial', padrao: 'DIREITO PENAL|DIREITO PROCESSUAL PENAL|Execução Penal', tema: 'Segurança' },
  // Previdência e assistência
  { fonte: 'camara-tema', padrao: '^Previdência e Assistência Social$', tema: 'Previdência e assistência' },
  { fonte: 'senado-classificacao', padrao: 'Previdência|Assistência Social', tema: 'Previdência e assistência' },
  { fonte: 'assunto-judicial', padrao: 'DIREITO PREVIDENCIÁRIO|DIREITO ASSISTENCIAL|Previdência Privada', tema: 'Previdência e assistência' },
  // Trabalho e renda
  { fonte: 'camara-tema', padrao: '^Trabalho e Emprego$', tema: 'Trabalho e renda' },
  { fonte: 'senado-classificacao', padrao: 'Trabalho e Emprego|Trabalho\\b|Emprego', tema: 'Trabalho e renda' },
  { fonte: 'assunto-judicial', padrao: 'DIREITO DO TRABALHO|Servidor Público Civil|Remuneração|FGTS', tema: 'Trabalho e renda' },
  // Meio ambiente
  { fonte: 'camara-tema', padrao: '^(Meio Ambiente e Desenvolvimento Sustentável|Energia, Recursos Hídricos e Minerais|Estrutura Fundiária)$', tema: 'Meio ambiente' },
  { fonte: 'senado-classificacao', padrao: 'Meio Ambiente|Recursos Hídricos|Mudanças Climáticas', tema: 'Meio ambiente' },
  { fonte: 'assunto-judicial', padrao: 'DIREITO AMBIENTAL|Meio Ambiente|Dano Ambiental', tema: 'Meio ambiente' },
  // Transporte e cidades
  { fonte: 'camara-tema', padrao: '^(Viação, Transporte e Mobilidade|Cidades e Desenvolvimento Urbano)$', tema: 'Transporte e cidades' },
  { fonte: 'senado-classificacao', padrao: 'Transporte|Trânsito|Desenvolvimento Urbano|Habitação|Saneamento', tema: 'Transporte e cidades' },
  { fonte: 'assunto-judicial', padrao: 'Trânsito|Transporte|Desapropriação|Urban', tema: 'Transporte e cidades' },
  { fonte: 'tipo', padrao: '^denominacao$', tema: 'Transporte e cidades' },
  // Economia e empresas
  { fonte: 'camara-tema', padrao: '^(Economia|Indústria, Comércio e Serviços|Agricultura, Pecuária, Pesca e Extrativismo|Relações Internacionais e Comércio Exterior|Turismo|Ciência, Tecnologia e Inovação|Comunicações|Direito e Defesa do Consumidor)$', tema: 'Economia e empresas' },
  { fonte: 'senado-classificacao', padrao: 'Economia|Indústria|Comércio|Agricultura|Agropecuária|Energia|Minas|Sistema Financeiro|Consumidor|Comunicações|Ciência|Tecnologia|Turismo', tema: 'Economia e empresas' },
  { fonte: 'assunto-judicial', padrao: 'DIREITO DO CONSUMIDOR|DIREITO EMPRESARIAL|DIREITO COMERCIAL|Contratos Bancários|Sistema Financeiro|DIREITO MARÍTIMO|Propriedade Industrial|Recuperação Judicial|Falência', tema: 'Economia e empresas' },
  // Direitos e cidadania
  { fonte: 'camara-tema', padrao: '^(Direitos Humanos e Minorias|Direito Civil e Processual Civil|Direito e Justiça|Arte, Cultura e Religião|Esporte e Lazer)$', tema: 'Direitos e cidadania' },
  { fonte: 'senado-classificacao', padrao: 'Direitos Humanos|Cidadania|Minorias|Família|Criança|Idoso|Pessoa com Deficiência|Mulher|Cultura|Desporto|Esporte|Jurídico|Direito Civil', tema: 'Direitos e cidadania' },
  { fonte: 'assunto-judicial', padrao: 'DIREITO CIVIL|DIREITO PROCESSUAL CIVIL|DIREITO DA CRIANÇA|Família|Sucessões|Responsabilidade Civil|DIREITO CONSTITUCIONAL', tema: 'Direitos e cidadania' },
  // Governo e instituições
  { fonte: 'camara-tema', padrao: '^(Administração Pública|Finanças Públicas e Orçamento|Processo Legislativo e Atuação Parlamentar|Política, Partidos e Eleições|Direito Constitucional)$', tema: 'Governo e instituições' },
  { fonte: 'senado-classificacao', padrao: 'Administração Pública|Orçamento|Organização do Estado|Política|Processo Legislativo|Eleitoral|Poder|Servidor', tema: 'Governo e instituições' },
  { fonte: 'assunto-judicial', padrao: 'DIREITO ADMINISTRATIVO|DIREITO ELEITORAL|DIREITO FINANCEIRO|Improbidade', tema: 'Governo e instituições' },
  { fonte: 'tipo', padrao: '^(credito-orcamentario|indicacao-autoridade|contas-publicas|veto-orcamento|organizacao-poder)$', tema: 'Governo e instituições' },
  // Outros
  { fonte: 'camara-tema', padrao: '^(Homenagens e Datas Comemorativas|Ciências Exatas e da Terra|Ciências Sociais e Humanas)$', tema: 'Outros' },
  { fonte: 'senado-classificacao', padrao: 'Honorífico|Homenage', tema: 'Outros' },
  { fonte: 'tipo', padrao: '^(homenagem|outro)$', tema: 'Outros' },
];
const COMPILADAS = REGRAS.map((r) => ({ ...r, re: new RegExp(r.padrao, r.fonte === 'tipo' ? 'u' : 'iu') }));

/**
 * rotulos: [{ fonte, valor }] — classificações oficiais do item.
 * Retorna { tema, criterio: { fonte, valor, regra } } (Outros quando nada casar).
 */
export function classificar(rotulos) {
  for (const r of COMPILADAS) {
    for (const rot of rotulos) {
      if (rot.fonte === r.fonte && rot.valor && r.re.test(rot.valor)) {
        return { tema: r.tema, criterio: { fonte: rot.fonte, valor: rot.valor } };
      }
    }
  }
  return { tema: 'Outros', criterio: { fonte: 'nenhuma', valor: null } };
}

/**
 * Tipo do ato, para seções sem classificação oficial: decidido pela fórmula inicial da ementa
 * (fórmulas fixas de redação legislativa, não pelo assunto).
 */
export function tipoDoAto(ementa) {
  const e = String(ementa || '');
  if (/^(abre|dispõe sobre a abertura de) (um )?crédito|crédito (adicional )?(suplementar|especial|extraordinário)/iu.test(e)) return 'credito-orcamentario';
  if (/^(denomina|dá (a )?denominação|dá nome)/iu.test(e)) return 'denominacao';
  if (/^(institui (o|a) (dia|semana|mês|campanha)|inclui no calendário|confere o título|declara .{0,80}capital nacional|declara de utilidade pública|concede (o )?título)/iu.test(e)) return 'homenagem';
  if (/^(submete|escolhe|aprova a indicação|indica)\b.{0,200}\b(cargo|compor|integrar)/iu.test(e)) return 'indicacao-autoridade';
  return null;
}

export function tabelaPublica() {
  return {
    descricao: 'Correspondência entre a classificação oficial de cada órgão e os temas do dia a dia usados no Brasil na Lupa. A primeira regra que casar, na ordem abaixo, define o tema. Quando a fonte não classifica o item, vale o tipo do ato (fórmula inicial da ementa: crédito orçamentário, denominação, homenagem, indicação de autoridade) ou o tipo de decisão (ICMS, contas públicas). Sem correspondência: "Outros".',
    temas: TEMAS,
    fontes_de_classificacao: {
      'camara-tema': 'Câmara dos Deputados — temas oficiais da proposição (Dados Abertos, /proposicoes/{id}/temas)',
      'camara-palavra-chave': 'Câmara dos Deputados — palavras-chave da indexação oficial (campo keywords da proposição)',
      'senado-classificacao': 'Senado Federal — classificações temáticas do processo (Dados Abertos, /processo/{id}, campo classificacoes)',
      'assunto-judicial': 'STJ e STF — assuntos da Tabela Processual Unificada do CNJ registrados no tema',
      tipo: 'Tipo do ato ou da decisão, quando a fonte não traz classificação temática',
    },
    regras: REGRAS.map(({ fonte, padrao, tema }, i) => ({ ordem: i + 1, fonte, padrao, tema })),
  };
}
