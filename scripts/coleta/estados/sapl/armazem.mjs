// Armazém de uma UF: os próprios arquivos publicados em dados/estados/<uf>/ guardam o que já foi
// coletado (campos internos do coletor ao lado dos campos de exibição). Carrega tudo, recebe os
// registros normalizados de cada página e regrava só os arquivos que mudaram (gravação atômica).
import fs from 'node:fs';
import path from 'node:path';
import { lerJson, gravarSeMudou as gravarBruto } from '../../alesp/lib.mjs';

/** Grava sem campos undefined (o formatador da ALESP não os omite). */
export const gravarSeMudou = (arq, obj) => gravarBruto(arq, JSON.parse(JSON.stringify(obj)));
import {
  indexarTabelas, montarParlamentares, montarProposicao, montarNorma, montarSessao, montarItemPauta,
  montarVotacao, resumoVotacao, fonte,
} from './montar.mjs';
import { bordas, coberturaDesde } from './fluxos.mjs';

const anoDe = (d) => (d && /^\d{4}/.test(d) ? d.slice(0, 4) : 'sem-data');
const lerDir = (dir, re) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)) : []);
const DISPLAY_PAUTA = ['etapa_nome', 'materia', 'tipo_votacao_nome'];

export class Armazem {
  constructor(raiz, cfg, hoje) {
    this.cfg = cfg;
    this.hoje = hoje;
    this.dir = path.join(raiz, 'dados', 'estados', cfg.uf.toLowerCase());
    this.meta = lerJson(path.join(this.dir, 'meta.json')) || {};
    this.cursor = this.meta.cursor || { fluxos: {}, tabelas_em: {}, ultima_requisicao: null, pendencias_inexistentes: [] };
    this.tabelas = lerJson(path.join(this.dir, 'tabelas.json')) || {};
    const mascaras = lerJson(path.join(this.dir, 'revisao', 'mascaras.json')) || {};
    this.regras = (chave) => [...(mascaras['*'] || []), ...(mascaras[chave] || [])];
    this.materias = new Map();
    this.tramPendente = new Map();
    this.normas = new Map();
    this.sessoes = new Map();
    this.pauta = new Map();
    this.votacoes = new Map();
    this._carregar();
  }

  _carregar() {
    const d = this.dir;
    for (const f of lerDir(path.join(d, 'proposicoes'), /^indice-.+\.json$/)) {
      for (const e of lerJson(path.join(d, 'proposicoes', f))?.itens || []) {
        this.materias.set(e.id_oficial, {
          id: e.id_oficial, tipo_id: e.tipo_id, numero: e.numero, ano: e.ano, data_apresentacao: e.data_apresentacao,
          ementa: e.ementa, apelido: e.apelido, em_tramitacao: e.em_tramitacao, autores_ids: e.autores_ids || [],
          texto_original: e.url_texto || null, atualizado_fonte: e.atualizado_fonte || null,
          privacidade_pendente: e.privacidade_pendente, ultima_tramitacao: e.ultima_tramitacao || null, lacunas: e.lacunas_fonte || [],
        });
      }
    }
    for (const [k, v] of Object.entries(lerJson(path.join(d, 'proposicoes', 'tramitacao-pendente.json'))?.itens || {})) this.tramPendente.set(Number(k), v);
    for (const f of lerDir(path.join(d, 'normas'), /^indice-.+\.json$/)) {
      for (const e of lerJson(path.join(d, 'normas', f))?.itens || []) {
        this.normas.set(e.id_oficial, {
          id: e.id_oficial, tipo_id: e.tipo_id, numero: e.numero, ano: e.ano, data: e.data, data_publicacao: e.data_publicacao,
          veiculo_publicacao: e.veiculo_publicacao, ementa: e.ementa, privacidade_pendente: e.privacidade_pendente,
          materia_id: e.materia_id ?? null, esfera: e.esfera === 'estadual' ? 'E' : e.esfera, texto_integral: e.url_texto || null,
          nome_oficial: e.nome_oficial, atualizado_fonte: e.atualizado_fonte || null, lacunas: e.lacunas_fonte || [],
        });
      }
    }
    for (const f of lerDir(path.join(d, 'sessoes'), /^indice-.+\.json$/)) {
      for (const e of lerJson(path.join(d, 'sessoes', f))?.itens || []) {
        this.sessoes.set(e.id_oficial, {
          id: e.id_oficial, nome: e.nome, numero: e.numero, tipo_id: e.tipo_id, data_inicio: e.data_inicio, hora_inicio: e.hora_inicio,
          data_fim: e.data_fim, hora_fim: e.hora_fim, url_video: e.url_video, url_audio: e.url_audio, pauta_pdf: e.pauta_pdf,
          ata_pdf: e.ata_pdf, lacunas: e.lacunas || [],
        });
      }
    }
    for (const f of lerDir(path.join(d, 'sessoes'), /^pauta-.+\.json$/)) {
      for (const e of lerJson(path.join(d, 'sessoes', f))?.itens || []) {
        const it = { ...e };
        for (const k of DISPLAY_PAUTA) delete it[k];
        this.pauta.set(`${it.etapa}-${it.id}`, it);
      }
    }
    for (const f of lerDir(path.join(d, 'votacoes'), /^[a-z]{2}-\d+\.json$/)) {
      const e = lerJson(path.join(d, 'votacoes', f));
      if (!e) continue;
      const votos = new Map((e.votos_fonte || []).map((v) => [v.parlamentar_id, v]));
      this.votacoes.set(e.id_oficial, { reg: e.registro_fonte || null, votos });
    }
  }

