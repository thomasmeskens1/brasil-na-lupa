// Votações nominais do Plenário da ALESP: lista em /votacao/{ano} + PDF oficial
// ("Relatório de Verificação de Votação") lido por coordenadas (extrair_votacao_pdf.py).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { obter, normalizarNome } from './lib.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EXTRATOR = path.join(AQUI, 'extrair_votacao_pdf.py');
export const API = 'https://legis-api-portal-prd.al.sp.gov.br';

/** Python do venv local (scripts/coleta/alesp/.venv), ou ALESP_PYTHON, ou python3/python do sistema. */
export function acharPython() {
  if (process.env.ALESP_PYTHON) return process.env.ALESP_PYTHON;
  for (const c of [path.join(AQUI, '.venv', 'Scripts', 'python.exe'), path.join(AQUI, '.venv', 'bin', 'python')]) {
    if (fs.existsSync(c)) return c;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * Roda o extrator num diretório temporário novo e vazio, com python -I (modo isolado:
 * não importa nada do diretório atual nem do diretório do PDF). O PDF é dado não confiável.
 */
export function extrairPdf(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alesp-pdf-'));
  const arq = path.join(dir, 'relatorio.pdf');
  try {
    fs.writeFileSync(arq, buf);
    const out = execFileSync(acharPython(), ['-I', EXTRATOR, arq], {
      cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000, windowsHide: true,
    });
    return JSON.parse(out);
  } catch (e) {
    return { ok: false, problemas: [`extrator falhou: ${String(e.message).slice(0, 200)}`], linhas: [], rodape: {} };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const RESULTADOS = { Aprovado: 'aprovada', Aprovada: 'aprovada', Rejeitado: 'rejeitada', Rejeitada: 'rejeitada' };
const norm = (s) => normalizarNome(s).replace(/[^A-Z0-9]/g, '');

/** Monta o registro da votação a partir do item da API e do resultado do extrator. */
export function montarVotacao(v, ext, { hoje, sha256, mapaNomes }) {
  const uuid = path.basename(v.urlArquivoPrincipal, '.pdf');
  const lacunas = [];
  const problemas = [...(ext.problemas || [])];
  const cab = ext.cabecalho || {};
  // A ligação PDF ↔ item da API precisa conferir: data da sessão e descrição do que foi votado.
  if (cab.data && cab.data !== v.dataSessao) problemas.push(`data do PDF (${cab.data}) difere da API (${v.dataSessao})`);
  const linhasCab = cab.linhas || [];
  if (ext.linhas?.length && !linhasCab.some((l) => norm(l) === norm(v.descricao))) {
    problemas.push('descrição no PDF difere da descrição da API');
  }
  const rod = ext.rodape || {};
  const temRodape = ['Votos Sim', 'Votos Não', 'Abstenção', 'Em Branco', 'Total'].every((k) => Number.isInteger(rod[k]));
  const confiavel = ext.ok === true && problemas.length === 0;
  const linhas = confiavel ? ext.linhas : [];
  const contar = (x) => linhas.filter((l) => l.voto === x).length;
  const placar = temRodape ? {
    sim: rod['Votos Sim'], nao: rod['Votos Não'], abstencao: rod['Abstenção'],
    obstrucao: confiavel ? contar('Obstrução') : null, outros: rod['Em Branco'],
  } : null;
  const resultadoTxt = rod.resultado || null;
  const resultado = resultadoTxt && RESULTADOS[resultadoTxt] ? RESULTADOS[resultadoTxt] : null;
  if (!resultado) {
    lacunas.push(resultadoTxt
      ? `Resultado registrado no relatório como "${resultadoTxt}"`
      : 'Resultado não consta do relatório oficial de verificação de votação');
  }
  if (!confiavel) {
    lacunas.push('Votos individuais não publicados: a leitura automática do relatório oficial (PDF) não permitiu '
      + 'ligar com segurança cada nome ao seu voto. Consulte o documento oficial no link.');
  }
  if (!temRodape) lacunas.push('Placar não lido do relatório oficial; consulte o documento no link');
  let semId = 0;
  const votos = linhas.map((l) => {
    const id = mapaNomes.get(normalizarNome(l.nome)) ?? null;
    if (!id) semId++;
    return {
      parlamentar_id: id, nome: l.nome, partido: l.partido || null, uf: 'SP', voto: l.voto,
      ...(l.marcador ? { marcador_relatorio: l.marcador } : {}),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (semId) {
    lacunas.push(`${semId} nome(s) do relatório sem correspondência exata na lista oficial de parlamentares; `
      + 'identificador deixado em branco');
  }
  const sessaoTxt = v.tituloSessao || null;
  return {
    id: uuid,
    casa: 'alesp',
    data: v.dataSessao,
    hora: cab.hora || null,
    orgao: 'Plenário',
    orgao_sigla: 'PLEN',
    orgao_nome: 'Plenário da Assembleia Legislativa do Estado de São Paulo',
    sessao: { id: v.idSessao, titulo: sessaoTxt, tipo: v.tipoSessao || null, numero: v.numeroSessao ?? null },
    proposicao: v.idProposicao ? {
      id: String(v.idProposicao), tipo: v.tipoProposicao || null, sigla: siglaTipo(v.idTipoProposicao),
      numero: v.numeroProposicao ?? null, ano: v.anoProposicao ?? null, ementa: v.ementaProposicao || null,
      url: `https://www.al.sp.gov.br/propositura/${v.idProposicao}`,
    } : null,
    descricao: v.descricao || null,
    descricao_abertura: linhasCab.find((l) => /^VERIFICA/i.test(l)) || null,
    resultado,
    resultado_texto_oficial: resultadoTxt,
    tipo: 'nominal',
    placar,
    placar_oficial_relatorio: temRodape ? {
      votos_sim: rod['Votos Sim'], votos_nao: rod['Votos Não'], abstencao: rod['Abstenção'],
      em_branco: rod['Em Branco'], presidente: rod.Presidente ?? null, total: rod.Total,
    } : null,
    partidos_em_obstrucao: rod.partidos_em_obstrucao || null,
    placar_origem: 'totais-oficiais',
    conferencia_placar: confiavel
      ? `Os ${linhas.length} registros lidos do relatório conferem com o rodapé oficial (Votos Sim, Votos Não, `
        + 'Abstenção, Em Branco, Presidente e Total) e cada nome tem a mesma cor de impressão do seu voto.'
      : 'Votos individuais não conferidos; placar copiado do rodapé do relatório oficial.',
    votos,
    fonte: {
      titulo: `Relatório de Verificação de Votação — ${v.descricao || ''} (${sessaoTxt || ''}, ${v.dataSessao})`,
      url: v.urlArquivoPrincipal,
      orgao: 'Assembleia Legislativa do Estado de São Paulo (ALESP)',
      acessado_em: hoje,
    },
    documento_sha256: sha256,
    url: v.urlArquivoPrincipal,
    lacunas,
    ...(problemas.length ? { problemas_leitura: problemas.slice(0, 20) } : {}),
  };
}

const SIGLAS = { 1: 'PL', 2: 'PLC', 3: 'PR', 4: 'PDL', 5: 'PEC' };
export function siglaTipo(id) { return SIGLAS[id] || null; }

/** Baixa e processa as votações do ano. Reaproveita o detalhe já gravado quando o PDF não mudou de data. */
export async function coletarPlenario(ano, { hoje, desde, completo, dirVot, mapaNomes, log }) {
  const lista = (await obter(`${API}/votacao/${ano}`)) || [];
  const resultados = [];
  for (const v of lista) {
    if (!v.urlArquivoPrincipal) continue;
    const uuid = path.basename(v.urlArquivoPrincipal, '.pdf');
    const arq = path.join(dirVot, `${uuid}.json`);
    const existente = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : null;
    if (existente && !completo && v.dataSessao < desde) { resultados.push(existente); continue; }
    const buf = await obter(v.urlArquivoPrincipal, { tipo: 'bin' });
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    let reg;
    if (existente && existente.documento_sha256 === sha256 && !completo) {
      reg = { ...existente, fonte: { ...existente.fonte, acessado_em: hoje } };
    } else {
      const ext = extrairPdf(buf);
      reg = montarVotacao(v, ext, { hoje, sha256, mapaNomes });
      log(`  plenário ${v.dataSessao} ${v.descricao}: ${reg.votos.length} votos${reg.votos.length ? '' : ' (não publicados: ' + (reg.problemas_leitura || []).slice(0, 2).join('; ') + ')'}`);
    }
    resultados.push(reg);
  }
  return resultados;
}
