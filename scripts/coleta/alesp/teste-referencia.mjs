#!/usr/bin/env node
/**
 * Teste do extrator de PDF do Plenário com a votação de referência, conferida manualmente:
 * PL 1.055/2025 (Lei 18.381/2025), 58ª Sessão Extraordinária de 09/12/2025, 52 Sim × 12 Não, 94 registros.
 *   node scripts/coleta/alesp/teste-referencia.mjs [caminho-local-do-pdf]
 * Sem argumento, baixa o PDF oficial. Sai com código 1 se qualquer conferência falhar.
 */
import fs from 'node:fs';
import { obter } from './lib.mjs';
import { extrairPdf, montarVotacao } from './plenario.mjs';

const URL = 'https://www.al.sp.gov.br/repositorio/ementario/votacoes/988544da-41bd-411a-8cd2-a4a02ef1d3dd.pdf';
const buf = process.argv[2] ? fs.readFileSync(process.argv[2]) : await obter(URL, { tipo: 'bin' });
const ext = extrairPdf(buf);
const erros = [];
const ok = (cond, msg) => { if (!cond) erros.push(msg); };

ok(ext.ok === true, `extrator sinalizou problemas: ${JSON.stringify(ext.problemas)}`);
ok(ext.linhas.length === 94, `esperados 94 registros, lidos ${ext.linhas.length}`);
const cont = (v) => ext.linhas.filter((l) => l.voto === v).length;
ok(cont('Sim') === 52, `Sim: ${cont('Sim')}`);
ok(cont('Não') === 12, `Não: ${cont('Não')}`);
ok(cont('Obstrução') === 25 && cont('Licenciado') === 3 && cont('---') === 2, 'demais contagens (25 Obstrução, 3 Licenciado, 2 "---")');
// Amostra conferida visualmente na imagem do PDF oficial (nome, partido, voto, marcador).
const amostra = [
  ['ANA CAROLINA SERRA', 'FED PSDB/CIDADANIA', 'Obstrução', null],
  ['BARROS MUNHOZ', 'FED PSDB/CIDADANIA', 'Sim', null],
  ['CARLOS GIANNAZI', 'FED PSOL/REDE', 'Licenciado', null],
  ['EDIANE MARIA', 'FED PSOL/REDE', 'Não', 'L'],
  ['DONATO', 'FED PT/PC DO B', 'Não', 'L'],
  ['THAINARA FARIA', 'FED PT/PC DO B', 'Obstrução', 'L'],
  ['ITAMAR BORGES', 'MDB', 'Licenciado', 'L'],
  ['MARCIO NAKASHIMA', 'PDT', '---', 'L'],
  ['ANDRÉ DO PRADO', 'PL', '---', 'P'],
  ['LETICIA AGUIAR', 'PL', 'Obstrução', null],
  ['ANDRÉA WERNER', 'PSB', 'Não', 'L'],
  ['GILMACI SANTOS', 'REPUBLICANOS', 'Sim', 'G'],
  ['RAFAEL SARAIVA', 'UNIÃO BRASIL', 'Obstrução', null],
  ['SOLANGE FREITAS', 'UNIÃO BRASIL', 'Sim', null],
];
for (const [nome, partido, voto, marc] of amostra) {
  const l = ext.linhas.find((x) => x.nome === nome);
  ok(l && l.partido === partido && l.voto === voto && (l.marcador || null) === marc,
    `${nome}: esperado ${partido}/${voto}/${marc}, lido ${l ? `${l.partido}/${l.voto}/${l.marcador}` : 'ausente'}`);
}
const reg = montarVotacao({
  urlArquivoPrincipal: URL, dataSessao: '2025-12-09', descricao: 'PL 1055/25 SALVO EMENDAS C. PARECER FAVORÁVEL DO VOTO EM SEP',
  idSessao: 23904, tituloSessao: '58ª Sessão Extraordinária', tipoSessao: 'Sessão Extraordinária', numeroSessao: 58,
  idProposicao: 1000631834, idTipoProposicao: 1, tipoProposicao: 'Projeto de Lei', numeroProposicao: 1055, anoProposicao: 2025,
}, ext, { hoje: '2000-01-01', sha256: 'teste', mapaNomes: new Map() });
ok(reg.votos.length === 94, `registro montado com ${reg.votos.length} votos`);
ok(reg.placar?.sim === 52 && reg.placar?.nao === 12 && reg.resultado === 'aprovada' && reg.hora === '18:18',
  `placar/resultado/hora: ${JSON.stringify(reg.placar)} ${reg.resultado} ${reg.hora}`);

if (erros.length) { console.error('FALHOU:\n- ' + erros.join('\n- ')); process.exit(1); }
console.log(`OK: 94 registros, 52 Sim × 12 Não, ${amostra.length} pares nome→voto conferidos, rodapé e cores conferem.`);
