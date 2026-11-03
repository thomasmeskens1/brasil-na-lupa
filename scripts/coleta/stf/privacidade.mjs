// Privacidade (diretriz 12) para os coletores do STF e do STJ.
//
// Todo texto literal gravado em dados/stf e dados/stj passa por mascararTexto antes da gravação:
//   - nomes de particulares (advogados, partes pessoas físicas, interessados) → "[nome de particular omitido]";
//   - números de OAB, CPF e RG → "[documento omitido]".
// Ficam em claro: ministros, desembargadores convocados, Procurador-Geral da República, Advogado-Geral da
// União, procuradores e defensores públicos identificados pelo cargo no próprio texto, entes públicos e
// pessoas jurídicas (CNPJ pode ficar). Na dúvida, mascara (contado em "em_duvida").
//
// Auditoria: ao lado de cada campo alterado grava-se "<campo>_original_sha256" (SHA-256 do texto original,
// UTF-8) e "<campo>_omissoes" ({ nomes, documentos, em_duvida }). O texto original nunca é gravado.
// É idempotente: os marcadores não casam com nenhuma regra, e um texto já mascarado não muda.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARCA_NOME = '[nome de particular omitido]';
export const MARCA_DOC = '[documento omitido]';
export const SUFIXO_SHA = '_original_sha256';
export const SUFIXO_OMISSOES = '_omissoes';

const sha256 = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

// ---------- blocos de expressão regular ----------
const MAI = 'A-ZÀ-ÖØ-Þ';
const LET = 'A-Za-zÀ-ÖØ-öø-ÿ';
// Palavra de nome: inicial maiúscula (ou inicial abreviada "J."). Ponto final de frase não entra.
const PAL = `(?:[${MAI}][${LET}'’-]+|[${MAI}]\\.)`;
const CONECT = `(?:d[aeoAEO][sS]?|[dD][aeAE][lL]|[eE]|[dD][’'])`;
const NOME = `${PAL}(?:\\s+(?:${CONECT}\\s+)?${PAL})*`;
const NAO_LETRA_ANTES = `(?<![${LET}0-9])`;
const NAO_LETRA_DEPOIS = `(?![${LET}0-9])`;

// Cargos públicos que, logo antes ou logo depois do nome, identificam agente público no exercício da função.
const CARGO = '(?:Senador[a]?|Sen\\.|Deputad[oa](?:\\s+(?:Federal|Estadual|Distrital))?|Dep\\.|Vereador[a]?|Governador[a]?|Vice-Governador[a]?|Prefeit[oa]|Vice-Prefeit[oa]|Presidente|Procurador[a]?(?:-Geral)?|Subprocurador[a]?(?:-Geral)?|Vice-Procurador[a]?(?:-Geral)?|Advogad[oa]-Geral|Advogad[oa] da União|Advogad[oa] Públic[oa]|Defensor[a]? Públic[oa](?:-Geral)?|Defensor[a]?-Geral|Promotor[a]? de Justiça|Membro do Ministério Público|Consultor[a]?-Geral|Secretári[oa]|Ministr[oa]|Desembargador[a]?|Juiz[a]?|Juíza)';
const CARGO_DEPOIS = new RegExp(`^\\s*(?:,\\s*(?:(?:o|a)\\s+)?${CARGO}|,?\\s*(?:que lavrar[áa] o ac[óo]rd[ãa]o|Relator[a]?(?![${LET}])|\\((?:Desembargador|Juiz)))`);
// Cargo + complemento ("Procurador-Geral da República, ") imediatamente antes do nome.
const COMPL = `(?:\\s+(?:d[aeo]s?\\s+)?[${MAI}][${LET}-]*)*`;
const CARGO_ANTES = new RegExp(`${CARGO}${COMPL},?\\s*(?:(?:o|a)\\s+)?$`);
// Primeira palavra que indica autoridade (não é particular): "Sr. Ministro", "Sra. Desembargadora" etc.
const TITULO_PUBLICO = new RegExp(`^(?:Mini?n?istr|Min(?![a-zà-ÿ])|Desembargador|Juiz|Juíza|Procurador|Subprocurador|Vice-|Presidente|Relator|Advogad[oa]-Geral|Defensor|Senador|Deputad|Governador|Prefeit|Secretári|Conselheir|Promotor)`);
const TITULO_PESSOA = /^(?:Drs?|Dras?|Doutora?|Srs?|Sras?|Senhora?)\.?$/;

