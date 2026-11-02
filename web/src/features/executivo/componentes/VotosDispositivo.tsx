"use client";

import { useState } from "react";
import { TabelaFiltravel } from "@/components/tabela";
import { CASA_NOME, rotaParlamentar } from "@/features/congresso/rotulos";
import type { Casa } from "@/features/congresso/tipos";
import type { VotosDispositivoArquivo } from "../tipos";

const CASAS: Casa[] = ["camara", "senado"];
const ORDEM_VOTO = ["Sim", "Não", "Abstenção", "Obstrução", "Branco"];

/**
 * Votos nominais de um dispositivo de veto, baixados só quando o leitor pede
 * (public/executivo/vetos/votos/<codigo>.json). Votos aparecem exatamente como registrados.
 * No celular, a tabela vira lista (TabelaFiltravel).
 */
export function VotosDispositivo({ codigo, rotulo }: { codigo: string; rotulo: string }) {
  const [estado, setEstado] = useState<"inicial" | "carregando" | "erro" | "pronto">("inicial");
  const [dados, setDados] = useState<VotosDispositivoArquivo | null>(null);

  function carregar() {
    if (estado === "carregando" || estado === "pronto") return;
    setEstado("carregando");
    fetch(`/executivo/vetos/votos/${encodeURIComponent(codigo)}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: VotosDispositivoArquivo) => {
        setDados(j);
        setEstado("pronto");
      })
      .catch(() => setEstado("erro"));
  }

  if (estado === "inicial") {
    return (
      <button type="button" className="botao mt-3" onClick={carregar}>
        Ver o voto de cada parlamentar
      </button>
    );
  }
  if (estado === "carregando") {
    return (
      <p className="meta mt-3" aria-live="polite">
        Carregando os votos…
      </p>
    );
  }
  if (estado === "erro" || !dados) {
    return (
      <p className="lacuna mt-3 text-sm" aria-live="polite">
        Não foi possível carregar os votos. Tente de novo.{" "}
        <button type="button" className="botao mt-2" onClick={() => setEstado("inicial")}>
          Tentar de novo
        </button>
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-6">
      <p>
        Votos como registrados pelo Congresso Nacional{dados.sessao ? ` (${dados.sessao})` : ""}, em ordem alfabética. A sigla do
        partido aparece como na fonte. O nome leva ao perfil do parlamentar só quando nome e estado coincidem com um único
        parlamentar da lista oficial atual da casa.
      </p>
      {CASAS.map((casa, c) => {
        const linhas = dados.v
          .filter((l) => l[0] === c)
          .map((l, i) => ({
            id: `${c}-${i}`,
            nome: l[1],
            partido: l[2],
            uf: l[3],
            voto: l[4],
            href: l[5] ? rotaParlamentar(casa, l[5]) : null,
          }));
        if (!linhas.length) return null;
        return (
          <section key={casa} aria-label={`Votos — ${CASA_NOME[casa]}`}>
            <h5 className="font-semibold text-foreground">
              {CASA_NOME[casa]} ({linhas.length.toLocaleString("pt-BR")} registros)
            </h5>
            <div className="mt-2">
              <TabelaFiltravel
                legenda={`Votos — ${CASA_NOME[casa]} — ${rotulo}`}
                chave="id"
                linhas={linhas}
                colunas={[
                  { chave: "nome", rotulo: casa === "camara" ? "Deputado" : "Senador", principal: true, link: "href" },
                  { chave: "partido", rotulo: "Partido na fonte" },
                  { chave: "uf", rotulo: "Estado (UF)" },
                  { chave: "voto", rotulo: "Voto registrado" },
                ]}
                busca={{ chaves: ["nome"], rotulo: "Buscar pelo nome", dica: "Ex.: Silva" }}
                filtros={[
                  { chave: "voto", rotulo: "Voto registrado", ordem: ORDEM_VOTO },
                  { chave: "uf", rotulo: "Estado (UF)" },
                  { chave: "partido", rotulo: "Partido na fonte" },
                ]}
                itens={{ singular: "voto", plural: "votos" }}
                porPagina={30}
              />
            </div>
          </section>
        );
      })}
      {dados.fonte?.url ? (
        <p>
          <a href={dados.fonte.url} className="lk inline-flex min-h-11 items-center text-sm" target="_blank" rel="noopener noreferrer">
            <span className="tag-fonte mr-1.5">Oficial</span> Votos deste dispositivo (Congresso Nacional)
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          {dados.fonte.acessado_em ? <span className="meta block">coletado em {dados.fonte.acessado_em.split("-").reverse().join("/")}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
