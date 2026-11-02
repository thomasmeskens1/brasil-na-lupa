#!/usr/bin/env node
// Conferência por amostragem: compara 3 sessões já realizadas de cada casa (as mais recentes com
// pauta) com a página oficial da sessão. Verifica se a situação, cada item da pauta e o texto do
// desfecho aparecem na página. Respeita o robots.txt (as páginas /evento-legislativo/{id} da Câmara
// e /web/atividade/sessao-plenaria/ do Senado são permitidas; o Senado pede intervalo de 10 s).
//
// Uso: node scripts/coleta/agenda/conferir.mjs [--por-casa=3]
// Grava dados/agenda/conferencia.json.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { obter, dormir, gravarSeMudou, lerJson, hojeISO } from './lib.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SAIDA = path.join(RAIZ, 'dados/agenda');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const porCasa = Math.min(Math.max(Number(args['por-casa'] ?? 3) || 3, 1), 10);
const INTERVALO = { camara: 2000, senado: 10000 }; // Crawl-delay: 10 em www25.senado.leg.br/robots.txt

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', ccedil: 'ç', atilde: 'ã', otilde: 'õ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à' };
function textoDaPagina(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/\\u([0-9a-f]{4})/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Trecho do desfecho para procurar na página: a frase decisiva, sem o rótulo da deliberação do Senado. */
function trechoDesfecho(item) {
  let t = String(item.desfecho_texto_oficial || '');
  if (!t) return null;
  if (t.includes(' — ')) t = t.split(' — ').slice(1).join(' — ');
  const m = /Resultado da matéria:\s*([^.]{5,80})/i.exec(t);
  if (m) return norm(m[1]);
  const fr = t.split(/(?<=\.)\s+/).filter((f) => /^(Matéria não apreciada|Aprovad|Rejeitad|Retirad|Adiad|Requerimento)/i.test(f)).pop();
  return fr ? norm(fr).slice(0, 60) : null;
}

/** Variações do identificador do item como as páginas o escrevem ("PL 1435/2023", "PL 1.435/2023"). */
function identificadores(item) {
  const p = item.proposicao || {};
  const out = new Set();
  if (item.titulo) out.add(norm(item.titulo).replace(/\s*-\s*\w+$/, ''));
  if (p.sigla && p.numero && p.ano) {
    out.add(`${p.sigla} ${p.numero}/${p.ano}`.toLowerCase());
    out.add(`${p.sigla} ${p.numero.toLocaleString('pt-BR')}/${p.ano}`.toLowerCase());
    out.add(`${p.sigla} nº ${p.numero}/${p.ano}`.toLowerCase());
    out.add(`${p.sigla} n° ${p.numero}/${p.ano}`.toLowerCase());
    // Forma por extenso usada no andamento da sessão do Senado ("REQUERIMENTO Nº 713, DE 2026").
    out.add(`nº ${p.numero.toLocaleString('pt-BR')}, de ${p.ano}`);
  }
  return [...out];
}

async function main() {
  const sessoes = lerJson(path.join(SAIDA, 'sessoes.json'))?.sessoes || [];
  const resultado = [];
  for (const casa of ['camara', 'senado']) {
    const amostra = sessoes
      .filter((s) => s.casa === casa && s.situacao === 'encerrada' && (s.pauta?.itens || 0) > 0)
      .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora))
      .slice(0, porCasa);
    for (const s of amostra) {
      const pauta = lerJson(path.join(SAIDA, s.pauta.arquivo));
      const bloco = pauta?.sessoes?.find((b) => b.sessao_id === s.id);
      const reg = { sessao_id: s.id, data: s.data, link_oficial: s.link_oficial, conferido_em: hojeISO(), verificacoes: [] };
      let texto = null;
      try { texto = textoDaPagina(await obter(s.link_oficial, { tipo: 'text', timeoutMs: 90000 })); } catch (e) { reg.erro = e.message; }
      if (texto) {
        const v = (o, ok, detalhe) => reg.verificacoes.push({ o, ok, detalhe });
        v('situação', texto.includes(norm(s.situacao_oficial)), s.situacao_oficial);
        if (s.video_oficial) {
          const idVideo = /[?&]v=([\w-]+)/.exec(s.video_oficial)?.[1] || s.video_oficial;
          v('vídeo', texto.includes(idVideo.toLowerCase()) ? true : null, idVideo);
        }
        for (const it of bloco?.itens || []) {
          const ids = identificadores(it);
          v(`item ${it.titulo}`, ids.some((i) => texto.includes(i)), ids.join(' | '));
          const tr = trechoDesfecho(it);
          if (tr) v(`desfecho ${it.titulo} (${it.desfecho})`, texto.includes(tr), tr);
        }
      }
      const ok = reg.verificacoes.filter((x) => x.ok === true).length;
      const falhou = reg.verificacoes.filter((x) => x.ok === false).length;
      reg.resumo = { conferidos: ok, divergentes_ou_ausentes: falhou, nao_verificaveis: reg.verificacoes.length - ok - falhou };
      resultado.push(reg);
      console.log(`${s.id} ${s.data}: ${ok} ok, ${falhou} ausentes na página${reg.erro ? `, erro: ${reg.erro}` : ''}`);
      for (const x of reg.verificacoes.filter((y) => y.ok === false)) console.log(`   ausente: ${x.o} → ${x.detalhe}`);
      await dormir(INTERVALO[casa]);
    }
  }
  gravarSeMudou(path.join(SAIDA, 'conferencia.json'), {
    atualizado_em: new Date().toISOString(),
    metodo: 'Para cada sessão da amostra, a página oficial é baixada e o texto é comparado com o que o coletor gravou: situação da sessão, identificador de cada item da pauta e a frase oficial do desfecho. "ok: null" quer dizer que a página não exibe o dado como texto (ex.: vídeo incorporado por script).',
    amostra_por_casa: porCasa,
    sessoes: resultado,
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
