#!/usr/bin/env node
/**
 * Gera, no build, os dados da página inicial, de "Quem me representa" e da Agenda do Plenário,
 * a partir de web/content (copiado de ../dados por sync-data.mjs) e dos índices que os outros
 * scripts gerar-*.mjs já produziram (rodar por último).
 *
 * Servidor/build (content/inicio/):
 *   decisoes.json      decisões dos últimos 7 dias, todas as esferas, em ordem cronológica
 *   agenda.json        sessões, contagem de votações por dia e pauta da última sessão por casa
 *   atualizacao.json   data e hora da última coleta (meta.json de cada fonte)
 *   uf/<uf>.json       eleitos estaduais e federais da UF (com vínculo às listas em exercício)
 * Navegador (public/, arquivos estáticos; nada do visitante é enviado):
 *   inicio/busca.json                  índice compacto da busca única
 *   quem-me-representa/municipios.json nome, UF e endereço curto de cada município
 *   quem-me-representa/m/<uf>/<slug>.json  eleitos de 2024 de cada município
 *
 * Nenhum dado é deduzido: só se copiam e reorganizam campos das fontes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lerJson, slug, decisoesDaSemana, indiceBusca } from "./lib/inicio-decisoes.mjs";

const inicio = Date.now();
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = path.join(webDir, "content");
const saida = path.join(content, "inicio");
const pubBusca = path.join(webDir, "public", "inicio");
const pubRep = path.join(webDir, "public", "quem-me-representa");

function gravar(arquivo, dados) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const txt = JSON.stringify(dados);
  fs.writeFileSync(arquivo, txt);
  return txt.length;
}

function hojeSaoPaulo() {
  // AAAA-MM-DD no fuso de Brasília (data de referência do build).
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/* ---------- atualização ---------- */
function ultimaColeta() {
  const fontes = [];
  for (const d of fs.existsSync(content) ? fs.readdirSync(content) : []) {
    const m = lerJson(path.join(content, d, "meta.json"));
    if (!m) continue;
    const cands = [m.ultima_execucao, m.atualizado_em, m.verificado_em].filter(
      (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v),
    );
    if (cands.length) fontes.push({ pasta: d, em: cands.sort().at(-1) });
  }
  fontes.sort((a, b) => b.em.localeCompare(a.em));
  return { coletado_em: fontes[0]?.em ?? null, fontes };
}

/* ---------- agenda ---------- */
function existeVotacao(casa, id) {
  if (casa !== "camara" && casa !== "senado") return false;
  if (!/^[A-Za-z0-9.-]{1,40}$/.test(String(id))) return false;
  return fs.existsSync(path.join(content, casa, "votacoes", `${id}.json`));
}

