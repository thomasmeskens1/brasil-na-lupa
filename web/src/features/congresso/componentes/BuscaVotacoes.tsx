"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { Casa } from "../tipos";
import { CASA_NOME, SIGLA_PROPOSICAO, TIPO, normalizar } from "../rotulos";
import { ItemVotacao } from "./ItemVotacao";

/** Formato compacto de public/congresso/busca.json (scripts/gerar-congresso.mjs). */
interface IndiceBusca {
  p: [string, string][];
  v: [number, string, string, number, number, number, string, number | null, number | null][];
}

interface Linha {
  casa: Casa;
  id: string;
  data: string;
  ano: string;
  tipo: string | null;
  resultado: string | null;
  titulo: string | null;
  descricao: string;
  sim: number | null;
  nao: number | null;
  texto: string;
  /** Nome da proposição normalizado, ex.: "plp 108/2024". */
  prop: string;
}

const CASAS_IDX: Casa[] = ["camara", "senado"];
const TIPOS_IDX = ["nominal", "simbolica", "secreta"];
const POR_PAGINA = 30;
/** Sigla conhecida + número (+ ano opcional), ex.: "plp 108", "pec 45/2019". */
const RE_PROPOSICAO = new RegExp(
  `\\b(${Object.keys(SIGLA_PROPOSICAO).join("|").toLowerCase()})\\s*(\\d+)(?:\\s*\\/\\s*(\\d{4}))?\\b`,
  "g",
);
const CAMPO = "mt-1 block w-full rounded border border-[#7b8794] bg-white px-2 py-1.5 text-sm text-gray-900";

function decodificar(ind: IndiceBusca): Linha[] {
  return ind.v.map(([c, id, data, t, r, pi, descricao, sim, nao]) => {
    const prop = pi >= 0 ? ind.p[pi] : null;
    const titulo = prop?.[0] ?? null;
    const sigla = titulo?.split(" ")[0] ?? "";
    return {
      casa: CASAS_IDX[c] ?? "camara",
      id,
      data,
      ano: data.slice(0, 4),
      tipo: TIPOS_IDX[t] ?? null,
      resultado: r === 1 ? "aprovada" : r === 0 ? "rejeitada" : null,
      titulo,
      descricao,
      sim,
      nao,
      texto: normalizar(`${titulo ?? ""} ${SIGLA_PROPOSICAO[sigla] ?? ""} ${prop?.[1] ?? ""} ${descricao}`),
      prop: normalizar(titulo ?? ""),
    };
  });
}

/**
 * Busca de votações no navegador, sobre um índice estático gerado no build.
 * O índice só é baixado quando o visitante usa a busca; nada do que é digitado sai do navegador.
 */