  // ------------------------------------------------------------ ingestão
  receber(rota, x) {
    if (rota === 'materialegislativa') {
      const antigo = this.materias.get(x.id);
      x.ultima_tramitacao = antigo?.ultima_tramitacao || null;
      const pend = this.tramPendente.get(x.id);
      if (pend) { this.tramPendente.delete(x.id); this._aplicarTram(x, pend); }
      this.materias.set(x.id, x);
    } else if (rota === 'tramitacao') {
      const m = this.materias.get(x.materia_id);
      if (m) this._aplicarTram(m, x);
      else {
        const p = this.tramPendente.get(x.materia_id);
        if (!p || maisNova(x, p)) this.tramPendente.set(x.materia_id, x);
      }
    } else if (rota === 'normajuridica') this.normas.set(x.id, x);
    else if (rota === 'sessaoplenaria') this.sessoes.set(x.id, x);
    else if (rota === 'ordemdia' || rota === 'expedientemateria') this.pauta.set(`${x.etapa}-${x.id}`, x);
    else if (rota === 'registrovotacao') this._vot(x.id).reg = x;
    else if (rota === 'votoparlamentar') {
      if (x.votacao_id == null || x.parlamentar_id == null) return;
      this._vot(x.votacao_id).votos.set(x.parlamentar_id, { parlamentar_id: x.parlamentar_id, voto: x.voto, voto_id: x.id });
    }
  }

  _aplicarTram(m, t) {
    const { materia_id, ...resto } = t;
    if (!m.ultima_tramitacao || maisNova(t, m.ultima_tramitacao)) m.ultima_tramitacao = resto;
  }

  _vot(id) {
    if (!this.votacoes.has(id)) this.votacoes.set(id, { reg: null, votos: new Map() });
    return this.votacoes.get(id);
  }

