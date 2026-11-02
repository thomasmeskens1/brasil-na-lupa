"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FonteLink } from "@/components/FonteLink";
import { FiltrosCompactos } from "@/components/tabela/FiltrosCompactos";
import { normalizar } from "@/features/congresso/rotulos";

type Linha = [key: number | string, numero: string, colegiado: number, tipo: number, data: string, relator: number, situacao: number, sumario: string | null, aviso: 0 | 1];

interface Arquivo {
  ano: number;
  prefixo: string;
  url_modelo: string | null;
  c: string[];
  t: string[];
  r: string[];
  s: string[];
  n: Linha[];
}

const POR_PAGINA = 10;

function data(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "data não informada";
}

function nome(v: string | undefined): string {
  if (!v) return "Relator não informado pela fonte";
  return v
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && ["de", "da", "do", "das", "dos", "e"].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

function tipoLegivel(t: string | undefined): string {
  if (!t) return "Tipo não informado";
  return t === "ACÓRDÃO DE RELAÇÃO" ? "Acórdão de relação" : t === "ACÓRDÃO" ? "Acórdão" : t;
}

/**
 * Busca nos acórdãos de um tribunal de contas (índice estático por ano em
 * public/tribunais-de-contas/<orgao>/acordaos-<ano>.json). A busca roda no navegador.
 * Só os acórdãos das coleções têm página própria; os demais levam ao registro oficial.
 */
export function BuscaAcordaos({ orgao, anos, comPagina }: { orgao: string; anos: number[]; comPagina: string[] }) {
  const padrao = anos[0] ? String(anos[0]) : "";
  const [ano, setAno] = useState(padrao);
  const [arq, setArq] = useState<(Arquivo & { busca: string[] }) | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [colegiado, setColegiado] = useState("");
  const [tipo, setTipo] = useState("");
  const [relator, setRelator] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);
  const paginas = useMemo(() => new Set(comPagina), [comPagina]);

  useEffect(() => {
    if (!ano) return;
    let ativo = true;
    fetch(`/tribunais-de-contas/${orgao}/acordaos-${ano}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Arquivo) => {
        if (!ativo) return;
        const busca = j.n.map((l) => normalizar(`${l[1]}/${j.ano} ${l[7] ?? ""} ${j.r[l[5]] ?? ""} ${j.c[l[2]] ?? ""}`));
        setErro(false);
        setArq({ ...j, busca });
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [orgao, ano]);

  const relatores = useMemo(() => (arq ? [...arq.r].sort((a, b) => a.localeCompare(b, "pt-BR")) : []), [arq]);
  const termos = normalizar(texto).split(/\s+/).filter(Boolean);
  const filtradas = arq
    ? arq.n.filter(
        (l, i) =>
          (!colegiado || arq.c[l[2]] === colegiado) &&
          (!tipo || arq.t[l[3]] === tipo) &&
          (!relator || arq.r[l[5]] === relator) &&
          termos.every((t) => arq.busca[i].includes(t)),
      )
    : [];

  function mudar(set: (v: string) => void) {
    return (v: string) => {
      setLimite(POR_PAGINA);
      set(v);
    };
  }

  function linkOficial(key: string): string | null {
    return arq?.url_modelo ? arq.url_modelo.replace("{id}", key) : null;
  }

  const carregando = !arq || String(arq.ano) !== ano;

  return (
    <div>
      <form role="search" aria-label="Buscar acórdãos" onSubmit={(e) => e.preventDefault()}>
        <FiltrosCompactos
          busca={{ valor: texto, aoMudar: mudar(setTexto), rotulo: "Buscar no sumário, número ou relator", dica: "Ex.: renúncia de receita" }}
          filtros={[
            {
              id: "ano",
              rotulo: "Ano",
              valor: ano === padrao ? "" : ano,
              aoMudar: (v) => mudar(setAno)(v || padrao),
              opcoes: anos.slice(1).map(String),
              todos: padrao ? `${padrao} (mais recente)` : "Mais recente",
            },
            { id: "colegiado", rotulo: "Colegiado", valor: colegiado, aoMudar: mudar(setColegiado), opcoes: arq?.c ?? [] },
            { id: "tipo", rotulo: "Tipo", valor: tipo, aoMudar: mudar(setTipo), opcoes: (arq?.t ?? []).map((t) => ({ valor: t, rotulo: tipoLegivel(t) })) },
            { id: "relator", rotulo: "Relator", valor: relator, aoMudar: mudar(setRelator), opcoes: relatores.map((r) => ({ valor: r, rotulo: nome(r) })) },
          ]}
          aoLimpar={() => {
            setLimite(POR_PAGINA);
            setTexto("");
            setAno(padrao);
            setColegiado("");
            setTipo("");
            setRelator("");
          }}
        />
      </form>

      <div aria-live="polite" className="mt-3 text-base text-[#3e4c59]">
        {erro ? (
          <p className="lacuna">Não foi possível carregar a lista. Tente recarregar a página.</p>
        ) : carregando ? (
          <p>Carregando os acórdãos de {ano}…</p>
        ) : (
          <p>
            {filtradas.length === 1 ? "1 acórdão encontrado" : `${filtradas.length.toLocaleString("pt-BR")} acórdãos encontrados`} em {ano}, do mais recente
            para o mais antigo.
          </p>
        )}
      </div>

      {!carregando && arq ? (
        <ul className="mt-3 space-y-3">
          {filtradas.slice(0, limite).map((l) => {
            const key = typeof l[0] === "number" ? `${arq.prefixo}${l[0]}` : l[0];
            const oficial = linkOficial(key);
            const situacao = arq.s[l[6]];
            const t = arq.t[l[3]];
            return (
              <li key={key} className="cartao">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-[#3e4c59]">
                  <span className="font-semibold text-gray-900">{data(l[4])}</span>
                  <span className="selo text-sm!">{arq.c[l[2]] ?? "Colegiado não informado"}</span>
                  <span>{tipoLegivel(t)}</span>
                </p>
                <h3 className="mt-2 text-base font-semibold text-gray-900">
                  {paginas.has(key) ? (
                    <Link href={`/tribunais-de-contas/${orgao}/acordaos/${key}`} className="lk">
                      Acórdão {l[1]}/{arq.ano} — {arq.c[l[2]]}
                    </Link>
                  ) : (
                    <>
                      Acórdão {l[1]}/{arq.ano} — {arq.c[l[2]]}
                    </>
                  )}
                </h3>
                <p className="mt-1 text-base text-gray-800">Relator: {nome(arq.r[l[5]])}</p>
                {situacao && situacao !== "OFICIALIZADO" ? <p className="mt-1 text-base text-gray-800">Situação na fonte: {situacao.toLowerCase()}</p> : null}
                {l[7] ? (
                  <p className="mt-2 text-base leading-relaxed text-gray-900">{l[7]}</p>
                ) : l[8] ? (
                  <p className="lacuna mt-2 text-base">
                    Sumário omitido: na fonte, este campo traz nomes ou documentos de particulares. O texto está no documento oficial.
                  </p>
                ) : (
                  <p className="mt-2 text-base text-[#3e4c59]">
                    {t === "ACÓRDÃO DE RELAÇÃO" ? "Acórdãos de relação não têm sumário na fonte oficial." : "Sumário não disponível em fonte oficial."}
                  </p>
                )}
                {oficial ? (
                  <p className="mt-2 inline-flex min-h-11 items-center">
                    <FonteLink href={oficial} tipo="oficial" className="inline-flex min-h-11 items-center text-base!">
                      Acórdão no site do tribunal
                    </FonteLink>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {!carregando && filtradas.length > limite ? (
        <button type="button" onClick={() => setLimite((n) => n + POR_PAGINA)} className="botao mt-4">
          Mostrar mais {Math.min(POR_PAGINA, filtradas.length - limite)} de {(filtradas.length - limite).toLocaleString("pt-BR")} restantes
        </button>
      ) : null}
    </div>
  );
}
