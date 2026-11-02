import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { BalaoTermo } from "@/components/glossario/BalaoTermo";
import { ListaRecolhivel } from "@/components/lista/ListaRecolhivel";
import { TabelaResponsiva } from "@/components/tabela/TabelaResponsiva";
import { CAMINHO_POR_ID, NAO_DISPONIVEL, formatarData, houveVotoDeParlamentares, rotuloPapel } from "../rotulos";
import type { Decisao, Fonte, Mudanca, TermoGlossario } from "../tipos";

const SEM_VALOR = "Não informado no documento";

/**
 * "O que mudou": antes → depois com os números exatos do documento. Abaixo de 640 px cada linha
 * vira um item (sem a coluna "Depois" fora da tela; auditoria mobile, item 3).
 */
export function TabelaMudancas({ decisao }: { decisao: Decisao }) {
  const m = decisao.mudancas ?? [];
  if (!m.length) return <p className="lacuna">{NAO_DISPONIVEL}</p>;
  return (
    <TabelaResponsiva<Mudanca>
      legenda="Valores antes e depois da decisão"
      legendaOculta
      linhas={m}
      chaveLinha={(x, i) => `${x.item}-${i}`}
      colunas={[
        { chave: "item", rotulo: "Item", principal: true, celula: (x) => x.item },
        { chave: "antes", rotulo: "Antes", celula: (x) => <span className="tabular-nums">{x.antes ?? SEM_VALOR}</span> },
        {
          chave: "depois",
          rotulo: "Depois",
          celula: (x) => <strong className="tabular-nums">{x.depois ?? SEM_VALOR}</strong>,
        },
        { chave: "unidade", rotulo: "Unidade", celula: (x) => x.unidade ?? SEM_VALOR },
        { chave: "vigencia", rotulo: "A partir de", celula: (x) => formatarData(x.vigencia ?? decisao.datas?.vigencia) },
      ]}
    />
  );
}

/** Quem decidiu, o caminho e o aviso quando não houve votação de parlamentares. */
export function QuemDecidiu({ decisao }: { decisao: Decisao }) {
  const caminho = CAMINHO_POR_ID[decisao.caminho];
  const semParlamentares = !houveVotoDeParlamentares(decisao);
  const resp = decisao.responsaveis ?? [];
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <dt className="font-semibold text-gray-900">Caminho</dt>
        <dd className="text-gray-800">{caminho?.rotulo ?? NAO_DISPONIVEL}</dd>
        <dt className="font-semibold text-gray-900">Órgão que decidiu</dt>
        <dd className="text-gray-800">{decisao.orgao ?? NAO_DISPONIVEL}</dd>
        {caminho ? (
          <>
            <dt className="font-semibold text-gray-900">Quem participa</dt>
            <dd className="text-gray-800">{caminho.quem}</dd>
          </>
        ) : null}
      </dl>
      {semParlamentares ? (
        <p className="aviso text-gray-900">
          <strong>Não houve votação de deputados nem de senadores.</strong> Esta decisão foi tomada{" "}
          {decisao.caminho === "confaz"
            ? "pelos representantes dos estados e do Distrito Federal no CONFAZ."
            : decisao.caminho === "governador-sp" || decisao.caminho === "presidencia"
              ? "por ato individual de quem tem a competência para assiná-lo."
              : "sem votação registrada de parlamentares em fonte oficial."}
        </p>
      ) : null}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Pessoas citadas no documento</h3>
        {resp.length ? (
          <div className="mt-2">
            <ListaRecolhivel
              rotulo={{ singular: "pessoa citada", plural: "pessoas citadas" }}
              inicial={5}
              className="grid grid-cols-1 gap-2 md:grid-cols-2"
              itens={resp.map((r, i) => (
                <div key={i} className="h-full rounded border border-borda px-3 py-2">
                  <span className="font-semibold text-gray-900">{r.nome}</span>
                  <span className="text-gray-800"> — {rotuloPapel(r.papel)}</span>
                  <span className="block text-[var(--cor-secundaria)]">
                    {r.cargo ?? "Cargo não informado no documento"}
                    {r.ente ? ` · ${r.ente}` : ""}
                  </span>
                </div>
              ))}
            />
          </div>
        ) : (
          <p className="lacuna mt-2">{NAO_DISPONIVEL}</p>
        )}
      </div>
    </div>
  );
}

