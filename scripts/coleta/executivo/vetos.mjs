// Vetos presidenciais: lista anual do Congresso, resultado por dispositivo (razão oficial do veto,
// situação na sessão conjunta) e votos nominais por dispositivo, quando a fonte os traz.
import path from 'node:path';
import fs from 'node:fs';
import { obter, paraCada, lerJson, gravarSeMudou, fonte, lista, normalizar } from './lib.mjs';

const SEN = 'https://legis.senado.leg.br/dadosabertos';
const ROTULO = { Rejeitado: 'derrubado', Mantido: 'mantido', Prejudicado: 'prejudicado', 'Não Apreciado': 'não apreciado' };
const CHAVE_VOTO = { Sim: 'sim', 'Não': 'nao', 'Abstenção': 'abstencao', 'Obstrução': 'obstrucao' };

function placarDe(votos) {
  if (!votos.length) return null;
  const p = { sim: 0, nao: 0, abstencao: 0, obstrucao: 0, outros: 0 }, detalhe = {};
  for (const v of votos) { p[CHAVE_VOTO[v.voto] || 'outros']++; detalhe[v.voto] = (detalhe[v.voto] || 0) + 1; }
  return { ...p, detalhe };
}

/** Cadastro local (dados/camara e dados/senado) para ligar nome + UF ao id oficial, só quando a combinação é única. */
function cadastro(raiz) {
  const mapa = { camara: new Map(), senado: new Map() };
  for (const casa of ['camara', 'senado']) {
    for (const p of lerJson(path.join(raiz, 'dados', casa, 'parlamentares.json'))?.itens || []) {
      const k = normalizar(p.nome) + '|' + p.uf;
      mapa[casa].set(k, mapa[casa].has(k) ? null : p.id); // null = homônimo na mesma UF (não liga)
    }
  }
  return mapa;
}

async function votosDispositivo(cod, cad) {
  const r = await obter(`${SEN}/plenario/resultado/veto/dispositivo/${cod}.json`, { opcional: true });
  const V = r?.dados?.ResultadoVetoDispositivoCN?.Votacao;
  if (!V) return null;
  const votos = [];
  for (const [casaFonte, casa] of [['Camara', 'camara'], ['Senado', 'senado']]) {
    for (const v of lista(V[casaFonte]?.Voto)) {
      const id = cad[casa].get(normalizar(v.NomeParlamentar) + '|' + v.UfParlamentar) ?? null;
      votos.push({ casa, nome: v.NomeParlamentar, partido_na_fonte: v.PartidoParlamentar || null, uf: v.UfParlamentar || null, voto: v.TipoVoto, parlamentar_id: id });
    }
  }
  return { parte_vetada: V.ParteVetada || null, tipo_votacao: V.TipoVotacao || null, sessao: V.Sessao || null, votos, url: `${SEN}/plenario/resultado/veto/dispositivo/${cod}.json` };
}

