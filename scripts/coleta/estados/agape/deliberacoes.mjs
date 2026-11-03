// Leitura dos registros oficiais de deliberação no texto da tramitação do SPL (funções puras).
//
// O SPL da Alese e da ALBA não publica votação estruturada nem voto por deputado; o resultado
// aparece no "complemento" de uma tramitação ("Aprovado em 1ª e 2ª discussão em 16/06/2026",
// "Proposição aprovada em 10/09/2026.", "Parecer APROVADO por UNANIMIDADE."). Só vira deliberação
// o trecho que diz literalmente que algo foi aprovado ou rejeitado; parecer "pela aprovação" é
// opinião de relator/comissão e fica só na tramitação. Nada é inferido:
//   - a forma de votação só é preenchida se o texto disser (unanimidade, maioria, nominal…);
//   - placar só com números literais no texto; voto individual nunca é atribuído;
//   - órgão só quando o setor do registro for o Plenário ou uma comissão, ou o texto disser.

export const VOTO_INDISPONIVEL = 'Informação não disponível em fonte oficial';
export const LACUNA_VOTO_INDIVIDUAL =
  `Voto de cada deputado: ${VOTO_INDISPONIVEL} (a Assembleia não publica o voto individual; o registro oficial traz só o resultado).`;

const MESES = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

function isoValida(a, m, d) {
  const iso = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso && a >= 1889 ? iso : null;
}

/** Datas literais no texto, na ordem: dd/mm/aaaa, dd.mm.aaaa, "1º/07/2026", "16 de junho de 2026". */
export function datasNoTexto(texto) {
  const s = String(texto || '');
  const achados = [];
  for (const m of s.matchAll(/(?<!\d)(\d{1,2})\s*[º°]?\s*[/.](\d{1,2})[/.](\d{4})(?!\d)/g)) {
    const iso = isoValida(+m[3], +m[2], +m[1]);
    if (iso) achados.push({ iso, pos: m.index, literal: m[0] });
  }
  for (const m of s.matchAll(/(?<!\d)(\d{1,2})\s*[º°]?\s+de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})/gi)) {
    const mes = MESES[m[2].toLowerCase()];
    const iso = mes ? isoValida(+m[3], mes, +m[1]) : null;
    if (iso) achados.push({ iso, pos: m.index, literal: m[0] });
  }
  return achados.sort((a, b) => a.pos - b.pos);
}

