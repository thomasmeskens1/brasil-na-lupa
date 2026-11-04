"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartaoDecisao } from "@/components/decisao";
import { FiltrosCompactos, normalizarBusca } from "@/components/tabela";
import { dadoNorma } from "../apresentacao";
import { lerHash } from "../rotulos";
import { MostrarMais } from "@/components/lista/MostrarMais";

type Linha = [
  id: string,
  tipo: number | string,
  titulo: string | null,
  dataAto: string,
  dataPublicacao: string,
  ementa: string | null,
  url: string | null,
  retificacao: 0 | 1,
  projetoTexto: string | null,
  projeto: [rotulo: string, idInterno: string | null, urlCasa: string | null] | null,
  razoesVeto: string | null,
  texto: string | null,
  coletadoEm: string | null,
];

export interface ContextoGoverno {
  uf: string;
  base: string;
  caminho: string;
  rotuloCaminho: string;
  /** "Governador do Estado de São Paulo". */
  governo: string;
  /** "Diário Oficial do Estado de São Paulo". */
  diario: string;
  casaSigla: string;
  casaNome: string;
  /** As normas vêm do sistema da própria Assembleia: o link é o registro dela, não o Diário Oficial. */
  registroCasa: boolean;
}

const POR_PAGINA = 20;

/** Leis, decretos e vetos do governador: índice estático baixado pelo navegador. */
export function BuscaNormas({ ctx }: { ctx: ContextoGoverno }) {
  const [dados, setDados] = useState<{ tipos: string[]; n: (Linha & { _t: string })[]; busca: string[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [ano, setAno] = useState("");
  const [retif, setRetif] = useState(true);
  const [fixo, setFixo] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let ativo = true;
    const lerFixo = () => {
      const h = lerHash();
      if (h.q) setTexto(h.q);
      setFixo(h.id ?? "");
    };
    fetch(`/estados/${ctx.uf}/normas.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { tipos: string[]; n: Linha[] }) => {
        if (!ativo) return;
        const n = j.n.map((l) => Object.assign([...l] as Linha, { _t: typeof l[1] === "number" ? (j.tipos[l[1]] ?? "") : String(l[1]) }));
        lerFixo();
        setDados({ tipos: j.tipos, n, busca: n.map((l) => normalizarBusca(`${l[2] ?? ""} ${l[5] ?? ""} ${l[8] ?? ""} ${l[9]?.[0] ?? ""}`)) });
      })
      .catch(() => ativo && setErro(true));
    window.addEventListener("hashchange", lerFixo);
    return () => {
      ativo = false;
      window.removeEventListener("hashchange", lerFixo);
    };
  }, [ctx.uf]);

  const anos = useMemo(() => (dados ? [...new Set(dados.n.map((l) => l[4].slice(0, 4)).filter(Boolean))].sort().reverse() : []), [dados]);
  const tipos = useMemo(() => (dados ? dados.tipos.filter((t) => dados.n.some((l) => l._t === t)) : []), [dados]);
  const termos = normalizarBusca(texto).split(/\s+/).filter(Boolean);
  const filtradas = dados
    ? dados.n.filter(
        (l, i) =>
          (!fixo || l[0] === fixo) &&
          (!tipo || (tipo === "vetos" ? /^Veto/i.test(l._t) : l._t === tipo)) &&
          (!ano || l[4].startsWith(ano)) &&
          (retif || !l[7]) &&
          termos.every((t) => dados.busca[i].includes(t)),
      )
    : [];
  const resto = filtradas.length - Math.min(limite, filtradas.length);

  function com(set: (v: string) => void) {
    return (v: string) => {
      setLimite(POR_PAGINA);
      set(v);
    };
  }

  return (
    <div className="space-y-4">
      <FiltrosCompactos
        busca={{ valor: texto, aoMudar: com(setTexto), rotulo: "Buscar no título, na ementa ou no projeto", dica: "Ex.: ICMS, 18.499, PL 1315/2023" }}
        filtros={[
          { id: "tipo", rotulo: "Tipo", valor: tipo, aoMudar: com(setTipo), opcoes: [...tipos, ...(tipos.some((t) => /^Veto/i.test(t)) ? [{ valor: "vetos", rotulo: "Vetos (total e parcial)" }] : [])] },
          { id: "ano", rotulo: "Ano de publicação", valor: ano, aoMudar: com(setAno), opcoes: anos },
        ]}
        contagem={
          erro
            ? null
            : !dados
              ? "Carregando a lista de leis, decretos e vetos…"
              : `Mostrando ${Math.min(limite, filtradas.length).toLocaleString("pt-BR")} de ${filtradas.length.toLocaleString("pt-BR")} ${
                  filtradas.length === 1 ? "ato" : "atos"
                }, do mais recente para o mais antigo`
        }
        aoLimpar={() => {
          setTexto("");
          setTipo("");
          setAno("");
          setLimite(POR_PAGINA);
        }}
      />
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" checked={retif} onChange={(e) => setRetif(e.target.checked)} className="h-5 w-5 shrink-0" />
        <span>Incluir retificações (correções publicadas de atos anteriores)</span>
      </label>
      {erro ? <p className="lacuna">Não foi possível carregar a lista. Tente recarregar a página.</p> : null}
      {fixo ? (
        <p className="aviso">
          Mostrando só o ato indicado no link.{" "}
          <button
            type="button"
            className="botao mt-2"
            onClick={() => {
              setFixo("");
              history.replaceState(null, "", window.location.pathname);
            }}
          >
            Ver todos os atos
          </button>
        </p>
      ) : null}

      <ul className="space-y-3">
        {filtradas.slice(0, limite).map((l) => {
          const veto = /^Veto/i.test(l._t);
          return (
            <CartaoDecisao
              key={l[0]}
              as="li"
              href={l[6] ?? `${ctx.base}/leis-e-decretos#id=${l[0]}`}
              tituloOficial={l[5] ?? l[2] ?? `${l._t} (título não informado)`}
              subtituloOficial={[l[5] ? l[2] : null, l[7] ? "retificação" : null, l[3] ? `ato de ${l[3].split("-").reverse().join("/")}` : null].filter(Boolean).join(" · ") || null}
              caminho={ctx.caminho}
              rotuloCaminho={ctx.rotuloCaminho}
              data={l[4] || null}
              rotuloData="publicado em"
              forma={l._t === "Decreto" || veto ? "ato-individual" : null}
              dado={dadoNorma(l._t, ctx.governo, !!l[7])}
              quemDecidiu={l[7] ? "Conforme o texto da retificação publicado no Diário Oficial" : l._t === "Decreto" || veto ? ctx.governo : /^Resolu/i.test(l._t) ? `${ctx.casaSigla} (ato da própria Assembleia)` : !/^Lei/i.test(l._t) ? "Conforme o texto oficial" : `${ctx.casaSigla} (aprovação) e ${ctx.governo.charAt(0).toLowerCase()}${ctx.governo.slice(1)} (sanção)`}
              fonte={l[6] ? { url: l[6], titulo: ctx.registroCasa ? `Registro no sistema da ${ctx.casaSigla}` : `Publicação no ${ctx.diario}`, orgao: ctx.registroCasa ? ctx.casaNome : ctx.diario, acessado_em: l[12] } : null}
            >
              <div className="space-y-2">
                {!l[5] && !veto ? <p className="lacuna">Ementa não disponível em fonte oficial</p> : null}
                {l[8] ? <p className="text-[var(--cor-secundaria)]">Origem, como publicada: {l[8]}</p> : null}
                {l[9] ? (
                  <p className="cartao-decisao__acima">
                    <span className="font-semibold">{veto ? "Projeto vetado: " : "Projeto de origem: "}</span>
                    {l[9][0]}
                    {l[9][1] ? (
                      <>
                        {" · "}
                        <Link href={`${ctx.base}/projetos#id=${l[9][1]}`} prefetch={false} className="lk inline-flex min-h-11 items-center">
                          ver na lista de projetos
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {l[10] ? (
                  <details className="cartao-decisao__acima rounded-md border border-borda bg-superficie">
                    <summary className="pr-3">Razões do veto (texto integral publicado)</summary>
                    <p className="whitespace-pre-line border-t border-borda px-3 pb-3 pt-2 leading-relaxed">{l[10]}</p>
                  </details>
                ) : veto ? (
                  <p className="lacuna">Razões do veto não disponíveis em fonte oficial coletada.</p>
                ) : null}
                {l[11] ? (
                  <details className="cartao-decisao__acima rounded-md border border-borda bg-superficie">
                    <summary className="pr-3">Texto da retificação publicado</summary>
                    <p className="whitespace-pre-line border-t border-borda px-3 pb-3 pt-2 leading-relaxed">{l[11]}</p>
                  </details>
                ) : null}
                {!l[6] ? <p className="lacuna">Link da publicação não disponível</p> : null}
              </div>
            </CartaoDecisao>
          );
        })}
      </ul>
      <MostrarMais
        visiveis={filtradas.length - resto}
        total={filtradas.length}
        passo={POR_PAGINA}
        itens={{ singular: "norma", plural: "normas" }}
        genero="f"
        aoMostrar={setLimite}
      />
    </div>
  );
}
