// Diretriz 12 (privacidade): monta a "ementa_publica" de cada ato, a única exibida pelo site.
//
//   - CPF, RG e outros documentos pessoais → "[documento omitido]" (sempre, automaticamente).
//   - Nome de pessoa física que não é agente público no exercício da função →
//     "[nome de particular omitido]".
//   - Agentes públicos citados pela função (prefeito, vice, secretários, vereadores, autoria
//     de projeto) ficam; em ato de pessoal (nomeação, exoneração, aposentadoria, licença…)
//     de servidor comum, o nome é mascarado e o cargo mantido.
//   - Homenagem pública em denominação de logradouro ou próprio público (rua, praça, escola,
//     unidade de saúde…) fica; nomes de empresas e entidades ficam.
//
// Detecção: a lista de curadoria (revisao/mascaras.json, { ato_id: [{ trecho, substituir_por }] })
// é aplicada primeiro e tem prioridade; depois, padrões automáticos. Todo nome com cara de
// pessoa física sem contexto que o explique vira "dúvida": o ato não é publicado até que a
// curadoria registre a decisão em mascaras.json (substituir_por igual ao trecho = manter).
// Função pura, sem rede nem arquivo.

export const NOME_OMITIDO = '[nome de particular omitido]';
export const DOC_OMITIDO = '[documento omitido]';
/** Versão das regras; muda quando o resultado de ementas já publicadas pode mudar. */
export const VERSAO_PRIVACIDADE = 1;

const sa = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lista = (s) => new Set(sa(s).split(/\s+/).filter(Boolean));

// ---------------------------------------------------------------- documentos pessoais
const NUM_DOC = String.raw`(?:n[º°o.]*\s*:?\s*)?(?:\(\s*n[º°o.]*\s*ocultado\s*\)|[\dXx][\dXx.\-\/ ]{4,}[\dXx])`;
const DOCS = [
  // CPF/MF nº 123.456.789-01 · CPF (nº ocultado) · C.P.F.
  new RegExp(String.raw`\b(?:CPF(?:\s*\/\s*MF)?|C\.P\.F\.?)\s*${NUM_DOC}`, 'gi'),
  // RG nº 12.345.678-9 · R.G. · RG/SSP-SP
  new RegExp(String.raw`(?<![A-Za-zÀ-ÿ])(?:RG|R\.G\.?)(?:\s*\/?\s*SSP\s*[\/-]?\s*[A-Z]{2})?\s*${NUM_DOC}`, 'g'),
  new RegExp(String.raw`\b(?:CTPS|CNH|PIS(?:\s*\/\s*PASEP)?|PASEP|NIS|NIT|CNS|T[íi]tulo de Eleitor|Passaporte|Carteira de Identidade|C[ée]dula de Identidade)\s*${NUM_DOC}`, 'gi'),
  // CPF sem rótulo (000.000.000-00), sem confundir com CNPJ (00.000.000/0000-00).
  /(?<![\d.\/])\d{3}\.\d{3}\.\d{3}\s*-\s*\d{2}(?![\d\/])/g,
];

const CNPJ_APOS_NOME = new RegExp(String.raw`(\[nome de particular omitido\],?\s*(?:inscrit[oa]\s+no\s+)?)CNPJ(?:\s*\/\s*MF)?\s*(?:sob\s+o\s+)?(?:n[º°o.]*\s*:?\s*)?\d{2}\.?\s?\d{3}\.?\d{3}\s*\/?\s*\d{4}\s*-?\s*\d{2}`, 'g');

/** Só documentos pessoais (para textos internos como a fila de curadoria). */
export function semDocumentos(texto) {
  return texto == null ? texto : mascararDocumentos(String(texto)).texto;
}

function mascararDocumentos(texto) {
  let n = 0;
  for (const re of DOCS) texto = texto.replace(re, (m) => { n++; return DOC_OMITIDO + (/\s$/.test(m) ? ' ' : ''); });
  return { texto, n };
}

// ---------------------------------------------------------------- nomes
const CONECTORES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', "d'", 'di', 'del', 'van', 'von']);
const TOKEN = String.raw`[A-ZÀ-Ý][A-Za-zÀ-ÿ'´’]*\.?`;
// Sequência de palavras iniciadas por maiúscula, com conectores minúsculos no meio.
const SEQ = new RegExp(String.raw`${TOKEN}(?:\s+(?:(?:d[aeo]s?|di|del)\s+)?${TOKEN})*`, 'g');