// Pessoa jurídica / ente público: se o nome da parte traz um destes termos, fica em claro.
const ENTE = new RegExp(`${NAO_LETRA_ANTES}(?:LTDA|S\\.?\\s?/?A\\.?(?![${LET}])|EIRELI|EPP|Estado|Estados|Município|Municipio|União|Uniao|Distrito Federal|Fazenda|Governador[a]?|Prefeit[oa]|Presidente|Mesa|Assembleia|Assembléia|Câmara|Camara|Senado|Congresso|Minist[ée]rio|Procuradoria|Defensoria|Advocacia|Instituto|Banco|Companhia|Cia|Associação|Associacao|Associações|Sindicato|Confederação|Confederacao|Federação|Federacao|Conselho|Ordem|Partido|Cooperativa|Fundação|Fundacao|Empresa|Agência|Agencia|Autarquia|Universidade|Tribunal|Comissão|Serviço|Serviços|Caixa|Rede|Telecomunicações|Comércio|Comercio|Indústria|Industria|Participações|Holding|Grupo|Sociedade|Central|Frente|Movimento|Organização|Entidade|Clube|Igreja|Energia|Distribuidora|Transportes|Advogados|Mercantil|Petróleo|Seguros|Seguradora|Incorporadora|Construtora|Comunicações|Cooperativas|Secretaria|Governo|República|Republica|Nacional|Brasil)${NAO_LETRA_DEPOIS}`, 'i');
const SIGLA = /^[A-Z0-9]{2,10}(?:[-/][A-Z0-9]{1,10})?$/; // ex.: ABRAPET, CONFAZ, ANATEL

