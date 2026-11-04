"use client";

import { useEffect, useState } from "react";
import { partesNecessarias, type ParteCatalogo } from "../acompanhamento";

const cache = new Map<string, Promise<ParteCatalogo | null>>();

function parte(nome: string): Promise<ParteCatalogo | null> {
  let p = cache.get(nome);
  if (!p) {
    p = fetch(`/api/conta/catalogo/${encodeURIComponent(nome)}`)
      .then((r) => (r.ok ? (r.json() as Promise<ParteCatalogo>) : null))
      .catch(() => null);
    cache.set(nome, p);
  }
  return p;
}

/**
 * Baixa só as partes do catálogo público necessárias para estes ids (títulos, datas e
 * atualizações). `pronto` fica false enquanto carrega.
 */
export function useCatalogo(ids: string[]): { partes: Record<string, ParteCatalogo | null>; pronto: boolean } {
  const chave = partesNecessarias(ids).join(",");
  const [estado, setEstado] = useState<{ chave: string; partes: Record<string, ParteCatalogo | null> } | null>(null);

  useEffect(() => {
    let vivo = true;
    const nomes = chave ? chave.split(",") : [];
    void Promise.all(nomes.map(async (n) => [n, await parte(n)] as const)).then((l) => {
      if (vivo) setEstado({ chave, partes: Object.fromEntries(l) });
    });
    return () => {
      vivo = false;
    };
  }, [chave]);

  const pronto = estado?.chave === chave;
  return { partes: pronto ? estado.partes : (estado?.partes ?? {}), pronto };
}