function gerarAgenda() {
  const dir = path.join(content, "agenda");
  const s = lerJson(path.join(dir, "sessoes.json"));
  const meta = lerJson(path.join(dir, "meta.json"));
  if (!s) return null;
  const sessoes = (s.sessoes ?? []).map((x) => ({
    id: x.id,
    casa: x.casa,
    casa_nome: x.casa_nome,
    data: x.data,
    hora: x.hora ?? null,
    tipo: x.tipo ?? null,
    tipo_oficial: x.tipo_oficial ?? null,
    descricao_oficial: x.descricao_oficial ?? null,
    situacao: x.situacao ?? null,
    situacao_oficial: x.situacao_oficial ?? null,
    link_oficial: x.link_oficial ?? null,
    fonte: x.fonte ?? null,
    votacoes_no_dia: x.votacoes_registradas_no_dia?.quantidade ?? null,
    itens_pauta: x.pauta?.itens ?? 0,
    pauta_arquivo: x.pauta?.arquivo ?? null,
  }));
  sessoes.sort((a, b) => `${a.data}T${a.hora ?? "99"}`.localeCompare(`${b.data}T${b.hora ?? "99"}`) || a.id.localeCompare(b.id));

  // Votações por dia: a fonte repete a contagem do dia em cada sessão da mesma casa → maior valor por casa.
  const dias = {};
  for (const x of sessoes) {
    const d = (dias[x.data] ??= { votacoes: {}, marcada: false, sessoes: 0 });
    d.sessoes += 1;
    if (x.situacao === "agendada") d.marcada = true;
    if (typeof x.votacoes_no_dia === "number") d.votacoes[x.casa] = Math.max(d.votacoes[x.casa] ?? 0, x.votacoes_no_dia);
  }
  for (const d of Object.values(dias)) d.total = Object.values(d.votacoes).reduce((a, b) => a + b, 0);

  // Pauta da última sessão encerrada com itens, por casa.
  const ultimas = {};
  for (const casa of ["camara", "senado", "congresso"]) {
    const enc = sessoes.filter((x) => x.casa === casa && x.situacao === "encerrada" && x.itens_pauta > 0 && x.pauta_arquivo);
    const ult = enc.at(-1);
    if (!ult) continue;
    const p = lerJson(path.join(dir, ult.pauta_arquivo));
    const sp = p?.sessoes?.find((q) => q.sessao_id === ult.id);
    if (!sp) continue;
    const casaVot = casa === "congresso" ? null : casa;
    ultimas[casa] = {
      sessao: ult,
      itens: (sp.itens ?? []).map((i) => ({
        ordem: i.ordem ?? null,
        titulo: i.titulo ?? null,
        ementa: i.proposicao?.ementa ?? null,
        url: i.proposicao?.url ?? null,
        relatores: [...new Set((i.relatores ?? []).map((r) => r.nome).filter(Boolean))],
        desfecho: i.desfecho ?? "não informado",
        desfecho_texto_oficial: i.desfecho_texto_oficial ?? null,
        votacoes: (i.votacoes ?? []).filter((v) => casaVot && existeVotacao(casaVot, v)).map((v) => ({ casa: casaVot, id: String(v) })),
        fonte: i.fonte ?? null,
      })),
    };
  }
  return {
    atualizado_em: meta?.atualizado_em ?? s.atualizado_em ?? null,
    periodo: meta?.periodo ?? s.periodo ?? null,
    tempo_real: meta?.tempo_real ?? false,
    aviso: meta?.aviso ?? s.aviso ?? null,
    fontes: meta?.fontes ?? [],
    regra_votacoes: meta?.regras?.votacoes_no_dia ?? null,
    sessoes,
    dias,
    ultimas,
  };
}

/* ---------- quem me representa ---------- */
const UFS = ["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to"];

function idsParlamentares() {
  const ids = { camara: new Set(), senado: new Set(), alesp: new Set() };
  for (const casa of ["camara", "senado"]) {
    const c = lerJson(path.join(content, "congresso", `${casa}.json`));
    for (const p of c?.parlamentares ?? []) ids[casa].add(String(p.id));
  }
  const sp = lerJson(path.join(content, "_gerado", "sp.json"));
  for (const d of sp?.deputados ?? []) ids.alesp.add(String(d.id));
  return ids;
}

function link(x, ids) {
  if (x.vinculo_confianca !== "exata" || !x.parlamentar_casa || !x.parlamentar_id) return null;
  const id = String(x.parlamentar_id);
  if (!ids[x.parlamentar_casa]?.has(id)) return null;
  if (x.parlamentar_casa === "alesp") return `/estados/sp/deputados/${id}`;
  return `/congresso/${x.parlamentar_casa}/parlamentares/${id}`;
}

function pessoa(x, ids) {
  const o = { cargo: x.cargo, nome: x.nome_urna, partido: x.partido ?? null, ano: x.ano ?? null, situacao: x.situacao ?? null };
  if (x.nome_completo) o.nome_completo = x.nome_completo;
  if (x.eleicao_suplementar) o.eleicao_suplementar = x.eleicao_suplementar;
  if (x.data_eleicao) o.data_eleicao = x.data_eleicao;
  const l = ids ? link(x, ids) : null;
  if (l) o.href = l;
  return o;
}

function porNome(a, b) {
  return a.nome.localeCompare(b.nome, "pt-BR");
}

