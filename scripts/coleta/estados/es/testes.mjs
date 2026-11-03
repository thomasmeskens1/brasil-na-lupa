#!/usr/bin/env node
// Testes offline do coletor ES (sem rede). Amostras: texto extraído de dois Boletins de Votação Nominal
// oficiais (amostras/) e registros no formato da API da ALES com dados pessoais fictícios.
// Uso: node scripts/coleta/estados/es/testes.mjs   (com Python+pdfplumber, testa também o extrator num PDF mínimo)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verificarPrivacidade } from '../rn/base.mjs';
import {
  montarParlamentar, montarProposicao, montarNorma, TIPOS_NORMA, indiceDeNomes, ligarNome, lerBoletim, lerTitulo,
  montarVotacaoBoletim, numeroBoletim, autorPublico, NOME_OMITIDO,
} from './ales.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const amostra = (f) => JSON.parse(fs.readFileSync(path.join(AQUI, 'amostras', f), 'utf8')).linhas;
let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log(`ok - ${nome}`); };
const hoje = '2026-11-03';

const parlBrutos = [
  { parlamentarID: 45, parlamentarNome: 'DELEGADO DANILO BAHIENSE', parlamentarRazaoSocial: 'Delegado Danilo Bahiense', partidoSigla: 'PL', partidoNome: 'PARTIDO LIBERAL',
    parlamentarFoto: 'https://www3.al.es.gov.br/Arquivo/images/pessoas/X.jpg', parlamentarLegislatura: '20', parlamentarMesaCargo: 'não participa',
    parlamentarSituacao: 'Ativos', parlamentarPerfil: '<p>biografia</p>', parlamentarTelefone: '(27) 0000-0000', parlamentarGabinete: '101',
    parlamentarEmail: 'dep.danilobahiense@al.es.gov.br', comissoesAtuantes: [{ comissaID: 1, comissaoNome: 'COMISSÃO X', comissaoCargo: 'Presidente' }], frequenciaPlenario: [] },
  { parlamentarID: 26, parlamentarNome: 'ENGENHEIRO JOSÉ ESMERALDO', partidoSigla: 'UNIÃO', parlamentarSituacao: 'Ativos', parlamentarEmail: 'pessoal@gmail.com' },
  { parlamentarID: 485, parlamentarNome: 'FABIO DUARTE', partidoSigla: 'PDT', parlamentarSituacao: 'Ativos' },
  { parlamentarID: 473, parlamentarNome: 'DR. BRUNO RESENDE', partidoSigla: 'UNIÃO', parlamentarSituacao: 'Ativos' },
  { parlamentarID: 486, parlamentarNome: 'TONINHO DA EMATER', partidoSigla: 'PSB', parlamentarSituacao: 'Deputados Suplentes participantes da Legislatura' },
];
const parls = parlBrutos.map(montarParlamentar);
const nomes = indiceDeNomes(parls);

teste('parlamentar: telefone, perfil e e-mail pessoal descartados; e-mail institucional mantido', () => {
  const s = JSON.stringify(parls);
  assert.ok(!s.includes('0000-0000') && !s.includes('biografia') && !s.includes('gmail'));
  assert.equal(parls[0].email, 'dep.danilobahiense@al.es.gov.br');
  assert.equal(parls[1].email, null);
  assert.equal(parls[4].em_exercicio, false);
  verificarPrivacidade(parls);
});

teste('ligação de nomes do boletim: abreviações fixas e acentos', () => {
  assert.equal(ligarNome('DEL DANILO BAHIENSE', nomes), '45');
  assert.equal(ligarNome('ENG. JOSÉ ESMERALDO', nomes), '26');
  assert.equal(ligarNome('FÁBIO DUARTE', nomes), '485');
  assert.equal(ligarNome('DR BRUNO RESENDE', nomes), '473');
  assert.equal(ligarNome('FULANO DESCONHECIDO', nomes), null);
});

teste('boletim RVP 53/2026: leitura e conferência com os totais', () => {
  const b = lerBoletim(amostra('boletim-rvp-53-2026.json'));
  assert.equal(b.ok, true, b.problemas.join('; '));
  assert.equal(b.votos.length, 30);
  assert.deepEqual(b.totais, { sim: 21, nao: 0, abstencao: 1 });
  assert.equal(b.resultado, 'Aprovada');
  assert.equal(b.cabecalho.modo, 'Nominal');
  assert.equal(b.cabecalho.inicio, '20/10/2026 15:21');
  assert.deepEqual(lerTitulo(b.cabecalho.titulo), { sigla: 'PLC', numero: 28, ano: 2026, objeto: null });
  const item = { id: 497392, protocolo: '22933', assunto: 'PROJETO DE COMPLEMENTAR Nº 28/2026 - APROVADO NO DIA 20.10.26',
    arquivo: 'https://www3.al.es.gov.br/Arquivo/Documents/2026/10/20/RVP/497392-RVP532026-20261020163242665_213c4f6c(3559).pdf' };
  const v = montarVotacaoBoletim(item, b, { hoje, sha256: 'x', indiceNomes: nomes, proposicaoId: 497000 });
  assert.equal(v.id, 'es-rvp-497392');
  assert.equal(v.data, '2026-10-20');
  assert.equal(v.hora, '15:21');
  assert.equal(v.resultado, 'aprovada');
  assert.equal(v.tipo, 'nominal');
  assert.equal(v.votos_situacao, 'coletados');
  assert.deepEqual(v.placar, { sim: 21, nao: 0, abstencao: 1, obstrucao: null, outros: null });
  assert.equal(v.votos_por_tipo.Ausente, 8);
  assert.equal(v.votos.find((x) => x.nome === 'DEL DANILO BAHIENSE').parlamentar_id, '45');
  assert.equal(v.proposicao.id, 'es-497000');
  assert.deepEqual(numeroBoletim(item.arquivo), { numero: 53, ano: 2026 });
  assert.equal(v.fonte.url, item.arquivo);
  assert.equal(v.fonte.acessado_em, hoje);
});

