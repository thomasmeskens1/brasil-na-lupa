#!/usr/bin/env node
/**
 * Gera, no build, os índices da seção Atibaia a partir de web/content/atibaia (copiado de
 * ../dados por sync-data.mjs; rodar depois dele e depois de gerar-executivo-justica.mjs, que
 * recria content/_gerado). Pasta ausente é ignorada.
 *
 * Servidor/build (content/_gerado/atibaia.json): composição da Câmara (da ata oficial), resumo
 * mensal das finanças (TCE-SP) e os atos mais recentes.
 * Navegador (public/atibaia/normas.json): leis, leis complementares e decretos para a busca.
 *
 * Diretriz 12: das normas, só o campo "ementa_publica" sai daqui (nomes de particulares já
 * omitidos pela curadoria). Nenhum outro campo de ementa é lido para exibição.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(webDir, "content", "atibaia");
const saidaServidor = path.join(webDir, "content", "_gerado");
const pub = path.join(webDir, "public", "atibaia");

function lerJson(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return null;
  }
}

function listar(dir, filtro) {
  try {
    return fs.readdirSync(dir).filter((n) => n.endsWith(".json") && filtro(n));
  } catch {
    return [];
  }
}

function gravar(arquivo, dados) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(dados));
  return Math.round(fs.statSync(arquivo).size / 1024);
}

/** Entidades HTML que a API do TCE-SP devolve nos nomes (ex.: &quot;). Só a grafia muda. */
function semEntidades(t) {
  return String(t ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const TIPOS = ["Lei", "Lei Complementar", "Decreto"];

function gerarNormas() {
  const dir = path.join(base, "normas");
  const indices = listar(dir, (n) => /^indice-\d{4}\.json$/.test(n)).map((n) => lerJson(path.join(dir, n))).filter(Boolean);
  const itens = indices.flatMap((i) => i.itens ?? []).filter((x) => typeof x.ementa_publica === "string" && x.ementa_publica.trim());
  itens.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || String(b.numero).localeCompare(String(a.numero), "pt-BR", { numeric: true }));
  const linhas = itens.map((x) => [
    String(x.id),
    TIPOS.indexOf(x.tipo) >= 0 ? TIPOS.indexOf(x.tipo) : x.tipo,
    x.numero ?? null,
    x.data ?? "",
    x.ementa_publica,
    x.edicao?.numero ?? null,
    x.edicao?.data ?? null,
    x.pagina ?? null,
    x.url ?? x.fonte?.url ?? null,
    (x.outras_publicacoes ?? []).map((o) => [o.edicao ?? null, o.data ?? null, o.pagina ?? null, o.url ?? null]),
    x.mascaramento && (x.mascaramento.nomes_omitidos_automatico || x.mascaramento.nomes_omitidos_lista || x.mascaramento.documentos_omitidos) ? 1 : 0,
  ]);
  const kb = gravar(path.join(pub, "normas.json"), { gerado_em: new Date().toISOString(), tipos: TIPOS, n: linhas });
  const porAnoTipo = {};
  for (const x of itens) {
    const k = `${(x.data ?? "").slice(0, 4)}|${x.tipo}`;
    porAnoTipo[k] = (porAnoTipo[k] ?? 0) + 1;
  }
  return {
    kb,
    resumo: {
      total: itens.length,
      por_ano_tipo: porAnoTipo,
      fonte: indices[0]?.fonte ?? null,
      atualizado_em: indices.map((i) => i.atualizado_em).filter(Boolean).sort().pop() ?? null,
      coberturas: indices.map((i) => ({ ano: i.ano ?? null, ...(i.cobertura ?? {}) })),
      criterio: indices[0]?.criterio ?? null,
      recentes: itens.slice(0, 5).map((x) => ({
        id: String(x.id),
        tipo: x.tipo,
        numero: x.numero ?? null,
        data: x.data ?? null,
        ementa_publica: x.ementa_publica,
        url: x.url ?? x.fonte?.url ?? null,
        edicao: x.edicao?.numero ?? null,
        edicao_data: x.edicao?.data ?? null,
        pagina: x.pagina ?? null,
      })),
    },
  };
}

const EVENTOS = { Empenhado: "empenhado", "Valor Liquidado": "liquidado", "Valor Pago": "pago", "Reforço": "reforco", "Anulação": "anulacao" };

function gerarFinancas() {
  const dir = path.join(base, "financas");
  const anos = [];
  for (const n of listar(dir, (x) => /^\d{4}\.json$/.test(x)).sort().reverse()) {
    const f = lerJson(path.join(dir, n));
    if (!f?.meses) continue;
    const meses = f.meses.map((m) => {
      const ev = {};
      for (const e of m.despesas?.por_evento ?? []) ev[EVENTOS[e.evento] ?? semEntidades(e.evento)] = e.total;
      const porOrgao = {};
      for (const e of m.despesas?.por_orgao_e_evento ?? []) {
        const o = semEntidades(e.orgao);
        (porOrgao[o] ??= {})[EVENTOS[e.evento] ?? semEntidades(e.evento)] = e.total;
      }
      return {
        mes: m.mes,
        nome: m.nome,
        com_dados: (m.despesas?.registros ?? 0) > 0 || (m.receitas?.registros ?? 0) > 0,
        consultado_em: m.consultado_em ?? null,
        url_despesas: m.url_despesas ?? null,
        url_receitas: m.url_receitas ?? null,
        receita: (m.receitas?.registros ?? 0) > 0 ? (m.receitas?.total_arrecadado ?? null) : null,
        despesa: ev,
        nao_lidos: (m.despesas?.valores_nao_lidos ?? 0) + (m.receitas?.valores_nao_lidos ?? 0),
        receita_por_orgao: (m.receitas?.por_orgao ?? []).map((x) => [semEntidades(x.orgao), x.total]),
        receita_por_fonte: (m.receitas?.por_fonte_recurso ?? []).map((x) => [semEntidades(x.ds_fonte_recurso), x.total]),
        despesa_por_orgao: Object.entries(porOrgao).sort((a, b) => a[0].localeCompare(b[0], "pt-BR")),
      };
    });
    anos.push({
      ano: f.exercicio ?? Number(n.slice(0, 4)),
      atualizado_em: f.atualizado_em ?? null,
      fonte: f.fonte ?? null,
      aviso_oficial: f.aviso_oficial ?? null,
      atualizacao_informada: f.atualizacao_informada ?? null,
      ultimo_mes_com_dados: f.ultimo_mes_com_dados ?? null,
      metodo: f.metodo ?? null,
      lacunas: f.lacunas ?? [],
      meses,
    });
  }
  return anos;
}

function main() {
  const inicio = Date.now();
  fs.rmSync(pub, { recursive: true, force: true });
  if (!fs.existsSync(base)) {
    console.log("[gerar-atibaia] sem dados.");
    return;
  }
  const meta = lerJson(path.join(base, "meta.json"));
  const vereadores = lerJson(path.join(base, "vereadores.json"));
  const normas = gerarNormas();
  const financas = gerarFinancas();
  fs.mkdirSync(saidaServidor, { recursive: true });
  gravar(path.join(saidaServidor, "atibaia.json"), {
    atualizado_em: meta?.atualizado_em ?? null,
    fontes: meta?.fontes ?? [],
    vereadores: vereadores
      ? {
          atualizado_em: vereadores.atualizado_em ?? null,
          fonte: vereadores.fonte ?? null,
          criterio: vereadores.criterio ?? null,
          sessao: vereadores.sessao ?? null,
          conferencia: vereadores.conferencia_com_ata_anterior ?? null,
          itens: (vereadores.itens ?? []).map((v) => ({ id: v.id, nome: v.nome, partido: v.partido ?? null, cargo_na_mesa: v.cargo_na_mesa ?? null })),
          mesa: vereadores.mesa ?? [],
          lacunas: vereadores.lacunas ?? [],
        }
      : null,
    normas: normas.resumo,
    financas,
  });
  console.log(
    `[gerar-atibaia] ${normas.resumo.total} normas (normas.json ${normas.kb} KB), ${vereadores?.itens?.length ?? 0} vereadores, finanças de ${financas.map((a) => a.ano).join(", ") || "nenhum ano"} (${Date.now() - inicio} ms).`,
  );
}

main();
