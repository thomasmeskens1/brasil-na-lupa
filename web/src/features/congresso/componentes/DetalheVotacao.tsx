import { FonteLink } from "@/components/FonteLink";
import { TabelaFiltravel, type LinhaDados } from "@/components/tabela/TabelaFiltravel";
import { TabelaResponsiva } from "@/components/tabela/TabelaResponsiva";
import type { ExplicacaoQuorum } from "../lista";
import { REGIMENTOS } from "../lista";
import type { Casa, Orientacao, ProposicaoCongresso, VotacaoDetalhe } from "../tipos";
import {
  NAO_DISPONIVEL,
  TERMOS,
  nomeTipoProposicao,
  rotaParlamentar,
  rotuloBancada,
  rotuloOrientacao,
  rotuloVoto,
} from "../rotulos";
import { TermosExplicados } from "./Basicos";

function tituloDe(p: ProposicaoCongresso): string | null {
  return p.titulo ?? p.identificacao ?? null;
}

/** Ficha de uma proposição: tipo por extenso, número, ano, ementa e link oficial. */
function FichaProposicao({ p, principal }: { p: ProposicaoCongresso; principal: boolean }) {
  return (
    <div className={principal ? "" : "border-t border-borda pt-3"}>
      <p className="font-semibold text-foreground">{tituloDe(p) ?? "Proposição não informada"}</p>
      <p className="text-sm text-[var(--cor-secundaria)]">
        {nomeTipoProposicao(p.sigla) ?? NAO_DISPONIVEL} · número {p.numero ?? "não informado"} · ano {p.ano ?? "não informado"}
      </p>
      <p className="mt-2 text-sm text-[var(--cor-secundaria)]">Ementa (resumo oficial do assunto)</p>
      <p className="mt-1 leading-relaxed">{p.ementa || "Ementa não disponível em fonte oficial"}</p>
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

export function listaProposicoes(v: VotacaoDetalhe): ProposicaoCongresso[] {
  const lista: ProposicaoCongresso[] = [];
  if (v.proposicao) lista.push(v.proposicao);
  for (const p of v.proposicoes ?? []) {
    if (!lista.some((x) => (x.id && x.id === p.id) || tituloDe(x) === tituloDe(p))) lista.push(p);
  }
  return lista;
}

export function Proposicoes({ v }: { v: VotacaoDetalhe }) {
  const lista = listaProposicoes(v);
  if (!lista.length) return <p className="lacuna text-sm">Proposição não disponível em fonte oficial.</p>;
  return (
    <div className="space-y-3">
      {lista.length > 1 ? <p className="meta">A fonte vincula esta votação a {lista.length} proposições; a primeira é a principal.</p> : null}
      {lista.map((p, i) => (
        <FichaProposicao key={`${p.id ?? i}`} p={p} principal={i === 0} />
      ))}
    </div>
  );
}

/** O que foi votado: textos oficiais da votação (transcritos da fonte). */
export function OQueFoiVotado({ v }: { v: VotacaoDetalhe }) {
  const textos: [string, string][] = [];
  if (v.descricao_abertura) textos.push(["Texto de abertura da votação", v.descricao_abertura]);
  if (v.materia_votada) textos.push(["Matéria votada", v.materia_votada]);
  textos.push(["Descrição oficial do que foi votado", v.descricao || "Descrição não disponível em fonte oficial"]);
  return (
    <div className="space-y-3 rounded-md border border-borda bg-white px-3 py-2.5">
      {textos.map(([r, t]) => (
        <div key={r}>
          <p className="text-sm text-[var(--cor-secundaria)]">{r}</p>
          <p className="mt-0.5 whitespace-pre-line leading-relaxed">{t.trim()}</p>
        </div>
      ))}
    </div>
  );
}

/** Resultado que contraria a maioria simples, explicado pelo quórum da Constituição. */
export function BlocoQuorum({ q }: { q: ExplicacaoQuorum }) {
  return (
    <div className="aviso">
      <p className="font-semibold text-foreground">Por que não foi aprovada?</p>
      <p className="mt-1">{q.texto}</p>
      <p className="mt-1">
        <FonteLink href={q.url} tipo="oficial">
          Constituição Federal — {q.artigo}
        </FonteLink>
      </p>
    </div>
  );
}

/** Orientações de bancada, recolhidas, em ordem alfabética da bancada. */
export function Orientacoes({ orientacoes, casa }: { orientacoes: Orientacao[]; casa: Casa }) {
  const ordenadas = [...orientacoes].sort((a, b) => rotuloBancada(a.bancada).localeCompare(rotuloBancada(b.bancada), "pt-BR"));
  return (
    <details id="orientacoes" className="scroll-mt-20 rounded-md border border-borda bg-white">
      <summary className="pr-3">
        Orientações de bancada <span className="font-normal text-[var(--cor-secundaria)]">({orientacoes.length})</span>
      </summary>
      <div className="space-y-2 border-t border-borda px-3 pb-3 pt-2">
        <p className="text-sm">{TERMOS.orientacao.explicacao}</p>
        {ordenadas.length ? (
          <TabelaResponsiva
            legenda="Orientações de bancada, em ordem alfabética"
            legendaOculta
            linhas={ordenadas}
            chaveLinha={(o, i) => `${o.bancada}-${i}`}
            colunas={[
              { chave: "b", rotulo: "Bancada", principal: true, celula: (o) => rotuloBancada(o.bancada) },
              { chave: "o", rotulo: "Orientação", celula: (o) => rotuloOrientacao(o.orientacao) },
            ]}
          />
        ) : (
          <p className="lacuna text-sm">Nenhuma orientação de bancada registrada na fonte oficial.</p>
        )}
        {casa === "camara" && ordenadas.length ? (
          <p className="meta">Os nomes de blocos e federações aparecem abreviados como na fonte oficial da Câmara.</p>
        ) : null}
      </div>
    </details>
  );
}

/** Explicação neutra para votações simbólicas, com os regimentos (artigos conferidos no texto oficial). */
export function PorQueSimbolica({ casa }: { casa: Casa }) {
  const r = REGIMENTOS[casa];
  return (
    <div className="space-y-2 rounded-md border border-borda bg-superficie px-3 py-3">
      <h3 className="font-semibold text-foreground">Por que esta votação não tem voto individual?</h3>
      <p>
        Foi uma votação simbólica: o presidente da sessão anuncia a votação, os parlamentares se manifestam no plenário e o
        presidente proclama o resultado, sem registrar o voto de cada um. É o processo padrão previsto no regimento de cada
        casa; a votação nominal, com o nome de quem votou, é usada nos casos que o regimento indica.
      </p>
      <p>{r.resumo}</p>
      <p>Por isso, este site não atribui voto a nenhum parlamentar nesta votação.</p>
      <ul className="space-y-1">
        {(["camara", "senado"] as Casa[]).map((c) => (
          <li key={c}>
            <FonteLink href={REGIMENTOS[c].url} tipo="pdf">
              {REGIMENTOS[c].nome} ({REGIMENTOS[c].artigos})
            </FonteLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Votos individuais (só em votação nominal — diretriz 5) ou registro de comparecimento (secreta).
 * Vira lista no celular (TabelaFiltravel).
 */
export function VotosDaVotacao({ v, perfis }: { v: VotacaoDetalhe; perfis: Set<string> }) {
  const membro = v.casa === "camara" ? "Deputado" : "Senador";
  const href = (id: string | null | undefined) => (id && perfis.has(String(id)) ? rotaParlamentar(v.casa, String(id)) : null);
  const colunas = (rotuloValor: string) => [
    { chave: "nome", rotulo: membro, principal: true, link: "href" },
    { chave: "partido", rotulo: "Partido" },
    { chave: "uf", rotulo: "Estado (UF)" },
    { chave: "valor", rotulo: rotuloValor },
  ];
  const filtros = (rotuloValor: string) => [
    { chave: "valor", rotulo: rotuloValor, ordem: ["Sim", "Não", "Abstenção", "Obstrução"] },
    { chave: "partido", rotulo: "Partido" },
    { chave: "uf", rotulo: "Estado (UF)" },
  ];

  if (v.tipo === "simbolica") return <PorQueSimbolica casa={v.casa} />;

  if (v.tipo === "secreta") {
    const linhas: LinhaDados[] = (v.comparecimento ?? []).map((c, i) => ({
      k: `${c.parlamentar_id ?? c.nome}-${i}`,
      nome: c.nome,
      partido: c.partido ?? null,
      uf: c.uf ?? null,
      valor: c.registro ?? c.situacao ?? null,
      href: href(c.parlamentar_id),
    }));
    return (
      <div className="space-y-4">
        <div className="aviso">
          <p className="font-semibold text-foreground">Voto secreto — não há voto individual.</p>
          <p className="mt-1">
            A Constituição e o regimento preveem voto secreto em alguns casos, como a escolha de autoridades. A casa divulga só
            os totais oficiais; nenhum voto é atribuído a parlamentar algum.
          </p>
        </div>
        {linhas.length ? (
          <>
            <p>
              Registro oficial de comparecimento: a situação de cada parlamentar na votação (se votou, se estava presente sem
              votar, em licença etc.). <strong>Não é o voto:</strong> “Votou” indica só que o parlamentar participou.
            </p>
            <TabelaFiltravel
              legenda="Registro oficial de comparecimento (ordem alfabética)"
              chave="k"
              linhas={linhas}
              colunas={colunas("Registro")}
              busca={{ chaves: ["nome"], rotulo: "Buscar pelo nome" }}
              filtros={filtros("Registro")}
              itens={{ singular: "registro", plural: "registros" }}
            />
          </>
        ) : null}
      </div>
    );
  }

  const votos = v.votos ?? [];
  if (!votos.length) return <p className="lacuna">Lista de votos individuais não disponível em fonte oficial coletada.</p>;
  const linhas: LinhaDados[] = [...votos]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((x, i) => ({
      k: `${x.parlamentar_id ?? x.nome}-${i}`,
      nome: x.nome,
      partido: x.partido ?? null,
      uf: x.uf ?? null,
      valor: x.voto ? rotuloVoto(x.voto) : rotuloVoto(null),
      href: href(x.parlamentar_id),
    }));
  const temArt17 = votos.some((x) => x.voto === "Artigo 17");
  const temArt51 = votos.some((x) => x.voto === "Presidente (art. 51 RISF)");
  const temObs = votos.some((x) => x.voto === "Obstrução");
  const termos = [TERMOS.abstencao, ...(temObs ? [TERMOS.obstrucao] : []), ...(temArt17 ? [TERMOS.artigo17] : []), ...(temArt51 ? [TERMOS.artigo51] : [])];
  return (
    <div className="space-y-4">
      <p>
        Votos registrados oficialmente, com partido e estado como constam no registro da votação.
        {v.casa === "camara"
          ? " A lista da Câmara traz só quem registrou voto; quem não votou não aparece nela."
          : " A lista do Senado inclui também registros de ausência, licença e missão, como publicados."}
      </p>
      <TabelaFiltravel
        legenda={`Votos dos ${v.casa === "camara" ? "deputados" : "senadores"} (ordem alfabética)`}
        chave="k"
        linhas={linhas}
        colunas={colunas("Voto")}
        busca={{ chaves: ["nome"], rotulo: "Buscar pelo nome", dica: "Ex.: Silva" }}
        filtros={filtros("Voto")}
        itens={{ singular: "voto", plural: "votos" }}
        porPagina={50}
      />
      <TermosExplicados termos={termos} />
    </div>
  );
}
