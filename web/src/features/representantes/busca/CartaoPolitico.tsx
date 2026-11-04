"use client";

/**
 * Cartão do político (conteúdo da janela modal). Só dados de fonte oficial, com período, fonte e
 * data da coleta; sem foto (as fontes consultadas não declaram licença de uso das imagens), sem
 * nota, ranking ou cor de avaliação (diretrizes 1, 2, 4, 6 e 11).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { FonteLink } from "@/components/FonteLink";
import type { FonteResumo } from "@/components/decisao";
import { CARGOS, UFS } from "../cargos";
import { situacaoLegivel } from "../Eleitos";
import type { ArquivoAutoria, ArquivoBase, Pessoa } from "./tipos";

export const NAO_DISPONIVEL = "Informação não disponível em fonte oficial";

export function dataBr(v: string | null | undefined): string {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "data não informada";
}

const nomeUf = (uf: string | null) => UFS.find((u) => u.sigla === uf)?.nome ?? uf ?? "";
const LISTA: Record<string, string> = { camara: "Câmara dos Deputados", senado: "Senado Federal", alesp: "Assembleia Legislativa de SP (ALESP)" };
const EXECUTIVO = new Set(["Prefeito", "Vice-prefeito", "Governador", "Vice-governador", "Presidente", "Vice-presidente"]);

function Fonte({ f }: { f: FonteResumo | null | undefined }) {
  if (!f) return null;
  return (
    <li>
      <FonteLink href={f.url} tipo="oficial">
        {f.titulo ?? f.orgao ?? "Fonte oficial"}
        {f.orgao && f.titulo && !f.titulo.includes(f.orgao) ? ` (${f.orgao})` : ""}
      </FonteLink>
      <span className="meta"> · coletado em {dataBr(f.acessado_em)}</span>
    </li>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--cor-borda)] py-2 first:border-t-0 sm:grid sm:grid-cols-[11rem_1fr] sm:gap-3">
      <dt className="font-semibold">{rotulo}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function CartaoPolitico({ pessoa, base, idTitulo, aoFechar }: { pessoa: Pessoa; base: ArquivoBase | null; idTitulo: string; aoFechar: () => void }) {
  const b = pessoa.base;
  const info = CARGOS[pessoa.cargo];
  const local = pessoa.uf === null ? "Todo o país" : pessoa.cidade ? `${pessoa.cidade.nome} (${pessoa.uf})` : `${nomeUf(pessoa.uf)} (${pessoa.uf})`;
  const fontesEleicao = (base?.eleitos.fontes ?? []).filter((f) =>
    pessoa.cidade ? /2024|munic/i.test(f.titulo ?? "") : pessoa.ano === 2018 ? /2018/.test(f.titulo ?? "") : /2022/.test(f.titulo ?? ""),
  );
  const perfil = b?.h ?? null;
  const pagUf = pessoa.uf
    ? pessoa.cidade
      ? `/quem-me-representa/${pessoa.uf.toLowerCase()}?cidade=${encodeURIComponent(pessoa.cidade.slug)}#na-sua-cidade`
      : `/quem-me-representa/${pessoa.uf.toLowerCase()}`
    : null;

  return (
    <article className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="meta">{info?.singular ?? pessoa.cargo}</p>
          <h2 id={idTitulo} tabIndex={-1} className="text-xl font-bold outline-none focus-visible:outline-2 sm:text-2xl">
            {pessoa.nome}
          </h2>
        </div>
        <button type="button" onClick={aoFechar} className="botao shrink-0">
          Fechar<span className="sr-only"> o cartão de {pessoa.nome}</span>
        </button>
      </div>

      <dl className="mt-4 text-base">
        <Linha rotulo="Nome completo">
          {b?.nc ? (
            <>
              {b.nc} <span className="meta">(segundo a lista oficial da {LISTA[b.v?.casa ?? ""] ?? "casa legislativa"})</span>
            </>
          ) : pessoa.fonte ? (
            <>
              {pessoa.nome} <span className="meta">(página oficial da Presidência da República)</span>
            </>
          ) : (
            <span className="text-[var(--cor-secundaria)]">{NAO_DISPONIVEL} nos dados coletados pelo site.</span>
          )}
        </Linha>
        <Linha rotulo="Nome de urna">
          {pessoa.fonte ? <span className="text-[var(--cor-secundaria)]">Não se aplica: nome da página oficial da Presidência.</span> : <>{pessoa.nome} <span className="meta">(Tribunal Superior Eleitoral, eleição de {pessoa.ano ?? "ano não informado"})</span></>}
        </Linha>
        <Linha rotulo="Partido">
          {pessoa.partido ? (
            <p>
              {pessoa.partido} <span className="meta">— partido na eleição de {pessoa.ano}, segundo o Tribunal Superior Eleitoral (TSE)</span>
            </p>
          ) : (
            <p className="text-[var(--cor-secundaria)]">{NAO_DISPONIVEL} nos dados coletados para este cargo.</p>
          )}
          {b?.pa ? (
            <p>
              {b.pa.p}{" "}
              <span className="meta">
                — partido atual na lista oficial da {LISTA[b.v?.casa ?? ""]}, consultada em {dataBr(b.pa.em)}
              </span>
            </p>
          ) : null}
        </Linha>
        <Linha rotulo="Cargo">
          {info?.singular ?? pessoa.cargo}
          {pessoa.situacao ? <span className="meta"> · {situacaoLegivel(pessoa.situacao)}</span> : null}
        </Linha>
        <Linha rotulo={pessoa.cidade ? "Cidade" : "Estado"}>{local}</Linha>
      </dl>

      {info ? (
        <p className="mt-3 text-sm text-[var(--cor-secundaria)]">
          {info.texto} ({info.artigos}.)
        </p>
      ) : null}

      <section aria-labelledby={`${idTitulo}-ind`} className="mt-6">
        <h3 id={`${idTitulo}-ind`} className="text-lg font-semibold">
          Indicadores do mandato
        </h3>
        <p className="meta mt-1">Números copiados das fontes oficiais, sem nota, ranking ou comparação.</p>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <Autoria pessoa={pessoa} base={base} />
          <Presenca pessoa={pessoa} base={base} />
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-1">
        {perfil ? (
          <Link href={perfil} className="lk inline-flex min-h-11 items-center font-semibold">
            Ver perfil completo<span className="sr-only"> de {pessoa.nome}</span>
          </Link>
        ) : b?.uo ? (
          <FonteLink href={b.uo} tipo="oficial" className="inline-flex min-h-11 items-center">
            Ver perfil completo no site oficial
          </FonteLink>
        ) : (
          <p className="meta">Perfil completo ainda não disponível neste site para este cargo.</p>
        )}
        {pagUf ? (
          <Link href={pagUf} className="lk inline-flex min-h-11 items-center">
            {pessoa.cidade ? `Todos os eleitos de ${pessoa.cidade.nome}` : `Todos os eleitos de ${nomeUf(pessoa.uf)}`}
          </Link>
        ) : null}
      </div>

      <section aria-labelledby={`${idTitulo}-fontes`} className="mt-6">
        <h3 id={`${idTitulo}-fontes`} className="font-semibold">
          Fontes deste cartão
        </h3>
        <ul className="mt-1 space-y-1">
          {pessoa.fonte ? <Fonte f={pessoa.fonte} /> : fontesEleicao.map((f) => <Fonte key={f.url} f={f} />)}
          {b?.v ? <Fonte f={base?.listas[b.v.casa]} /> : null}
        </ul>
        <p className="meta mt-2">
          {pessoa.fonte
            ? "Eleito para todo o país."
            : "Eleito não é o mesmo que quem está no cargo hoje: cassações, renúncias, licenças e posses de suplentes não aparecem na lista do TSE."}
        </p>
      </section>
    </article>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--cor-borda)] bg-[var(--cor-superficie-2)] p-3">
      <h4 className="font-semibold">{titulo}</h4>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

function motivoSemDado(p: Pessoa, tipo: "autoria" | "presenca"): string {
  const b = p.base;
  if (EXECUTIVO.has(p.cargo)) return `${NAO_DISPONIVEL}: cargo do Poder Executivo; o site não reúne este indicador para o Executivo.`;
  if (p.cargo === "Vereador") return `${NAO_DISPONIVEL} coletada pelo site para as Câmaras Municipais.`;
  if (p.cargo === "Deputado estadual" || p.cargo === "Deputado distrital") {
    return tipo === "autoria"
      ? `${NAO_DISPONIVEL} coletada pelo site para todo o mandato: a coleta das Assembleias ainda não reúne autoria e situação de todas as proposições desde 2023.`
      : `${NAO_DISPONIVEL} coletada pelo site para esta Assembleia.`;
  }
  if (!b?.v) return `${NAO_DISPONIVEL} para este nome: ele não consta, com o mesmo nome, na lista oficial de quem está em exercício hoje.`;
  if (b.v.casa === "senado" && tipo === "presenca")
    return `${NAO_DISPONIVEL}: o Senado não publica a presença de cada senador por sessão; o registro de cada um aparece em cada votação nominal.`;
  return `${NAO_DISPONIVEL} para este parlamentar na última coleta.`;
}

function Autoria({ pessoa, base }: { pessoa: Pessoa; base: ArquivoBase | null }) {
  const b = pessoa.base;
  const casa = b?.v?.casa === "camara" || b?.v?.casa === "senado" ? b.v.casa : null;
  const meta = casa ? base?.autoria[casa] : null;
  const a = b?.i?.aut;
  const titulo = "Projetos de autoria transformados em norma";
  if (!casa || !meta || !a) {
    return (
      <Bloco titulo={titulo}>
        <p className="text-[var(--cor-secundaria)]">{motivoSemDado(pessoa, "autoria")}</p>
      </Bloco>
    );
  }
  const situacao = casa === "camara" ? "“Transformado em Norma Jurídica”" : "“Transformada em norma jurídica”, com norma gerada registrada";
  return (
    <Bloco titulo={titulo}>
      <p className="text-lg">
        <strong>{a.n}</strong> {a.n === 1 ? "proposição" : "proposições"}
        {a.n > 0 ? (
          <span className="text-base">
            {" "}
            ({a.n1} como {casa === "camara" ? "primeiro signatário" : "primeiro autor"}, {a.n - a.n1} como coautor)
          </span>
        ) : null}
      </p>
      <p className="text-sm">
        Apresentadas de {dataBr(meta.periodo?.inicio)} (início da legislatura atual) a {dataBr(meta.periodo?.fim)}, com situação atual {situacao} na{" "}
        {casa === "camara" ? "Câmara dos Deputados" : "Senado Federal"}.
      </p>
      {a.n > 0 ? <ListaAutoria casa={casa} id={b!.v!.id} n={a.n} /> : null}
      <ul className="space-y-1">
        {meta.fontes
          // Modelos de endereço: o do autor recebe o código oficial; o do processo fica em cada proposição.
          .filter((f) => !f.url.includes("{id}"))
          .map((f) => ({ ...f, url: f.url.replace("{código}", encodeURIComponent(b!.v!.id)) }))
          .slice(0, 2)
          .map((f) => (
            <Fonte key={f.url} f={f} />
          ))}
        {casa === "camara" && meta.fontes.length > 2 ? (
          <li className="meta">e os arquivos dos demais anos desde {meta.periodo?.inicio.slice(0, 4)}, coletados na mesma data.</li>
        ) : null}
      </ul>
    </Bloco>
  );
}

function ListaAutoria({ casa, id, n }: { casa: "camara" | "senado"; id: string; n: number }) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<ArquivoAutoria | null | "erro">(null);
  useEffect(() => {
    if (!aberto || dados) return;
    let vivo = true;
    fetch(`/quem-me-representa/r/aut/${casa}-${encodeURIComponent(id)}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ArquivoAutoria>) : null))
      .then((d) => vivo && setDados(d ?? "erro"))
      .catch(() => vivo && setDados("erro"));
    return () => {
      vivo = false;
    };
  }, [aberto, dados, casa, id]);
  return (
    <details onToggle={(e) => setAberto((e.target as HTMLDetailsElement).open)}>
      <summary>Ver {n === 1 ? "a proposição" : `as ${n} proposições`} (ordem de apresentação)</summary>
      {!dados ? (
        <p aria-live="polite">Carregando…</p>
      ) : dados === "erro" ? (
        <p className="lacuna">Não foi possível carregar a lista agora. Tente de novo mais tarde.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {dados.itens.map((x) => (
            <li key={x.url} className="border-t border-[var(--cor-borda)] pt-2 first:border-t-0">
              <p className="font-semibold">
                {x.identificacao}
                {x.ordem ? <span className="meta font-normal"> · {x.ordem === 1 ? "primeiro autor" : `coautor (assinatura nº ${x.ordem})`}</span> : null}
              </p>
              {x.ementa ? <p className="text-sm">{x.ementa}</p> : null}
              <p className="meta">
                Apresentada em {dataBr(x.data_apresentacao)} · {x.situacao ? x.situacao.charAt(0) + x.situacao.slice(1).toLowerCase() : ""} em {dataBr(x.data_situacao)}
                {x.norma?.descricao ? ` · ${x.norma.descricao}` : ""}
              </p>
              <FonteLink href={x.url} tipo="oficial" className="inline-flex min-h-11 items-center">
                Tramitação oficial de {x.identificacao}
              </FonteLink>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function Presenca({ pessoa, base }: { pessoa: Pessoa; base: ArquivoBase | null }) {
  const b = pessoa.base;
  const pr = b?.v?.casa === "camara" ? b.i?.pr : undefined;
  const meta = base?.presenca.camara;
  const titulo = "Presença e faltas em Plenário";
  if (!pr || !meta) {
    return (
      <Bloco titulo={titulo}>
        <p className="text-[var(--cor-secundaria)]">{motivoSemDado(pessoa, "presenca")}</p>
      </Bloco>
    );
  }
  return (
    <Bloco titulo={titulo}>
      <p className="text-lg">
        <strong>{pr.d}</strong> de <strong>{pr.t}</strong> dias com sessão deliberativa em {meta.ano}
      </p>
      <p className="text-sm">
        Ausências registradas: {pr.aj ?? "não informado"} {pr.aj === 1 ? "dia justificado" : "dias justificados"} e {pr.an ?? "não informado"}{" "}
        {pr.an === 1 ? "dia não justificado" : "dias não justificados"}.
      </p>
      <p className="text-sm">
        Período no registro oficial: de {dataBr(pr.ini)} a {dataBr(pr.fim)}; contam os {meta.definicao}.
      </p>
      <ul>
        <Fonte f={meta.fonte} />
      </ul>
    </Bloco>
  );
}