// Rótulos de parte seguidos de dois-pontos ("RECORRENTE: …", "pela parte RECORRIDA: …", "ADV.(A/S): …").
const ROTULO_PARTE = '(?:RECORRENTES?|RECORRID[OA]S?|REQUERENTES?|REQUERID[OA]S?|AGRAVANTES?|AGRAVAD[OA]S?|EMBARGANTES?|EMBARGAD[OA]S?|IMPETRANTES?|IMPETRAD[OA]S?|INTERESSAD[OA]S?|AMICUS CURIAE|PACIENTES?|AUTOR(?:A|ES|AS)?|RÉU|RÉ|RÉUS|RECTE|RECDO|RECDA|AGTE|AGDO|AGDA|EMBTE|EMBDO|REQTE|REQDO|INTDO|INTDA|IMPTE|PACTE|AM\\. CURIAE)(?:\\.?\\s*\\([A-Z/]{1,5}\\))?\\.?';
const RE_ROTULO = new RegExp(`(${NAO_LETRA_ANTES}(?:pel[oa]s?\\s+(?:parte\\s+)?)?${ROTULO_PARTE}\\s*:\\s*)([^;\\n]+?)(?=\\s*(?:;|\\n|$|\\.\\s|,\\s*(?:(?:o|a)\\s+)?(?:Drs?|Dras?|Srs?|Sras?)\\.))`, 'gi');
const RE_ADV = new RegExp(`(${NAO_LETRA_ANTES}ADV(?:OGAD[OA]S?)?\\.?\\s*(?:\\([A-Z/]{1,5}\\))?\\s*:\\s*)([^;\\n]+?)(?=\\s*(?:;|\\n|$|\\.\\s))`, 'gi');
// "pela requerente X, o Dr." / "pelo amicus curiae Estado de São Paulo, o Dr." (texto entre o papel e a vírgula).
const RE_PAPEL = new RegExp(`(${NAO_LETRA_ANTES}pel[oa]s?\\s+(?:parte\\s+)?(?:requerentes?|recorrentes?|recorrid[oa]s?|requerid[oa]s?|interessad[oa]s?|amicus curiae|agravantes?|agravad[oa]s?|embargantes?|embargad[oa]s?|impetrantes?|pacientes?|autor(?:a|es|as)?|réu|ré)\\s+)([${MAI}][^,;:\\n]*?)(?=\\s*(?:,|;|\\.\\s|\\s+e,))`, 'g');
// Títulos de tratamento seguidos de nome.
// "Doutor(a)" por extenso só com artigo antes ("o Doutor Fulano"), para não pegar "Município de Doutor Ulysses";
// "Senhor(a)" por extenso fica de fora ("Associação do Senhor Jesus").
const RE_DR = new RegExp(`(${NAO_LETRA_ANTES}(?:(?:Drs?|Dras?|Srs?|Sras?)\\.?|(?<=\\b(?:o|a)\\s)Doutora?)\\s+)(${NOME})`, 'g');
// "o advogado Fulano", "advogada: Fulana".
const RE_ADVOGADO_NOME = new RegExp(`(${NAO_LETRA_ANTES}[aA]dvogad[oa]s?(?:\\([as]\\))?\\s*:?\\s+)(${NOME})`, 'g');
// Trechos de sustentação oral: nomes sem título ("Falou, pelo requerente, Fulano de Tal").
const RE_TRECHO_ORAL = /(?:Falaram|Falou|Sustent(?:ou|aram)\s+oralmente|[Ss]ustentação oral|[Ss]ustentações orais)[\s\S]*?(?=(?<!\b(?:Drs?|Dras?|Srs?|Sras?|n|nº|art|arts|Min|p))\.(?:\s+[A-ZÀ-Þ]|\s*$)|$)/g;
const RE_NOME_NO_TRECHO = new RegExp(`((?:^|[,:;]\\s*|\\be\\s+|oralmente\\s+)(?:(?:o|a|os|as)\\s+)?)(${NOME})(?=\\s*(?:,|;|\\.|$|\\s+e\\s|\\s+pel[oa]))`, 'g');

// Documentos.
const DOCS = [
  new RegExp(`${NAO_LETRA_ANTES}CPF(?:/MF)?\\s*(?:n[º°o.]*\\s*)?:?\\s*[\\dXx*][\\dXx*.\\-]{9,13}[\\dXx*]${NAO_LETRA_DEPOIS}`, 'g'),
  new RegExp(`${NAO_LETRA_ANTES}[\\dXx*]{3}\\.[\\dXx*]{3}\\.[\\dXx*]{3}-[\\dXx*]{2}${NAO_LETRA_DEPOIS}`, 'g'),
  new RegExp(`${NAO_LETRA_ANTES}(?<!Tema\\s)(?:RG|R\\.G\\.|C\\.I\\.|Carteira de Identidade)\\s*(?:n[º°o.]*\\s*)?:?\\s*\\d[\\dXx.\\-]{5,13}(?:\\s*(?:SSP|SESP|SDS|DETRAN|IFP|PC)[/-]?[A-Z]{2})?${NAO_LETRA_DEPOIS}`, 'g'),
  new RegExp(`${NAO_LETRA_ANTES}OAB\\s*[/-]?\\s*[A-Z]{2}\\s*(?:n[º°o.]*\\s*)?:?\\s*\\d[\\d.]*(?:-?[A-Z])?${NAO_LETRA_DEPOIS}`, 'g'),
  new RegExp(`${NAO_LETRA_ANTES}OAB(?:\\s*[/-]\\s*[A-Z]{2})?\\s+(?:sob\\s+o\\s+)?(?:n[º°o.]*\\s*)?:?\\s*\\d[\\d.]*(?:-?[A-Z])?(?:\\s*[/-]\\s*[A-Z]{2})?${NAO_LETRA_DEPOIS}`, 'g'),
  new RegExp(`${NAO_LETRA_ANTES}\\d[\\d.]*(?:-?[A-Z])?\\s*/\\s*OAB(?:\\s*[/-]\\s*[A-Z]{2})?${NAO_LETRA_DEPOIS}`, 'g'),
];