/** Separa o complemento em trechos (linhas e frases). */
export function trechos(texto) {
  return String(texto || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+|(?<=[.;])\s+(?=[A-ZÀ-Ý(])/)
    .map((x) => x.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean);
}

const RE_RESULTADO = /(?<![A-Za-zÀ-ÿ])(aprovad[oa]s?|rejeitad[oa]s?)(?![A-Za-zÀ-ÿ])/i;
const EXCLUIR = [
  /\bpel[ao]s?\s+(?:sua\s+)?(?:aprova|rejei)/i, // parecer "pela aprovação" (opinião, não deliberação)
  /requerimento\s+de\s+urg[êe]ncia/i, // deliberação sobre outro requerimento
  /desconsider|sem\s+efeito/i, // correção de despacho (vai para "correcoes")
  /\b(?:se|caso|quando|ap[óo]s)\s+(?:for\s+)?aprovad/i,
  /\baguard/i,
  /\bpara\s+ser\s+(?:aprovad|rejeitad)/i,
];
const RE_ETAPA = /(\d+\s*[ªº]\s*e\s*\d+\s*[ªº]\s*discuss(?:[ãa]o|[õo]es)(?:\s+[úu]nica)?|discuss[ãa]o\s+[úu]nica|turno\s+[úu]nico|\d+\s*[ªº]\s*discuss[ãa]o|\d+\s*[ºª]\s*turno|reda[çc][ãa]o\s+final)/i;
const RE_CORRECAO = /desconsiderar|torn(?:a|ar|ou)[- ]se\s+sem\s+efeito|tornar\s+sem\s+efeito|retifica[çc][ãa]o|onde\s+se\s+l[êe]|em\s+tempo\s*:/i;

function tipoDoTexto(t) {
  if (/vota[çc][ãa]o\s+nominal|nominalmente|painel\s+eletr[ôo]nico/i.test(t)) return 'nominal';
  if (/vota[çc][ãa]o\s+secreta|escrut[íi]nio\s+secreto/i.test(t)) return 'secreta';
  if (/simb[óo]lic/i.test(t)) return 'simbolica';
  if (/unanimidade|un[âa]nime/i.test(t)) return 'unanimidade-registrada';
  if (/por\s+maioria/i.test(t)) return 'maioria-registrada';
  return null;
}

/** Placar só quando o texto traz os números com rótulo ("32 votos favoráveis e 7 contrários"). */
export function placarDoTexto(t) {
  const sim = /(\d+)\s+votos?\s+(?:favor[áa]veis|a\s+favor|sim)\b/i.exec(t);
  const nao = /(\d+)\s+(?:votos?\s+)?(?:contr[áa]rios?|n[ãa]o)\b/i.exec(t);
  if (!sim || !nao) return null;
  const abst = /(\d+)\s+absten[çc](?:[ãa]o|[õo]es)/i.exec(t);
  return { sim: +sim[1], nao: +nao[1], abstencao: abst ? +abst[1] : null, obstrucao: null, outros: null };
}

function orgaoDe(setor, t) {
  const s = String(setor || '').trim();
  const pelo = /(?<![A-Za-zÀ-ÿ])pel[ao]\s+(Mesa\s+Diretora|Comiss[ãa]o\s+[^,.;()]+|Plen[áa]rio)/i.exec(t);
  if (pelo) return /^plen/i.test(pelo[1]) ? 'Plenário' : pelo[1].trim();
  if (/plen[áa]rio/i.test(s)) return 'Plenário';
  if (/^comiss/i.test(s)) return s;
  if (/(?:em|pelo|no)\s+plen[áa]rio/i.test(t)) return 'Plenário';
  return null;
}

function objetoDe(t, posVerbo) {
  const antes = t.slice(0, posVerbo);
  if (/\bparecer/i.test(antes)) return 'parecer';
  if (/\bsubstitutivo/i.test(antes)) return 'substitutivo';
  if (/\bemendas?\b/i.test(antes)) return 'emenda';
  if (/reda[çc][ãa]o\s+final/i.test(antes)) return 'redacao-final';
  return 'proposicao';
}

/**
 * Deliberações registradas na tramitação de uma proposição.
 * tramitacoes: normalizadas ({ id, data, setor, complemento, arquivo }), em qualquer ordem.
 * Devolve { deliberacoes: [...], correcoes: [{ tramitacao_id, data, texto }] }.
 */
export function extrairDeliberacoes(tramitacoes) {
  const ordenadas = [...(tramitacoes || [])].sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')) || a.id - b.id);
  const lista = [];
  const correcoes = [];
  for (const t of ordenadas) {
    const partes = trechos(t.complemento);
    partes.forEach((p, i) => {
      if (RE_CORRECAO.test(p)) correcoes.push({ tramitacao_id: t.id, data: t.data || null, texto: p });
      const m = RE_RESULTADO.exec(p);
      if (!m || EXCLUIR.some((re) => re.test(p))) return;
      const verbo = m[1].toLowerCase();
      const datas = datasNoTexto(p.slice(m.index)).concat(datasNoTexto(p.slice(0, m.index)));
      const etapa = RE_ETAPA.exec(p);
      lista.push({
        id: partes.length > 1 && lista.some((x) => x.tramitacao_id === t.id) ? `${t.id}-${i + 1}` : String(t.id),
        tramitacao_id: t.id,
        data: datas[0]?.iso || null,
        data_registro: t.data || null,
        orgao: orgaoDe(t.setor, p),
        setor_registro: t.setor || null,
        objeto: objetoDe(p, m.index),
        etapa: etapa ? etapa[1].replace(/\s+/g, ' ') : null,
        resultado: verbo.startsWith('aprov') ? 'aprovada' : 'rejeitada',
        tipo: tipoDoTexto(p),
        placar: placarDoTexto(p),
        descricao: p.length > 500 ? p.slice(0, 497) + '…' : p,
        documento: t.arquivo || null,
      });
    });
  }
  // Mesmo resultado, mesma data, mesmo objeto e etapa registrado em duas tramitações: um item só.
  const vistos = new Map();
  const deliberacoes = [];
  for (const d of lista) {
    const etapa = (d.etapa || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/discuss(?:oes|ao)/g, 'discussao').replace(/\s+/g, '');
    const chave = d.data ? `${d.objeto}|${d.resultado}|${d.data}|${etapa}` : `sem-data|${d.id}`;
    const ja = vistos.get(chave);
    if (ja) { ja.outros_registros.push(d.tramitacao_id); if (!ja.orgao && d.orgao) ja.orgao = d.orgao; continue; }
    const novo = { ...d, outros_registros: [] };
    vistos.set(chave, novo);
    deliberacoes.push(novo);
  }
  return { deliberacoes, correcoes };
}

const ESPECIES = [
  [/^lei\s+complementar$/i, 'Lei Complementar', 'lc'],
  [/^lei$/i, 'Lei', 'lei'],
  [/^emenda\s+constitucional$/i, 'Emenda Constitucional', 'ec'],
  [/^resolu[çc][ãa]o$/i, 'Resolução', 'res'],
  [/^decreto\s+legislativo$/i, 'Decreto Legislativo', 'dl'],
];
const RE_NORMA = /\b(promulgad[oa]|publicad[oa]|sancionad[oa]|transformad[oa]\s+n[ao]|convertid[oa]\s+n[ao]|originou\s+[ao])\s+(?:[ao]\s+)?(lei\s+complementar|lei|emenda\s+constitucional|resolu[çc][ãa]o|decreto\s+legislativo)\s+(?:estadual\s+)?n[º°o.]*\s*([\d.]+\d)(?:\s*\/\s*(\d{4}))?/gi;

/** Normas que a tramitação oficial diz terem resultado da proposição (com o evento e a data literais). */
export function normasCitadas(tramitacoes) {
  const porId = new Map();
  for (const t of tramitacoes || []) {
    for (const p of trechos(t.complemento)) {
      for (const m of p.matchAll(RE_NORMA)) {
        const esp = ESPECIES.find(([re]) => re.test(m[2].replace(/\s+/g, ' ')));
        if (!esp) continue;
        const numero = Number(m[3].replace(/\./g, ''));
        const depois = p.slice(m.index + m[0].length);
        const data = /^\s*,?\s*(?:de|em)\s/i.test(depois) ? datasNoTexto(depois.slice(0, 40))[0]?.iso || null : null;
        const ano = m[4] ? Number(m[4]) : data ? Number(data.slice(0, 4)) : null;
        if (!Number.isFinite(numero) || !ano) continue;
        const id = `${esp[2]}-${numero}-${ano}`;
        const evento = m[1].toLowerCase().split(/\s+/)[0].replace(/[oa]$/, 'a');
        const atual = porId.get(id) || { id, tipo: esp[1], numero, ano, eventos: [] };
        if (!atual.eventos.some((e) => e.tramitacao_id === t.id && e.evento === evento)) {
          atual.eventos.push({ evento, data, texto: p.length > 300 ? p.slice(0, 297) + '…' : p, tramitacao_id: t.id, documento: t.arquivo || null });
        }
        porId.set(id, atual);
      }
    }
  }
  for (const n of porId.values()) n.eventos.sort((a, b) => a.tramitacao_id - b.tramitacao_id);
  return [...porId.values()];
}
