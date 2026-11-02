// Leitura dos atos (leis, leis complementares e decretos do prefeito) a partir do texto
// de uma edição da Imprensa Oficial de Atibaia, já separado em blocos por coluna
// (ver extrair_pdf.py). Funções puras: entram blocos, saem candidatos com "confianca".
//
// Regra do projeto: nada é deduzido. Um ato só recebe confianca "alta" quando o número,
// a data e a ementa estão lidos de forma inequívoca, todos no MESMO bloco de coluna, na
// sequência cabeçalho → data → ementa → cláusula de promulgação/decretação. Qualquer
// desvio deixa o candidato como "revisar", com os motivos, para curadoria humana.
import { mesDoNome, dataISO, diasEntre, semAcento } from './lib.mjs';

/** "D E C R E T O Nº 11.631" → "DECRETO Nº 11.631" (cabeçalhos com letras espaçadas). */
export function juntarEspacadas(s) {
  return s.replace(/(?<![A-Za-zÀ-ÿ])(?:[A-ZÀ-Ú] ){2,}[A-ZÀ-Ú](?![A-Za-zÀ-ÿº°ª.])/g, (m) => m.replace(/ /g, ''));
}

/** Normaliza espaços e caracteres de numeração ordinal, sem alterar o conteúdo. */
export function normalizar(s) {
  return String(s ?? '').normalize('NFC').replace(/[   \t]/g, ' ').replace(/\s+/g, ' ').trim();
}

// "LEI Nº 5.196", "LEI COMPLEMENTAR Nº 983", "DECRETO N.º 11.739", "DECRETO Nº 11.900, DE 20 DE OUTUBRO DE 2026"
const CABECALHO = new RegExp(
  '^(LEI COMPLEMENTAR|LEI|DECRETO)\\s+(?:MUNICIPAL\\s+)?N\\s*[.\\u00ba\\u00b0o\\u00aa]*\\s*[.\\u00ba\\u00b0\\u00aa]?\\s*:?\\s*' +
  '(\\d{1,3}(?:\\.\\d{3})?|\\d{1,6})(?:\\s*\\/\\s*(\\d{4}))?' +
  '(?:\\s*[,\\-–]?\\s*(?:DE|De|de)\\s+(.+))?$',
);
// "de 28 de outubro 2026", "De 07 de julho de 2026", "28 DE OUTUBRO DE 2026."
const DATA = /^(?:(?:DE|De|de)\s+)?(\d{1,2})\s*[º°]?\s+(?:DE|De|de)\s+([A-Za-zÀ-ÿ]+)\s+(?:(?:DE|De|de)\s+)?(\d{4})\s*\.?$/;
// Cláusulas que encerram a ementa e dizem quem edita o ato.
const CLAUSULA_PREFEITO = /^(A C[ÂA]MARA MUNICIPAL\b|O PREFEITO\b|O VICE-PREFEITO\b|O PREFEITO MUNICIPAL\b|[A-ZÀ-Ú][A-ZÀ-Ú .]{6,},\s*PREFEITO\b)/i;
const CLAUSULA_CAMARA = /^(O PRESIDENTE DA C[ÂA]MARA|A MESA DA C[ÂA]MARA|FA[ÇC]O SABER QUE A C[ÂA]MARA)/i;
const INICIO_ARTICULADO = /^(Art\.?\s*1|Artigo\s+1|D\s*E\s*C\s*R\s*E\s*T\s*A|DECRETA\s*:)/i;
const RETIFICACAO = /RETIFICA|REPUBLICA|ERRATA|TORNA SEM EFEITO/i;

/** Versão das regras de leitura; edições lidas por regras anteriores são relidas na rotina. */
export const VERSAO_LEITOR = 2;

export const TIPOS = { 'LEI': 'lei', 'LEI COMPLEMENTAR': 'lei-complementar', 'DECRETO': 'decreto' };
export const NOMES_TIPO = { 'lei': 'Lei', 'lei-complementar': 'Lei Complementar', 'decreto': 'Decreto' };

export function lerData(texto) {
  const m = normalizar(texto).match(DATA);
  if (!m) return null;
  const mes = mesDoNome(m[2]);
  return mes ? dataISO(m[3], mes, m[1]) : null;
}

/** Cabeçalho da página 1: "Sábado, 31 de outubro de 2026 - n.º 3051 - Ano XXX". */
export function lerCabecalhoEdicao(linhas) {
  for (const l of linhas.slice(0, 12)) {
    const m = normalizar(l).match(/(\d{1,2}) de ([A-Za-zÀ-ÿ]+) de (\d{4}) - n\.?\s*[º°]?\s*(\d+[A-Z]?)/);
    if (m) {
      const mes = mesDoNome(m[2]);
      return { data: mes ? dataISO(m[3], mes, m[1]) : null, numero: m[4], extraordinaria: /Extraordin/i.test(l) };
    }
  }
  return null;
}