  /** Ids referenciados que faltam (para buscar um a um, se não estiverem em faixa já lida). */
  pendencias() {
    const materias = new Set();
    const pauta = new Set();
    const sessoes = new Set();
    const parlamentares = new Set();
    for (const v of this.votacoes.values()) {
      const r = v.reg;
      if (r?.materia_id != null && !this.materias.has(r.materia_id)) materias.add(r.materia_id);
      if (r) {
        const k = r.ordem_id != null ? `ordemdia-${r.ordem_id}` : r.expediente_id != null ? `expedientemateria-${r.expediente_id}` : null;
        const it = k && this.pauta.get(k);
        if (k && !it) pauta.add(k);
        if (it?.sessao_id != null && !this.sessoes.has(it.sessao_id)) sessoes.add(it.sessao_id);
      }
      for (const pid of v.votos.keys()) if (!(this.tabelas.parlamentares || []).some((p) => p.id === pid)) parlamentares.add(pid);
    }
    for (const n of this.normas.values()) if (n.materia_id != null && !this.materias.has(n.materia_id)) materias.add(n.materia_id);
    return { materias, pauta, sessoes, parlamentares };
  }

  // ------------------------------------------------------------ gravação
  contexto() {
    return { cfg: this.cfg, hoje: this.hoje, tab: indexarTabelas(this.tabelas), materias: this.materias, sessoes: this.sessoes, pauta: this.pauta };
  }

  situacaoVotos() {
    const fv = this.cursor.fluxos.votoparlamentar || { faixas: [], concluido: false };
    const b = [...bordas(fv)];
    const desde = coberturaDesde(fv);
    return (reg, votos, tipo) => {
      if (tipo === 'secreta') return 'nao-se-aplica';
      if (tipo === 'simbolica') return 'inexistentes-na-fonte'; // mesmo valor do coletor RN/ES
      if (tipo !== 'nominal') return 'em-coleta'; // tipo ainda não conhecido: votos guardados, não exibidos
      if (votos.length) {
        const ids = votos.map((v) => v.voto_id).filter(Number.isFinite);
        const min = Math.min(...ids), max = Math.max(...ids);
        return b.some((x) => x >= min && x <= max) ? 'em-coleta' : 'coletados';
      }
      return desde && reg?.data && desde < reg.data ? 'inexistentes-na-fonte' : 'em-coleta';
    };
  }

  gravar(execucao) {
    const ctx = this.contexto();
    const d = this.dir;
    const uf = this.cfg.uf;
    const casa = this.cfg.casa;
    const porAno = (itens, chave) => {
      const g = new Map();
      for (const x of itens) { const a = chave(x); if (!g.has(a)) g.set(a, []); g.get(a).push(x); }
      return g;
    };
    const cont = {};
    if (this.tabelas.mandatos) {
      const p = montarParlamentares(ctx);
      gravarSeMudou(path.join(d, 'parlamentares.json'), p);
      cont.parlamentares = p.itens.length;
      cont.parlamentares_em_exercicio = p.itens.filter((x) => x.em_exercicio).length;
    }
    gravarSeMudou(path.join(d, 'tabelas.json'), { ...this.tabelas, atualizado_em: this.hoje, uf, casa, observacao: 'Tabelas de apoio do SAPL usadas pelo coletor (sem CPF, telefone, endereço ou data de nascimento).' });

    const props = [...this.materias.values()].map((m) => ({ ...montarProposicao(ctx, m), lacunas_fonte: m.lacunas || [] }));
    for (const [ano, itens] of porAno(props, (x) => (x.ano ? String(x.ano) : 'sem-ano'))) {
      itens.sort((a, b) => b.id_oficial - a.id_oficial);
      gravarSeMudou(path.join(d, 'proposicoes', `indice-${ano}.json`), {
        atualizado_em: this.hoje, uf, casa, ano: Number(ano) || null,
        fonte: fonte(ctx, `Matérias legislativas de ${ano} — SAPL da ${this.cfg.nome}`, `/api/materia/materialegislativa/?ano=${ano}`), itens,
      });
    }
    cont.proposicoes = props.length;
    gravarSeMudou(path.join(d, 'proposicoes', 'tramitacao-pendente.json'), {
      atualizado_em: this.hoje, observacao: 'Última tramitação de matérias ainda não coletadas (uso interno do coletor).',
      itens: Object.fromEntries([...this.tramPendente].sort((a, b) => a[0] - b[0])),
    });

    const normas = [...this.normas.values()].map((n) => ({ ...montarNorma(ctx, n), lacunas_fonte: n.lacunas || [] }));
    const usados = new Map();
    for (const n of normas) usados.set(n.id, (usados.get(n.id) || 0) + 1);
    for (const n of normas) if (usados.get(n.id) > 1) n.id = `${n.id}-${n.id_oficial}`;
    for (const [ano, itens] of porAno(normas, (x) => (x.ano ? String(x.ano) : 'sem-ano'))) {
      itens.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || b.id_oficial - a.id_oficial);
      gravarSeMudou(path.join(d, 'normas', `indice-${ano}.json`), {
        atualizado_em: this.hoje, uf, casa, ano: Number(ano) || null,
        abrangencia: 'Normas jurídicas cadastradas no SAPL da Assembleia (leis, leis complementares, resoluções, decretos legislativos e, quando a Casa cadastra, decretos do Executivo).',
        fontes: [fonte(ctx, `Normas jurídicas de ${ano} — SAPL da ${this.cfg.nome}`, `/api/norma/normajuridica/?ano=${ano}`)], itens,
      });
    }
    cont.normas = normas.length;

