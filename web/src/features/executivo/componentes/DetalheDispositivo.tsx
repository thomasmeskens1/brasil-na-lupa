"use client";

import { useEffect, useRef, useState } from "react";
import { BlocoDadoChave, placarOficial } from "@/components/decisao";
import { BalaoTermo } from "@/components/glossario/BalaoTermo";
import { CASA_NOME, formatarData } from "@/features/congresso/rotulos";
import type { DetalheDispositivoArquivo, PlacarCasaVeto, ResumoDispositivo } from "../tipos";
import { SITUACAO_DISPOSITIVO, TERMOS_EXECUTIVO, rotuloTipoVotacaoVeto } from "../rotulos";
import { Citacao } from "./Dispositivo";
import { VotosDispositivo } from "./VotosDispositivo";

const cache = new Map<string, Promise<DetalheDispositivoArquivo>>();

function baixar(codigo: string): Promise<DetalheDispositivoArquivo> {
  let p = cache.get(codigo);
  if (!p) {
    p = fetch(`/executivo/vetos/dispositivos/${encodeURIComponent(codigo)}.json`).then((r) =>
      r.ok ? (r.json() as Promise<DetalheDispositivoArquivo>) : Promise.reject(new Error(String(r.status))),
    );
    p.catch(() => cache.delete(codigo));
    cache.set(codigo, p);
  }
  return p;
}

function placarCasa(p: PlacarCasaVeto) {
  // O detalhe traz os rótulos exatamente como a fonte os conta (ex.: "Branco").
  if (p.detalhe) return Object.entries(p.detalhe).map(([rotulo, valor]) => ({ rotulo, valor }));
  return placarOficial({ sim: p.sim, nao: p.nao, abstencao: p.abstencao, obstrucao: p.obstrucao, outros: p.outros });
}

/**
 * Conteúdo de um dispositivo vetado, baixado só quando o leitor abre o item (o details pai):
 * texto vetado e razões do veto (literais), origem do trecho e a votação em sessão conjunta.
 * Sem JavaScript, fica o link para a página oficial do Congresso.
 */
export function DetalheDispositivo({ r, urlOficial }: { r: ResumoDispositivo; urlOficial?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [d, setD] = useState<DetalheDispositivoArquivo | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const det = ref.current?.closest("details");
    if (!det) return;
    let ativo = true;
    const abrir = () => {
      if (!det.open) return;
      setErro(false);
      baixar(r.codigo)
        .then((x) => ativo && setD(x))
        .catch(() => ativo && setErro(true));
    };
    abrir();
    det.addEventListener("toggle", abrir);
    return () => {
      ativo = false;
      det.removeEventListener("toggle", abrir);
    };
  }, [r.codigo]);

  const sit = r.situacao ? SITUACAO_DISPOSITIVO[r.situacao] : undefined;
  const v = d?.votacao;
  const casas = (["camara", "senado"] as const).filter((c) => v?.placar?.[c]);
  const rotulo = r.identificador ? `dispositivo ${r.identificador}` : `dispositivo ${r.ordem}`;
  const tipoVot = rotuloTipoVotacaoVeto(v?.tipo_votacao_fonte ?? d?.tipo_votacao ?? null);

  return (
    <div ref={ref}>
      {sit ? <p>{sit.explicacao}</p> : null}
      {r.dispositivo ? <p className="meta mt-1 [overflow-wrap:break-word]">Trecho do projeto: {r.dispositivo}</p> : null}
      {!d && !erro ? (
        <p className="meta mt-2" aria-live="polite">
          Carregando o texto vetado e as razões do veto…
        </p>
      ) : null}
      {erro ? (
        <p className="lacuna mt-2 text-sm">
          Não foi possível carregar o texto deste trecho.{" "}
          {urlOficial ? (
            <a href={urlOficial} className="lk" target="_blank" rel="noopener noreferrer">
              Ver na página oficial do Congresso Nacional<span className="sr-only"> (abre em nova aba)</span>
            </a>
          ) : null}
        </p>
      ) : null}
      <noscript>
        {urlOficial ? (
          <a href={urlOficial} className="lk">
            Texto vetado e razões na página oficial do Congresso Nacional
          </a>
        ) : null}
      </noscript>
      {d ? (
        <>
          <Citacao rotulo="Texto vetado (texto oficial)" texto={d.texto_vetado} />
          <Citacao rotulo="Razões do veto (texto oficial)" texto={d.razao_veto} />
          {d.origem ? (
            <details className="mt-3 rounded-md border border-borda">
              <summary className="pr-3">Origem do trecho no Congresso, segundo a fonte</summary>
              <p className="whitespace-pre-line border-t border-borda px-3 pb-3 pt-2">{d.origem}</p>
            </details>
          ) : null}
          {v ? (
            <section aria-label={`Votação do ${rotulo}`} className="mt-4 border-t border-borda pt-3">
              <h5 className="font-semibold text-foreground">
                Votação em{" "}
                <BalaoTermo texto="sessão conjunta" titulo={TERMOS_EXECUTIVO.sessaoConjunta.termo} definicao={TERMOS_EXECUTIVO.sessaoConjunta.explicacao} />
              </h5>
              <p className="meta mt-1">
                {v.sessao ?? (r.dataSessao ? `Sessão de ${formatarData(r.dataSessao)}` : "Sessão não informada")}
                {tipoVot ? ` · ${tipoVot}` : ""}
              </p>
              {casas.length ? (
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {casas.map((c) => (
                    <div key={c}>
                      <p className="text-sm font-semibold text-foreground">{CASA_NOME[c]}</p>
                      <BlocoDadoChave dado={{ tipo: "placar", itens: placarCasa(v.placar![c]!) }} className="mt-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="lacuna mt-2 text-sm">Placar não disponível em fonte oficial.</p>
              )}
              {casas.length === 1 ? (
                <p className="meta mt-2">
                  A fonte traz placar só {casas[0] === "camara" ? "da Câmara dos Deputados" : "do Senado Federal"} neste trecho; o da
                  outra casa não consta da fonte.
                </p>
              ) : null}
              {v.votos_ref ? <VotosDispositivo codigo={r.codigo} rotulo={rotulo} /> : null}
              {v.url ? (
                <p className="mt-2">
                  <a href={v.url} className="lk inline-flex min-h-11 items-center text-sm" target="_blank" rel="noopener noreferrer">
                    <span className="tag-fonte mr-1.5">Oficial</span> Resultado da votação deste trecho (Congresso Nacional)
                    <span className="sr-only"> (abre em nova aba)</span>
                  </a>
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
