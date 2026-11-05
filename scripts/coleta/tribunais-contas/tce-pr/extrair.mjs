// Funções puras (sem rede): leitor de CSV em streaming e extração de trechos literais do CSV de acórdãos
// do TCE-PR e da deliberação do PDF. Nada é deduzido: só se guarda o que está escrito na fonte.

export const COLUNAS = [
  'DsTipoAto', 'NrAto', 'AnoAto', 'SgUnidAdm', 'DsClasseProcessual', 'DsSubClasseProcessual', 'NrProcesso', 'AnoProcesso',
  'DsTitulo', 'DsResumo', 'NmCategoriaPublicacao', 'DsColegiado', 'DsEntidade', 'DsInteressado', 'DsVeiculoPublicacao',
  'NmAdvogados', 'DtPublicacaoDOE', 'DtSessao', 'NrDOE', 'NmRelator', 'Termos', 'ReferenciaLegislativas', 'DsTema', 'UrlPDF',
];

/**
 * Leitor de CSV (separador ';', aspas duplas, quebras de linha dentro de aspas) que recebe o texto em pedaços.
 * aoRegistro recebe um objeto por linha, com as colunas do cabeçalho; o cabeçalho é conferido com COLUNAS.
 */
export function criarLeitorCsv(aoRegistro) {
  let campo = '', linha = [], aspas = false, aspaPendente = false, cab = null, inicio = true;
  const fecharLinha = () => {
    linha.push(campo); campo = '';
    if (linha.length === 1 && linha[0] === '') { linha = []; return; }
    if (!cab) {
      cab = linha.map((c) => c.trim());
      if (cab.length !== COLUNAS.length || COLUNAS.some((c, i) => cab[i] !== c)) throw new Error(`cabeçalho inesperado no CSV: ${cab.join(';').slice(0, 300)}`);
    } else {
      if (linha.length !== cab.length) throw new Error(`linha com ${linha.length} colunas (esperado ${cab.length})`);
      aoRegistro(Object.fromEntries(cab.map((c, i) => [c, linha[i].trim()])));
    }
    linha = [];
  };
  return {
    empurrar(txt) {
      for (let i = 0; i < txt.length; i++) {
        let c = txt[i];
        if (inicio) { inicio = false; if (c === '﻿') continue; }
        if (aspaPendente) {
          aspaPendente = false;
          if (c === '"') { campo += '"'; continue; }
          aspas = false;
        }
        if (aspas) {
          if (c === '"') aspaPendente = true; else campo += c;
        } else if (c === '"' && campo === '') aspas = true;
        else if (c === ';') { linha.push(campo); campo = ''; }
        else if (c === '\n') fecharLinha();
        else if (c !== '\r') campo += c;
      }
    },
    fim() {
      if (aspaPendente) { aspaPendente = false; aspas = false; }
      if (aspas) throw new Error('CSV terminou dentro de aspas (arquivo truncado?)');
      if (campo !== '' || linha.length) fecharLinha();
      if (!cab) throw new Error('CSV vazio');
    },
  };
}

export const CLASSE_PREFEITO = 'PRESTAÇÃO DE CONTAS DO PREFEITO MUNICIPAL';
export const CLASSE_GOVERNADOR = 'PRESTAÇÃO DE CONTAS DO GOVERNADOR DO ESTADO';
export const TIPOS_PARECER = new Set(['Parecer Prévio', 'Acórdão de Parecer Prévio']);

const RE_EXERCICIO = /exerc[íi]cio\s+(?:financeiro\s+)?(?:de\s+)?(\d{4})\b/i;

/** Exercício escrito no texto ("exercício de 2024"): { ano, trecho } ou null. */
export function exercicioNoTexto(texto) {
  const t = String(texto || '').normalize('NFC');
  const m = t.match(RE_EXERCICIO);
  return m ? { ano: Number(m[1]), trecho: m[0].replace(/\s+/g, ' ') } : null;
}

/** Exercício literal do registro: primeiro DsTema, depois DsResumo. */
export function exercicioDoRegistro(r) {
  for (const campo of ['DsTema', 'DsResumo']) {
    const e = exercicioNoTexto(r[campo]);
    if (e) return { ...e, campo };
  }
  return null;
}

/**
 * Frase do resumo (DsResumo) que diz a conclusão do parecer, copiada literalmente. Só aceita frases que
 * afirmam a conclusão ("Parecer Prévio pela …", "Pela regularidade …", "Regularidade com ressalva das contas"),
 * nunca "Proposta de Parecer Prévio" (proposta do relator, não a decisão).
 */
export function conclusaoNoResumo(resumo) {
  const frases = String(resumo || '').normalize('NFC').replace(/\s+/g, ' ').split(/(?<=\.)\s+/);
  for (const f of frases) {
    if (/proposta/i.test(f)) continue;
    if (/\bparecer pr[ée]vio (?:favor[áa]vel |desfavor[áa]vel )?pel[ao]s? (?:ir)?regularidade/i.test(f)
      || /^(?:pela|pelas) (?:ir)?regularidade/i.test(f)
      || /^(?:ir)?regularidade (?:com ressalvas? )?das contas/i.test(f)
      || /^contas (?:ir)?regulares\b/i.test(f)) {
      const m = f.match(/parecer pr[ée]vio .*$/i);
      return (m ? m[0] : f).trim();
    }
  }
  return null;
}

// Linhas de cabeçalho/rodapé repetidas nas páginas dos PDFs do TCE-PR.
const RUIDO = [/^TRIBUNAL DE CONTAS DO ESTADO DO PARAN[ÁA]$/, /^DOCUMENTO E ASSINATURA/i, /^AUTENTICIDADE E ORIGINAL/i, /^\d{1,4}$/, /^PCA \d{4} \|/i, /^Processo n\.?º? .*\| (Acórdão|Parecer)/i];