export function BuscaVotacoes({ anos }: { anos: string[] }) {
  const base = useId();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState(false);
  const pedido = useRef(false);
  const [texto, setTexto] = useState("");
  const [casa, setCasa] = useState("");
  const [ano, setAno] = useState("");
  const [tipo, setTipo] = useState("");
  const [resultado, setResultado] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const carregar = useCallback(() => {
    if (pedido.current) return;
    pedido.current = true;
    fetch("/congresso/busca.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: IndiceBusca) => setLinhas(decodificar(j)))
      .catch(() => {
        pedido.current = false;
        setErro(true);
      });
  }, []);

  /** "PLP 108" ou "PLP 108/2024" buscam pela proposição; o resto, em todo o texto. */
  const { termos, props } = useMemo(() => {
    const props: string[] = [];
    const resto = normalizar(texto).replace(RE_PROPOSICAO, (_m, sg, n, a) => {
      props.push(a ? `${sg} ${n}/${a}` : `${sg} ${n}/`);
      return " ";
    });
    return { termos: resto.split(/\s+/).filter(Boolean), props };
  }, [texto]);
  const ativo = termos.length > 0 || props.length > 0 || !!casa || !!ano || !!tipo || !!resultado;

  const filtradas = useMemo(() => {
    if (!linhas || !ativo) return [];
    return linhas.filter(
      (l) =>
        (!casa || l.casa === casa) &&
        (!ano || l.ano === ano) &&
        (!tipo || l.tipo === tipo) &&
        (!resultado || (resultado === "nao-informado" ? l.resultado === null : l.resultado === resultado)) &&
        props.every((p) => l.prop.startsWith(p)) &&
        termos.every((t) => l.texto.includes(t)),
    );
  }, [linhas, ativo, casa, ano, tipo, resultado, termos, props]);

  function mudar(set: (v: string) => void) {
    return (e: { target: { value: string } }) => {
      carregar();
      setLimite(POR_PAGINA);
      set(e.target.value);
    };
  }

  return (
    <div>
      <form role="search" aria-label="Buscar votações" onSubmit={(e) => e.preventDefault()} onFocus={carregar}>
        <label htmlFor={`${base}-t`} className="block text-sm font-medium text-gray-900">
          Buscar por assunto, proposição ou texto da votação
          <input
            id={`${base}-t`}
            type="search"
            value={texto}
            onChange={mudar(setTexto)}
            placeholder="Ex.: imposto, ICMS, PLP 108"
            className={CAMPO}
          />
        </label>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label htmlFor={`${base}-c`} className="text-sm font-medium text-gray-900">
            Casa
            <select id={`${base}-c`} value={casa} onChange={mudar(setCasa)} className={CAMPO}>
              <option value="">As duas</option>
              {CASAS_IDX.map((c) => (
                <option key={c} value={c}>
                  {CASA_NOME[c]}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${base}-a`} className="text-sm font-medium text-gray-900">
            Ano
            <select id={`${base}-a`} value={ano} onChange={mudar(setAno)} className={CAMPO}>
              <option value="">Todos</option>
              {anos.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${base}-y`} className="text-sm font-medium text-gray-900">
            Tipo de votação
            <select id={`${base}-y`} value={tipo} onChange={mudar(setTipo)} className={CAMPO}>
              <option value="">Todos</option>
              {TIPOS_IDX.map((t) => (
                <option key={t} value={t}>
                  {TIPO[t as keyof typeof TIPO].rotulo}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${base}-r`} className="text-sm font-medium text-gray-900">
            Resultado
            <select id={`${base}-r`} value={resultado} onChange={mudar(setResultado)} className={CAMPO}>
              <option value="">Todos</option>
              <option value="aprovada">Aprovada</option>
              <option value="rejeitada">Rejeitada</option>
              <option value="nao-informado">Não informado na fonte</option>
            </select>
          </label>
        </div>
      </form>

      <div aria-live="polite" className="mt-4">
        {erro ? (
          <p className="lacuna text-sm">Não foi possível carregar o índice de busca. Tente recarregar a página.</p>
        ) : !ativo ? (
          <p className="meta">Digite um termo ou escolha um filtro para ver as votações encontradas.</p>
        ) : !linhas ? (
          <p className="meta">Carregando o índice de votações…</p>
        ) : (
          <p className="meta">
            {filtradas.length === 1 ? "1 votação encontrada" : `${filtradas.length} votações encontradas`}, da mais
            recente para a mais antiga.
          </p>
        )}
      </div>

      {filtradas.length ? (
        <>
          <ul className="mt-3 space-y-3">
            {filtradas.slice(0, limite).map((l) => (
              <li key={`${l.casa}-${l.id}`}>
                <ItemVotacao
                  casa={l.casa}
                  id={l.id}
                  data={l.data}
                  tipo={l.tipo}
                  resultado={l.resultado}
                  titulo={l.titulo}
                  descricao={l.descricao}
                  sim={l.sim}
                  nao={l.nao}
                />
              </li>
            ))}
          </ul>
          {filtradas.length > limite ? (
            <button
              type="button"
              onClick={() => setLimite((n) => n + POR_PAGINA)}
              className="mt-4 rounded border border-[#7b8794] bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-superficie"
            >
              Mostrar mais {Math.min(POR_PAGINA, filtradas.length - limite)} de {filtradas.length - limite} restantes
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