// Palavras que, no início da sequência, indicam que não é nome de pessoa (entidade, lugar, norma…).
const NAO_PESSOA = lista(`Associação Associações Assoc Empresa Instituto Sociedade Igreja Paróquia Clube Sindicato
  Cooperativa Fundação Escola Colégio Creche Centro Hospital Santa Santo São Nossa Senhora Irmandade Organização Federação
  Confederação Liga Grêmio Corporação Banco Caixa Companhia Cia Consórcio Condomínio Loteamento Residencial Jardim Parque
  Vila Chácara Chácaras Bairro Estância Fazenda Sítio Rua Avenida Av Estrada Alameda Praça Travessa Rodovia Viela Largo Via
  Ponte Viaduto Rotatória Marginal Córrego Rio Ribeirão Lago Serra Morro Município Prefeitura Câmara Secretaria Conselho
  Comissão Comitê Fundo Plano Programa Sistema Política Lei Decreto Leis Decretos Código Estatuto Regimento Orçamento
  Anexo Artigo Art Inciso Mesa Poder Executivo Legislativo Estado União República Governo Ministério Tribunal Unidade UBS
  USF EMEF EMEI EE Ginásio Estádio Teatro Museu Biblioteca Cemitério Mercado Feira Festa Semana Dia Mês Hino Bandeira
  Guarda Defesa Polícia Corpo Junta Grupo Núcleo Departamento Divisão Diretoria Coordenadoria Procuradoria Controladoria
  Ouvidoria Autarquia Saneamento Serviço Serviços Termo Acordo Convênio Contrato Concurso Processo Projeto Regulamento
  Atibaia Brasil Brasileiro Nacional Municipal Estadual Federal Público Pública Pública Complementar Ordinária
  Membros Membro Representantes Titulares Suplentes Controle Fiscalização Gestão Desenvolvimento Assistência Educação
  Saúde Cultura Turismo Meio Ambiente Habitação Segurança Transporte Trânsito Obras Finanças Administração Planejamento
  Esporte Esportes Lazer Justiça Cidadania Direitos Comunicação Tecnologia Inovação Agricultura Abastecimento Mobilidade
  Urbanismo Infraestrutura Recursos Humanos Previdência Patrimônio Licitação Licitações Compras Contratos Pregão Avaliação
  Apuração Infrações Regulação Social Honorários Natal Carnaval Páscoa Cavalhada
  Ltda ME EIRELI SA Dispõe Altera Revoga Declara Institui Autoriza Regulamenta Nomeia Exonera Concede Cria Denomina
  Estabelece Fixa Abre Homologa Designa Dá Torna Prorroga Suspende Aprova Ratifica Delega Convoca Disciplina Acrescenta
  Vereador Vereadora Vereadores Prefeito Vice Secretário Secretária Presidente Deputado Deputada Senador Governador Ministro
  Sr Sra Senhor Dr Dra Doutor Doutora Professor Professora Prof Profa Padre Pastor Dom Frei Irmã Irmão Coronel Capitão
  Sargento Tenente Major General Cabo Soldado Delegado Juiz Juíza Engenheiro Arquiteto Mestre Maestro Coral Banda`);