// Ministros (composição atual do STF e do STJ, dos ministros.json gravados) citados sem o título "Ministro",
// ex.: "nos termos do voto do Sr. Benedito Gonçalves". Outras autoridades podem ser somadas com registrarAutoridades.
const chave = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const AUTORIDADES = new Set();
export function registrarAutoridades(nomes) { for (const x of nomes) if (x && String(x).trim().split(/\s+/).length >= 2) AUTORIDADES.add(chave(x)); }
{
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  for (const t of ['stf', 'stj']) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', t, 'ministros.json'), 'utf8'));
      registrarAutoridades((m.itens ?? []).flatMap((i) => [i.nome, i.nome_destaque, i.nome_completo]));
    } catch { /* sem a lista, vale só o título */ }
  }
}
const ehAutoridade = (nome) => AUTORIDADES.has(chave(nome));
const INICIAL_MAI = new RegExp(`^\\s*[${MAI}]`);

const ehEnte = (s) => {
  const t = String(s).trim();
  return ENTE.test(t) || SIGLA.test(t) || /\bCNPJ\b/i.test(t) || TITULO_PUBLICO.test(t); // "Requerente: Senador Fulano"
};
const contemMarca = (s) => s.includes(MARCA_NOME) || s.includes(MARCA_DOC);

/**
 * Mascara um texto. Retorna { texto, nomes, documentos, em_duvida } (contagens desta passagem).
 * Texto já mascarado volta igual, com contagens zero.
 */
export function mascararTexto(entrada) {
  const c = { nomes: 0, documentos: 0, em_duvida: 0 };
  if (typeof entrada !== 'string' || !entrada) return { texto: entrada, ...c };
  let t = entrada;

  // 1) Documentos.
  for (const re of DOCS) t = t.replace(re, () => { c.documentos++; return MARCA_DOC; });

  // 2) Linhas de partes com rótulo ("RECORRENTE: …") e de advogados ("ADV.(A/S): …").
  t = t.replace(RE_ADV, (m, rot, nome) => {
    if (!INICIAL_MAI.test(nome) || contemMarca(nome) || ehEnte(nome) || ehAutoridade(nome)) return m;
    c.nomes++; return rot + MARCA_NOME;
  });
  t = t.replace(RE_ROTULO, (m, rot, parte) => {
    if (!INICIAL_MAI.test(parte) || contemMarca(parte) || ehEnte(parte) || ehAutoridade(parte)) return m;
    c.nomes++; c.em_duvida++; return rot + MARCA_NOME;
  });
  // 3) "pelo requerente Fulano," — parte nomeada no relato da sustentação oral.
  t = t.replace(RE_PAPEL, (m, rot, parte) => {
    if (contemMarca(parte) || ehEnte(parte) || /^(?:o|a|os|as)\s/.test(parte)) return m;
    c.nomes++; c.em_duvida++; return rot + MARCA_NOME;
  });

  // 4) Títulos de tratamento ("Dr.", "Dra.", "Sr.", "Sra.") e "advogado Fulano".
  const porTitulo = (m, pre, nome, off, todo) => {
    if (TITULO_PUBLICO.test(nome) || ehAutoridade(nome)) return m; // "Sr. Ministro …", "Sr. Benedito Gonçalves"
    const depois = todo.slice(off + m.length, off + m.length + 120);
    const antes = todo.slice(Math.max(0, off - 140), off);
    if (CARGO_DEPOIS.test(depois) || CARGO_ANTES.test(antes)) return m;
    c.nomes++; return pre + MARCA_NOME;
  };
  t = t.replace(RE_DR, porTitulo);
  t = t.replace(RE_ADVOGADO_NOME, (m, pre, nome, off, todo) => {
    if (TITULO_PESSOA.test(nome.split(/\s+/)[0]) || ehEnte(nome)) return m;
    return porTitulo(m, pre, nome, off, todo);
  });

  // 5) Nomes sem título dentro do relato de sustentação oral.
  t = t.replace(RE_TRECHO_ORAL, (trecho) => trecho.replace(RE_NOME_NO_TRECHO, (m, pre, nome, off, todo) => {
    const primeira = nome.split(/\s+/)[0];
    if (/^(?:Falaram|Falou|Sustent|Plenário|Presidência|Ausente|Tudo|Não|O|A|Os|As)$/.test(primeira)) return m;
    if (TITULO_PESSOA.test(primeira) || TITULO_PUBLICO.test(nome) || ehEnte(nome) || ehAutoridade(nome)) return m;
    const depois = todo.slice(off + m.length, off + m.length + 120);
    const antes = todo.slice(Math.max(0, off - 140), off + pre.length);
    if (CARGO_DEPOIS.test(depois) || CARGO_ANTES.test(antes)) return m;
    c.nomes++; c.em_duvida++; return pre + MARCA_NOME;
  }));

  return { texto: t, ...c };
}

