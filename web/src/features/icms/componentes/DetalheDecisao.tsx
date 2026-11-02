import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { CAMINHO_POR_ID, NAO_DISPONIVEL, formatarData, houveVotoDeParlamentares, rotuloPapel } from "../rotulos";
import type { Decisao, Fonte, TermoGlossario } from "../tipos";

const SEM_VALOR = "Não informado no documento";

/** Tabela "antes → depois" com os números exatos do documento. */
export function TabelaMudancas({ decisao }: { decisao: Decisao }) {
  const m = decisao.mudancas ?? [];
  if (!m.length) return <p className="lacuna text-sm">{NAO_DISPONIVEL}</p>;
  return (
    <div className="overflow-x-auto rounded border border-borda" tabIndex={0} role="region" aria-label="O que mudou">
      <table className="tabela">
        <caption className="sr-only">Valores antes e depois da decisão</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Antes</th>
            <th scope="col">Depois</th>
            <th scope="col">Unidade</th>
            <th scope="col">A partir de</th>
          </tr>
        </thead>
        <tbody>
          {m.map((x, i) => (
            <tr key={i}>
              <th scope="row" className="min-w-[10rem] font-medium">
                {x.item}
              </th>
              <td className="whitespace-nowrap tabular-nums">{x.antes ?? SEM_VALOR}</td>
              <td className="whitespace-nowrap font-semibold tabular-nums">
                <span aria-hidden="true">→ </span>
                {x.depois ?? SEM_VALOR}
              </td>
              <td>{x.unidade ?? SEM_VALOR}</td>
              <td className="whitespace-nowrap">{formatarData(x.vigencia ?? decisao.datas?.vigencia)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Quem decidiu, o caminho e o aviso quando não houve votação de parlamentares. */
export function QuemDecidiu({ decisao }: { decisao: Decisao }) {
  const caminho = CAMINHO_POR_ID[decisao.caminho];
  const semParlamentares = !houveVotoDeParlamentares(decisao);
  const resp = decisao.responsaveis ?? [];
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
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
        <p className="aviso text-sm text-gray-900">
          <strong>Não houve votação de deputados nem de senadores.</strong> Esta decisão foi tomada{" "}
          {decisao.caminho === "confaz"
            ? "pelos representantes dos estados e do Distrito Federal no CONFAZ."
            : decisao.caminho === "governador-sp" || decisao.caminho === "presidencia"
              ? "por ato individual de quem tem a competência para assiná-lo."
              : "sem votação registrada de parlamentares em fonte oficial."}
        </p>
      ) : null}
      <div>
        <h3 className="text-base font-semibold text-gray-900">Pessoas citadas no documento</h3>
        {resp.length ? (
          <ul className="mt-2 space-y-2">
            {resp.map((r, i) => (
              <li key={i} className="rounded border border-borda px-3 py-2 text-sm">
                <span className="font-semibold text-gray-900">{r.nome}</span>
                <span className="text-gray-800"> — {rotuloPapel(r.papel)}</span>
                <span className="meta block">
                  {r.cargo ?? "Cargo não informado no documento"}
                  {r.ente ? ` · ${r.ente}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lacuna mt-2 text-sm">{NAO_DISPONIVEL}</p>
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
          <blockquote className="text-sm italic leading-relaxed text-gray-900">“{j.texto}”</blockquote>
          <figcaption className="meta mt-2">
            {j.documento ?? "Documento oficial"}
            {j.url ? (
              <>
                {" · "}
                <FonteLink href={j.url} tipo="oficial" className="text-xs">
                  ver documento
                </FonteLink>
              </>
            ) : null}
          </figcaption>
        </figure>
      ) : (
        <p className="lacuna text-sm">Justificativa não disponível em fonte oficial.</p>
      )}
      {contrarias.length ? (
        <div>
          <h3 className="text-base font-semibold text-gray-900">Justificativas contrárias registradas</h3>
          <ul className="mt-2 space-y-3">
            {contrarias.map((c, i) => (
              <li key={i}>
                <figure className="rounded border border-borda px-4 py-3">
                  <blockquote className="text-sm italic leading-relaxed text-gray-900">“{c.texto}”</blockquote>
                  <figcaption className="meta mt-2">
                    {c.autor ?? "Autor não informado no documento"}
                    {c.url ? (
                      <>
                        {" · "}
                        <FonteLink href={c.url} tipo="oficial" className="text-xs">
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

export function TermosExplicados({ termos }: { termos: TermoGlossario[] }) {
  if (!termos.length) return null;
  return (
    <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {termos.map((t) => (
        <div key={t.termo} className="rounded border border-borda px-3 py-2">
          <dt className="text-sm font-semibold text-gray-900">{t.termo}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-gray-800">{t.explicacao}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Lacunas({ lacunas }: { lacunas: string[] }) {
  if (!lacunas.length) return <p className="text-sm text-gray-800">Nenhuma lacuna registrada.</p>;
  return (
    <ul className="space-y-2">
      {lacunas.map((l, i) => (
        <li key={i} className="lacuna text-sm">
          {l}
        </li>
      ))}
    </ul>
  );
}

export function Fontes({ fontes }: { fontes: Fonte[] }) {
  if (!fontes.length) return <p className="lacuna text-sm">{NAO_DISPONIVEL}</p>;
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm">
      {fontes.map((f, i) => (
        <li key={i}>
          <FonteLink href={f.url} tipo="oficial">
            {f.titulo}
          </FonteLink>
          <span className="meta block">
            {f.orgao ? `${f.orgao} · ` : ""}
            Acessado em {formatarData(f.acessado_em)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Relacionadas({ itens }: { itens: Pick<Decisao, "id" | "titulo">[] }) {
  if (!itens.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {itens.map((d) => (
        <li key={d.id}>
          <Link href={`/impostos/icms/${d.id}`} className="lk">
            {d.titulo}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AvisoProvisorio() {
  return (
    <p className="aviso text-sm text-gray-900">
      <strong>Dados provisórios de exemplo.</strong> Esta página mostra, por enquanto, duas decisões
      reais transcritas das fontes oficiais citadas, enquanto o levantamento completo das decisões
      sobre o ICMS em São Paulo é concluído.
    </p>
  );
}
