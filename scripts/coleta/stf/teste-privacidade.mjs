#!/usr/bin/env node
// Testes do mascaramento da diretriz 12 (STF e STJ). Nomes de particulares aqui são fictícios.
// Uso: node scripts/coleta/stf/teste-privacidade.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mascararTexto, mascararObjeto, totaisGravados, MARCA_NOME as N, MARCA_DOC as D } from './privacidade.mjs';

let n = 0;
const caso = (nome, entrada, esperado) => {
  const r = mascararTexto(entrada);
  assert.equal(r.texto, esperado, nome);
  assert.equal(mascararTexto(r.texto).texto, r.texto, `${nome} (idempotente)`);
  n++;
  return r;
};

// Caso da ADI 7379 (estrutura real da certidão; nome fictício).
const r7379 = caso('ADI 7379: advogada particular na sustentação oral',
  'O Tribunal, por unanimidade, julgou improcedente o pedido, nos termos do voto do Relator. Falou, pela requerente, a Dra. Fulana Beltrana de Tal. Plenário, Sessão Virtual de 12.9.2025 a 19.9.2025.',
  `O Tribunal, por unanimidade, julgou improcedente o pedido, nos termos do voto do Relator. Falou, pela requerente, a Dra. ${N}. Plenário, Sessão Virtual de 12.9.2025 a 19.9.2025.`);
assert.equal(r7379.nomes, 1);

caso('advogado particular + procuradora do Estado (mantida pelo cargo)',
  'Falaram, pelas requerentes, o Dr. Joaquim Ficticio Neto; e, pelo interessado Governador do Estado do Rio de Janeiro, a Dra. Maria Exemplo Servidora, Procuradora do Estado. Ausente, justificadamente, a Ministra Cármen Lúcia.',
  `Falaram, pelas requerentes, o Dr. ${N}; e, pelo interessado Governador do Estado do Rio de Janeiro, a Dra. Maria Exemplo Servidora, Procuradora do Estado. Ausente, justificadamente, a Ministra Cármen Lúcia.`);
caso('amicus curiae ente público + procurador do Estado',
  'Falaram: pelo interessado Governador do Estado do Rio Grande do Sul, a Dra. Ana Publica, Procuradora do Estado; e, pelo amicus curiae Estado de São Paulo, o Dr. Rui Publico, Procurador do Estado. Plenário.',
  'Falaram: pelo interessado Governador do Estado do Rio Grande do Sul, a Dra. Ana Publica, Procuradora do Estado; e, pelo amicus curiae Estado de São Paulo, o Dr. Rui Publico, Procurador do Estado. Plenário.');
caso('nome com conector "e" e "Segundo"',
  'Falou, pelo amicus curiae, o Dr. Vitor de Exemplo Soares e Sousa. Plenário.',
  `Falou, pelo amicus curiae, o Dr. ${N}. Plenário.`);
caso('PGR e AGU mantidos',
  'Falaram o Procurador-Geral da República, Dr. Paulo Exemplo Gonet, e o Advogado-Geral da União, Dr. Jorge Exemplo.',
  'Falaram o Procurador-Geral da República, Dr. Paulo Exemplo Gonet, e o Advogado-Geral da União, Dr. Jorge Exemplo.');
caso('ministros mantidos (Sr./Sra. Ministro)',
  'Os Srs. Ministros Herman Benjamin e Regina Helena Costa votaram com o Sr. Ministro Relator. Ausente a Sra. Ministra Nancy Andrighi.',
  'Os Srs. Ministros Herman Benjamin e Regina Helena Costa votaram com o Sr. Ministro Relator. Ausente a Sra. Ministra Nancy Andrighi.');
caso('Sr. particular', 'Sustentou oralmente o Sr. Pedro Exemplo, pela parte recorrente.', `Sustentou oralmente o Sr. ${N}, pela parte recorrente.`);
caso('STJ: sustentação oral com parte PJ (mantida) e advogado',
  'Sustentou oralmente o Dr. Carlos Ficticio, pela parte RECORRENTE: EMPRESA EXEMPLO LTDA.\nPresidiu o julgamento o Sr. Ministro Fulano Ministro.',
  `Sustentou oralmente o Dr. ${N}, pela parte RECORRENTE: EMPRESA EXEMPLO LTDA.\nPresidiu o julgamento o Sr. Ministro Fulano Ministro.`);
const rPF = caso('STJ: parte pessoa física com rótulo (dúvida → mascara)',
  'pela parte RECORRIDA: JOSE DA SILVA EXEMPLO; e pela parte RECORRENTE: FAZENDA NACIONAL',
  `pela parte RECORRIDA: ${N}; e pela parte RECORRENTE: FAZENDA NACIONAL`);
assert.equal(rPF.em_duvida, 1);
caso('cabeçalho de partes e advogados',
  'RECTE.(S): FULANO DE TAL EXEMPLO\nADV.(A/S): BELTRANO EXEMPLO\nRECDO.(A/S): ESTADO DE SÃO PAULO',
  `RECTE.(S): ${N}\nADV.(A/S): ${N}\nRECDO.(A/S): ESTADO DE SÃO PAULO`);
caso('sustentação oral sem título', 'Falou, pelo requerente, Fulano Exemplo. Plenário.', `Falou, pelo requerente, ${N}. Plenário.`);
caso('parte nomeada após o papel', 'Falou, pelo requerente Fulano Exemplo, o Dr. Beltrano Exemplo.', `Falou, pelo requerente ${N}, o Dr. ${N}.`);
caso('"o advogado Fulano"', 'conforme petição do advogado Cicrano Exemplo, juntada aos autos', `conforme petição do advogado ${N}, juntada aos autos`);