// ---------- objetos ----------
const CHAVES_IGNORADAS = /(?:^|_)(?:url|urls|id|ids|sha256|hash)$|^(?:url|id|tribunal|classe|numero|incidente_ou_registro)$/;
const somar = (a, b) => ({ nomes: a.nomes + b.nomes, documentos: a.documentos + b.documentos, em_duvida: a.em_duvida + b.em_duvida });

/**
 * Mascara (no lugar) todas as strings de um objeto JSON. "anterior" é a versão já gravada do mesmo objeto:
 * se um campo já estava mascarado, o hash e as omissões gravados antes são preservados.
 * Retorna { alteradas, contagem } desta passagem.
 */
export function mascararObjeto(obj, anterior = null) {
  const r = { alteradas: 0, contagem: { nomes: 0, documentos: 0, em_duvida: 0 } };
  const registrar = (c) => { r.contagem = somar(r.contagem, c); };
  const visitar = (o, ant) => {
    if (Array.isArray(o)) {
      o.forEach((v, i) => { if (v && typeof v === 'object') visitar(v, Array.isArray(ant) ? ant[i] : null); });
      return;
    }
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (k.endsWith(SUFIXO_SHA) || k.endsWith(SUFIXO_OMISSOES) || CHAVES_IGNORADAS.test(k)) continue;
      const v = o[k];
      const vAnt = ant && typeof ant === 'object' ? ant[k] : undefined;
      if (typeof v === 'string') {
        const m = mascararTexto(v);
        if (m.texto !== v) {
          o[k] = m.texto; r.alteradas++; registrar(m);
          o[k + SUFIXO_SHA] = sha256(v);
          o[k + SUFIXO_OMISSOES] = { nomes: m.nomes, documentos: m.documentos, em_duvida: m.em_duvida };
        } else if (contemMarca(v) && !(k + SUFIXO_SHA in o) && ant && vAnt === v && ant[k + SUFIXO_SHA]) {
          o[k + SUFIXO_SHA] = ant[k + SUFIXO_SHA];
          if (ant[k + SUFIXO_OMISSOES]) o[k + SUFIXO_OMISSOES] = ant[k + SUFIXO_OMISSOES];
        }
      } else if (Array.isArray(v) && v.some((x) => typeof x === 'string')) {
        const hashes = Array.isArray(o[k + SUFIXO_SHA]) ? o[k + SUFIXO_SHA] : (Array.isArray(ant?.[k + SUFIXO_SHA]) ? ant[k + SUFIXO_SHA] : null);
        let mudou = false; const novos = v.map((x, i) => hashes?.[i] ?? null); let tot = { nomes: 0, documentos: 0, em_duvida: 0 };
        o[k] = v.map((x, i) => {
          if (typeof x !== 'string') return x;
          const m = mascararTexto(x);
          if (m.texto === x) return x;
          mudou = true; r.alteradas++; registrar(m); tot = somar(tot, m); novos[i] = sha256(x);
          return m.texto;
        });
        if (mudou || hashes) {
          o[k + SUFIXO_SHA] = novos;
          const omAnt = o[k + SUFIXO_OMISSOES] ?? ant?.[k + SUFIXO_OMISSOES];
          o[k + SUFIXO_OMISSOES] = mudou ? (omAnt && hashes ? somar(omAnt, tot) : tot) : omAnt;
        }
        v.forEach((x, i) => { if (x && typeof x === 'object') visitar(x, Array.isArray(vAnt) ? vAnt[i] : null); });
      } else if (v && typeof v === 'object') {
        visitar(v, vAnt);
      }
    }
  };
  visitar(obj, anterior);
  return r;
}

