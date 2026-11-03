// Leis do RN publicadas no portal da ALRN (www.al.rn.leg.br/legislacao/<tipo>): lista HTML por ano,
// cada item com o PDF oficial em www.al.rn.leg.br/storage/legislacao/AAAA/<arquivo>.pdf.
// (O "iframe.leisestaduais.com.br" linkado no portal é serviço privado e não é usado.)
import { decodificarEntidades } from '../../alesp/lib.mjs';
import { textoPublico } from './base.mjs';
import { UF, CASA } from './elegis.mjs';

export const PORTAL = 'https://www.al.rn.leg.br';
export const LISTAS = [
  { caminho: 'leis-ordinarias', tipo: 'Lei Ordinária', titulo: 'Leis ordinárias', prefixo: 'lei' },
  { caminho: 'leis-complementares', tipo: 'Lei Complementar', titulo: 'Leis complementares', prefixo: 'lc' },
];

const limpar = (s) => decodificarEntidades(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/**
 * Lê os itens <li> da lista. Título esperado: "Lei Ordinária 12.931 de 19.10.2026" (variações de
 * pontuação aceitas). Itens fora do padrão entram com numero/data null e lacuna.
 */
export function lerListaLeis(html, lista, { hoje, regras = [] }) {
  const itens = [];
  const reLi = /<li class="list-group-item">([\s\S]*?)<\/li>/g;
  for (const m of String(html).matchAll(reLi)) {
    const bloco = m[1];
    const a = /<a href='([^']+)'[^>]*>([\s\S]*?)<\/a>/.exec(bloco) || /<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(bloco);
    if (!a) continue;
    const url = a[1].trim();
    if (!/^https:\/\/www\.al\.rn\.leg\.br\/storage\/legislacao\//.test(url)) continue;
    const titulo = limpar(a[2]);
    const ementaBruta = limpar(bloco.slice(bloco.indexOf('</a>') + 4));
    const t = /(\d{1,3}(?:\.\d{3})*|\d+)\s*,?\s*(?:de|,)\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/i.exec(titulo);
    const numero = t ? Number(t[1].replace(/\./g, '')) : null;
    const dataTitulo = t ? `${t[4]}-${t[3].padStart(2, '0')}-${t[2].padStart(2, '0')}` : null;
    // Ano = pasta oficial do arquivo (storage/legislacao/AAAA). A data do título só é usada se for coerente
    // com essa pasta e não for futura; senão fica null e a lacuna reproduz o título publicado.
    const anoPasta = Number((/\/legislacao\/(\d{4})\//.exec(url) || [])[1]) || null;
    const ano = anoPasta || (t ? Number(t[4]) : null);
    const dataOk = !!dataTitulo && (!anoPasta || Number(t[4]) === anoPasta) && dataTitulo <= hoje;
    const data = dataOk ? dataTitulo : null;
    const em = textoPublico(ementaBruta || null, regras);
    const lacunas = [];
    if (t && !dataOk) lacunas.push(`Data de assinatura não informada: o título oficial ("${titulo}") traz data incoerente com o ano do arquivo oficial (${anoPasta}) ou posterior à coleta`);
    if (!t) lacunas.push('Número e data não identificados no título publicado; ver documento oficial');
    if (!ementaBruta) lacunas.push('Ementa não publicada na lista oficial');
    if (em.duvidas) lacunas.push('Ementa com trecho em análise de privacidade (nome possivelmente de particular)');
    itens.push({
      id: numero != null && ano ? `${lista.prefixo}-${numero}-${ano}` : `${lista.prefixo}-${url.split('/').pop().replace(/\.pdf$/i, '')}`,
      uf: UF,
      casa: CASA,
      tipo: lista.tipo,
      numero,
      ano,
      nome_oficial: titulo,
      data_assinatura: data,
      ementa: em.texto,
      ...(em.duvidas ? { privacidade_pendente: true } : {}),
      url,
      fonte: { titulo: `${lista.titulo} — portal da ALRN`, url: `${PORTAL}/legislacao/${lista.caminho}`, orgao: 'Assembleia Legislativa do Estado do Rio Grande do Norte (ALRN)', acessado_em: hoje },
      lacunas,
    });
  }
  return itens;
}