/** Justificativa oficial do autor e, quando existirem, as contrárias. */
export function Justificativas({ decisao }: { decisao: Decisao }) {
  const j = decisao.justificativa;
  const contrarias = decisao.justificativas_contrarias ?? [];
  return (
    <div className="space-y-4">
      {j?.texto ? (
        <figure className="rounded border-l-4 border-acento bg-superficie px-4 py-3">
          <blockquote className="italic leading-relaxed text-gray-900">“{j.texto}”</blockquote>
          <figcaption className="mt-2 text-[var(--cor-secundaria)]">
            {j.documento ?? "Documento oficial"}
            {j.url ? (
              <>
                {" · "}
                <FonteLink href={j.url} tipo="oficial" className="inline-flex min-h-11 items-center text-base!">
                  ver documento
                </FonteLink>
              </>
            ) : null}
          </figcaption>
        </figure>
      ) : (
        <p className="lacuna">Justificativa não disponível em fonte oficial.</p>
      )}
      {contrarias.length ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Justificativas contrárias registradas</h3>
          <ul className="mt-2 space-y-3">
            {contrarias.map((c, i) => (
              <li key={i}>
                <figure className="rounded border border-borda px-4 py-3">
                  <blockquote className="italic leading-relaxed text-gray-900">“{c.texto}”</blockquote>
                  <figcaption className="mt-2 text-[var(--cor-secundaria)]">
                    {c.autor ?? "Autor não informado no documento"}
                    {c.url ? (
                      <>
                        {" · "}
                        <FonteLink href={c.url} tipo="oficial" className="inline-flex min-h-11 items-center text-base!">
                          ver documento
                        </FonteLink>
                      </>
                    ) : null}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Termos da decisão em balões (toque abre a explicação; diretriz 9). */
export function TermosExplicados({ termos }: { termos: TermoGlossario[] }) {
  if (!termos.length) return null;
  return (
    <div>
      <p className="text-[var(--cor-secundaria)]">Toque num termo para ver a explicação.</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 [&_.termo-botao]:inline-flex [&_.termo-botao]:min-h-11 [&_.termo-botao]:items-center">
        {termos.map((t) => (
          <li key={t.termo} className="inline-flex min-h-11 items-center">
            <BalaoTermo texto={t.termo} titulo={t.termo} definicao={t.explicacao} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Lacunas({ lacunas }: { lacunas: string[] }) {
  if (!lacunas.length) return <p className="text-gray-800">Nenhuma lacuna registrada.</p>;
  return (
    <ul className="space-y-2">
      {lacunas.map((l, i) => (
        <li key={i} className="lacuna">
          {l}
        </li>
      ))}
    </ul>
  );
}

/** Fontes com data de coleta; listas longas (decretos agrupados) ficam recolhidas. */
export function Fontes({ fontes }: { fontes: Fonte[] }) {
  if (!fontes.length) return <p className="lacuna">{NAO_DISPONIVEL}</p>;
  return (
    <ListaRecolhivel
      rotulo={{ singular: "fonte oficial", plural: "fontes oficiais" }}
      inicial={5}
      ordenada
      className="list-decimal space-y-2 pl-5"
      itens={fontes.map((f, i) => (
        <div key={i}>
          <FonteLink href={f.url} tipo={/\.pdf($|\?)/i.test(f.url) ? "pdf" : "oficial"} className="inline-flex min-h-11 items-center text-base!">
            {f.titulo}
          </FonteLink>
          <span className="block text-[var(--cor-secundaria)]">
            {f.orgao ? `${f.orgao} · ` : ""}
            coletado em {formatarData(f.acessado_em)}
          </span>
        </div>
      ))}
    />
  );
}

export function Relacionadas({ itens }: { itens: Pick<Decisao, "id" | "titulo">[] }) {
  if (!itens.length) return null;
  return (
    <ul className="space-y-1">
      {itens.map((d) => (
        <li key={d.id}>
          <Link href={`/impostos/icms/${d.id}`} className="lk inline-flex min-h-11 items-center">
            {d.titulo}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AvisoProvisorio() {
  return (
    <p className="aviso text-gray-900">
      <strong>Dados provisórios de exemplo.</strong> Esta página mostra, por enquanto, duas decisões
      reais transcritas das fontes oficiais citadas, enquanto o levantamento completo das decisões
      sobre o ICMS em São Paulo é concluído.
    </p>
  );
}
