// Acesso às duas fontes oficiais do TCE-RR:
//  - API do Portal da Transparência (a mesma usada pela página "Decisões e Acórdãos"): lista as deliberações
//    da série "Parecer Prévio" com número, colegiado, data de publicação e o link do documento no SEI;
//  - documento do parecer no SEI (HTML em ISO-8859-1), lido só até o limite de bytes (o texto vem antes das imagens).
import fs from 'node:fs';
import path from 'node:path';
import { requisitar, HOST_API, HOST_SEI } from './lib.mjs';

export const URL_PAGINA = 'https://transparencia.tcerr.tc.br/sessoes/decisoes-e-acordaos';
export const URL_API = `https://${HOST_API}/api/sessoes/deliberacao`;
export const SERIE = 'Parecer Prévio';
const TAMANHO_PAGINA = 100;
export const LIMITE_DOC_BYTES = 900 * 1024;

const t = (v) => (v == null ? '' : String(v).trim());

/** Link oficial do documento no SEI montado com cv e crc (o campo "link" da API vem com o prefixo "null"). */
export function linkSei(cv, crc) {
  if (!/^\d{1,12}$/.test(cv) || !/^[0-9A-F]{8}$/i.test(crc)) return null;
  return `https://${HOST_SEI}/sei/controlador_externo.php?acao=md_tcerr_dp_gerar_hash&id_orgao_acesso_externo=0&cv=${cv}&crc=${crc.toUpperCase()}`;
}

/** Campos de interesse de uma deliberação da API. */
export function normalizarDeliberacao(r) {
  const cv = t(r.cv);
  const crc = t(r.crc);
  return {
    id: Number(r.id),
    numero: t(r.numeroDocumento) || null,
    serie: t(r.nomeSerie) || null,
    colegiado: t(r.descricaoColegiado) || null,
    data_publicacao_portal: /^\d{4}-\d{2}-\d{2}$/.test(t(r.dataPublicacao)) ? t(r.dataPublicacao) : null,
    ano_deliberacao: t(r.anoDeliberacao) || null,
    ano_api: t(r.ano) || null,
    id_procedimento: r.idProcedimento ?? null,
    cv,
    crc,
    url: linkSei(cv, crc),
  };
}

/** Id da série "Parecer Prévio" a partir da lista de séries que a própria API devolve. */
export function idDaSerie(series) {
  const s = (series || []).filter((x) => t(x.descricao) === SERIE);
  if (s.length !== 1) throw new Error(`série "${SERIE}" não encontrada (ou repetida) na lista da API`);
  return s[0].id;
}

/** Todas as deliberações da série "Parecer Prévio" (≈ 5 páginas de 100). */
export async function listarPareceres() {
  const descoberta = JSON.parse((await requisitar(`${URL_API}?paginar=true&page=0&size=1`, { metodo: 'POST', corpo: {} })).texto);
  const serieId = idDaSerie(descoberta.series);
  const corpo = { serieId, colegiados: [], conteudoFilter: '' };
  const itens = [];
  let total = null;
  for (let page = 0; page < 100; page++) {
    const j = JSON.parse((await requisitar(`${URL_API}?paginar=true&page=${page}&size=${TAMANHO_PAGINA}`, { metodo: 'POST', corpo })).texto);
    const l = j?.lista;
    if (!l || !Array.isArray(l.content)) throw new Error('resposta inesperada da API de deliberações');
    total = Number(l.totalElements);
    itens.push(...l.content.map(normalizarDeliberacao));
    if (l.last || !l.content.length) break;
  }
  const deSerie = itens.filter((i) => i.serie === SERIE && Number.isInteger(i.id));
  if (deSerie.length !== total) throw new Error(`a API anunciou ${total} pareceres e devolveu ${deSerie.length}`);
  if (new Set(deSerie.map((i) => i.id)).size !== deSerie.length) throw new Error('ids repetidos na lista da API');
  return { serieId, consulta: `${URL_API}?paginar=true&page=0&size=${TAMANHO_PAGINA} (POST ${JSON.stringify(corpo)})`, itens: deSerie };
}

/**
 * HTML do parecer no SEI. TCERR_CACHE_DIR (opcional, só para desenvolvimento) guarda o HTML lido fora do repositório.
 */
export async function baixarDocumento(del) {
  const cache = process.env.TCERR_CACHE_DIR ? path.join(process.env.TCERR_CACHE_DIR, `${del.id}.html`) : null;
  if (cache && fs.existsSync(cache)) {
    const html = fs.readFileSync(cache, 'utf8');
    // Cópias antigas sem a marca: o tamanho em UTF-8 indica a leitura parcial (aproximado).
    const truncado = html.startsWith('<!--TRUNCADO-->') || (!html.startsWith('<!--INTEGRAL-->') && Buffer.byteLength(html, 'latin1') >= LIMITE_DOC_BYTES);
    return { html, truncado };
  }
  if (!del.url) throw new Error('deliberação sem link do SEI');
  const { texto, truncado } = await requisitar(del.url, { limiteBytes: LIMITE_DOC_BYTES });
  if (cache) { fs.mkdirSync(path.dirname(cache), { recursive: true }); fs.writeFileSync(cache, `${truncado ? '<!--TRUNCADO-->' : '<!--INTEGRAL-->'}${texto}`, 'utf8'); }
  return { html: texto, truncado };
}