export async function coletarVetos({ anos, desde, completo, hoje, dirDados, raiz, log }) {
  const dir = path.join(dirDados, 'vetos');
  const cad = cadastro(raiz);
  const contagem = { total: 0, detalhes_atualizados: 0, dispositivos: 0, dispositivos_com_votos: 0, arquivos_de_votos: 0, votos_sem_id_parlamentar: 0, votos_total: 0, por_situacao_dispositivo: {}, sem_resultado: 0 };
  for (const ano of anos) {
    const { dados } = await obter(`${SEN}/materia/vetos/${ano}.json`);
    const vetosLista = lista(dados?.ListaVetosAnoCN?.Vetos?.Veto);
    const proc = new Map();
    for (const p of (await obter(`${SEN}/processo?sigla=VET&ano=${ano}`)).dados || []) proc.set(String(p.codigoMateria), p);
    const itensIndice = [];
    await paraCada(vetosLista, async (v) => {
      const numero = Number(v.Materia.Numero);
      const id = `vet-${numero}-${ano}`;
      const arq = path.join(dir, `${id}.json`);
      const antigo = lerJson(arq);
      const p = proc.get(String(v.Materia.Codigo));
      const atualizar = completo || !antigo || v.Materia.EmTramitacao === 'Sim' || (p?.dataUltimaAtualizacao || '').slice(0, 10) >= desde
        || antigo.dispositivos?.length !== Number(v.QuantidadeDispositivos || 0);
      let reg = antigo;
      if (atualizar) {
        const r = await obter(`${SEN}/plenario/resultado/veto/${v.Codigo}.json`, { opcional: true });
        reg = await montarVeto({ v, det: r?.dados?.ResultadoVetoItemCN?.Veto || null, p, id, numero, ano, hoje, completo, dir, cad, contagem });
        contagem.detalhes_atualizados++;
      }
      gravarSeMudou(arq, reg);
      contagem.total++;
      if (!reg.dispositivos.length) contagem.sem_resultado++;
      for (const d of reg.dispositivos) {
        contagem.dispositivos++;
        contagem.por_situacao_dispositivo[d.situacao_oficial || 'sem situação'] = (contagem.por_situacao_dispositivo[d.situacao_oficial || 'sem situação'] || 0) + 1;
        if (d.votacao) contagem.dispositivos_com_votos++;
      }
      itensIndice.push({
        id, numero, ano, tipo: reg.tipo, materia_vetada: reg.materia_vetada.identificacao, norma: reg.norma?.descricao || null,
        data_publicacao: reg.datas.publicacao, ementa: reg.ementa, dispositivos: reg.dispositivos.length,
        situacao_dispositivos: reg.situacao_dispositivos, situacao_oficial: reg.situacao_oficial,
        sobrestando_pauta: reg.sobrestando_pauta, url: reg.mensagem.url_planalto,
      });
    });
    itensIndice.sort((a, b) => a.numero - b.numero);
    gravarSeMudou(path.join(dir, `indice-${ano}.json`), {
      atualizado_em: hoje, ano,
      fonte: fonte(`Vetos de ${ano} — Congresso Nacional (Dados Abertos do Senado Federal)`, `${SEN}/materia/vetos/${ano}.json`, 'Congresso Nacional', hoje),
      itens: itensIndice,
    });
    log(`Vetos ${ano}: ${itensIndice.length}`);
  }
  // contagem de votos a partir dos arquivos gravados
  const dv = path.join(dir, 'votos');
  if (fs.existsSync(dv)) for (const f of fs.readdirSync(dv)) {
    const j = lerJson(path.join(dv, f)); if (!j) continue;
    contagem.arquivos_de_votos++; contagem.votos_total += j.votos.length;
    contagem.votos_sem_id_parlamentar += j.votos.filter((x) => !x.parlamentar_id).length;
  }
  return contagem;
}