// Documentos.
caso('OAB/UF nº', 'Dr. Fulano Exemplo (OAB/SP nº 123.456)', `Dr. ${N} (${D})`);
caso('OAB-UF sem nº', 'inscrito na OAB-RJ 98765', `inscrito na ${D}`);
caso('número/OAB-UF', '(30.648/OAB-DF)', `(${D})`);
caso('CPF formatado', 'portador do CPF 123.456.789-09', `portador do ${D}`);
caso('CPF mascarado na fonte', 'Fulano (XXX.456.789-XX)', `Fulano (${D})`);
caso('RG', 'RG nº 12.345.678-9 SSP/SP', D);
caso('CNPJ fica', 'CNPJ 12.345.678/0001-90', 'CNPJ 12.345.678/0001-90');

// Textos que não devem mudar (falsos positivos conhecidos dos dados).
for (const s of [
  'Competência para processar e julgar ações de cobrança de contribuições devidas por advogados à Ordem dos Advogados do Brasil – OAB.',
  'A fixação e cobrança das contribuições anuais de advogados são regidas especificamente pelo Estatuto da OAB (Lei nº 8.906/94).',
  'Transposição de Assistente Jurídico aposentado para o cargo de Advogado da União.',
  'emissão para mais de uma pessoa de idêntico número no Cadastro de Pessoas Físicas - CPF, ocasionando indevida inscrição',
  'descabe indeferir a petição inicial sob o argumento da falta de indicação do CPF e/ou RG da parte executada (pessoa física)',
  'Afetação cancelada porque o advogado subscritor do recurso não possui capacidade postulatória (Súmula 115/STJ).',
  'acolheu questão de ordem proposta pela Sra. Ministra Regina Helena Costa, Relatora',
  'Licenciado o Sr. Ministro Afrânio Vilela.',
  'nos termos do voto do Sr. Min. Rel.',
  'em QO suscitada pelo Sr. Min.Rel., decidiu remeter o feito à 1ª Seção',
  'Não participou o Sr. Mininistro Antonio Carlos Ferreira.',
  'nos termos do voto do Sr. Benedito Gonçalves, que lavrará o acórdão',
  'o Tema RG nº 1.255 está, atualmente, restrito à fixação de honorários',
  'sujeitam a pretensão do autor:a) ao prazo decadencial do art. 178 do Código Civil',
  'Requerentes: Senadora Fulana Exemplo (PP/MS); Deputado Federal Beltrano Exemplo (PL/RS).',
  'Homenagear os 45 anos da Associação do Senhor Jesus.',
  'Senador Dr. Hiran (PP/RR), Senadora Dra. Eudócia (PL/AL)',
  'assinada pelo relator, Dep. Doutor Luizinho (PP/RJ).',
  'localizados nos Municípios de Doutor Ulysses e Sengés, Estado do Paraná.',
  'Votaram com Sr. Ministro Ricardo Villas Bôas Cueva os Srs. Ministros\n Daniela Teixeira e Humberto Martins.',
]) caso(`sem mudança: ${s.slice(0, 40)}`, s, s);

// Objeto: hash do original, omissões, idempotência e preservação do hash já gravado.
const original = 'Falou, pela requerente, a Dra. Fulana Beltrana de Tal. Plenário.';
const j = { id: 'stf-adi-0000', certidao_literal: original, votacoes: [{ trecho: original }], url: 'https://x/?Dr. Fulano', lista: ['ok', original] };
const r = mascararObjeto(j);
assert.equal(r.alteradas, 3);
assert.equal(j.certidao_literal_original_sha256, crypto.createHash('sha256').update(original, 'utf8').digest('hex'));
assert.deepEqual(j.certidao_literal_omissoes, { nomes: 1, documentos: 0, em_duvida: 0 });
assert.ok(!JSON.stringify(j).includes('Fulana'), 'nome fictício não pode sobrar no objeto');
assert.equal(j.url, 'https://x/?Dr. Fulano', 'URLs não são alteradas');
assert.equal(j.lista[0], 'ok'); assert.equal(j.lista_original_sha256[0], null); assert.ok(j.lista_original_sha256[1]);
const copia = JSON.stringify(j);
assert.equal(mascararObjeto(j).alteradas, 0); assert.equal(JSON.stringify(j), copia, 'reaplicar não muda nada');
// Coletor reconstrói o objeto a partir do texto já mascarado e sem os campos de auditoria: hash é preservado do anterior.
const novo = { id: j.id, certidao_literal: j.certidao_literal, votacoes: [{ trecho: j.votacoes[0].trecho }], url: j.url, lista: [...j.lista] };
mascararObjeto(novo, JSON.parse(copia));
assert.equal(novo.certidao_literal_original_sha256, j.certidao_literal_original_sha256);
assert.equal(novo.votacoes[0].trecho_original_sha256, j.votacoes[0].trecho_original_sha256);
assert.deepEqual(novo.lista_original_sha256, j.lista_original_sha256);
const tot = totaisGravados(j);
assert.equal(tot.nomes, 3); assert.equal(tot.marcadores_nome, 3);
n += 8;

console.log(`ok: ${n} verificações de privacidade`);
