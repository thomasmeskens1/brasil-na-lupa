// Leitura das resoluções de parecer prévio sobre as contas de governo das Prefeituras no texto de
// uma edição do Diário Oficial Eletrônico do TCM-PA. Só campos escritos na publicação: nada é
// deduzido. Exercício só quando a resolução o escreve (no cabeçalho, na ementa ou na decisão) e sem
// divergência entre esses lugares; município só pelo campo "Município", pela unidade "Prefeitura
// Municipal de X" ou pelo início da ementa. CPFs são retirados de todo trecho republicado.

const CABECALHO = /^\s*[*•▪]?\s*RESOLU[ÇC][ÃA]O\s+N[º°o.]*\s*:?\s*(\d{1,2}\.?\d{3})(?:\s*\/\s*(\d{4}))?(?:\s*,?\s*DE\s+(\d{2})\/(\d{2})\/(\d{4}))?/i;
// Títulos de outros atos (acórdão, portaria etc.) encerram o bloco; acórdão só se seguido do processo.
const OUTRO_ATO = /^\s*AC[ÓO]RD[ÃA]O\s+N[º°o.]*\s*:?\s*\d/i;
const FIM_BLOCO = /^\s*(PORTARIA\s+N[º°o.]*\s*\d|EDITAL\b|ATA\s+D[AE]\s+\d|DECIS[ÃA]O\s+MONOCR[ÁA]TICA|PAUTA\s+D[AE]\b|PUBLICA[ÇC][ÃA]O\s+DE\s+ATO)/;

// Linhas de cabeçalho e rodapé das páginas do DOE (repetidas a cada página, às vezes cortadas).
const RUIDO = [
  /Di[áa]rio\s+(Oficial\s+)?Eletr[ôo]nico\s+do\s+TCM/i, /www\.tcm\.?pa\.(gov|tc)\.br/i, /tcmpa\.tc\.br/i, /QR\s*Code/i, /@tcmpa/i,
  /autenticidade\s+(poder[áa]|pode)/i, /^\s*(Segunda|Ter[çc]a|Quarta|Quinta|Sexta|S[áa]bado|Domingo)(-feira)?,\s*\d/i,
  /DOE\s+TCMPA\s+N[º°]/i, /Oficial\s+Eletr[ôo]nico\s+do\s+TCMPA/i, /ribunal\s+de\s+Contas\s+dos\s+Munic[íi]pios\s+do\s+Estado\s*$/i,
  /\.br\/diario/i, /na\s+Internet,?\s+no\s+[Ee]ndere[çc]o/i, /na\s+p[áa]gina\s+do\s+Tribunal\s+de\s+Contas/i, /[ée]\s+GRATUITO/i, /^\s*(Este\s+)?Di[áa]rio\s+Eletr[ôo]nico/i,
];

export function limparLinhas(texto) {
  return String(texto || '')
    .replace(/\r/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u0002￾￿]/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 3 && !RUIDO.some((r) => r.test(l)));
}

/** Retira CPFs (com ou sem o rótulo e parênteses). */
export const semCpf = (s) => String(s || '')
  .replace(/\s*\(\s*CPF\s*(?:n[º°o.]*)?\s*:?\s*\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s*\)/gi, '')
  .replace(/,?\s*(?:inscrit[oa]\s+no\s+)?CPF\s*(?:\/MF)?\s*(?:n[º°o.]*)?\s*:?\s*\d{3}\.?\d{3}\.?\d{3}-?\d{2}/gi, '')
  .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '')
  .replace(/\s+([,.;])/g, '$1').replace(/\s{2,}/g, ' ').trim();

/** Junta linhas desfazendo hifenização de quebra de linha. */
const juntar = (linhas) => linhas.join(' ').replace(/(\p{L})- (\p{Ll})/gu, '$1$2').replace(/\s+/g, ' ').trim();