async function montarVeto({ v, det, p, id, numero, ano, hoje, completo, dir, cad }) {
  const base = det || v;
  const mv = base.MateriaVetada || {};
  const ng = mv.NormaGerada || null;
  const lacunas = [];
  const fontes = [fonte(`Vetos de ${ano} — Congresso Nacional`, `${SEN}/materia/vetos/${ano}.json`, 'Congresso Nacional', hoje)];
  if (det) fontes.push(fonte(`Resultado do Veto ${numero}/${ano} — Congresso Nacional`, `${SEN}/plenario/resultado/veto/${v.Codigo}.json`, 'Congresso Nacional', hoje));
  else lacunas.push('Resultado por dispositivo não disponível no serviço oficial do Congresso (HTTP 404)');
  if (base.Mensagem?.UrlPlanalto) fontes.push(fonte(`Mensagem de veto nº ${base.Mensagem.Numero}/${base.Mensagem.Ano}`, base.Mensagem.UrlPlanalto, 'Presidência da República', hoje));
  const dispositivos = [];
  for (const d of lista(det?.Dispositivos?.Dispositivo)) {
    const item = {
      codigo: d.Codigo ?? null, identificador: d.Identificador || null, dispositivo: d.Descricao || null,
      texto_vetado: d.Conteudo || null, assunto_congresso: d.Assunto || null, origem: d.Origem || null,
      razao_veto: d.RazaoVeto || null,
      situacao: ROTULO[d.Situacao] || null, situacao_oficial: d.Situacao || null,
      tipo_votacao: d.TipoVotacao || null, data_sessao: d.DataSessao || null,
      votacao: null,
    };
    if (!d.RazaoVeto) lacunas.push(`Dispositivo ${d.Identificador || d.Codigo}: razão do veto não disponível em fonte oficial estruturada (ver mensagem de veto)`);
    if (d.PossuiVotos === 'Sim' && d.Codigo) {
      const arqVotos = path.join(dir, 'votos', `${d.Codigo}.json`);
      let vj = completo ? null : lerJson(arqVotos);
      if (!vj) {
        const r = await votosDispositivo(d.Codigo, cad);
        if (r) {
          vj = {
            id: d.Codigo, veto_id: id, dispositivo: item.dispositivo, identificador: item.identificador,
            sessao: r.sessao, data: item.data_sessao, tipo_votacao: r.tipo_votacao, resultado_oficial: d.Situacao || null,
            fonte: fonte(`Votação do dispositivo ${item.identificador} do Veto ${numero}/${ano}`, r.url, 'Congresso Nacional', hoje),
            vinculo_parlamentar: 'parlamentar_id preenchido só quando nome + UF da fonte coincidem com um único parlamentar do cadastro atual da Casa (dados/camara, dados/senado); caso contrário, null',
            lacunas: ['A fonte não traz o código do parlamentar; o partido vem abreviado pela própria fonte (ex.: "Republican")'],
            votos: r.votos,
          };
          gravarSeMudou(arqVotos, vj);
        }
      }
      if (vj) {
        const porCasa = (c) => placarDe(vj.votos.filter((x) => x.casa === c));
        item.votacao = {
          sessao: vj.sessao, tipo: 'nominal', tipo_votacao_fonte: vj.tipo_votacao,
          placar: { camara: porCasa('camara'), senado: porCasa('senado') },
          placar_origem: 'contagem-dos-votos',
          votos_ref: `vetos/votos/${d.Codigo}.json`,
          url: vj.fonte.url,
        };
      } else lacunas.push(`Dispositivo ${item.identificador}: a fonte indica votos, mas o serviço não os devolveu`);
    }
    dispositivos.push(item);
  }
  const sit = {};
  for (const d of dispositivos) sit[d.situacao_oficial || 'sem situação'] = (sit[d.situacao_oficial || 'sem situação'] || 0) + 1;
  const pdfs = lista(det?.PdfsResultadoVotacao?.PdfResultadoVotacao).map((x) => ({ descricao: x.Descricao, url: x.URL }));
  for (const x of pdfs) fontes.push(fonte(x.descricao, x.url, 'Congresso Nacional', hoje));
  if (!ng) lacunas.push('Norma gerada (lei) não informada pela fonte');
  return {
    id, caminho: 'presidencia', instrumento: 'Veto', forma: 'ato individual (veto); apreciação pelo Congresso Nacional em sessão conjunta',
    numero, ano, identificacao: `VET ${numero}/${ano}`,
    ementa: base.Materia?.Ementa || null,
    assunto_congresso: base.Assunto || null,
    tipo: base.Total === 'Sim' ? 'total' : base.Total === 'Não' ? 'parcial' : null,
    materia_vetada: {
      identificacao: mv.Sigla ? `${mv.Sigla} ${mv.Numero}/${mv.Ano}` : null, sigla: mv.Sigla || null, numero: mv.Numero ? Number(mv.Numero) : null,
      ano: mv.Ano ? Number(mv.Ano) : null, ementa: mv.Ementa || null, senado_materia: mv.Codigo || null,
    },
    norma: ng ? {
      id: `${/LCP/.test(ng.SiglaTipoNorma) ? 'lcp' : 'lei'}-${ng.NumeroNorma}-${ng.AnoNorma}`, descricao: ng.NomeNorma,
      data_assinatura: ng.DataAssinatura || null, data_publicacao: ng.DataPublicacao || null, publicacao: ng.DescricaoVeiculoPublicacao || null,
    } : null,
    mensagem: { identificacao: base.Mensagem ? `MSG ${base.Mensagem.Numero}/${base.Mensagem.Ano}` : null, url_planalto: base.Mensagem?.UrlPlanalto || null },
    datas: { publicacao: base.DataPublicacao || null, recebimento_congresso: base.DataRecebimentoCongresso || null, sobrestamento_pauta: base.DataSobrestacaoPauta || null },
    sobrestando_pauta: base.SobrestandoPauta === 'Sim',
    em_tramitacao: base.Materia?.EmTramitacao === 'Sim',
    situacao_oficial: p?.situacaoAtual || null,
    quantidade_dispositivos_fonte: Number(v.QuantidadeDispositivos || 0) || null,
    situacao_dispositivos: sit,
    resultado_pdfs: pdfs,
    dispositivos,
    ids_oficiais: { congresso_veto: v.Codigo, senado_materia: base.Materia?.Codigo || null, senado_processo: p ? String(p.id) : null },
    links: {
      planalto_mensagem: base.Mensagem?.UrlPlanalto || null,
      congresso_dispositivos: v.UrlDispositivos || null,
      senado: base.Materia?.Codigo ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${base.Materia.Codigo}` : null,
    },
    fontes, lacunas: [...new Set(lacunas)],
    atualizado_em: hoje,
  };
}
