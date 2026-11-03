// Leitura literal das páginas oficiais de participação. Nada é calculado nem deduzido:
// cada campo é copiado do HTML oficial; o que não aparece fica null.

export const NAO_DISPONIVEL = 'Informação não disponível em fonte oficial';

export const URL_ECIDADANIA = (codigo) => `https://www12.senado.leg.br/ecidadania/visualizacaomateria?id=${codigo}`;
export const URL_ENQUETE = (id) => `https://www.camara.leg.br/enquetes/${id}`;
export const URL_ENQUETE_RESULTADOS = (id) => `https://www.camara.leg.br/enquetes/${id}/resultados`;

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function texto(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
      return ENTIDADES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** "95.278" → 95278; qualquer coisa que não seja só dígitos e pontos de milhar → null. */
export function inteiroBR(s) {
  const t = String(s ?? '').trim();
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(t)) return null;
  return Number(t.replace(/\./g, ''));
}

/** "03/11/2026" → "2026-11-03". */
export function dataISO(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br ?? '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const semComentarios = (html) => String(html ?? '').replace(/<!--[\s\S]*?-->/g, '');

/**
 * Página da Consulta Pública do e-Cidadania (visualizacaomateria?id=CODIGO).
 * situacao:
 *   'aberta'        — há botões de voto e "Votos apurados até ..." (resultado parcial);
 *   'encerrada'     — a página traz "RESULTADO FINAL:";
 *   'nao_passivel'  — a página traz "Tipo de Matéria não passível de votação!";
 *   'desconhecida'  — nenhum dos marcadores acima.
 */
export function extrairEcidadania(html) {
  const h = semComentarios(html);
  const titulo = /<title>\s*Consulta Pública - ([^<]*?)\s*::/i.exec(h)?.[1]?.trim() ?? null;
  const ehConsulta = !!titulo;
  const naoPassivel = /Tipo de Matéria não passível de votação!/i.test(h);
  const final = /RESULTADO FINAL:/.test(h);
  const apuradoBr = /Votos apurados até\s*(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/i.exec(h);
  const temBotao = /data-voto="favor"/.test(h) && /data-voto="contra"/.test(h);
  const sim = inteiroBR(/<span class="contabilizacao-favor">\s*([\d.]+)\s*<\/span>/.exec(h)?.[1]);
  const nao = inteiroBR(/<span class="contabilizacao-contra">\s*([\d.]+)\s*<\/span>/.exec(h)?.[1]);
  const fraseEncerrada = /Este texto não é mais passível de votação\./.test(h) ? 'Este texto não é mais passível de votação.' : null;
  let situacao = 'desconhecida';
  if (naoPassivel) situacao = 'nao_passivel';
  else if (final) situacao = 'encerrada';
  else if (temBotao || apuradoBr) situacao = 'aberta';
  return {
    eh_consulta: ehConsulta,
    identificacao: titulo,
    situacao,
    rotulo_oficial: naoPassivel ? 'Tipo de Matéria não passível de votação!' : final ? 'RESULTADO FINAL' : null,
    frase_oficial: fraseEncerrada,
    apurado_ate: apuradoBr ? `${apuradoBr[1]}${apuradoBr[2] ? ' ' + apuradoBr[2] : ''}` : null,
    apurado_ate_data: apuradoBr ? dataISO(apuradoBr[1]) : null,
    sim: naoPassivel ? null : sim,
    nao: naoPassivel ? null : nao,
  };
}

/**
 * Página de resultados da enquete da Câmara (/enquetes/ID/resultados).
 * Copia o rótulo literal ("Resultado parcial desde dd/mm/aaaa" ou "Resultado final desde ...")
 * e as linhas Opção / Participações / Percentual na ordem da página.
 */
export function extrairEnqueteCamara(html) {
  const h = semComentarios(html);
  const sit = /Resultado (parcial|final) desde (\d{2}\/\d{2}\/\d{4})/i.exec(texto(h));
  const opcoes = [];
  const re = /<th[^>]*resumo-resposta__opiniao[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*resumo-resposta__participacoes[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*resumo-resposta__percentual[^>]*>([\s\S]*?)<\/td>/g;
  let m;
  while ((m = re.exec(h))) {
    opcoes.push({ opcao: texto(m[1]), participacoes: inteiroBR(texto(m[2])), percentual: texto(m[3]) || null });
  }
  const pergunta = /Qual sua opinião sobre [^?<]*\?/.exec(texto(h))?.[0] ?? null;
  return {
    situacao: sit ? (sit[1].toLowerCase() === 'final' ? 'encerrada' : 'aberta') : 'desconhecida',
    rotulo_oficial: sit ? `Resultado ${sit[1].toLowerCase()} desde ${sit[2]}` : null,
    desde: sit ? dataISO(sit[2]) : null,
    pergunta,
    opcoes: opcoes.length && opcoes.every((o) => o.opcao && o.participacoes !== null) ? opcoes : [],
  };
}

/**
 * CSV de dados abertos do e-Cidadania ("Proposições com votos", Latin-1, ';').
 * Primeira linha: "Dados atualizados até dd/mm/aaaa". Soma por matéria as colunas VOTO SIM e
 * VOTO NÃO de cada UF, só para conferência com a página oficial.
 */
export function somarCsvEcidadania(textoCsv, lerCsv, codigos) {
  const i = textoCsv.indexOf('\n');
  const cab = textoCsv.slice(0, i).replace(/["\r]/g, '').trim();
  const ate = /(\d{2}\/\d{2}\/\d{4})/.exec(cab)?.[1] ?? null;
  const quer = new Set([...codigos].map(String));
  const soma = new Map();
  for (const r of lerCsv(textoCsv.slice(i + 1))) {
    const cod = r['CÓD. MATÉRIA'];
    if (!quer.has(cod)) continue;
    const a = soma.get(cod) ?? { sim: 0, nao: 0, linhas: 0 };
    a.sim += inteiroBR(r['VOTO SIM'] || '0') ?? NaN;
    a.nao += inteiroBR(r['VOTO NÃO'] || '0') ?? NaN;
    a.linhas++;
    soma.set(cod, a);
  }
  return { dados_ate: dataISO(ate), dados_ate_texto: cab || null, soma };
}