function limparTexto(texto) {
  return String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !RUIDO.some((r) => r.test(l))).join(' ')
    .replace(/\s+/g, ' ').trim();
}

// "ACORDAM os membros…"; entre o verbo e "membros" pode haver quebra de página com nota de rodapé.
const RE_INICIO = /\b(?:decidem|acordam|resolvem)\b(?=[\s\S]{0,500}?\b(?:membros|conselheiros)\b)/gi;
const RE_FIM = /\s(?:Votaram|VOTARAM|Presentes? (?:os|o) Conselheir|Sala das Sess[õo]es|SALA DAS SESS[ÕO]ES|Tribunal Pleno, em|Plenário Virtual)/;

/**
 * Deliberação literal no fim do PDF: { deliberacao, votacao, item_parecer, conclusao, exercicio } (campos
 * ausentes = null). Retorna null quando o início da deliberação não aparece no texto.
 */
export function lerDeliberacao(textoBruto, maxChars = 1500) {
  const texto = limparTexto(textoBruto).normalize('NFC');
  const inicios = [...texto.matchAll(RE_INICIO)];
  if (!inicios.length) return null;
  let bloco = texto.slice(inicios[inicios.length - 1].index);
  const fim = bloco.search(RE_FIM);
  if (fim > 0) bloco = bloco.slice(0, fim);
  bloco = bloco.trim();
  const abertura = bloco.slice(0, 900);
  const v = abertura.match(/por\s+(unanimidade|maioria(?:\s+absoluta)?)/i);
  // "Emitir/expedir [...] Parecer Prévio ...": o item termina no ponto final antes do próximo item ("b.",
  // "II."), de "Após…" ou do fim; ou em ":"/";". Itens longos são cortados (marcados com […]).
  const item = bloco.match(/\b(?:emitir|expedir|(?:julgar\s+pela\s+)?emiss[ãa]o\s+de)\b[^:;]{0,300}?Parecer\s+Pr[ée]vio[^:;]*?(?:\.(?=\s+(?:[a-zA-Z0-9]{1,4}[.)]|[IVX]{1,5}\s*[–-])\s|\s+Ap[óo]s\s|\s*$)|[:;])/i);
  let itemBruto = item ? item[0] : null;
  // "Emitir parecer prévio:" seguido da conclusão em subitens: o trecho segue até o fim da frase seguinte.
  if (itemBruto && /:$/.test(itemBruto) && !/regular|aprova|rejei|favor/i.test(itemBruto)) {
    const m2 = bloco.slice(item.index + itemBruto.length).match(/^[\s\S]{0,600}?\.(?=\s|$)/);
    if (m2) itemBruto += m2[0];
  }
  const itemTxt = itemBruto ? cortar(itemBruto, 700) : null;
  const conc = itemTxt ? itemTxt.match(/Parecer\s+Pr[ée]vio(?:\s+deste\s+Tribunal)?(?:,[^.;]{0,250}?,)?\s+(?:(?:favor[áa]vel|desfavor[áa]vel)\b|(?:recomend[ae]n?do\s+)?(?:o\s+julgamento\s+)?(?:pel[ao]s?|[ao]|à)\s+[^,;]*?(?=\s+das?\s+contas|\s+(?:à|a|d[ao]s?)\s+presta|,|;|\.|$))/i) : null;
  const ex = itemTxt ? exercicioNoTexto(itemTxt) : null;
  return {
    deliberacao: bloco.length > maxChars ? `${bloco.slice(0, maxChars).trim()} […]` : bloco,
    deliberacao_truncada: bloco.length > maxChars,
    votacao: v ? v[0].replace(/\s+/g, ' ') : null,
    item_parecer: itemTxt,
    conclusao: conc ? conc[0].replace(/\s+/g, ' ').trim() : null,
    exercicio: ex,
  };
}

/**
 * Seções numeradas da deliberação ("RESSALVAS: 1. … 2. …", "DETERMINAÇÕES:", "RECOMENDAÇÕES:",
 * "ENCAMINHAMENTOS:"), copiadas literalmente: [{ grupo, numero, texto }].
 */
export function secoesDeliberacao(deliberacao) {
  const t = String(deliberacao || '');
  const marcas = [...t.matchAll(/\b(RESSALVAS?|DETERMINAÇÕES|DETERMINAÇÃO|RECOMENDAÇÕES|RECOMENDAÇÃO|ENCAMINHAMENTOS?)\b\s*:?\s*(?=\d{1,2}\.\s)/g)];
  const itens = [];
  marcas.forEach((m, k) => {
    const corpo = t.slice(m.index + m[0].length, k + 1 < marcas.length ? marcas[k + 1].index : t.length);
    const partes = corpo.split(/(?:^|\s)(\d{1,2})\.\s+(?=[A-Za-zÀ-ú])/);
    for (let i = 1; i < partes.length; i += 2) {
      const texto = partes[i + 1].trim().replace(/[;.]$/, '').trim();
      if (texto) itens.push({ grupo: m[1], numero: partes[i], texto });
    }
  });
  return itens;
}

/** Entidade "MUNICÍPIO DE X" → nome normalizado do município (ou null se não for município). */
export function municipioDaEntidade(entidade, normalizar) {
  const n = normalizar(entidade);
  const m = n.match(/^MUNICIPIO (?:DE|DA|DO|DOS|DAS) (.+)$/);
  return m ? m[1].trim() : null;
}

/** Corta texto literal longo, marcando o corte. */
export function cortar(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max).trim()} […]` : t;
}