/** Soma as omissões gravadas (campos *_omissoes) e conta marcadores de um objeto já mascarado. */
export function totaisGravados(obj) {
  const t = { campos: 0, nomes: 0, documentos: 0, em_duvida: 0, marcadores_nome: 0, marcadores_documento: 0 };
  const contar = (s, marca) => s.split(marca).length - 1;
  const visitar = (o) => {
    if (Array.isArray(o)) return o.forEach(visitar);
    if (typeof o === 'string') { t.marcadores_nome += contar(o, MARCA_NOME); t.marcadores_documento += contar(o, MARCA_DOC); return; }
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k.endsWith(SUFIXO_OMISSOES) && v && typeof v === 'object') {
        t.campos++; t.nomes += v.nomes || 0; t.documentos += v.documentos || 0; t.em_duvida += v.em_duvida || 0;
      } else if (!k.endsWith(SUFIXO_SHA)) visitar(v);
    }
  };
  visitar(obj);
  return t;
}

/**
 * Reaplica o mascaramento a todos os .json de uma pasta (recursivo), regravando só os que mudam.
 * "formatar" é a função de serialização do coletor (mantém o estilo do arquivo).
 * Retorna o resumo para o meta.json.
 */
export function reprocessarPasta(dir, formatar, { ignorar = ['meta.json'] } = {}) {
  const resumo = {
    regra: `Diretriz 12: nomes de particulares (advogados, partes pessoas físicas, interessados) → "${MARCA_NOME}"; números de OAB, CPF e RG → "${MARCA_DOC}". Ficam em claro ministros, desembargadores convocados, PGR, AGU, procuradores e defensores públicos identificados pelo cargo, entes públicos e pessoas jurídicas. Na dúvida, mascara (contado em em_duvida). Auditoria: só o SHA-256 do texto original (campos *${SUFIXO_SHA}).`,
    arquivos_lidos: 0, arquivos_regravados_nesta_execucao: 0,
    nesta_execucao: { campos: 0, nomes: 0, documentos: 0, em_duvida: 0 },
    total_gravado: { campos: 0, nomes: 0, documentos: 0, em_duvida: 0, marcadores_nome: 0, marcadores_documento: 0 },
    arquivos_com_omissao: [],
  };
  const arquivos = [];
  const listar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) listar(p);
      else if (e.isFile() && e.name.endsWith('.json') && !ignorar.includes(path.relative(dir, p).replace(/\\/g, '/'))) arquivos.push(p);
    }
  };
  if (fs.existsSync(dir)) listar(dir);
  for (const arq of arquivos.sort()) {
    let obj; const bruto = fs.readFileSync(arq, 'utf8');
    try { obj = JSON.parse(bruto); } catch { continue; }
    resumo.arquivos_lidos++;
    const r = mascararObjeto(obj);
    if (r.alteradas) {
      const tmp = `${arq}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, formatar(obj) + '\n', 'utf8');
      fs.renameSync(tmp, arq);
      resumo.arquivos_regravados_nesta_execucao++;
      resumo.nesta_execucao.campos += r.alteradas;
      resumo.nesta_execucao = { ...somar(resumo.nesta_execucao, r.contagem), campos: resumo.nesta_execucao.campos };
    }
    const t = totaisGravados(obj);
    for (const k of Object.keys(resumo.total_gravado)) resumo.total_gravado[k] += t[k];
    if (t.campos || t.marcadores_nome || t.marcadores_documento) resumo.arquivos_com_omissao.push(path.relative(dir, arq).replace(/\\/g, '/'));
  }
  return resumo;
}
