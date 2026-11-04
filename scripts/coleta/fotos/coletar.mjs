#!/usr/bin/env node
/**
 * Fotos oficiais dos parlamentares, só das fontes que declaram permissão de uso (pesquisa em
 * docs/pesquisa/fotos-licencas.md): Câmara dos Deputados, Senado Federal e ALESP.
 *
 * Lê o endereço da foto nas listas oficiais já coletadas (dados/<fonte>/parlamentares.json),
 * baixa só quando a foto muda (If-None-Match / If-Modified-Since; sem esses cabeçalhos, compara
 * o hash do original, no máximo uma vez por semana), reduz para 256 px de largura em WebP e grava
 * em dados/fotos/<fonte>/<id>.webp. Quem saiu da lista em exercício tem a foto removida.
 *
 * dados/fotos/manifest.json: chave "<fonte>/<id>" -> arquivo, url_origem, credito, licenca,
 * acessado_em (data em que o arquivo atual foi baixado). A data de cada conferência fica em
 * dados/fotos/meta.json (muda a cada execução e não dispara publicação).
 *
 * Uso: node scripts/coleta/fotos/coletar.mjs [--fonte camara|senado|alesp] [--forcar]
 * Requer o pacote sharp (vem com o Next.js em web/node_modules; no GitHub Actions é instalado
 * no passo da coleta, sem entrar no package.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { obterArquivo, estatisticas } from '../camara/lib.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DADOS = path.join(RAIZ, 'dados');
const DIR = path.join(DADOS, 'fotos');
const LARGURA = 256;
const REVER_SEM_VALIDADOR_DIAS = 7;

/** Fontes ativadas: permissão oficial declarada (URL e trecho em docs/pesquisa/fotos-licencas.md). */
export const FONTES = {
  camara: {
    orgao: 'Câmara dos Deputados',
    lista: 'camara/parlamentares.json',
    // As fotos oficiais (bandep) não identificam o fotógrafo: formato "Arquivo/Câmara dos Deputados".
    credito: 'Arquivo/Câmara dos Deputados',
    licenca: 'Uso livre, sem custo e sem autorização, com crédito (Guia para jornalistas da Câmara dos Deputados)',
    url_permissao: 'https://www2.camara.leg.br/comunicacao/assessoria-de-imprensa/guia-para-jornalistas/noticias-e-fotografias',
  },
  senado: {
    orgao: 'Senado Federal',
    lista: 'senado/parlamentares.json',
    // As fotos oficiais não identificam o fotógrafo: cita-se a Agência Senado.
    credito: 'Agência Senado',
    licenca: 'Reprodução livre, sem descaracterização, com citação da Agência Senado e do autor (Política de Uso do Senado Federal)',
    url_permissao: 'https://www12.senado.leg.br/noticias/politica-de-uso',
  },
  alesp: {
    orgao: 'Assembleia Legislativa do Estado de São Paulo (ALESP)',
    lista: 'alesp/parlamentares.json',
    credito: 'Alesp',
    licenca: 'Creative Commons Atribuição 4.0 Internacional (CC BY 4.0); imagem redimensionada e, na exibição, enquadrada na moldura 3:4 (corte lateral quando o original é mais largo)',
    url_permissao: 'https://www.al.sp.gov.br/alesp/license/',
    url_licenca: 'https://creativecommons.org/licenses/by/4.0/deed.pt_BR',
  },
};

const args = process.argv.slice(2);
const soFonte = args.includes('--fonte') ? args[args.indexOf('--fonte') + 1] : null;
const forcar = args.includes('--forcar');
const hoje = new Date().toISOString().slice(0, 10);