/** Junta as linhas da ementa; quebra com hífen no fim da linha é sinalizada (não se adivinha). */
function juntarEmenta(linhas) {
  let hifen = false;
  let texto = '';
  for (const l of linhas) {
    if (!texto) { texto = l; continue; }
    if (/[A-Za-zÀ-ÿ]-$/.test(texto) && /^[a-zà-ÿ]/.test(l)) { hifen = true; texto += ' ' + l; }
    else texto += ' ' + l;
  }
  return { texto: normalizar(texto), hifen };
}

/**
 * Lê os candidatos a ato de uma página.
 * pagina: { pagina, blocos: [{ col, linhas[] }] }; edicao: { numero, data, url }.
 */
export function atosDaPagina(pagina, edicao) {
  const saida = [];
  pagina.blocos.forEach((bloco, ib) => {
    const linhas = bloco.linhas.map(normalizar);
    for (let i = 0; i < linhas.length; i++) {
      const m = juntarEspacadas(linhas[i]).match(CABECALHO);
      if (!m) continue;
      const motivos = [];
      const tipo = TIPOS[m[1]];
      const numero = m[2];
      if (m[3]) motivos.push('número com barra e ano no cabeçalho; conferir');
      // Data: na mesma linha ("..., DE 20 DE OUTUBRO DE 2026") ou na linha seguinte.
      let data = null, j = i + 1;
      if (m[4]) {
        data = lerData('de ' + m[4]);
        if (!data) motivos.push('data na linha do cabeçalho não reconhecida');
      } else if (j < linhas.length) {
        data = lerData(linhas[j]);
        if (data) j++;
        else motivos.push('data não encontrada logo abaixo do cabeçalho');
      } else motivos.push('bloco de coluna termina logo após o cabeçalho');
      // Ementa: linhas até a cláusula de promulgação/decretação.
      const ementaLinhas = [];
      let clausula = null, editor = null;
      const varrer = (ls, k) => {
        for (; k < ls.length && ementaLinhas.length <= 15; k++) {
          if (CLAUSULA_PREFEITO.test(ls[k])) { clausula = ls[k]; editor = 'prefeito'; break; }
          if (CLAUSULA_CAMARA.test(ls[k])) { clausula = ls[k]; editor = 'camara'; break; }
          if (INICIO_ARTICULADO.test(ls[k]) || CABECALHO.test(juntarEspacadas(ls[k]))) break;
          ementaLinhas.push(ls[k]);
        }
        return k;
      };
      j = varrer(linhas, j);
      let fimDoBloco = j >= linhas.length;
      // Página de coluna única: cabeçalho e data (curtos, à esquerda ou à direita da calha)
      // terminam o bloco e a ementa vem logo abaixo, em faixa de largura total. Só segue
      // para o bloco seguinte quando nada além do cabeçalho e da data ficou no bloco atual.
      let ementaNoBlocoSeguinte = false;
      const seguinte = pagina.blocos[ib + 1];
      if (!clausula && fimDoBloco && data && !ementaLinhas.length && bloco.col !== 'largura' && seguinte?.col === 'largura') {
        const ls = seguinte.linhas.map(normalizar);
        const k = varrer(ls, 0);
        fimDoBloco = k >= ls.length;
        ementaNoBlocoSeguinte = true;
      }
      const { texto: ementa, hifen } = juntarEmenta(ementaLinhas);
      if (!clausula) {
        motivos.push(fimDoBloco
          ? 'bloco de coluna termina antes da cláusula de promulgação (a ementa pode continuar em outra coluna ou página)'
          : 'cláusula de promulgação/decretação não localizada após a ementa');
      }
      if (editor === 'camara') motivos.push('ato promulgado pela Câmara (não é ato do prefeito); conferir');
      if (!ementa) motivos.push('ementa vazia');
      else if (ementa.length < 15) motivos.push('ementa curta demais');
      else if (ementa.length > 1500) motivos.push('ementa longa demais (possível mistura de colunas)');
      if (hifen) motivos.push('palavra hifenizada na quebra de linha da ementa; conferir a grafia');
      if (/\b(Art\.|Parágrafo único|R\$)/.test(ementa) && !/^Dispõe|^Altera|^Autoriza/.test(ementa)) {
        motivos.push('ementa contém trecho de articulado ou valores; conferir');
      }
      if (data && edicao.data) {
        const d = diasEntre(data, edicao.data);
        if (d < 0) motivos.push('data do ato posterior à data da edição');
        else if (d > 120) motivos.push(`data do ato ${d} dias antes da edição (republicação ou citação?)`);
      }
      const anteriores = linhas.slice(Math.max(0, i - 3), i).join(' ');
      if (RETIFICACAO.test(anteriores) || RETIFICACAO.test(ementa)) motivos.push('retificação ou republicação; conferir');
      const numeroInt = Number(numero.replace(/\./g, ''));
      const ano = data ? Number(data.slice(0, 4)) : null;
      const id = tipo && ano ? `atibaia-${tipo}-${numeroInt}-${ano}` : null;
      const autoria = (ementa.match(/\((de autoria d[oa]s? [^)]+)\)/i) || [])[1] || null;
      saida.push({
        id_candidato: `${edicao.numero}-p${pagina.pagina}-b${ib}-l${i}`,
        id,
        tipo,
        tipo_nome: NOMES_TIPO[tipo],
        numero: numeroInt.toLocaleString('pt-BR'),
        numero_int: numeroInt,
        data,
        ementa: ementa || null,
        autoria_na_ementa: autoria,
        editor,
        clausula: clausula ? clausula.slice(0, 160) : null,
        pagina: pagina.pagina,
        coluna: bloco.col,
        ementa_em_faixa_abaixo: ementaNoBlocoSeguinte,
        cabecalho: linhas[i],
        confianca: motivos.length ? 'revisar' : 'alta',
        motivos,
        trecho: [...linhas.slice(i, Math.min(linhas.length, i + 14)),
          ...(ementaNoBlocoSeguinte ? seguinte.linhas.slice(0, 8).map(normalizar) : [])],
      });
    }
  });
  return saida;
}