/** Divide o texto da edição em blocos que começam no título "RESOLUÇÃO Nº ...". */
export function blocosResolucao(texto) {
  const linhas = limparLinhas(texto);
  const blocos = [];
  let atual = null;
  linhas.forEach((l, i) => {
    const m = l.match(CABECALHO);
    // Título de resolução de verdade: seguido, em até 3 linhas, do número do processo. Uma linha que só
    // cita outra resolução (ex.: no assunto de um recurso) não abre bloco novo.
    if (m && linhas.slice(i + 1, i + 4).some((x) => /^PROCESSO\b/i.test(x))) {
      if (atual) blocos.push(atual);
      const antes = linhas.slice(Math.max(0, i - 4), i).join(' ');
      atual = { m, linhas: [l], citacao: /in\s+verbis|transcrev|abaixo\s+transcrit|seguinte\s+teor|se\s+extrai|extrai-se/i.test(antes) };
      return;
    }
    const seguido = () => linhas.slice(i + 1, i + 4).some((x) => /^PROCESSO\b/i.test(x));
    if (atual && (FIM_BLOCO.test(l) || (OUTRO_ATO.test(l) && seguido()))) { blocos.push(atual); atual = null; return; }
    if (atual) {
      atual.linhas.push(l);
      if (atual.linhas.length > 400) { blocos.push(atual); atual = null; }
    }
  });
  if (atual) blocos.push(atual);
  return blocos;
}

const ROTULOS = [
  ['processo', /PROCESSO(?:\s+SPE)?\s*(?:N[º°o.]*\s*:?|:)/i],
  ['municipio', /MUNIC[ÍI]PIO\s*:/i],
  ['orgao', /(?:[ÓO]RG[ÃA]O|UNIDADE\s+GESTORA|UNIDADE\s+JURISDICIONADA|JURISDICIONAD[OA]|ENTIDADE|PROCED[ÊE]NCIA|ORIGEM)\s*:/i],
  ['assunto', /ASSUNTO(?:\s*\/\s*ESP[ÉE]CIE)?\s*:/i],
  ['classe', /CLASSE\s*:/i],
  ['exercicio', /EXERC[ÍI]CIO(?:\s+FINANCEIRO)?\s*:?(?=\s*(?:DE\s+)?\d{4})/i],
  ['relator', /RELATOR(?:A|\(A\))?\s*:/i],
  ['outro', /(?:RESPONS[ÁA]VEL|RESPONS[ÁA]VEIS|INTERESSAD[OA]S?|ORDENADOR[A]?|CONTADOR[A]?|CONTABILISTA|PROCURADOR[A]?|ADVOGAD[OA]S?|INSTRU[ÇC][ÃA]O|MPCM?|MPC\/PA|MINIST[ÉE]RIO\s+P[ÚU]BLICO(?:\s+DE\s+CONTAS)?|RECORRENTE|RESCINDENTE|REQUERENTE|REFER[ÊE]NCIA|DECIS[ÃA]O\s+RECORRIDA|PROCESSO\s+APENSADO\s*N[º°o.]*|CONSELHEIR[OA]\s+RELATOR[A]?)(?:\([AO]\))?(?:\s*\/\s*[A-Za-zÀ-ú]+(?:\([AO]\))?)?\s*:/i],
];

/** Campos do cabeçalho (antes da ementa) pelos rótulos. */
export function camposCabecalho(cab) {
  const achados = [];
  for (const [nome, re] of ROTULOS) {
    const g = new RegExp(re.source, 'gi');
    let m;
    while ((m = g.exec(cab))) achados.push({ nome, ini: m.index, fim: m.index + m[0].length });
  }
  achados.sort((a, b) => a.ini - b.ini || b.fim - a.fim);
  const usados = [];
  for (const a of achados) if (!usados.some((u) => a.ini < u.fim && a.fim > u.ini)) usados.push(a);
  const campos = {};
  usados.forEach((a, i) => {
    const valor = cab.slice(a.fim, i + 1 < usados.length ? usados[i + 1].ini : undefined).replace(/^[\s:–-]+|[\s;,–-]+$/g, '').trim();
    if (valor && !(a.nome in campos)) campos[a.nome] = valor;
  });
  return campos;
}