function carregarSharp() {
  for (const base of [import.meta.url, path.join(RAIZ, 'web', 'package.json')]) {
    try {
      return createRequire(base)('sharp');
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

const lerJson = (f, padrao = null) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return padrao;
  }
};
function gravarSeMudou(f, obj) {
  const texto = JSON.stringify(obj, null, 2) + '\n';
  if (fs.existsSync(f) && fs.readFileSync(f, 'utf8') === texto) return false;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(`${f}.tmp`, texto);
  fs.renameSync(`${f}.tmp`, f);
  return true;
}
const ehImagem = (b) =>
  b && b.length > 100 &&
  ((b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP'));
const diasDesde = (d) => (d ? (Date.parse(hoje) - Date.parse(d)) / 86400000 : Infinity);
const idSeguro = (id) => /^[0-9A-Za-z_-]{1,40}$/.test(id);

async function main() {
  const sharp = carregarSharp();
  if (!sharp) {
    console.error('[fotos] pacote sharp não encontrado (instale com npm install --no-save sharp); nada alterado.');
    process.exit(1);
  }
  const manifestoAntigo = lerJson(path.join(DIR, 'manifest.json'), {});
  const metaAntigo = lerJson(path.join(DIR, 'meta.json'), {});
  const itens = { ...(manifestoAntigo.itens || {}) };
  const conferido = { ...(metaAntigo.conferido || {}) };
  const validadores = { ...(metaAntigo.validadores || {}) };
  const resumo = {};

  for (const [fonte, cfg] of Object.entries(FONTES)) {
    if (soFonte && soFonte !== fonte) continue;
    const lista = lerJson(path.join(DADOS, cfg.lista));
    const pessoas = (lista?.itens || []).filter((p) => p.em_exercicio !== false && p.id && idSeguro(String(p.id)));
    const r = (resumo[fonte] = { na_lista: pessoas.length, com_foto: 0, baixadas: 0, sem_mudanca: 0, removidas: 0, falhas: 0 });
    if (!pessoas.length) {
      console.warn(`[fotos] ${fonte}: lista vazia ou ausente; fotos existentes mantidas.`);
      continue;
    }
    const pasta = path.join(DIR, fonte);
    fs.mkdirSync(pasta, { recursive: true });
    const atuais = new Set();

    await Promise.all(
      pessoas.map(async (p) => {
        const id = String(p.id);
        const chave = `${fonte}/${id}`;
        const url = typeof p.foto === 'string' && /^https?:\/\//.test(p.foto) ? p.foto.replace(/^http:\/\//, 'https://') : null;
        if (!url) return;
        atuais.add(chave);
        const arquivo = `${fonte}/${id}.webp`;
        const destino = path.join(DIR, arquivo);
        const ant = itens[chave];
        const val = validadores[chave];
        const mesmo = !forcar && ant && ant.url_origem === url && fs.existsSync(destino);
        // Sem ETag/Last-Modified na fonte: confere o hash do original no máximo uma vez por semana.
        if (mesmo && !val?.etag && !val?.last_modified && diasDesde(conferido[chave]) < REVER_SEM_VALIDADOR_DIAS) {
          r.sem_mudanca++;
          return;
        }
        try {
          const res = await obterArquivo(url, { anterior: mesmo ? val : null, timeoutMs: 60000 });
          conferido[chave] = hoje;
          if (res.naoMudou || (mesmo && val?.sha256 === res.sha256)) {
            r.sem_mudanca++;
            return;
          }
          if (!ehImagem(res.buf)) throw new Error('resposta não é imagem');
          const webp = await sharp(res.buf).rotate().resize({ width: LARGURA, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
          const igual = fs.existsSync(destino) && crypto.createHash('sha256').update(fs.readFileSync(destino)).digest('hex') === crypto.createHash('sha256').update(webp).digest('hex');
          if (!igual) {
            fs.writeFileSync(`${destino}.tmp`, webp);
            fs.renameSync(`${destino}.tmp`, destino);
          }
          validadores[chave] = { etag: res.etag, last_modified: res.last_modified, sha256: res.sha256 };
          if (!igual || !ant || ant.url_origem !== url) {
            itens[chave] = { arquivo, url_origem: url, credito: cfg.credito, licenca: cfg.licenca, acessado_em: hoje };
            r.baixadas++;
          } else r.sem_mudanca++;
        } catch (e) {
          r.falhas++;
          console.warn(`[fotos] ${chave}: ${e.message} (mantida a versão anterior, se houver)`);
          if (ant) atuais.add(chave);
        }
      }),
    );

    // Remove quem saiu da lista em exercício (ou ficou sem foto na fonte).
    for (const chave of Object.keys(itens)) {
      if (!chave.startsWith(`${fonte}/`) || atuais.has(chave)) continue;
      fs.rmSync(path.join(DIR, itens[chave].arquivo), { force: true });
      delete itens[chave];
      delete conferido[chave];
      delete validadores[chave];
      r.removidas++;
    }
    for (const f of fs.readdirSync(pasta)) {
      if (!itens[`${fonte}/${f.replace(/\.webp$/, '')}`]) fs.rmSync(path.join(pasta, f), { force: true });
    }
    // Crédito e licença acompanham a configuração (mudança de regra vale para todas as fotos).
    for (const [k, it] of Object.entries(itens)) if (k.startsWith(`${fonte}/`)) Object.assign(it, { credito: cfg.credito, licenca: cfg.licenca });
    r.com_foto = Object.keys(itens).filter((k) => k.startsWith(`${fonte}/`)).length;
  }

  const ordenado = Object.fromEntries(Object.entries(itens).sort(([a], [b]) => a.localeCompare(b)));
  const mudou = gravarSeMudou(path.join(DIR, 'manifest.json'), {
    descricao: 'Fotos oficiais de parlamentares, só de fontes que declaram permissão de uso, com o crédito exigido por cada uma.',
    largura_px: LARGURA,
    formato: 'webp',
    fontes: Object.fromEntries(Object.entries(FONTES).map(([k, { lista, ...c }]) => [k, c])),
    itens: ordenado,
  });
  gravarSeMudou(path.join(DIR, 'meta.json'), {
    executado_em: new Date().toISOString(),
    resumo,
    requisicoes: estatisticas.requisicoes,
    bytes_baixados: estatisticas.bytes,
    conferido: Object.fromEntries(Object.entries(conferido).filter(([k]) => ordenado[k]).sort()),
    validadores: Object.fromEntries(Object.entries(validadores).filter(([k]) => ordenado[k]).sort()),
  });
  console.log(`[fotos] ${JSON.stringify(resumo)}; manifesto ${mudou ? 'atualizado' : 'sem mudança'}.`);
}

main().catch((e) => {
  console.error('[fotos] erro:', e);
  process.exit(1);
});