    const sess = [...this.sessoes.values()].map((s) => montarSessao(ctx, s));
    for (const [ano, itens] of porAno(sess, (x) => anoDe(x.data_inicio))) {
      itens.sort((a, b) => String(b.data_inicio || '').localeCompare(String(a.data_inicio || '')) || b.id_oficial - a.id_oficial);
      gravarSeMudou(path.join(d, 'sessoes', `indice-${ano}.json`), {
        atualizado_em: this.hoje, uf, casa, fonte: fonte(ctx, `Sessões plenárias — SAPL da ${this.cfg.nome}`, '/api/sessao/sessaoplenaria/'), itens,
      });
    }
    cont.sessoes = sess.length;
    const pauta = [...this.pauta.values()].map((it) => montarItemPauta(ctx, it));
    for (const [ano, itens] of porAno(pauta, (x) => anoDe(x.data))) {
      itens.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || b.id - a.id);
      gravarSeMudou(path.join(d, 'sessoes', `pauta-${ano}.json`), {
        atualizado_em: this.hoje, uf, casa,
        fonte: fonte(ctx, `Matérias da Ordem do Dia e do Expediente — SAPL da ${this.cfg.nome}`, '/api/sessao/ordemdia/'), itens,
      });
    }
    cont.itens_pauta = pauta.length;

    const sit = this.situacaoVotos();
    const resumos = [];
    const porSituacao = {};
    for (const [id, v] of this.votacoes) {
      const votos = [...v.votos.values()];
      const out = montarVotacao(ctx, id, v.reg, votos, sit);
      out.votos_fonte = votos.sort((a, b) => a.parlamentar_id - b.parlamentar_id);
      gravarSeMudou(path.join(d, 'votacoes', `${out.id}.json`), out);
      resumos.push(resumoVotacao(out));
      porSituacao[out.votos_situacao] = (porSituacao[out.votos_situacao] || 0) + 1;
    }
    for (const [ano, itens] of porAno(resumos, (x) => anoDe(x.data))) {
      itens.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || String(b.id).localeCompare(String(a.id)));
      gravarSeMudou(path.join(d, 'votacoes', `indice-${ano}.json`), { atualizado_em: this.hoje, uf, casa, itens });
    }
    cont.votacoes = resumos.length;
    cont.votacoes_por_situacao_dos_votos = porSituacao;
    cont.votos_individuais = [...this.votacoes.values()].reduce((s, v) => s + v.votos.size, 0);

    this.meta = { ...execucao.meta, contagens: cont, cursor: this.cursor };
    gravarSeMudou(path.join(d, 'meta.json'), this.meta);
    return cont;
  }
}

function maisNova(a, b) {
  const da = a.data || '', db = b.data || '';
  return da !== db ? da > db : a.id > b.id;
}