/**
 * Lista de presença da ata de sessão da Câmara publicada na Imprensa Oficial:
 * "ESTIVERAM PRESENTES NESTA SESSÃO, OS SEGUINTES VEREADORES: Vereador Fulano - PSB; ...
 *  VEREADOR AUSENTE: não houve."
 * Só devolve resultado quando TODOS os trechos têm o formato "Nome - PARTIDO".
 */
export function presencaDaPagina(pagina) {
  const todas = pagina.blocos.flatMap((b) => b.linhas.map(normalizar));
  const texto = todas.join(' ');
  const ini = texto.search(/ESTIVERAM PRESENTES/i);
  if (ini < 0) return null;
  const resto = texto.slice(ini);
  const m = resto.match(/^ESTIVERAM PRESENTES[^:]*:\s*(.+?)\s*VEREADOR(?:ES|A|AS)?\s+AUSENTES?\s*:\s*([^.]*)\./i);
  const sessao = (texto.match(/Ata da (\d+)\s*[ªa]\s*Sess[ãa]o (Ordin[áa]ria|Extraordin[áa]ria|Solene)/i) || []);
  const dataSessao = (texto.match(/Aos (\d{1,2}) de ([A-Za-zÀ-ÿ]+) de (\d{4})/) || []);
  const base = {
    pagina: pagina.pagina,
    sessao: sessao[0] ? `${sessao[1]}ª Sessão ${sessao[2]}` : null,
    data_sessao: dataSessao[0] ? dataISO(dataSessao[3], mesDoNome(dataSessao[2]), dataSessao[1]) : null,
  };
  if (!m) return { ...base, valida: false, motivo: 'fim da lista de presença não localizado' };
  const partes = m[1].split(/\s*;\s*/).map((s) => s.replace(/\.$/, '').trim()).filter(Boolean);
  const presentes = [];
  for (const p of partes) {
    const q = p.match(/^(?:Vereador(?:a)?\s+)?([A-ZÀ-Ú][A-Za-zÀ-ÿ'.]+(?:\s+(?:d[aeo]s?|e|[A-ZÀ-Ú][A-Za-zÀ-ÿ'.]+))+)\s+[-–]\s+([A-Za-z]{2,15})$/);
    if (!q) return { ...base, valida: false, motivo: `trecho fora do formato "Nome - Partido": "${p.slice(0, 80)}"` };
    presentes.push({ nome: q[1], partido: q[2] });
  }
  // Mesa Diretora (cabeçalho da ata): "PRESIDENTE: Fulano", "1º VICE-PRESIDENTE: ..."
  const mesa = [];
  for (const l of todas) {
    const c = l.match(/^((?:\d[º°]\s*)?(?:VICE-)?PRESIDENTE|(?:\d[º°]\s*)?SECRET[ÁA]RIO):\s*(.+)$/i);
    if (c) mesa.push({ cargo: c[1].replace(/\s+/g, ' '), nome: c[2] });
  }
  return { ...base, valida: presentes.length > 0, presentes, ausentes_texto: m[2].trim(), mesa };
}

/** Chave de comparação da ementa (ignora caixa, acentos e espaços). */
export function chaveEmenta(e) {
  return semAcento(normalizar(e || '')).replace(/[^a-z0-9]/g, '');
}
