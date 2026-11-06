#!/usr/bin/env node
/**
 * Gera, no build, os índices da seção Congresso a partir de web/content/{camara,senado,titulos}
 * (copiados de ../dados por sync-data.mjs; rodar depois dele).
 *
 * - content/congresso/<casa>.json  (só servidor/build): parlamentares (lista oficial + quem
 *   aparece em votações nominais e não está na lista atual), resumo de todas as votações e o
 *   índice invertido parlamentar → votos nominais. Evita ler ~3.800 arquivos por página.
 * - public/congresso/busca.json    (navegador): índice compacto da lista e da busca de votações,
 *   com o título em linguagem simples aprovado (dados/titulos/<casa>.json) quando existir.
 *   É um arquivo estático; a busca roda no navegador e nada do visitante é enviado.
 * - content/congresso/painel.json (só servidor/build): números do painel da página /congresso
 *   (semana e mês da última votação coletada, leis do ano, medidas provisórias em tramitação,
 *   parlamentares em exercício), cada um com período e fonte.
 * - public/congresso/votos-<casa>.json (navegador): votos nominais de cada parlamentar, em texto
 *   compacto (um caractere por votação nominal), para o comparador lado a lado.
 * - content/congresso/og-dados.mjs (empacotado só nas rotas de imagem Open Graph): as mesmas
 *   linhas do índice, sem ementa, e o resumo dos parlamentares. As imagens são geradas sob
 *   demanda e content/ não acompanha as funções; por isso os dados vão como módulo.
 *
 * Critério "Só o que muda leis" (marca `muda_lei` / coluna `l`): a votação é de uma proposição
 * que pode criar ou mudar norma (PEC, PLP, PL, MPV, PLV, PDL, PDC, PDS, PRC, PRS, PLN) E a
 * descrição oficial NÃO começa por uma etapa de procedimento: requerimento (urgência, adiamento,
 * retirada de pauta, encerramento de discussão etc.), alteração do regime de tramitação,
 * redação final, preferência, recurso ou questão de ordem. O mesmo texto está em src/features/congresso/lista.ts.
 *
 * Nenhum dado é deduzido: só se copiam e reorganizam campos da fonte.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = path.join(webDir, "content");
const saidaServidor = path.join(content, "congresso");
const saidaPublica = path.join(webDir, "public", "congresso");

const CASAS = ["camara", "senado"];
const TIPOS = ["nominal", "simbolica", "secreta"];
const NORMAS = new Set(["PEC", "PLP", "PL", "MPV", "PLV", "PDL", "PDC", "PDS", "PRC", "PRS", "PLN"]);
// "Aprovado o Requerimento…", "Aprovado, por unanimidade, o Requerimento…": até 30 caracteres
// (sem ponto) entre o verbo e o objeto.
const VERBO = "^(aprovad|rejeitad)[oa]s?\\b[^.]{0,30}?";
const PROCEDIMENTO = [
  new RegExp(`${VERBO}\\brequerimentos?\\b`),
  new RegExp(`${VERBO}\\bredacao final\\b`),
  new RegExp(`${VERBO}\\bpreferencia\\b`),
  new RegExp(`${VERBO}\\b(adiamento|encerramento)\\b`),
  new RegExp(`${VERBO}\\bretirada de pauta\\b`),
  new RegExp(`${VERBO}\\brecursos?\\b`),
  /^votacao nominal do requerimento\b/,
  /^alteracao do regime de tramitacao\b/,
  /questao de ordem/,
];
/** Votos Sim/Não/Abstenção/Obstrução + marcações; o resto vai como veio (índice no rótulo). */
const VAZIO_VOTO = ".";

function lerJson(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return null;
  }
}