const ehContasDeGoverno = (s) => /contas\s+(anuais\s+)?de\s+governo|chefe\s+do\s+poder\s+executivo\s+municipal/i.test(s || '');
const anosEm = (s, re) => [...String(s || '').matchAll(re)].map((m) => m[1]);
const RE_EX = /exerc[íi]cio(?:\s+financeiro)?\s*(?:de\s*|:\s*)?(\d{4})\b/gi;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesNum = (s) => MESES.indexOf(String(s).toLowerCase().replace('marco', 'março')) + 1;
const dd = (n) => String(n).padStart(2, '0');

/** Data da sessão escrita no fecho ("Sala das Sessões..., em 23 de outubro de 2025" ou "de 10 a 14 de fevereiro de 2025"). */
export function dataSessao(texto) {
  const t = String(texto || '');
  const ini = t.search(/Sala\s+das\s+Sess[õo]es|Plen[áa]rio\s+(Conselheiro|Virtual)|Bel[ée]m\s*(?:[-–/]\s*PA|\(PA\))?\s*,\s*\d/i);
  if (ini < 0) return null;
  const trecho = t.slice(ini, ini + 260);
  const faixa = trecho.match(/(?:de\s+|,\s*)(\d{1,2})\s*(?:de\s+([a-zç]+)\s+)?(?:a|até)\s+(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (faixa && mesNum(faixa[4]) > 0) return { data: null, literal: faixa[0].replace(/^,\s*/, '').trim() };
  const um = trecho.match(/(\d{1,2})[º°]?\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (um && mesNum(um[2]) > 0) return { data: `${um[3]}-${dd(mesNum(um[2]))}-${dd(um[1])}`, literal: um[0] };
  return null;
}

// Fim de cláusula: ";", ponto final seguido de maiúscula (fora de abreviações) ou o próximo item.
const FIM_CLAUSULA = /;|(?<!\b(?:Sr|Sra|Srs|Dr|Dra|Art|art|n[º°]|N[º°]|Exm[oa]|Inc|inc|Lei|LC|Cons|Prof))\.\s+(?=[A-ZÀ-Ú])|\s(?:[IVX]{1,4}|\d{1,2})\s*[–-]\s/;

const RESULTADO = /aprova|reprova|contr[áa]ri|favor[áa]v|desfavor|regular|rejei/i;

/** Cláusula da decisão com o parecer prévio e a conclusão curta (trecho literal que começa em "parecer prévio"). */
export function conclusaoDoBloco(corpo, ementa, recurso = false) {
  const i = corpo.search(/DECIS[ÃA]O\s*:/i);
  let clausula = null;
  if (i >= 0) {
    const decisao = corpo.slice(i).replace(/^DECIS[ÃA]O\s*:\s*/i, '');
    const p = decisao.search(/parecer\s+pr[ée]vio/i);
    if (p >= 0 && p < 1500) {
      // Início: o último marcador de item ("I –", "II -") antes do trecho, ou o começo da decisão.
      let ini = 0;
      for (const m of decisao.slice(0, p).matchAll(/(?:^|\s)([IVX]{1,4}|\d{1,2})\s*[–-]\s/g)) ini = m.index + (m[0].startsWith(' ') ? 1 : 0);
      const resto = decisao.slice(ini);
      const fim = resto.slice(p - ini).search(FIM_CLAUSULA);
      clausula = semCpf(resto.slice(0, fim >= 0 ? p - ini + fim : 700)).slice(0, 900).trim();
    }
  } else {
    // Sem o rótulo "DECISÃO:": a decisão vem na mesma frase de "RESOLVEM/ACORDAM/VOTAM ..., pela emissão de parecer prévio ...".
    const r = corpo.search(/\b(RESOLVEM|ACORDAM|VOTAM)\b/);
    const depois = r >= 0 ? corpo.slice(r) : '';
    const p = depois.search(/parecer\s+pr[ée]vio/i);
    if (p >= 0 && p < 1500) {
      const antes = depois.slice(Math.max(0, p - 40), p);
      const m = antes.match(/(?:pela|pelo|em)\s+(?:emiss[ãa]o\s+de|emitir)\s+$/i);
      const ini = m ? p - (antes.length - m.index) : p;
      const resto = depois.slice(ini);
      const fim = resto.slice(p - ini).search(FIM_CLAUSULA);
      clausula = semCpf(resto.slice(0, fim >= 0 ? p - ini + fim : 700)).slice(0, 900).trim();
    }
  }
  let curta = null;
  // Num recurso, a ementa resume o recurso (ex.: "PROVIMENTO PARCIAL"); a conclusão vem da decisão.
  const e = recurso ? null : String(ementa || '').match(/PARECER\s+PR[ÉE]VIO[^.]{3,220}/i);
  // A frase da ementa só serve se trouxer o resultado (ex.: "PARECER PRÉVIO DAS CONTAS DO CHEFE..." não traz).
  if (e && RESULTADO.test(e[0])) curta = e[0].trim();
  else if (clausula) {
    const q = clausula.search(/parecer\s+pr[ée]vio/i);
    const s = clausula.slice(q);
    const corte = s.search(/,?\s*(?:das\s+contas\s+(?:prestadas|anuais|de\s+governo|do\s+(?:chefe|prefeito|sr))|exerc[íi]cio|de\s+responsabilidade|referente|nos\s+termos|relativ|sem\s+(?:o\s+)?preju[íi]zo|com\s+fundamento|devendo)|\s\(|;|:\s|\.\s/i);
    curta = s.slice(0, corte > 0 ? corte : 260).trim();
  }
  return { clausula, curta: curta ? semCpf(curta) : null };
}

/**
 * Pareceres prévios sobre contas de governo das Prefeituras numa edição.
 * Retorna { pareceres: [...], descartes: { motivo: n } }.
 */
export function pareceresDaEdicao(texto) {
  const pareceres = [];
  const descartes = {};
  const descartar = (m) => { descartes[m] = (descartes[m] || 0) + 1; };
  for (const b of blocosResolucao(texto)) {
    const tudo = juntar(b.linhas);
    if (!/parecer\s+pr[ée]vio/i.test(tudo)) continue;
    const iEm = tudo.search(/\bEMENTA\b|\bVistos,?\s+relatados/i);
    const cab = iEm > 0 ? tudo.slice(0, iEm) : tudo.slice(0, 900);
    const corpo = iEm > 0 ? tudo.slice(iEm) : tudo;
    const ementa = /^EMENTA/i.test(corpo) ? corpo.slice(0, Math.max(0, corpo.search(/Vistos|RESOLVEM|ACORDAM|DECIS[ÃA]O\s*:/i)) || 700) : '';
    const c = camposCabecalho(cab.replace(CABECALHO, ' '));
    // Recurso contra parecer prévio: entra se a unidade é a Prefeitura e a decisão fala do parecer prévio.
    const recurso = /\brecurso\b|reconsidera[çc][ãa]o|revis[ãa]o/i.test(`${c.assunto || ''} ${c.classe || ''}`);
    const daPrefeitura = /prefeitura/i.test(`${c.orgao || ''} ${ementa.slice(0, 120)}`);
    if (!ehContasDeGoverno(c.assunto) && !ehContasDeGoverno(ementa) && !(recurso && daPrefeitura)) { descartar('não é prestação de contas de governo'); continue; }
    if (/c[âa]mara\s+municipal/i.test(c.orgao || '') && !/prefeitura/i.test(c.orgao || '')) { descartar('unidade não é a Prefeitura'); continue; }
    const { clausula, curta } = conclusaoDoBloco(corpo, ementa, recurso);
    if (recurso && !clausula) { descartar('recurso sem parecer prévio na decisão'); continue; }
    if (!clausula && !curta) { descartar('sem texto de parecer prévio na decisão ou na ementa'); continue; }

    let municipio = c.municipio || null;
    let municipioOrigem = municipio ? 'campo "Município"' : null;
    if (!municipio) {
      const u = (c.orgao || '').match(/Prefeitura\s+(?:Municipal\s+de|do\s+Munic[íi]pio\s+de|de)\s+(.+?)(?:\s*\([^)]*\))?$/i);
      if (u) { municipio = u[1]; municipioOrigem = 'unidade "Prefeitura Municipal de ..."'; }
    }
    if (!municipio) {
      const u = ementa.match(/^EMENTA\s*[:.]?\s*PREFEITURA\s+MUNICIPAL\s+DE\s+([^.]+)\./i);
      if (u) { municipio = u[1]; municipioOrigem = 'início da ementa'; }
    }
    // Tira só sufixos que não fazem parte do nome: "/PA", "- PA" e o ano do exercício ("Moju – 2017").
    municipio = municipio ? municipio.replace(/\s+Exerc[íi]cio\b.*$/i, '').replace(/\s*[-–]\s*Contas\s+(?:anuais\s+)?de\s+Governo.*$/i, '').replace(/\s+\d{4}$/, '').replace(/\s*[-–]\s*(?:exerc[íi]cio\s*:?\s*)?\d{4}$/i, '').replace(/\s*[-–/]\s*PA$/i, '').replace(/[.;,]+$/, '').trim() : null;

    const decisao = corpo.slice(Math.max(0, corpo.search(/DECIS[ÃA]O\s*:|Decis[ãa]o\s*:/)));
    const anos = new Set([
      ...anosEm(c.exercicio ? `exercício ${c.exercicio}` : '', RE_EX),
      ...anosEm(c.assunto, RE_EX),
      ...anosEm(c.orgao, RE_EX),
      ...anosEm(ementa, RE_EX),
      ...anosEm(clausula, RE_EX),
    ]);
    const exercicio = anos.size === 1 ? [...anos][0] : null;
    const motivoSemExercicio = anos.size > 1 ? `exercícios diferentes no texto (${[...anos].join(', ')})` : anos.size === 0 ? 'exercício não escrito na resolução' : null;

    const numero = b.m[1].replace(/\./g, '');
    const dataCab = b.m[5] ? `${b.m[5]}-${b.m[4]}-${b.m[3]}` : null;
    const sessao = dataSessao(decisao);
    // Sobra de rótulo colado ("Membro/" de "Membro/MPCM:") não faz parte do nome.
    const relator = c.relator ? semCpf(c.relator).replace(/\s+[\wÀ-ú]+\/$/, '').replace(/\s+/g, ' ').slice(0, 120) : null;
    pareceres.push({
      numero,
      numero_literal: b.m[0].trim(),
      ano_resolucao: b.m[2] || (dataCab ? dataCab.slice(0, 4) : null),
      citacao: b.citacao,
      recurso,
      processo: c.processo ? c.processo.split(/\s/)[0].replace(/[.,;]+$/, '') : null,
      municipio_literal: municipio,
      municipio_origem: municipioOrigem,
      orgao_literal: c.orgao || null,
      assunto_literal: c.assunto ? semCpf(c.assunto).slice(0, 200) : null,
      classe_literal: c.classe || null,
      relator,
      exercicio,
      motivo_sem_exercicio: motivoSemExercicio,
      data_resolucao: dataCab,
      sessao_literal: sessao?.literal || null,
      data_sessao: sessao?.data || null,
      ementa_literal: ementa ? semCpf(ementa).slice(0, 700) : null,
      conclusao: curta,
      conclusao_literal: clausula,
    });
  }
  return { pareceres, descartes };
}
