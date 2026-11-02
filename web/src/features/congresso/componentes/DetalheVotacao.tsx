import { FonteLink } from "@/components/FonteLink";
import type { Casa, ConferenciaPlacar, Orientacao, ProposicaoCongresso, VotacaoDetalhe } from "../tipos";
import {

  NAO_DISPONIVEL,
  TERMOS,
  nomeTipoProposicao,
  rotuloBancada,
  rotuloOrientacao,
} from "../rotulos";
import { Placar, TermosExplicados } from "./Basicos";
import { TabelaRegistros, type LinhaRegistro } from "./TabelaRegistros";

function tituloDe(p: ProposicaoCongresso): string | null {
  return p.titulo ?? p.identificacao ?? null;
}

/** Ficha de uma proposição: tipo por extenso, número, ano, ementa e link oficial. */
function FichaProposicao({ p, principal }: { p: ProposicaoCongresso; principal: boolean }) {
  const tipo = nomeTipoProposicao(p.sigla);
  return (
    <div className={principal ? "" : "border-t border-borda pt-3"}>
      <p className="text-base font-semibold text-gray-900">{tituloDe(p) ?? "Proposição não informada"}</p>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="meta">Tipo</dt>
          <dd className="text-gray-900">{tipo ?? NAO_DISPONIVEL}</dd>
        </div>
        <div>
          <dt className="meta">Número</dt>
          <dd className="text-gray-900">{p.numero ?? NAO_DISPONIVEL}</dd>
        </div>
        <div>
          <dt className="meta">Ano</dt>
          <dd className="text-gray-900">{p.ano ?? NAO_DISPONIVEL}</dd>
        </div>
      </dl>
      <p className="meta mt-3">Ementa (resumo oficial do assunto)</p>
      <p className="mt-1 text-sm leading-relaxed text-gray-800">{p.ementa || "Ementa não disponível em fonte oficial"}</p>
      {p.url ? (
        <p className="mt-2">
          <FonteLink href={p.url} tipo="oficial">
            Página oficial da proposição
          </FonteLink>
        </p>
      ) : null}
    </div>
  );
}

export function Proposicoes({ v }: { v: VotacaoDetalhe }) {
  const lista: ProposicaoCongresso[] = [];
  if (v.proposicao) lista.push(v.proposicao);
  for (const p of v.proposicoes ?? []) {
    if (!lista.some((x) => (x.id && x.id === p.id) || tituloDe(x) === tituloDe(p))) lista.push(p);
  }
  if (!lista.length) return <p className="lacuna text-sm">Proposição não disponível em fonte oficial.</p>;
  return (
    <div className="cartao space-y-3">
      {lista.length > 1 ? (
        <p className="meta">A fonte vincula esta votação a {lista.length} proposições; a primeira é a principal.</p>
      ) : null}
      {lista.map((p, i) => (
        <FichaProposicao key={`${p.id ?? i}`} p={p} principal={i === 0} />
      ))}
    </div>
  );
}

/** O que foi votado: textos oficiais da votação. */
export function OQueFoiVotado({ v }: { v: VotacaoDetalhe }) {
  const textos: [string, string][] = [];
  if (v.descricao_abertura) textos.push(["Texto de abertura da votação", v.descricao_abertura]);
  if (v.materia_votada) textos.push(["Matéria votada", v.materia_votada]);
  textos.push(["Descrição oficial", v.descricao || "Descrição não disponível em fonte oficial"]);
  return (
    <div className="space-y-3">
      {textos.map(([r, t]) => (
        <div key={r}>
          <p className="meta">{r}</p>
          <p className="mt-1 whitespace-pre-line leading-relaxed text-gray-900">{t.trim()}</p>
        </div>
      ))}
    </div>
  );
}

function rotuloConferencia(c: string | null | undefined): string {
  if (!c) return "não informado";
  return c === "indisponivel" ? "indisponível" : c;
}

/** Placar e, quando houver, como a coleta o conferiu com outras páginas oficiais. */
export function PlacarVotacao({ v }: { v: VotacaoDetalhe }) {
  const c = v.conferencia_placar;
  const conf = c && typeof c === "object" ? (c as ConferenciaPlacar) : null;
  return (
    <div className="space-y-3">
      {v.placar ? <Placar placar={v.placar} /> : null}
      {v.placar_origem ? <p className="meta">Origem do placar: {v.placar_origem}.</p> : null}
      {conf ? (
        <p className="meta">
          Conferência do placar com o texto oficial da sessão: {rotuloConferencia(conf.texto_oficial)}; com o painel de
          orientação: {rotuloConferencia(conf.painel_orientacao)}.
        </p>
      ) : typeof c === "string" ? (
        <p className="meta">Conferência do placar: {c}</p>
      ) : null}
    </div>
  );
}

