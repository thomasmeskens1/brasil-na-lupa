#!/usr/bin/env node
// Coletor do Executivo federal (Fase 3): medidas provisórias, vetos e normas (leis, leis complementares, decretos).
// Node 20+, sem dependências. Escreve só em dados/executivo/.
//
// Uso:
//   node scripts/coleta/executivo/coletar.mjs                     # incremental: últimos 7 dias
//   node scripts/coleta/executivo/coletar.mjs --desde 2026-10-01  # incremental a partir da data
//   node scripts/coleta/executivo/coletar.mjs --completo          # 2025 e 2026 inteiros (refaz tudo)
//   Opções: --so mps|vetos|normas (repetível)
//
// Incremental: relê as listas anuais (poucas requisições) e só consulta o detalhe do que é novo,
// está em tramitação ou foi atualizado na fonte desde a data; exposições de motivos já extraídas
// e votos de vetos já gravados são reaproveitados.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estatisticas, contagemGravacao, gravarSeMudou, lerJson, hojeISO, somarDias, fonte } from './lib.mjs';
import { coletarMps } from './mps.mjs';
import { coletarVetos } from './vetos.mjs';
import { coletarNormas } from './normas.mjs';
import { ESQUEMA } from './esquema.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DADOS = path.join(RAIZ, 'dados', 'executivo');
const ANOS_COMPLETO = [2025, 2026];

function argumentos(argv) {
  const a = { completo: false, desde: null, so: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--completo') a.completo = true;
    else if (argv[i] === '--desde') a.desde = argv[++i];
    else if (argv[i] === '--so') a.so.push(argv[++i]);
    else throw new Error(`Argumento desconhecido: ${argv[i]}`);
  }
  if (a.desde && !/^\d{4}-\d{2}-\d{2}$/.test(a.desde)) throw new Error('--desde deve ser AAAA-MM-DD');
  for (const s of a.so) if (!['mps', 'vetos', 'normas'].includes(s)) throw new Error(`--so inválido: ${s}`);
  return a;
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const hoje = hojeISO();
  const inicio = new Date();
  const desde = args.completo ? `${ANOS_COMPLETO[0]}-01-01` : (args.desde || somarDias(hoje, -7));
  const anoHoje = Number(hoje.slice(0, 4));
  // As listas anuais são baratas (1 a 3 requisições por ano): o incremental relê todos os anos
  // desde 2025, porque uma MP ou veto de um ano pode mudar de situação no ano seguinte.
  const anos = [];
  for (let y = ANOS_COMPLETO[0]; y <= Math.max(anoHoje, ANOS_COMPLETO[ANOS_COMPLETO.length - 1]); y++) anos.push(y);
  const quais = args.so.length ? args.so : ['mps', 'vetos', 'normas'];
  const log = (m) => console.log(`[executivo] ${m}`);
  log(`modo ${args.completo ? 'completo' : 'incremental'}; desde ${desde}; anos ${anos.join(', ')}; ${quais.join(', ')}`);
  const ctx = { anos, desde, completo: args.completo, hoje, dirDados: DADOS, raiz: RAIZ, log };

  const metaAntiga = lerJson(path.join(DADOS, 'meta.json')) || {};
  const contagens = { ...(metaAntiga.contagens || {}) };
  const erros = [];
  const tarefas = {
    mps: () => coletarMps(ctx),
    vetos: () => coletarVetos(ctx),
    normas: () => coletarNormas(ctx),
  };
  await Promise.all(quais.map(async (q) => {
    try { contagens[q === 'mps' ? 'medidas_provisorias' : q] = await tarefas[q](); }
    catch (e) { erros.push(`${q}: ${e.message}`); log(`ERRO em ${q}: ${e.stack || e.message}`); }
  }));

  const meta = {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: {
      inicio: inicio.toISOString(), fim: new Date().toISOString(), modo: args.completo ? 'completo' : 'incremental',
      desde, anos, partes: quais, requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas,
      falhas: estatisticas.falhas.slice(0, 50), erros,
    },
    periodo: { inicio: `${ANOS_COMPLETO[0]}-01-01`, fim: hoje, observacao: 'Atos de 2025 e 2026 (ano de edição da MP, ano do veto, ano de assinatura da norma)' },
    contagens,
    fontes: [
      fonte('Senado Federal / Congresso Nacional: processos (MPV, VET) e prazos', 'https://legis.senado.leg.br/dadosabertos/processo', 'Senado Federal / Congresso Nacional', hoje),
      fonte('Congresso Nacional: lista anual de vetos e resultado por dispositivo', 'https://legis.senado.leg.br/dadosabertos/materia/vetos/{ano}.json', 'Congresso Nacional', hoje),
      fonte('Senado Federal: legislação federal (lista e detalhe de normas)', 'https://legis.senado.leg.br/dadosabertos/legislacao/lista', 'Senado Federal', hoje),
      fonte('Câmara dos Deputados: proposições do tipo MPV', 'https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=MPV', 'Câmara dos Deputados', hoje),
      fonte('Presidência da República: Portal da Legislação (ccivil_03) — medidas provisórias, exposições de motivos, leis e decretos', 'https://www.planalto.gov.br/ccivil_03/', 'Presidência da República', hoje),
    ],
    observacoes: [
      'Nada é deduzido: o que a fonte não traz fica null e é registrado em "lacunas" de cada item.',
      'Situação das medidas provisórias: rótulo padronizado só quando o tipo de deliberação oficial é inequívoco (perda de eficácia, rejeição, revogação, aprovação com norma gerada); o texto oficial fica em "situacao_oficial".',
      'Exposição de motivos: PDF oficial do Planalto, localizado pelo link "Exposição de motivos" da página da MP; guardamos URL, hash SHA-256 e trechos literais (parágrafo 2 e o parágrafo sobre relevância e urgência), nunca resumo. PDF sem texto legível fica como lacuna.',
      'Vetos: razão do veto por dispositivo é o texto oficial do campo RazaoVeto do Congresso Nacional. Situação por dispositivo: Rejeitado = veto derrubado; Mantido = veto mantido (rótulos da própria fonte). Os campos "Comentario" e "Justificativa" da fonte (resumos da equipe do Congresso) não são incorporados.',
      'Votos em vetos: a fonte traz nome, UF e partido abreviado, sem código do parlamentar. O id do parlamentar só é preenchido quando nome + UF coincidem com um único parlamentar do cadastro atual da Casa; caso contrário fica null. O significado de "Sim"/"Não" na cédula não é interpretado pelo coletor.',
      'Votações das MPs: referência pelo id oficial às votações já coletadas em dados/camara e dados/senado (Câmara: proposição "MPV n/ano"; Senado: processo da MPV). O serviço do Senado só lista votações nominais e secretas.',
      'Normas: decretos não numerados não estão incluídos. Link do Planalto só é gravado depois de confirmado por requisição ao endereço padrão. O link direto para a página do DOU não é gravado (a fonte estruturada traz só veículo, data, página e coluna).',
    ],
    esquema: ESQUEMA,
  };
  gravarSeMudou(path.join(DADOS, 'meta.json'), meta);
  log(`requisições ${estatisticas.requisicoes}, retentativas ${estatisticas.retentativas}, falhas ${estatisticas.falhas.length}; arquivos gravados ${contagemGravacao.gravados}, inalterados ${contagemGravacao.inalterados}`);
  if (erros.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
