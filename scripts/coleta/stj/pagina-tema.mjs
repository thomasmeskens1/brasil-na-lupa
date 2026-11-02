// Página pública "Precedentes Qualificados" do STJ (HTML, ISO-8859-1). Usada só como link para o leitor
// e para conferir o CSV em poucos temas (coleções e linhas sem tipo). Não há API; nada é contornado:
// se a página não responder 200 com o documento, a conferência fica "indisponível".
import { obter, htmlParaTexto, dataISO } from './lib.mjs';

const BASE = 'https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp';
/** Letra do parâmetro tipo_pesquisa usada pela própria página (função copiarLinkTema): T = repetitivo, E = relevância. */
export const urlTema = (numero, letra = 'T') =>
  `${BASE}?novaConsulta=true&tipo_pesquisa=${letra}&cod_tema_inicial=${numero}&cod_tema_final=${numero}`;

const ROTULOS = ['Situação', 'Órgão julgador', 'Ramo do direito', 'Questão submetida a julgamento', 'Tese Firmada',
  'Anotações NUGEPNAC', 'Informações Complementares', 'Repercussão Geral', 'Delimitação do Julgado', 'Entendimento Anterior',
  'Referência Sumular', 'Súmula Originada', 'Referência Legislativa'];

/** Lê a página de um tema. Retorna null se não houver documento. */
export async function lerPaginaTema(numero, letra = 'T') {
  const url = urlTema(numero, letra);
  const html = await obter(url, { tipo: 'latin1', opcional: true, timeoutMs: 60000 });
  if (!html) return { url, disponivel: false, motivo: 'sem resposta 200' };
  const texto = htmlParaTexto(html);
  const linhas = texto.split('\n');
  const iDoc = linhas.findIndex((l) => /^Documento 1$/.test(l));
  if (iDoc < 0 || !/1 documento encontrado/.test(texto)) return { url, disponivel: false, motivo: 'documento não encontrado na página' };
  const iFim = linhas.findIndex((l, i) => i > iDoc && /^Última atualização:/.test(l));
  const doc = linhas.slice(iDoc + 1, iFim > 0 ? iFim : undefined);
  const ultima = iFim > 0 ? dataISO(linhas[iFim]) : null;

  const rotulo = doc.find((l) => /^(Tema Repetitivo|Tema de Relevância|Controvérsia|IAC|SIRDR|PUIL)$/.test(l)) ?? null;
  const campos = {};
  const iProc = doc.findIndex((l) => /^[A-Za-z]+(?: n[oa]s? [A-Za-z]+)* \d+\/[A-Z]{2}$/.test(l));
  const corpo = doc.slice(0, iProc >= 0 ? iProc : undefined);
  for (let i = 0; i < corpo.length; i++) {
    if (ROTULOS.includes(corpo[i])) {
      const vals = [];
      for (let j = i + 1; j < corpo.length && !ROTULOS.includes(corpo[j]); j++) vals.push(corpo[j]);
      campos[corpo[i]] = vals.join(' ').trim();
    }
  }
  const processos = [];
  if (iProc >= 0) {
    const resto = doc.slice(iProc);
    let atual = null;
    const valorDe = (arr, rot) => { const k = arr.indexOf(rot); return k >= 0 ? arr[k + 1] ?? null : null; };
    const fechar = () => {
      if (!atual) return;
      const a = atual.linhas;
      const v = (rot) => { const x = valorDe(a, rot); return x && x !== '-' ? x : null; };
      processos.push({
        processo: atual.processo, uf: atual.uf,
        tribunal_origem: v('Tribunal de Origem'), relator: v('Relator'),
        afetacao: dataISO(v('Afetação')), julgado_em: dataISO(v('Julgado em')),
        acordao_publicado_em: dataISO(v('Acórdão publicado em')), transito_em_julgado: dataISO(v('Trânsito em Julgado')),
      });
    };
    for (const l of resto) {
      const m = l.match(/^([A-Za-z]+(?: n[oa]s? [A-Za-z]+)* \d+)\/([A-Z]{2})$/);
      if (m) { fechar(); atual = { processo: m[1], uf: m[2], linhas: [] }; } else if (atual) atual.linhas.push(l);
    }
    fechar();
  }
  return {
    url, disponivel: true, rotulo_tipo: rotulo, ultima_atualizacao: ultima,
    situacao: campos['Situação'] ?? null, orgao: campos['Órgão julgador'] ?? null, ramo_do_direito: campos['Ramo do direito'] ?? null,
    tese: campos['Tese Firmada'] ?? null, processos,
  };
}