/** Orientações de bancada em ordem alfabética da bancada. */
export function Orientacoes({ orientacoes, casa }: { orientacoes: Orientacao[]; casa: Casa }) {
  if (!orientacoes.length) {
    return <p className="lacuna text-sm">Nenhuma orientação de bancada registrada na fonte oficial.</p>;
  }
  const ordenadas = [...orientacoes].sort((a, b) => rotuloBancada(a.bancada).localeCompare(rotuloBancada(b.bancada), "pt-BR"));
  return (
    <div>
      <div className="max-h-[28rem] overflow-auto rounded border border-borda" tabIndex={0} role="region" aria-label="Orientações de bancada">
        <table className="tabela">
          <caption className="sr-only">Orientações de bancada, em ordem alfabética</caption>
          <thead>
            <tr>
              <th scope="col">Bancada</th>
              <th scope="col">Orientação</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((o, i) => (
              <tr key={`${o.bancada}-${i}`}>
                <td>{rotuloBancada(o.bancada)}</td>
                <td>{rotuloOrientacao(o.orientacao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {casa === "camara" ? (
        <p className="meta mt-2">
          Os nomes de blocos e federações aparecem abreviados como na fonte oficial da Câmara (inclusive com reticências).
        </p>
      ) : null}
    </div>
  );
}

/**
 * Votos individuais. Só existem em votação nominal (diretriz 5); na simbólica e na
 * secreta, a página explica por que não há voto individual.
 */
export function VotosDaVotacao({ v, perfis }: { v: VotacaoDetalhe; perfis: Set<string> }) {

  const link = (id: string | null | undefined) => (id && perfis.has(String(id)) ? String(id) : null);

  if (v.tipo === "simbolica") {
    return (
      <div className="aviso">
        <p className="font-semibold text-gray-900">Votação simbólica — não há registro oficial de voto individual.</p>
        <p className="mt-1 text-sm text-gray-800">
          O resultado foi anunciado pelo presidente da sessão sem o registro do voto de cada parlamentar. Por isso, este
          site não atribui voto a nenhum deputado ou senador nesta votação.
        </p>
      </div>
    );
  }

  if (v.tipo === "secreta") {
    const comp = v.comparecimento ?? [];
    const linhas: LinhaRegistro[] = comp.map((c) => ({
      nome: c.nome,
      partido: c.partido ?? null,
      uf: c.uf ?? null,
      valor: c.registro ?? c.situacao ?? null,
      pid: link(c.parlamentar_id),
    }));
    return (
      <div className="space-y-4">
        <div className="aviso">
          <p className="font-semibold text-gray-900">Voto secreto — não há voto individual.</p>
          <p className="mt-1 text-sm text-gray-800">
            A casa divulga apenas o placar oficial. Nenhum voto é atribuído a parlamentar algum.
          </p>
        </div>
        {linhas.length ? (
          <div>
            <h3 className="text-base font-semibold text-gray-900">Registro oficial de comparecimento</h3>
            <p className="mt-1 text-sm text-gray-800">
              Lista publicada {v.casa === "camara" ? "pela Câmara dos Deputados" : "pelo Senado Federal"} com a situação de cada
              parlamentar na votação (por exemplo, se votou, se estava presente sem registrar voto ou em licença).{" "}
              <strong>Não é o voto:</strong> “Votou” indica apenas que o parlamentar participou.
            </p>
            <div className="mt-3">
              <TabelaRegistros casa={v.casa} linhas={linhas} legenda="Registro oficial de comparecimento" rotuloValor="Registro" />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const votos = v.votos ?? [];
  if (!votos.length) {
    return <p className="lacuna text-sm">Lista de votos individuais não disponível em fonte oficial coletada.</p>;
  }
  const linhas: LinhaRegistro[] = votos.map((x) => ({
    nome: x.nome,
    partido: x.partido ?? null,
    uf: x.uf ?? null,
    valor: x.voto,
    pid: link(x.parlamentar_id),
  }));
  const temArt17 = votos.some((x) => x.voto === "Artigo 17");
  const temArt51 = votos.some((x) => x.voto === "Presidente (art. 51 RISF)");
  const temObs = votos.some((x) => x.voto === "Obstrução");
  const termos = [TERMOS.abstencao, ...(temObs ? [TERMOS.obstrucao] : []), ...(temArt17 ? [TERMOS.artigo17] : []), ...(temArt51 ? [TERMOS.artigo51] : [])];
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-800">
        Votos registrados oficialmente, com partido e estado como constam no registro da votação.
        {v.casa === "camara"
          ? " A lista da Câmara traz só quem registrou voto; quem não votou não aparece nela."
          : " A lista do Senado inclui também registros de ausência, licença e missão, como publicados."}
      </p>
      <TabelaRegistros casa={v.casa} linhas={linhas} legenda="Votos individuais" />
      <TermosExplicados termos={termos} />
    </div>
  );
}
