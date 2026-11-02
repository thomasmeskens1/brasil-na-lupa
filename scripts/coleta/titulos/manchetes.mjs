// Escolha de manchetes da Agência Câmara e da Agência Senado. A manchete é usada sem alteração
// (só sai o sufixo de editoria, como "; acompanhe"), e só quando descreve o mesmo fato do item:
// votação do texto no mesmo dia (ou no seguinte), com o mesmo resultado e o mesmo turno; edição da
// medida provisória; publicação/sanção da lei. Manchetes com declaração, opinião ou nome de partido
// ficam de fora.
import { VERBOS_EMENTA, limpar } from './texto.mjs';
import { diasEntre } from './lib.mjs';

const VE = VERBOS_EMENTA.join('|');
const SUFIXOS = [/;\s*(acompanhe|assista|veja|confira)(\s+(ao vivo|a íntegra|o vídeo))?\s*$/iu, /\s+[-–|]\s+Agência (Câmara|Senado)( de Notícias)?\s*$/iu, /\s*\((ao vivo|vídeo|áudio)\)\s*$/iu];
const DECLARACAO = /\b(diz|dizem|afirma|afirmam|defende|defendem|critica|criticam|cobra|cobram|alerta|alertam|pede|pedem|quer|querem|anuncia|promete|debate|debatem|entrevista|opina|avalia|avaliam|aponta|apontam|destaca|ressalta|lamenta|comemora|celebra|reage|reagem|acusa|nega que|garante que|espera|esperam|ao vivo|acompanhe)\b/iu;
const PARTIDOS = /\b(MDB|PT|PL|PSD|PP|PSDB|PSOL|PSB|PDT|PCdoB|PV|PRD|Republicanos|Podemos|Solidariedade|Avante|Cidadania|Rede|União Brasil|NOVO|Novo partido)\b/u;

export function limparManchete(t) {
  let s = limpar(t);
  for (const re of SUFIXOS) s = s.replace(re, '');
  return s.trim();
}

function aceitavel(t) {
  if (!t || /[?!"“”‘’]/.test(t)) return false;
  if (DECLARACAO.test(t)) return false;
  if (PARTIDOS.test(t)) return false;
  return true;
}

const VERBO_RESULTADO = { aprova: /\baprova(m)?\b/iu, rejeita: /\brejeita(m)?\b/iu };

/** Votação: manchete do mesmo dia (ou seguinte), da mesma Casa, com o mesmo resultado e o mesmo turno. */
export function mancheteVotacao(perfil, casa, noticias) {
  if (!perfil?.principal || !perfil.plenario) return null;
  const inicio = casa === 'camara' ? /^(Câmara|Plenário|Deputados)\b/u : /^(Senado|Plenário|Senadores)\b/u;
  for (const n of noticias) {
    const d = diasEntre(perfil.data, n.data);
    if (d < 0 || d > 1) continue;
    const t = limparManchete(n.titulo);
    if (!aceitavel(t) || !inicio.test(t)) continue;
    if (!VERBO_RESULTADO[perfil.verbo]?.test(t)) continue;
    const outro = perfil.verbo === 'aprova' ? VERBO_RESULTADO.rejeita : VERBO_RESULTADO.aprova;
    if (outro.test(t)) continue;
    const t1 = /\b(1º|primeiro) turno\b/iu.test(t), t2 = /\b(2º|segundo) turno\b/iu.test(t), dois = /\bdois turnos\b/iu.test(t);
    if (perfil.turno === '1º' && !t1) continue;
    if (perfil.turno === '2º' && !t2) continue;
    if (!perfil.turno && (t1 || t2 || dois)) continue;
    const base = /\b(texto-base|texto principal)\b/iu.test(t);
    if (base !== Boolean(perfil.textoPrincipal)) continue;
    return { titulo: t, noticia: n };
  }
  return null;
}

/** Medida provisória: manchete que descreve a MP ("MP amplia…", "Medida provisória cria…") até 30 dias da edição. */
export function mancheteMp(dataEdicao, noticias) {
  const re = new RegExp(`^(MP|Medida provisória)\\s+(que\\s+)?(${VE})\\b`, 'iu');
  const ok = noticias.filter((n) => {
    const d = diasEntre(dataEdicao, n.data);
    const t = limparManchete(n.titulo);
    return d >= -1 && d <= 30 && aceitavel(t) && re.test(t);
  });
  return ok.length ? { titulo: limparManchete(ok[0].titulo), noticia: ok[0] } : null;
}

/** Lei: manchete da sanção/publicação ("Sancionada lei que…", "Lei amplia…") até 30 dias da assinatura. */
export function mancheteNorma(dataAssinatura, noticias) {
  const re = new RegExp(`^((Nova )?Lei( complementar)?\\s+(${VE})\\b|(Sancionada|Sancionado|Promulgada|Promulgado|Publicada|Publicado)\\b)`, 'iu');
  const ok = noticias.filter((n) => {
    const d = diasEntre(dataAssinatura, n.data);
    const t = limparManchete(n.titulo);
    return d >= -1 && d <= 30 && aceitavel(t) && re.test(t);
  });
  return ok.length ? { titulo: limparManchete(ok[0].titulo), noticia: ok[0] } : null;
}
