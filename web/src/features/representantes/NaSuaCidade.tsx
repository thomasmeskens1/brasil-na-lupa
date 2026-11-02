"use client";

/**
 * "Na sua cidade": lê ?cidade= da URL e baixa public/quem-me-representa/m/<uf>/<cidade>.json
 * (um arquivo pequeno por município, gerado no build — sem uma página por município).
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FonteLink } from "@/components/FonteLink";
import { EM_EXERCICIO } from "./cargos";
import { GrupoCargo, agrupar } from "./Eleitos";
import type { ArquivoMunicipio } from "./tipos";

const CARGOS_MUNICIPIO = ["Prefeito", "Vice-prefeito", "Vereador"];

type Estado = { slug: string; dados: ArquivoMunicipio | null; erro: boolean };

function dataBr(v: string | null | undefined) {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "data não informada";
}

export function NaSuaCidade({ uf, nomeUf }: { uf: string; nomeUf: string }) {
  const cidade = (useSearchParams().get("cidade") ?? "").toLowerCase();
  const valida = /^[a-z0-9-]{1,90}$/.test(cidade) ? cidade : "";
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    if (!valida) return;
    let vivo = true;
    fetch(`/quem-me-representa/m/${uf}/${valida}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ArquivoMunicipio>) : null))
      .then((d) => vivo && setEstado({ slug: valida, dados: d, erro: !d }))
      .catch(() => vivo && setEstado({ slug: valida, dados: null, erro: true }));
    return () => {
      vivo = false;
    };
  }, [uf, valida]);

  if (uf === "df") {
    return (
      <p className="aviso">
        O Distrito Federal não se divide em municípios (Constituição, art. 32): não há prefeito nem vereadores. As funções
        locais ficam com o governador e a Câmara Legislativa, abaixo.
      </p>
    );
  }
  if (!valida) {
    return <p className="lacuna">Escolha sua cidade no campo acima para ver o prefeito, o vice-prefeito e os vereadores eleitos.</p>;
  }
  const atual = estado && estado.slug === valida ? estado : null;
  if (!atual) return <p aria-live="polite">Carregando os eleitos do município…</p>;
  if (atual.erro || !atual.dados) {
    return <p className="lacuna">Município não encontrado em {nomeUf}. Confira o nome no campo acima.</p>;
  }
  const d = atual.dados;
  const grupos = agrupar(d.itens, CARGOS_MUNICIPIO, CARGOS_MUNICIPIO);
  return (
    <div aria-live="polite" className="space-y-4">
      <p className="text-lg font-semibold">
        {d.nome} ({d.uf}) · eleitos em {d.ano}
      </p>
      {d.itens.length === 0 ? (
        <p className="lacuna">
          Informação não disponível em fonte oficial: o arquivo do TSE não registra eleitos válidos neste município na eleição de
          2024 (sem eleição suplementar publicada com eleitos).
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4">
        {grupos.map(([c, l]) => (
          <GrupoCargo key={c} cargo={c} pessoas={l} />
        ))}
      </div>
      {uf === "sp" && valida === "atibaia" ? (
        <p>
          <Link href={EM_EXERCICIO.atibaia.href} className="lk inline-flex min-h-11 items-center">
            {EM_EXERCICIO.atibaia.rotulo}
          </Link>
        </p>
      ) : null}
      <ul className="space-y-1">
        {d.fontes.map((f) => (
          <li key={f.url}>
            <FonteLink href={f.url} tipo="oficial">
              {f.titulo ?? f.orgao ?? "Fonte oficial"}
            </FonteLink>
            <span className="meta"> · coletado em {dataBr(f.acessado_em ?? d.atualizado_em)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