// Prenomes frequentes (para reconhecer nome de pessoa sem gatilho). Não precisa ser exaustiva:
// os gatilhos (Sr., munícipe, em favor de, ato de pessoal…) pegam os demais.
const PRENOMES = lista(`Ana Maria Antônio Antonio Antonia Antônia Adriana Adriano Alessandra Alessandro Alexandre Aline
  Amanda André Andre Andréa Andreia Angela Ângela Aparecida Apparecida Benedito Benedita Bruno Bruna Camila Carla Carlos
  Carolina Caio Cairo Cecília Célia Cesar César Cícero Claudia Cláudia Claudio Cláudio Cleber Cristiane Cristina Daniel
  Daniela Danilo Davi David Débora Denise Diego Douglas Edson Eduardo Elaine Eliane Elias Elisa Elenildo Emerson Fabiana
  Fabiano Fábio Fabio Fátima Felipe Fernanda Fernando Flávia Flavia Flávio Francisca Francisco Gabriel Gabriela Geraldo
  Georgina Gilberto Gisele Giovana Guilherme Gustavo Helena Hélio Helio Heloísa Henrique Igor Isabel Isabela Ivone Jaqueline
  Jefferson João Joao Joaquim Jorge José Jose Josefa Joana Juliana Julio Júlio Juliano Karina Larissa Laura Leandro Leonardo
  Letícia Lucas Luciana Luciano Lúcia Lucia Luís Luis Luiz Luiza Luísa Manoel Manuel Marcela Marcelo Márcia Marcia Marcio
  Márcio Marco Marcos Mariana Marina Mário Mario Marta Mateus Matheus Maurício Mauricio Michele Miguel Milton Mônica Monica
  Natália Nelson Neusa Nilton Olga Osvaldo Oswaldo Patrícia Patricia Paula Pedro Rafael Rafaela Raimundo Raquel Regina
  Reinaldo Renata Renato Ricardo Roberta Roberto Rodrigo Rogério Ronaldo Rosa Rosana Rosângela Rubens Sandra Sebastião
  Sergio Sérgio Silvia Sílvia Simone Sônia Sonia Tânia Tatiane Teresa Tereza Thiago Tiago Valéria Valdir Valter Vanessa
  Vera Vicente Vinícius Vitor Vítor Victor Wagner Waldir Walter Wellington Wilson Zilda Benedicta Conceição Dirce Durval
  Ernesto Expedito Geni Hermínio Irene Ivo Jair Jairo Lourdes Lourenço Natalino Odair Orlando Otávio Pascoal Plínio
  Rosário Salvador Silvio Sílvio Takashi Tomoteru Valdemar Waldemar Zélia Zenaide`);