teste('boletim de veto: resultado literal ("MANTIDO O VETO") sem conversão; "Não votou" reproduzido', () => {
  const b = lerBoletim(amostra('boletim-rvp-49-2026-veto.json'));
  assert.equal(b.ok, true, b.problemas.join('; '));
  assert.deepEqual(lerTitulo(b.cabecalho.titulo), { sigla: 'PL', numero: 326, ano: 2019, objeto: 'Veto Total' });
  const v = montarVotacaoBoletim({ id: 495125, arquivo: 'https://www3.al.es.gov.br/x/495125-RVP492026-1.pdf' }, b, { hoje, sha256: 'y', indiceNomes: nomes });
  assert.equal(v.resultado, null);
  assert.equal(v.resultado_texto_oficial, 'MANTIDO O VETO');
  assert.equal(v.votos_por_tipo['Não votou'], 3);
  assert.ok(v.lacunas.some((l) => l.includes('MANTIDO O VETO')));
});

teste('boletim que não confere com os totais não é aceito', () => {
  const linhas = amostra('boletim-rvp-53-2026.json').map((l) => (l === 'Totais: Sim: 21 Não:0 Abstenção: 1' ? 'Totais: Sim: 22 Não:0 Abstenção: 1' : l));
  const b = lerBoletim(linhas);
  assert.equal(b.ok, false);
  assert.ok(b.problemas.some((p) => p.startsWith('Sim:')));
  const l2 = amostra('boletim-rvp-53-2026.json').map((l) => l.replace('Modo: Nominal', 'Modo: Secreto'));
  assert.equal(lerBoletim(l2).ok, false);
  const l3 = amostra('boletim-rvp-53-2026.json').map((l) => l.replace('(PP) Sim 15:28:39', '(PP) Talvez 15:28:39'));
  assert.equal(lerBoletim(l3).ok, false);
});

teste('proposição: CPF, e-mail e telefone de quem protocolou nunca saem; autor pessoa física omitido', () => {
  const p = {
    id: 497867, processo: '21971', ano: '2026', sigla: 'PLC', tipo: 'Projeto de Lei Complementar', numero: '29', protocolo: '23397',
    assunto: 'Mensagem nº 205/2026 - Encaminha Projeto de Lei Complementar que dispõe sobre honorários.', data: '29/10/2026 17:12:36', situacao: 'Tramitando',
    arquivo: 'https://www3.al.es.gov.br/Arquivo/Documents/2026/10/29/PLC/x.pdf',
    AutorRequerenteDados: { pessoaId: 1, autorId: 972, cpf_cnpj: '000.000.000-00', telefone: '(27) 0000-0000', email: 'servidora@seg.es.gov.br', nomeRazao: 'GOVERNADOR DO ESTADO', setor: 'Secretaria' },
    Tramitacoes: [{ fase: 'Aguardar Análise da Presidência', setor: 'Secretaria Geral da Mesa', acao: '', dataRecebimento: '30/10/2026 09:19:37', ResponsavelAcao: 'NOME DE SERVIDOR' }],
  };
  const r = montarProposicao(p, { hoje, indiceNomes: nomes });
  const s = JSON.stringify(r);
  assert.ok(!/000\.000|0000-0000|servidora@|NOME DE SERVIDOR|pessoaId|cpf/i.test(s));
  assert.equal(r.autor.nome, 'GOVERNADOR DO ESTADO');
  assert.equal(r.id, 'es-497867');
  assert.equal(r.situacao.data, '2026-10-30');
  verificarPrivacidade(r);
  assert.equal(autorPublico({ nomeRazao: 'MARIA DA SILVA' }, nomes).nome, NOME_OMITIDO);
  assert.equal(autorPublico({ nomeRazao: 'DELEGADO DANILO BAHIENSE' }, nomes).parlamentar_id, '45');
});

teste('norma: id e campos', () => {
  const n = montarNorma({ id: 113273, tipoId: '3', tipo: 'Lei Ordinária', origem: 'PODER LEGISLATIVO', numero: '12961', ano: '2026', data: '16/10/2026 00:00:00',
    situacao: 'Em Vigor', arquivoHtml: 'https://www3.al.es.gov.br/Arquivo/Documents/legislacao/html/LEI129612026.html', arquivo: '', ementa: 'Complementa a Política Estadual.' }, TIPOS_NORMA[0], { hoje });
  assert.equal(n.id, 'lei-12961-2026');
  assert.equal(n.data, '2026-10-16');
  assert.equal(n.id_oficial, 113273);
});

console.log(`\n${ok} teste(s) ES ok`);
