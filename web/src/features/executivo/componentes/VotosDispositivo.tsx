"use client";

import { useState } from "react";
import { TabelaRegistros, type LinhaRegistro } from "@/features/congresso/componentes/TabelaRegistros";
import { CASA_NOME } from "@/features/congresso/rotulos";
import type { Casa } from "@/features/congresso/tipos";
import type { VotosDispositivoArquivo } from "../tipos";

const CASAS: Casa[] = ["camara", "senado"];

/**
 * Votos nominais de um dispositivo de veto, baixados só quando o leitor abre a lista
 * (public/executivo/vetos/votos/<codigo>.json). Votos aparecem exatamente como registrados.
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

  return (
    <details className="mt-3 rounded border border-borda" onToggle={(e) => (e.currentTarget.open ? carregar() : null)}>
      <summary className="px-3 py-2 text-sm">Ver os votos de cada parlamentar ({rotulo})</summary>
      <div className="border-t border-borda p-3">
        {estado === "carregando" || estado === "inicial" ? (
          <p className="meta" aria-live="polite">
            Carregando os votos…
          </p>
        ) : estado === "erro" || !dados ? (
          <p className="lacuna text-sm">Não foi possível carregar os votos. Tente recarregar a página.</p>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-gray-800">
              Votos como registrados pelo Congresso Nacional. A sigla do partido aparece abreviada como na fonte (ex.:
              &quot;Republican&quot;). O nome leva ao perfil do parlamentar só quando nome e estado coincidem com um único
              parlamentar da lista oficial atual da casa; nos demais casos, o nome aparece sem link.
            </p>
            {CASAS.map((casa, c) => {
              const linhas: LinhaRegistro[] = dados.v
                .filter((l) => l[0] === c)
                .map((l) => ({ nome: l[1], partido: l[2], uf: l[3], valor: l[4], pid: l[5] }));
              if (!linhas.length) return null;
              return (
                <section key={casa} aria-label={`Votos — ${CASA_NOME[casa]}`}>
                  <h5 className="text-sm font-semibold text-gray-900">
                    {CASA_NOME[casa]} ({linhas.length} registros)
                  </h5>
                  <div className="mt-2">
                    <TabelaRegistros casa={casa} linhas={linhas} legenda={`Votos — ${CASA_NOME[casa]} — ${rotulo}`} />
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