function normalizar(t) {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function mudaLei(d) {
  const sigla = d.proposicao?.sigla ?? null;
  if (!sigla || !NORMAS.has(sigla)) return false;
  const desc = normalizar(d.descricao);
  return !PROCEDIMENTO.some((re) => re.test(desc));
}

function tituloProposicao(p) {
  if (!p) return null;
  return p.titulo ?? p.identificacao ?? (p.sigla && p.numero && p.ano ? `${p.sigla} ${p.numero}/${p.ano}` : null);
}

function chaveTempo(v) {
  return `${v.data ?? ""}T${v.hora ?? "99:99"}`;
}

/** Mesmas regras de tituloAprovado() em src/components/decisao/rotulos.ts. */
function tituloAprovado(s) {
  if (!s || typeof s.titulo !== "string" || !s.titulo.trim()) return false;
  const v = s.verificacao;
  if (!v) return true;
  if (v.numeros_e_datas_conferidos === false || v.verbo_permitido === false) return false;
  if (Array.isArray(v.palavras_proibidas) && v.palavras_proibidas.length > 0) return false;
  if (v.veto_vies !== null && v.veto_vies !== undefined && v.veto_vies !== false) return false;
  return true;
}

function gerarCasa(casa) {
  const dir = path.join(content, casa, "votacoes");
  if (!fs.existsSync(dir)) return null;
  const lista = lerJson(path.join(content, casa, "parlamentares.json"));
  const meta = lerJson(path.join(content, casa, "meta.json"));

  const votacoes = [];
  for (const nome of fs.readdirSync(dir)) {
    if (!nome.endsWith(".json") || nome.startsWith("indice")) continue;
    const d = lerJson(path.join(dir, nome));
    if (!d || !d.id) continue;
    votacoes.push(d);
  }
  votacoes.sort((a, b) => chaveTempo(b).localeCompare(chaveTempo(a)) || String(b.id).localeCompare(String(a.id)));

  const resumos = votacoes.map((d) => ({
    id: String(d.id),
    data: d.data ?? null,
    hora: d.hora ?? null,
    tipo: d.tipo ?? null,
    resultado: d.resultado ?? null,
    orgao: d.orgao_nome ?? d.orgao ?? null,
    proposicao: d.proposicao
      ? {
          id: d.proposicao.id != null ? String(d.proposicao.id) : null,
          titulo: tituloProposicao(d.proposicao),
          sigla: d.proposicao.sigla ?? null,
          ementa: d.proposicao.ementa ?? null,
        }
      : null,
    descricao: d.descricao ?? null,
    placar: d.placar ?? null,
    muda_lei: mudaLei(d),
    fonte_url: d.fonte?.url ?? d.url ?? null,
  }));

  // Parlamentares da lista oficial atual.
  const parlamentares = new Map();
  for (const p of lista?.itens ?? []) {
    parlamentares.set(String(p.id), { ...p, id: String(p.id), na_lista_atual: true });
  }

  // Índice invertido: só votações nominais, só o que a fonte registra em "votos".
  const votosPor = {};
  votacoes.forEach((d, i) => {
    if (d.tipo !== "nominal") return;
    for (const v of d.votos ?? []) {
      const pid = v.parlamentar_id != null ? String(v.parlamentar_id) : null;
      if (!pid) continue;
      (votosPor[pid] ??= []).push([i, v.voto ?? null]);
      // Quem votou e não está na lista atual: nome, partido e UF do registro mais recente.
      if (!parlamentares.has(pid)) {
        parlamentares.set(pid, {
          id: pid,
          nome: v.nome,
          partido: v.partido ?? null,
          uf: v.uf ?? null,
          foto: null,
          url_oficial: null,
          na_lista_atual: false,
          registro_de: d.data ?? null,
        });
      }
    }
  });

  const ordenados = [...parlamentares.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return {
    casa,
    atualizado_em: meta?.atualizado_em ?? lista?.atualizado_em ?? null,
    lista_atualizada_em: lista?.atualizado_em ?? null,
    lista_fonte: lista?.fonte ?? null,
    fontes: meta?.fontes ?? [],
    periodo: meta?.periodo ?? null,
    observacoes: meta?.observacoes ?? [],
    parlamentares: ordenados,
    votacoes: resumos,
    votos_por_parlamentar: votosPor,
  };
}

/** Votos nominais de cada parlamentar: um caractere por votação nominal ("." = sem registro). */
function votosCompactos(r, titulos) {
  const nominais = [];
  r.votacoes.forEach((v, i) => {
    if (v.tipo === "nominal") nominais.push(i);
  });
  const pos = new Map(nominais.map((i, n) => [i, n]));
  const rotulos = [];
  const codigo = new Map();
  const p = {};
  for (const [pid, lista] of Object.entries(r.votos_por_parlamentar)) {
    const s = new Array(nominais.length).fill(VAZIO_VOTO);
    for (const [i, voto] of lista) {
      const k = voto ?? "Registro não informado";
      if (!codigo.has(k)) {
        codigo.set(k, rotulos.length);
        rotulos.push(k);
      }
      const n = pos.get(i);
      if (n !== undefined) s[n] = String.fromCharCode(65 + codigo.get(k));
    }
    p[pid] = s.join("");
  }
  const v = nominais.map((i) => {
    const x = r.votacoes[i];
    const t = titulos?.itens?.[x.id];
    return [x.id, x.data ?? "", tituloAprovado(t) ? t.titulo : "", x.proposicao?.titulo ?? "", x.descricao ?? "", x.resultado ?? ""];
  });
  return { casa: r.casa, atualizado_em: r.atualizado_em, rotulos, v, p };
}

// ---------------------------------------------------------------- painel da página /congresso

function dataUTC(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

function iso(x) {
  return x.toISOString().slice(0, 10);
}

/** Contagens de um conjunto de linhas do índice (só campos da fonte; nada é estimado). */
function contarLinhas(ls) {
  const n = (f) => ls.filter(f).length;
  return {
    total: ls.length,
    camara: n((l) => l[0] === 0),
    senado: n((l) => l[0] === 1),
    nominais: n((l) => l[3] === 0),
    simbolicas: n((l) => l[3] === 1),
    secretas: n((l) => l[3] === 2),
    muda_lei: n((l) => l[8] === 1),
    aprovadas: n((l) => l[4] === 1),
    rejeitadas: n((l) => l[4] === 0),
  };
}

/**
 * Números do painel inicial. Períodos fechados pela data da última votação coletada (não pela
 * data do build): a semana (segunda a domingo) e o mês do calendário dessa votação. Leis e
 * medidas provisórias vêm dos índices oficiais do Executivo (content/executivo, copiados por
 * sync-data.mjs). Presença média não entra: as casas não publicam esse número.
 */
function gerarPainel(linhas, listas) {
  const ultima = linhas.find((l) => l[2])?.[2] ?? null;
  const d = dataUTC(ultima);
  let semana = null;
  let mes = null;
  if (d) {
    const seg = new Date(d);
    seg.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const dom = new Date(seg);
    dom.setUTCDate(seg.getUTCDate() + 6);
    const [ini, fim] = [iso(seg), iso(dom)];
    const ls = linhas.filter((l) => l[2] >= ini && l[2] <= fim);
    semana = { inicio: ini, fim, ultima_votacao: ultima, ...contarLinhas(ls), itens: ls.filter((l) => l[8] === 1).map((l) => [CASAS[l[0]], l[1]]) };
    const am = ultima.slice(0, 7);
    const lm = linhas.filter((l) => l[2].startsWith(am));
    mes = { inicio: `${am}-01`, fim: ultima, ...contarLinhas(lm) };
  }

  const exec = path.join(content, "executivo");
  const anoLeis = (ultima ?? "").slice(0, 4);
  let leis = null;
  const ni = anoLeis ? lerJson(path.join(exec, "normas", `indice-${anoLeis}.json`)) : null;
  if (ni?.itens) {
    const doCongresso = ni.itens.filter((i) => i.caminho === "congresso" && (i.tipo === "Lei" || i.tipo === "Lei Complementar"));
    const datas = doCongresso.map((i) => i.data_assinatura).filter(Boolean).sort();
    leis = {
      ano: anoLeis,
      total: doCongresso.length,
      ordinarias: doCongresso.filter((i) => i.tipo === "Lei").length,
      complementares: doCongresso.filter((i) => i.tipo === "Lei Complementar").length,
      primeira: datas[0] ?? null,
      ultima: datas[datas.length - 1] ?? null,
      atualizado_em: ni.atualizado_em ?? null,
      fontes: [
        { titulo: `Legislação federal: leis de ${anoLeis}`, url: `https://legis.senado.leg.br/dadosabertos/legislacao/lista?tipo=LEI&ano=${anoLeis}`, orgao: "Senado Federal" },
        { titulo: `Legislação federal: leis complementares de ${anoLeis}`, url: `https://legis.senado.leg.br/dadosabertos/legislacao/lista?tipo=LCP&ano=${anoLeis}`, orgao: "Senado Federal" },
      ],
    };
  }

  let mps = null;
  const dirMp = path.join(exec, "medidas-provisorias");
  if (fs.existsSync(dirMp)) {
    const itens = [];
    let atualizado = null;
    const anos = [];
    for (const nome of fs.readdirSync(dirMp)) {
      const m = /^indice-(\d{4})\.json$/.exec(nome);
      if (!m) continue;
      const j = lerJson(path.join(dirMp, nome));
      if (!j?.itens) continue;
      anos.push(m[1]);
      itens.push(...j.itens);
      if (j.atualizado_em && (!atualizado || j.atualizado_em > atualizado)) atualizado = j.atualizado_em;
    }
    anos.sort();
    mps = {
      em_tramitacao: itens.filter((i) => i.situacao === "em tramitação").length,
      enviadas_a_sancao: itens.filter((i) => i.situacao === "aprovada pelo Congresso, enviada à sanção").length,
      editadas: itens.length,
      anos,
      atualizado_em: atualizado,
      fonte: { titulo: "Processos de medidas provisórias (Dados Abertos)", url: "https://legis.senado.leg.br/dadosabertos/processo?sigla=MPV", orgao: "Senado Federal / Congresso Nacional" },
    };
  }

  return { ultima_votacao: ultima, semana, mes, leis, mps, parlamentares: listas };
}

function main() {
  const inicio = Date.now();
  fs.mkdirSync(saidaServidor, { recursive: true });
  fs.mkdirSync(saidaPublica, { recursive: true });

  const proposicoes = [];
  const indiceProp = new Map();
  const temas = [];
  const indiceTema = new Map();
  const linhas = [];
  const casas = {};
  const resumo = [];
  const parlamentaresOg = {};
  const listas = {};

  CASAS.forEach((casa, c) => {
    const r = gerarCasa(casa);
    if (!r) return;
    const titulos = lerJson(path.join(content, "titulos", `${casa}.json`));
    fs.writeFileSync(path.join(saidaServidor, `${casa}.json`), JSON.stringify(r));
    const votos = votosCompactos(r, titulos);
    fs.writeFileSync(path.join(saidaPublica, `votos-${casa}.json`), JSON.stringify(votos));
    casas[casa] = { atualizado_em: r.atualizado_em };
    listas[casa] = {
      em_exercicio: r.parlamentares.filter((p) => p.na_lista_atual).length,
      lista_atualizada_em: r.lista_atualizada_em,
      fonte: r.lista_fonte ? { titulo: r.lista_fonte.titulo ?? null, url: r.lista_fonte.url, orgao: r.lista_fonte.orgao ?? null } : null,
    };
    let comTitulo = 0;
    for (const p of r.parlamentares) {
      parlamentaresOg[`${casa}/${p.id}`] = [p.nome, p.partido ?? "", p.uf ?? "", (r.votos_por_parlamentar[p.id] ?? []).length, p.na_lista_atual ? 1 : 0];
    }
    for (const v of r.votacoes) {
      let pi = -1;
      if (v.proposicao?.titulo) {
        const k = `${c}|${v.proposicao.id ?? v.proposicao.titulo}`;
        if (!indiceProp.has(k)) {
          indiceProp.set(k, proposicoes.length);
          proposicoes.push([v.proposicao.titulo, v.proposicao.ementa ?? "", v.proposicao.sigla ?? ""]);
        }
        pi = indiceProp.get(k);
      }
      const t = TIPOS.indexOf(v.tipo);
      const res = v.resultado === "aprovada" ? 1 : v.resultado === "rejeitada" ? 0 : -1;
      const pl = v.placar ? ["sim", "nao", "abstencao", "obstrucao", "outros"].map((k) => (typeof v.placar[k] === "number" ? v.placar[k] : null)) : null;
      const s = titulos?.itens?.[v.id];
      const ok = tituloAprovado(s);
      if (ok) comTitulo += 1;
      let tm = -1;
      if (ok && s.tema) {
        if (!indiceTema.has(s.tema)) {
          indiceTema.set(s.tema, temas.length);
          temas.push(s.tema);
        }
        tm = indiceTema.get(s.tema);
      }
      linhas.push([
        c,
        v.id,
        v.data ?? "",
        t,
        res,
        pi,
        v.descricao ?? "",
        pl,
        v.muda_lei ? 1 : 0,
        ok ? s.titulo : "",
        ok ? (s.subtitulo ?? "") : "",
        tm,
        v.fonte_url ?? "",
        ok ? (s.origem ?? "") : "",
        v.hora ?? "",
      ]);
    }
    resumo.push(`${casa}: ${r.votacoes.length} votações (${r.votacoes.filter((v) => v.muda_lei).length} mudam leis, ${comTitulo} com título simples), ${r.parlamentares.length} parlamentares`);
  });

  linhas.sort((a, b) => `${b[2]}T${b[14] || "99:99"}`.localeCompare(`${a[2]}T${a[14] || "99:99"}`));
  const v = linhas.map((l) => l.slice(0, 14));
  const busca = { gerado_em: new Date().toISOString(), casas, temas, p: proposicoes, v };
  fs.writeFileSync(path.join(saidaPublica, "busca.json"), JSON.stringify(busca));
  const kb = Math.round(fs.statSync(path.join(saidaPublica, "busca.json")).size / 1024);
  fs.writeFileSync(path.join(saidaServidor, "painel.json"), JSON.stringify(gerarPainel(linhas, listas)));

  // "Fale com seus parlamentares" (navegador): só quem está em exercício, com o e-mail institucional
  // publicado pela Câmara/Senado. [id, nome, partido, UF, e-mail]. Baixado só quando a pessoa abre o bloco.
  const contatos = { gerado_em: new Date().toISOString() };
  for (const casa of ["camara", "senado"]) {
    const l = lerJson(path.join(content, casa, "parlamentares.json"));
    const itens = Array.isArray(l) ? l : (l?.itens ?? l?.parlamentares ?? []);
    contatos[casa] = itens
      .filter((p) => p.em_exercicio !== false && p.email && p.uf)
      .map((p) => [String(p.id), p.nome, p.partido ?? null, String(p.uf).toUpperCase(), p.email])
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }
  fs.writeFileSync(path.join(saidaPublica, "contatos.json"), JSON.stringify(contatos));

  // Módulo das imagens Open Graph: sem ementa (não aparece na imagem).
  const og = { casas, temas, p: proposicoes.map(([t, , s]) => [t, "", s]), v: v.map((l) => [...l.slice(0, 6), String(l[6]).slice(0, 200), ...l.slice(7)]), parlamentares: parlamentaresOg };
  fs.writeFileSync(
    path.join(saidaServidor, "og-dados.mjs"),
    `// Gerado por scripts/gerar-congresso.mjs. Não editar.\nexport default JSON.parse(${JSON.stringify(JSON.stringify(og))});\n`,
  );
  const kbOg = Math.round(fs.statSync(path.join(saidaServidor, "og-dados.mjs")).size / 1024);
  console.log(`[gerar-congresso] ${resumo.join("; ") || "sem dados"}; busca.json ${kb} KB; og-dados ${kbOg} KB (${Date.now() - inicio} ms).`);
}

main();