// Contexto à esquerda (até ~60 caracteres) que classifica a sequência.
const CTX_AGENTE = /(vereador(?:a|es|as)?|prefeit[oa]|vice-prefeit[oa]|secret[áa]ri[oa](?:\s+(?:municipal|adjunt[oa]))?(?:\s+de\s+[^,;]{3,60})?|presidente(?:\s+da\s+c[âa]mara[^,;]{0,40})?|deputad[oa]|senador(?:a)?|governador(?:a)?|ministr[oa]|autoria\s+d[oa]s?|procurador(?:a)?[- ]geral|chefe\s+de\s+gabinete|controlador(?:a)?[- ]geral|subprefeit[oa])\s*(?:municipal\s*)?[,:]?\s*(?:o|a|os|as|sr\.?|sra\.?)?\s*$/i;
const CTX_LOGRADOURO = /(?<![A-Za-zÀ-ÿ])(ruas?|avenidas?|av\.|estradas?|alamedas?|pra[çc]as?|travessas?|rodovias?|vielas?|largo|via|ponte|viaduto|cal[çc]ad[ãa]o|galeria|espa[çc]o|rotat[óo]ria|marginal|passarela|parque|bosque|escola(?:\s+municipal|\s+estadual)?(?:\s+de\s+[^,;]{3,40})?|emef|emei|e\.?\s?e\.?|creche|centro(?:\s+de\s+[^,;]{3,40})?|unidade\s+b[áa]sica\s+de\s+sa[úu]de|ubs|usf|gin[áa]sio|est[áa]dio|teatro|museu|biblioteca|quadra|campo|complexo|cemit[ée]rio|terminal|plen[áa]rio|sala|audit[óo]rio|loteamento|residencial|jardim|vila|bairro|condom[íi]nio|fazenda|s[íi]tio|ch[áa]caras?|hospital|pronto[- ]socorro|policl[íi]nica|cras|creas|caps)\s*(?:municipal\s*)?(?:d[aeo]s?\s*)?(?:prof(?:essor|essora|a)?\.?\s*|dr\.?\s*|dra\.?\s*|doutor(?:a)?\s*|padre\s*|vereador(?:a)?\s*|pastor\s*|maestro\s*|irm[ãa]\s*)?[“"']?\s*$/i;
const CTX_DENOMINACAO = /(denomina[çc][ãa]o|denomina|denominad[oa]|nome\s+d[eoa]|passa\s+a\s+(?:se\s+)?(?:chamar|denominar))\s+(?:d[eoa]s?\s+)?(?:atual\s+)?[“"']?\s*$/i;
const CTX_ENTIDADE_DIR = /^\s*(?:,?\s*(?:inscrit[oa]|CNPJ|Ltda|EIRELI|S\.?\/?A\.?\b|ME\b|EPP\b|Eireli))/i;
// Gatilhos de particular: o nome que vem a seguir é de pessoa física destinatária do ato.
const CTX_PARTICULAR = /(\bsr\.?|\bsra\.?|\bsr[ªa]\.?|\bsenhor|\bsenhora|\bmun[íi]cipe|\bpermission[áa]ri[oa]|\bbenefici[áa]ri[oa]|\brequerente|\binteressad[oa]|\bpropriet[áa]ri[oa]|\bposseir[oa]|\blocat[áa]ri[oa]|\bcession[áa]ri[oa]|\bem\s+favor\s+d[eoa]s?|\besp[óo]lio\s+de|\bherdeiros\s+de|\bem\s+nome\s+de|\bpessoa\s+de|\bservidor(?:a)?|\bfuncion[áa]ri[oa]|\bpensionista|\bvi[úu]v[oa])\s*:?\s*$/i;
// Ato de pessoal: o nome é do servidor; mascara, salvo cargo político/de alta direção.
const ATO_PESSOAL = /^(nomeia|exonera|aposenta|concede\s+(?:aposentadoria|licen[çc]a|pens[ãa]o|afastamento|f[ée]rias|adicional|gratifica[çc][ãa]o|progress[ãa]o)|designa|dispensa|readapta|reintegra|demite|p[õo]e\s+[àa]\s+disposi[çc][ãa]o|cede|torna\s+sem\s+efeito\s+a\s+(?:nomea|exonera)|declara\s+vac[âa]ncia|transfere|remove|promove)\b/i;
const CARGO_POLITICO = /\b(secret[áa]ri[oa](?:\s+(?:municipal|adjunt[oa]|executiv[oa]))?|prefeit[oa]|vice-prefeit[oa]|subprefeit[oa]|procurador(?:a)?[- ]geral|controlador(?:a)?[- ]geral|chefe\s+de\s+gabinete|ouvidor(?:a)?[- ]geral|presidente\s+d[oa]\s+(?:saae|autarquia|instituto|funda[çc][ãa]o)|diretor(?:a)?[- ]presidente|superintendente)\b/i;
// O cargo político tem de ser o próprio objeto do ato ("Nomeia Fulano para o cargo de Secretário…",
// "Exonera Fulano do cargo de Procurador-Geral…"); menção mais adiante não basta (aí mascara).
const CARGO_DO_ATO = new RegExp(String.raw`^\s*,?\s*(?:(?:para\s+(?:exercer\s+)?|n[oa]\s+|d[oa]\s+)?(?:[oa]\s+)?(?:cargo|fun[çc][ãa]o)\s+(?:em\s+comiss[ãa]o\s+|p[úu]blic[oa]\s+)?(?:de\s+)?|como\s+|para\s+)?` + CARGO_POLITICO.source, 'i');
// "concede … a/à/ao Fulano" (honraria, uso de área, isenção…): destinatário pode ser pessoa física.
const CTX_CONCEDE_A = /\b(concede|confere|outorga|autoriza(?:[çc][ãa]o)?\s+(?:de\s+)?uso|permiss[ãa]o\s+de\s+uso|uso\s+a\s+t[íi]tulo\s+(?:de\s+uso\s+)?prec[áa]rio|cess[ãa]o|doa[çc][ãa]o|isen[çc][ãa]o|remiss[ãa]o|indeniza[çc][ãa]o|restitui[çc][ãa]o|ressarcimento|pagamento)\b[^.;]{0,160}?(?<![A-Za-zÀ-ÿ])(?:a|à|ao|aos|às)\s*$/i;
const CTX_HONRARIA = /(t[íi]tulo\s+de\s+cidad[ãa][oa]?[^,;]{0,30}|medalha[^,;]{0,60}|comenda[^,;]{0,60}|diploma[^,;]{0,60}|honraria[^,;]{0,60}|voto\s+de\s+(?:louvor|aplauso|congratula[çc][õo]es))\s+(?:a|à|ao|para\s+[oa]?)?\s*(?:sr\.?|sra\.?)?\s*[“"']?\s*$/i;

/** Nome dentro de uma enumeração de autores ("de autoria dos Vereadores A, Dr. B e C"). */
const GATILHO_AGENTES = /(?:autoria\s+d[oa]s?|vereador(?:a|es|as)?)\s+(?:vereador(?:a|es|as)?\s+)?([^;()]*)$/i;
const GATILHO_LOGRADOUROS = /(?<![A-Za-zÀ-ÿ])(?:ruas|avenidas|estradas|alamedas|pra[çc]as|travessas|rodovias)\s+([^;()]*)$/i;
function listaDeAgentes(antes, gatilho = GATILHO_AGENTES) {
  const m = antes.match(gatilho);
  if (!m) return false;
  return /^(?:[A-ZÀ-Ý][A-Za-zÀ-ÿ'´’.]*\s*|(?:d[aeo]s?|e)\s+|,\s*)*$/.test(m[1]) && /(?:,|\se)\s*$|^$/.test(m[1]);
}

function tokens(seq) { return seq.split(/\s+/).filter((t) => !CONECTORES.has(sa(t))); }
const caixaAlta = (t) => t.length > 1 && t === t.toUpperCase() && /[A-ZÀ-Ý]{2}/.test(t);

/** A sequência tem forma de nome de pessoa? (≥ 2 palavras de nome, 1.ª não é palavra de entidade/lugar.) */
function formaDeNome(seq) {
  const tk = tokens(seq);
  if (tk.length < 2) return false;
  const primeira = sa(tk[0].replace(/\.$/, ''));
  if (NAO_PESSOA.has(primeira)) return false;
  if (tk.some((t) => /\d/.test(t))) return false;
  // Siglas soltas (SAAE, CNPJ) não são nome.
  if (tk.every((t) => caixaAlta(t) && t.length <= 5)) return false;
  return true;
}

/** Corta tratamento/conector no início e pontuação no fim da sequência. */
const PREFIXO_ENTIDADE = /(?:^|\s)(?:Associa[çc][ãa]o|Instituto|Funda[çc][ãa]o|Escola|Col[ée]gio|Creche|Centro|Hospital|Igreja|Par[óo]quia|Clube|Sindicato|Cooperativa|Empresa|Sociedade|Irmandade|Organiza[çc][ãa]o|Federa[çc][ãa]o|Liga|Gr[êe]mio|Corpora[çc][ãa]o|Banco|Companhia|Cons[óo]rcio|Condom[íi]nio|Loteamento|Residencial|Jardim|Parque|Vila|Ch[áa]caras?|Bairro|Fazenda|S[íi]tio|Rua|Avenida|Av|Estrada|Alameda|Pra[çc]a|Travessa|Rodovia|Viela|Largo|Ponte|Viaduto|Unidade|UBS|USF|EMEF|EMEI|EE|Gin[áa]sio|Est[áa]dio|Teatro|Museu|Biblioteca|Cemit[ée]rio|Mercado|Terminal|Galeria|S[ãa]o|Sant[oa]|Senhora|Beat[oa]|Papa)(?![A-Za-zÀ-ÿ])/i;

function limparSeq(seq) {
  return seq.replace(/^(?:(?:Sr|Sra|Srª|Dr|Dra|Prof|Profa)\.?\s+)+/, '').replace(/[.,;:]+$/, '');
}

/**
 * Classifica cada sequência com forma de nome da ementa.
 * Devolve [{ trecho, inicio, acao: 'mascarar'|'manter'|'duvida', motivo }].
 */
export function analisarNomes(ementa) {
  const res = [];
  const pessoal = ATO_PESSOAL.test(ementa.trim());
  for (const m of ementa.matchAll(SEQ)) {
    let seq = m[0];
    let ini = m.index;
    const semTrat = limparSeq(seq);
    ini += seq.indexOf(semTrat);
    seq = semTrat;
    // Palavras de entidade/lugar/verbo no início ("Exonera MARIA…", "Rua José…", "Semana Ana…")
    // saem da sequência e passam a ser contexto à esquerda.
    let resto = seq;
    for (let mm; (mm = resto.match(/^(\S+)\s+/));) {
      const t = sa(mm[1].replace(/[.“”"']/g, ''));
      if (!NAO_PESSOA.has(t) && !CONECTORES.has(t)) break;
      resto = resto.slice(mm[0].length);
    }
    const prefixo = seq.slice(0, seq.length - resto.length);
    ini += prefixo.length;
    seq = resto;
    if (!formaDeNome(seq)) {
      // Nome após "Sr./Sra." com uma só palavra de nome também é particular.
      const esq = ementa.slice(Math.max(0, ini - 40), ini);
      if (tokens(seq).length === 1 && /\b(?:sr|sra|srª)\.?\s*$/i.test(esq) && /^[A-ZÀ-Ý][a-zà-ÿ]{2,}$/.test(seq)) {
        res.push({ trecho: seq, inicio: ini, acao: 'mascarar', motivo: 'nome após tratamento (Sr./Sra.)' });
      }
      continue;
    }
    // Títulos antes do nome ("Vereador Dr. Fulano", "Rua Prof. Beltrano") não mudam o contexto.
    const esq = ementa.slice(Math.max(0, ini - 90), ini)
      .replace(/(?:(?:Dr|Dra|Prof|Profa|Professor|Professora|Doutor|Doutora|Coronel|Capitão|Sargento|Tenente|Major|Pastor|Padre|Maestro)\.?\s+)+$/i, '');
    const dir = ementa.slice(ini + seq.length, ini + seq.length + 40);
    const tk = tokens(seq);
    const prenomeConhecido = PRENOMES.has(sa(tk[0]));
    const emCaixaAlta = tk.every(caixaAlta);
    const prefixoSoVerbo = !prefixo.trim() || (ATO_PESSOAL.test(prefixo.trim()) && prefixo.trim().split(/\s+/).length <= 2);
    let acao = null, motivo = null;
    // Parte do nome de entidade, lugar, santo ou próprio público ("Associação Fulano", "Festa de São João Paulo II").
    if (PREFIXO_ENTIDADE.test(prefixo)) { acao = 'manter'; motivo = 'nome de entidade, lugar, santo ou próprio público'; }
    else if (CTX_HONRARIA.test(esq)) { acao = 'duvida'; motivo = 'honraria a pessoa (título, medalha); conferir se é particular'; }
    // Nome de pessoa como destinatário, mesmo seguido de CNPJ (microempreendedor individual).
    else if (!CTX_PARTICULAR.test(esq) && CTX_CONCEDE_A.test(esq) && prenomeConhecido) { acao = 'mascarar'; motivo = 'destinatário do ato com nome de pessoa (concede/autoriza … a)'; }
    else if (CTX_ENTIDADE_DIR.test(dir) && !CTX_PARTICULAR.test(esq)) { acao = 'manter'; motivo = 'nome de empresa ou entidade (CNPJ/razão social)'; }
    else if (CTX_PARTICULAR.test(esq)) { acao = 'mascarar'; motivo = 'nome após indicação de particular (Sr./Sra., munícipe, permissionário, em favor de…)'; }
    else if (CTX_AGENTE.test(esq) || listaDeAgentes(ementa.slice(Math.max(0, ini - 400), ini))) { acao = 'manter'; motivo = 'agente público citado pela função'; }
    else if (CTX_LOGRADOURO.test(esq) || CTX_DENOMINACAO.test(esq) || listaDeAgentes(esq, GATILHO_LOGRADOUROS)) { acao = 'manter'; motivo = 'homenagem em denominação de logradouro ou próprio público'; }
    else if (pessoal && ini < 140 && prefixoSoVerbo) {
      const resto = ementa.slice(ini + seq.length, ini + seq.length + 160);
      if (CARGO_DO_ATO.test(resto)) { acao = 'manter'; motivo = 'agente político (secretário, procurador-geral…) em ato sobre a função pública'; }
      else if (prenomeConhecido || emCaixaAlta) { acao = 'mascarar'; motivo = 'ato de pessoal de servidor (nome omitido, cargo mantido)'; }
      else { acao = 'duvida'; motivo = 'ato de pessoal: conferir se o trecho é nome de servidor'; }
    }
    else if (CTX_CONCEDE_A.test(esq) && (prenomeConhecido || emCaixaAlta)) { acao = 'mascarar'; motivo = 'destinatário do ato com nome de pessoa (concede/autoriza … a)'; }
    else if (CTX_CONCEDE_A.test(esq)) { acao = 'duvida'; motivo = 'destinatário do ato pode ser pessoa física ou entidade'; }
    else if (prenomeConhecido || (emCaixaAlta && tk.some((t) => PRENOMES.has(sa(t))))) { acao = 'duvida'; motivo = emCaixaAlta ? 'nome em caixa alta sem contexto que o explique' : 'nome de pessoa sem contexto que o explique'; }
    if (acao) res.push({ trecho: seq, inicio: ini, acao, motivo });
  }
  return res;
}

/**
 * Monta a ementa pública.
 * regras: entradas da curadoria para este ato ([{ trecho, substituir_por }]); substituir_por igual
 * ao trecho registra a decisão de manter. Devolve
 * { ementa_publica, mascaras: [{ trecho, origem: 'lista'|'automatico', motivo }], documentos, duvidas: [{ trecho, motivo }] }.
 */
export function ementaPublica(ementa, regras = []) {
  if (!ementa) return { ementa_publica: ementa ?? null, mascaras: [], documentos: 0, duvidas: [] };
  let texto = ementa;
  const mascaras = [];
  const decididos = new Set();
  // 1) Lista de curadoria (prioridade). Trecho ausente na ementa é dúvida (lista desatualizada).
  const duvidas = [];
  for (const r of regras || []) {
    if (!r || typeof r.trecho !== 'string' || !r.trecho || typeof r.substituir_por !== 'string') {
      duvidas.push({ trecho: String(r?.trecho ?? ''), motivo: 'entrada inválida em mascaras.json' });
      continue;
    }
    decididos.add(sa(r.trecho));
    if (!texto.includes(r.trecho)) {
      if (!ementa.includes(r.trecho)) duvidas.push({ trecho: r.trecho, motivo: 'trecho de mascaras.json não encontrado na ementa' });
      continue;
    }
    if (r.substituir_por !== r.trecho) {
      texto = texto.split(r.trecho).join(r.substituir_por);
      mascaras.push({ trecho: r.trecho, origem: 'lista', motivo: r.motivo || 'lista de curadoria' });
    }
  }
  // 2) Documentos pessoais.
  const d = mascararDocumentos(texto);
  texto = d.texto;
  // 3) Nomes (sobre o texto já tratado; trechos decididos pela curadoria não voltam a ser avaliados).
  const achados = analisarNomes(texto).filter((a) => ![...decididos].some((k) => sa(a.trecho).includes(k) || k.includes(sa(a.trecho))));
  const aMascarar = achados.filter((a) => a.acao === 'mascarar').sort((a, b) => b.inicio - a.inicio);
  for (const a of aMascarar) {
    texto = texto.slice(0, a.inicio) + NOME_OMITIDO + texto.slice(a.inicio + a.trecho.length);
    mascaras.push({ trecho: a.trecho, origem: 'automatico', motivo: a.motivo });
  }
  // CNPJ ligado a nome omitido (microempreendedor individual) identifica a pessoa: também sai.
  let cnpjs = 0;
  texto = texto.replace(CNPJ_APOS_NOME, (m, pre) => { cnpjs++; return pre + DOC_OMITIDO; });
  for (const a of achados.filter((x) => x.acao === 'duvida')) duvidas.push({ trecho: a.trecho, motivo: a.motivo });
  // 4) Rede de segurança: nada com cara de CPF/RG pode sobrar.
  if (temDocumentoPessoal(texto)) duvidas.push({ trecho: '(documento)', motivo: 'padrão de documento pessoal restou após o mascaramento' });
  return { ementa_publica: texto, mascaras, documentos: d.n + cnpjs, duvidas };
}

/** Busca de segurança por CPF/RG em texto já publicado. */
export function temDocumentoPessoal(texto) {
  const t = String(texto ?? '');
  return /(?<![\d.\/])\d{3}\.?\d{3}\.?\d{3}\s*-\s*\d{2}(?![\d\/])/.test(t)
    || /\b(?:CPF|C\.P\.F)\b/i.test(t)
    || /(?<![A-Za-zÀ-ÿ])(?:RG|R\.G\.)(?![A-Za-zÀ-ÿ])\s*(?:n[º°o.]*\s*)?\d/.test(t)
    || /(?<![\d.])\d{1,2}\.\d{3}\.\d{3}\s*-\s*[\dXx](?![\d\/])/.test(t);
}