function gerarRepresentantes() {
  const dir = path.join(content, "eleitos");
  const meta = lerJson(path.join(dir, "meta.json"));
  if (!meta) return null;
  const ids = idsParlamentares();
  const lista = [];
  let arquivos = 0;
  fs.rmSync(path.join(pubRep, "m"), { recursive: true, force: true });
  const muniOficial = lerJson(path.join(dir, "municipios.json"));
  const nomesOficiais = new Map((muniOficial?.itens ?? []).map((m) => [m.codigo_tse, m]));
  for (const uf of UFS) {
    const d = lerJson(path.join(dir, `${uf}.json`));
    if (!d) continue;
    const e26 = lerJson(path.join(dir, "eleitos-2026", `${uf}.json`));
    const fontes24 = (d.fontes ?? []).filter((f) => /2024|munic/i.test(f.titulo ?? ""));
    const usados = new Set();
    const municipios = [];
    for (const m of d.municipios ?? []) {
      let s = slug(m.nome);
      if (usados.has(s)) s = `${s}-${m.codigo_tse}`;
      usados.add(s);
      const itens = (m.itens ?? []).map((x) => pessoa({ ano: m.ano ?? null, ...x }, null)).sort(porNome);
      gravar(path.join(pubRep, "m", uf, `${s}.json`), {
        nome: m.nome,
        uf: d.uf,
        nome_uf: d.nome_uf,
        ano: m.ano ?? 2024,
        atualizado_em: d.atualizado_em ?? null,
        itens,
        fontes: fontes24,
      });
      arquivos += 1;
      municipios.push({ nome: m.nome, slug: s });
      lista.push([m.nome, d.uf, s]);
      nomesOficiais.delete(m.codigo_tse);
    }
    const ef = (d.estaduais_federais?.itens ?? []).map((x) => pessoa(x, ids)).sort(porNome);
    const novos = (e26?.itens ?? []).map((x) => pessoa(x, ids)).sort(porNome);
    gravar(path.join(saida, "uf", `${uf}.json`), {
      uf: d.uf,
      nome_uf: d.nome_uf,
      atualizado_em: d.atualizado_em ?? null,
      aviso: d.aviso ?? null,
      fontes: (d.fontes ?? []).filter((f) => !/2024|munic/i.test(f.titulo ?? "")),
      itens: ef,
      municipios: municipios.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      eleitos_2026: e26 ? { status: e26.status ?? null, aviso: e26.aviso ?? null, fontes: e26.fontes ?? [], itens: novos } : null,
    });
  }
  // Municípios da tabela oficial sem eleitos no arquivo do TSE (ficam buscáveis, com a lacuna explicada).
  for (const m of nomesOficiais.values()) {
    const uf = String(m.uf).toLowerCase();
    if (!UFS.includes(uf) || uf === "df") continue;
    const s = `${slug(m.nome)}-${m.codigo_tse}`;
    gravar(path.join(pubRep, "m", uf, `${s}.json`), { nome: m.nome, uf: m.uf, ano: 2024, atualizado_em: meta.atualizado_em ?? null, itens: [], fontes: [] });
    lista.push([m.nome, m.uf, s]);
    arquivos += 1;
  }
  lista.sort((a, b) => a[0].localeCompare(b[0], "pt-BR") || a[1].localeCompare(b[1]));
  const tam = gravar(path.join(pubRep, "municipios.json"), { gerado_em: new Date().toISOString(), m: lista });
  gravar(path.join(saida, "eleitos-meta.json"), {
    atualizado_em: meta.atualizado_em ?? null,
    ultima_execucao: meta.ultima_execucao ?? null,
    aviso: meta.aviso ?? null,
    lacunas: meta.lacunas ?? [],
    fontes: meta.fontes ?? [],
    glossario: meta.glossario ?? {},
  });
  return { municipios: lista.length, arquivos, tam };
}

/* ---------- execução ---------- */
function main() {
  if (!fs.existsSync(content)) {
    console.log("[gerar-inicio] content/ não encontrado; nada a gerar.");
    return;
  }
  fs.mkdirSync(saida, { recursive: true });
  const atual = ultimaColeta();
  gravar(path.join(saida, "atualizacao.json"), atual);

  const hoje = hojeSaoPaulo();
  const dec = decisoesDaSemana(content, webDir, hoje);
  gravar(path.join(saida, "decisoes.json"), dec);

  const agenda = gerarAgenda();
  if (agenda) gravar(path.join(saida, "agenda.json"), agenda);

  // Depois dos representantes: a busca usa a lista de municípios que eles gravam.
  const rep = gerarRepresentantes();
  const busca = indiceBusca(content, webDir);
  const tamBusca = gravar(path.join(pubBusca, "busca.json"), busca);
  console.log(
    `[gerar-inicio] decisões de ${dec.periodo.inicio} a ${dec.periodo.fim}: ${dec.itens.length}; ` +
      `agenda: ${agenda ? agenda.sessoes.length : 0} sessões; busca.json ${Math.round(tamBusca / 1024)} KB (${busca.i.length} itens); ` +
      (rep ? `municípios: ${rep.municipios} (${rep.arquivos} arquivos, lista ${Math.round(rep.tam / 1024)} KB); ` : "eleitos ausentes; ") +
      `última coleta ${atual.coletado_em ?? "não informada"} (${Date.now() - inicio} ms).`,
  );
}

main();
