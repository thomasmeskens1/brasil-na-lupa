#!/usr/bin/env node
// Testes das regras de desfecho com textos oficiais reais (pautas de out/2026).
// Uso: node scripts/coleta/agenda/teste-desfecho.mjs
import assert from 'node:assert/strict';
import { desfechoCamara, desfechoSenado } from './desfecho.mjs';
import { relatoresDoTexto, tipoSenado } from './senado.mjs';
import { tipoCamara } from './camara.mjs';
import { categoriaSituacao } from './lib.mjs';

let n = 0;
const caso = (nome, obtido, esperado) => { assert.equal(obtido, esperado, nome); n++; };

// Câmara
caso('não apreciada', desfechoCamara('Matéria não apreciada em face do encerramento da Ordem do Dia.').desfecho, 'não votado');
caso('aprovada com destaques e requerimento rejeitado', desfechoCamara(
  'Discussão em turno único. Votação do Requerimento do Dep. Kim Kataguiri, que solicita a retirada de pauta deste Projeto de Lei Complementar. Rejeitado o Requerimento. Sim: 11; Não: 387; Total: 398. Aprovada a Subemenda Substitutiva Global ao Projeto de Lei Complementar nº 186, de 2026, ressalvados os destaques. Votação da Redação Final. Aprovada a Redação Final assinada pelo relator, Dep. Rubens Pereira Júnior (PT/MA). Prejudicado o DTQ 1 (UNIÃO): Emenda de Plenário n. 4 (161, II).',
).desfecho, 'aprovado');
caso('adiada depois de rejeitar substitutivo', desfechoCamara(
  'Votação em turno único. Rejeitada a Subemenda Substitutiva ao Projeto de Lei Complementar nº 281, de 2019, adotada pelo relator da Comissão Especial. Sim: 252; Não: 176; Total: 428. Adiada a continuação da votação em face do encerramento da Ordem do Dia.',
).desfecho, 'adiado');
caso('substitutivo rejeitado sozinho não é rejeição do projeto', desfechoCamara(
  'Rejeitada a Subemenda Substitutiva ao Projeto de Lei Complementar nº 281, de 2019.',
).desfecho, 'não informado');
caso('projeto rejeitado', desfechoCamara('Votação em turno único. Rejeitado o Projeto de Lei nº 1, de 2026.').desfecho, 'rejeitado');
caso('MPV aprovada, emendas rejeitadas, DTQ retirado', desfechoCamara(
  'Aprovado, em apreciação preliminar, o Parecer da Comissão Mista. Aprovada a Medida Provisória nº 1.357, de 2026, na forma do Projeto de Lei de Conversão. Rejeitada a Emenda nº 99. Mantido o texto. Retirado o DTQ 1 (PL): Destaque da Emenda nº 96. Rejeitada a Emenda nº 97.',
).desfecho, 'aprovado');
caso('urgência aprovada em item que é requerimento', desfechoCamara(
  'Aprovado, por unanimidade, o Requerimento de Urgência (Art. 155 do RICD).', { itemERequerimento: true },
).desfecho, 'aprovado');
caso('urgência aprovada não é desfecho de projeto', desfechoCamara('Aprovado o Requerimento de Urgência (Art. 155 do RICD).').desfecho, 'não informado');
caso('retirado de pauta', desfechoCamara('Retirado de pauta de ofício pelo Presidente.').desfecho, 'retirado');
caso('sessão futura', desfechoCamara('Aprovado o Projeto.', { sessaoRealizada: false }).desfecho, 'não informado');
caso('sem texto', desfechoCamara(null).desfecho, 'não informado');

// Senado
const r = (descricaoDeliberacao, textoResultado) => ({ descricaoDeliberacao, textoResultado });
caso('aprovado o projeto', desfechoSenado(r('Apreciado', 'Resultado da matéria: Aprovado o projeto. \n\nA matéria vai à sanção.')).desfecho, 'aprovado');
caso('urgência + projeto aprovado', desfechoSenado(r('Apreciado', 'Objeto da deliberação: Requerimento nº 640.\n\nResultado: Aprovado o requerimento.\n\nResultado da matéria: Aprovado o projeto de decreto legislativo.')).desfecho, 'aprovado');
caso('só calendário especial', desfechoSenado(r('Apreciado', 'Objeto da deliberação: Requerimento nº 706, de 2026, de Líderes, que solicita calendário especial para a proposta. Resultado: Aprovado o requerimento.')).desfecho, 'não informado');
caso('discussão encerrada', desfechoSenado(r('Apreciação não concluída', 'Resultado da matéria: Encerrada a primeira sessão de discussão, em primeiro turno.')).desfecho, 'não informado');
caso('retirado', desfechoSenado(r('Retirado', 'Resultado da matéria: Retirado de Pauta.')).desfecho, 'retirado');
caso('não apreciado', desfechoSenado(r('Não apreciado', '')).desfecho, 'não votado');
caso('pauta: requerimento aprovado', desfechoSenado(null, { decisoesPauta: ['Requerimento aprovado.\n\n'], itemERequerimento: true }).desfecho, 'aprovado');
caso('pauta: urgência não vale para PL', desfechoSenado(null, { decisoesPauta: ['Aprovado o requerimento.'] }).desfecho, 'não informado');
caso('pauta: indicador retirado', desfechoSenado(null, { retirado: true }).desfecho, 'retirado');
caso('sessão futura', desfechoSenado(r('Apreciado', 'Resultado da matéria: Aprovado o projeto.'), { sessaoRealizada: false }).desfecho, 'não informado');

// Relator, tipo e situação
const rel = relatoresDoTexto('Parecer nº 59, de 2026, da Comissão de Constituição, Justiça e Cidadania, Relator: Senador Omar Aziz, favorável à proposta.');
caso('relator citado', rel[0]?.nome, 'Omar Aziz');
caso('sem relator', relatoresDoTexto('Requer licença saúde.').length, 0);
caso('tipo CN', tipoSenado('SESSÃO SOLENE ', 'CN', 'N'), 'sessão do Congresso Nacional');
caso('tipo especial', tipoSenado('SESSÃO ESPECIAL ', 'SF', 'N'), 'não deliberativa');
caso('tipo ordinária SF', tipoSenado('SESSÃO DELIBERATIVA ORDINÁRIA ', 'SF', 'S'), 'deliberativa ordinária');
caso('tipo extraordinária Câmara', tipoCamara('Sessão Deliberativa', 'Sessão Deliberativa Extraordinária Semipresencial (AM nº 123/2020)'), 'deliberativa extraordinária');
caso('tipo solene Câmara', tipoCamara('Sessão Não Deliberativa Solene', 'Homenagem'), 'não deliberativa');
caso('situação não realizada', categoriaSituacao('Sessão não realizada'), 'não realizada');
caso('situação convocada', categoriaSituacao('Convocada'), 'agendada');
caso('situação em andamento', categoriaSituacao('Em Andamento'), 'em andamento');

console.log(`teste-desfecho: ${n} casos ok`);
