"use client";

import { useEffect, useMemo, useState } from "react";
import { CartaoDecisao, type DadoChave } from "@/components/decisao";
import { FiltrosCompactos, normalizarBusca } from "@/components/tabela";
import type { LinhaNorma } from "../tipos";
import { encurtar } from "../apresentacao";

interface Arquivo {
  tipos: string[];
  n: LinhaNorma[];
}

type Linha = LinhaNorma & { _t: string; _b: string };

const POR_PAGINA = 20;

/** Dado-chave da norma: o caminho (decreto = ato individual) ou a publicação no Diário Oficial. */
function dadoNorma(l: Linha): DadoChave {
  const dou = l[7].length ? l[7].join("; ") : null;
  if (l._t === "Decreto") return { tipo: "sem-votacao", caminho: "ato individual do Presidente da República", detalhe: dou ? `Diário Oficial da União: ${dou}` : null };
  return { tipo: "texto", rotulo: "Publicação no Diário Oficial da União", texto: dou ?? "Informação não disponível em fonte oficial" };
}

/**
 * Leis, leis complementares e decretos: índice estático (public/executivo/normas.json) baixado
 * pelo navegador; busca e filtros rodam localmente. Cada norma vira um Cartão de Decisão que
 * leva ao texto oficial no Planalto (não há página de detalhe).
 */
export function BuscaNormas({ coletadoEm }: { coletadoEm: string | null }) {
  const [dados, setDados] = useState<{ tipos: string[]; linhas: Linha[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [ano, setAno] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let ativo = true;
    fetch("/executivo/normas.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Arquivo) => {
        if (!ativo) return;
        const linhas = j.n.map((l) => {
          const t = typeof l[1] === "number" ? (j.tipos[l[1]] ?? "") : String(l[1]);
          return Object.assign([...l] as LinhaNorma, {
            _t: t,
            _b: normalizarBusca(`${l[2] ?? ""} ${l[4]} ${l[5] ?? ""} ${l[8].join(" ")} ${l[11] ?? ""}`),
          });
        });
        setDados({ tipos: j.tipos, linhas });
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, []);

  const anos = useMemo(() => (dados ? [...new Set(dados.linhas.map((l) => l[3].slice(0, 4)).filter(Boolean))].sort().reverse() : []), [dados]);
  const termos = normalizarBusca(texto).split(/\s+/).filter(Boolean);
  const filtradas = dados
    ? dados.linhas.filter((l) => (!tipo || l._t === tipo) && (!ano || l[3].startsWith(ano)) && termos.every((t) => l._b.includes(t)))
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
        busca={{ valor: texto, aoMudar: com(setTexto), rotulo: "Buscar na ementa, no número ou no projeto de origem", dica: "Ex.: ICMS, 15.164, PL 3819" }}
        filtros={[
          { id: "tipo", rotulo: "Tipo", valor: tipo, aoMudar: com(setTipo), opcoes: dados?.tipos ?? [] },
          { id: "ano", rotulo: "Ano de assinatura", valor: ano, aoMudar: com(setAno), opcoes: anos },
        ]}
        contagem={
          erro
            ? null
            : !dados
              ? "Carregando a lista de leis e decretos…"
              : `Mostrando ${Math.min(limite, filtradas.length).toLocaleString("pt-BR")} de ${filtradas.length.toLocaleString("pt-BR")} ${
                  filtradas.length === 1 ? "norma" : "normas"
                }, da mais recente para a mais antiga`
        }
        aoLimpar={() => {
          setTexto("");
          setTipo("");
          setAno("");
          setLimite(POR_PAGINA);
        }}
      />
      {erro ? <p className="lacuna text-sm">Não foi possível carregar a lista. Tente recarregar a página.</p> : null}

      <ul className="space-y-3">
        {filtradas.slice(0, limite).map((l) => {
          const decreto = l._t === "Decreto";
          const href = l[6] ?? (l[9] ? `/executivo/vetos/${l[9]}` : (l[10] ?? "/executivo/leis-e-decretos"));
          const links = [
            ...(l[10] ? [{ href: l[10], rotulo: "Ficha no Senado Federal", externo: true }] : []),
            ...(l[9] ? [{ href: `/executivo/vetos/${l[9]}`, rotulo: "Veto desta lei", externo: false }] : []),
          ];
          return (
            <CartaoDecisao
              key={l[0]}
              as="li"
              href={href}
              tituloOficial={l[11] ?? encurtar(l[4]) ?? l[2] ?? "Ementa não disponível em fonte oficial"}
              subtituloOficial={[l[2] ?? `${l._t} (nome oficial não informado)`, l[5] ? `nome dado pelo Senado: ${l[5]}` : null].filter(Boolean).join(" · ")}
              caminho="presidencia"
              data={l[3] || null}
              rotuloData="assinada em"
              forma={decreto ? "ato-individual" : null}
              dado={dadoNorma(l)}
              quemDecidiu={decreto ? "Presidente da República" : "Congresso Nacional (aprovação) e Presidente da República (sanção)"}
              fonte={l[6] ? { url: l[6], titulo: "Texto no Planalto", orgao: "Presidência da República (Planalto)", acessado_em: coletadoEm } : null}
            >
              {l[8].length || links.length ? (
                <div className="space-y-1">
                  {l[8].length ? <p className="text-[var(--cor-secundaria)]">Projeto de origem: {l[8].join("; ")}</p> : null}
                  {links.length ? (
                    <p className="cartao-decisao__acima flex flex-wrap gap-x-4">
                      {links.map((x) => (
                        <a
                          key={x.href}
                          href={x.href}
                          className="lk inline-flex min-h-11 items-center"
                          {...(x.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                          {x.rotulo}
                          {x.externo ? <span className="sr-only"> (abre em nova aba)</span> : null}
                        </a>
                      ))}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CartaoDecisao>
          );
        })}
      </ul>
      {resto > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="botao" onClick={() => setLimite((n) => n + POR_PAGINA)}>
            Mostrar mais {Math.min(POR_PAGINA, resto).toLocaleString("pt-BR")}
          </button>
          <span className="self-center text-sm text-[var(--cor-secundaria)]">faltam {resto.toLocaleString("pt-BR")} normas</span>
        </div>
      ) : null}
    </div>
  );
}
