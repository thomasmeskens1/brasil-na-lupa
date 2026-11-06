// Ceará — leis, leis complementares, emendas constitucionais e decretos numerados do Governador, lidos no
// Diário Oficial do Estado (DOE-CE), caderno do Poder Executivo, em PDF com camada de texto:
//   https://imagens.seplag.ce.gov.br/PDF/AAAAMMDD/doAAAAMMDDpNN.pdf   (robots.txt inexistente: HTTP 404)
// O portal www.ce.gov.br NÃO é acessado (robots.txt respondeu 403: tratado como bloqueio total).
// Puro e testado offline (testes.mjs). Um ato só é gravado quando o cabeçalho ocupa a linha inteira
// ("DECRETO Nº37.589, de 28 de outubro de 2026."), a data do ato não é posterior à edição e, em até 12 linhas,
// vem a fórmula do Governador ("O GOVERNADOR DO ESTADO DO CEARÁ"): citações dentro de outros atos ficam de fora.
import { limpar, dataISO, textoPublico, fonte, LACUNA_PRIVACIDADE } from '../abertos/base.mjs';

export const HOST_DOE = 'https://imagens.seplag.ce.gov.br';
export const ORGAO_DOE = 'Diário Oficial do Estado do Ceará (DOE-CE)';
export const urlCaderno = (iso, n) => { const d = iso.replace(/-/g, ''); return `${HOST_DOE}/PDF/${d}/do${d}p${String(n).padStart(2, '0')}.pdf`; };

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const TIPOS = [
  [/^LEI COMPLEMENTAR$/i, 'Lei Complementar', 'lc'],
  [/^LEI$/i, 'Lei', 'lei'],
  [/^EMENDA CONSTITUCIONAL$/i, 'Emenda Constitucional', 'ec'],
  [/^DECRETO$/i, 'Decreto', 'dec'],
];
const CABECALHO = /^(LEI COMPLEMENTAR|LEI|EMENDA CONSTITUCIONAL|DECRETO)\s+N\s*[º°o.]\s*([\d.]{1,7}),?\s+de\s+(\d{1,2})[º°]?\s+de\s+([a-zç]+)\s+de\s+(\d{4})\.?$/i;

/** Primeira linha do caderno: "Fortaleza, 28 de outubro de 2026 | … | Caderno 1/2 | …" → { data, caderno, total }. */
export function lerCapaDOE(texto) {
  const l = String(texto || '').split('\n').map((x) => x.trim()).find((x) => /Caderno\s+\d+\/\d+/i.test(x)) || '';
  const m = /Fortaleza,\s*(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i.exec(l);
  const c = /Caderno\s+(\d+)\/(\d+)/i.exec(l);
  const mes = m ? MESES.indexOf(m[2].toLowerCase()) + 1 : 0;
  return {
    data: m && mes ? `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null,
    caderno: c ? Number(c[1]) : null, total: c ? Number(c[2]) : null,
    poder_executivo: /^\s*PODER EXECUTIVO\s*$/m.test(String(texto || '')),
  };
}

/** Páginas de texto de um caderno → atos do Governador encontrados (sem duplicatas). */
export function atosDoCaderno(paginas, { edicao, url, hoje }) {
  const atos = [];
  const vistos = new Set();
  paginas.forEach((pg, ip) => {
    const ls = String(pg || '').split('\n').map((x) => limpar(x) || '');
    for (let i = 0; i < ls.length; i++) {
      const m = CABECALHO.exec(ls[i]);
      if (!m) continue;
      const def = TIPOS.find(([re]) => re.test(m[1]));
      const mes = MESES.indexOf(m[4].toLowerCase()) + 1;
      const dataAto = mes ? dataISO(`${m[3].padStart(2, '0')}/${String(mes).padStart(2, '0')}/${m[5]}`, hoje) : null;
      if (!def || !dataAto || dataAto > edicao) continue;
      const fim = ls.findIndex((x, k) => k > i && k <= i + 12 && /^O GOVERNADOR DO ESTADO DO CEAR[ÁA](?![A-Za-z])/i.test(x));
      if (fim < 0) continue;
      const numero = Number(m[2].replace(/\./g, ''));
      const ano = Number(m[5]);
      const id = `${def[2]}-${numero}-${ano}`;
      if (!numero || vistos.has(id)) continue;
      vistos.add(id);
      const em = textoPublico(ls.slice(i + 1, fim).join(' ').replace(/(\p{L})-\s+(\p{Ll})/gu, '$1$2'));
      const lacunas = [
        'Proposição de origem: não informada no Diário Oficial; para leis, consultar a ficha do projeto na ALECE.',
        'Ementa copiada do Diário Oficial como impressa (em maiúsculas).',
      ];
      if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
      atos.push({
        id, uf: 'CE', tipo: def[1], tipo_texto_oficial: m[1].toUpperCase(), numero, ano,
        nome_oficial: `${def[1]} nº ${numero.toLocaleString('pt-BR')}/${ano}`, titulo: `${def[1]} nº ${numero.toLocaleString('pt-BR')}, de ${dataAto.split('-').reverse().join('/')}`,
        data_assinatura: dataAto, data_publicacao: edicao, ementa: em.texto || null, projeto_origem: null,
        url, pagina_pdf: ip + 1,
        fonte: fonte(`Diário Oficial do Estado do Ceará de ${edicao.split('-').reverse().join('/')} — caderno do Poder Executivo (PDF)`, url, ORGAO_DOE, hoje),
        privacidade_pendente: em.pendente || undefined, lacunas,
      });
    }
  });
  return atos;
}

/** Datas (ISO) de ini a fim, inclusivas, da mais recente para a mais antiga. */
export function diasDesc(ini, fim) {
  const out = [];
  for (let t = Date.parse(`${fim}T12:00:00Z`); t >= Date.parse(`${ini}T12:00:00Z`); t -= 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
