import Link from "next/link";
import { SeloFonte } from "@/components/decisao";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Secao } from "@/components/Secao";
import { Migalhas } from "@/features/executivo/componentes/Migalhas";
import type { AssembleiaIndisponivel } from "../tipos";
import { baseUf, type UfInfo } from "../ufs";

/**
 * UF acompanhada só pelos atos do governador (ex.: GO): a Assembleia não é coletada pelo motivo gravado
 * pelo coletor (meta.json → assembleia_indisponivel). O texto do motivo vem do coletor, com a fonte.
 */
export function AvisoAssembleia({ u, aviso, id = "assembleia-indisponivel" }: { u: UfInfo; aviso: AssembleiaIndisponivel; id?: string }) {
  return (
    <Secao id={id} titulo="Assembleia Legislativa: em breve">
      <div className="cartao space-y-3">
        <p className="font-semibold text-foreground">
          Deputados, projetos e votações da {u.casa.nome} ainda não estão disponíveis aqui.
        </p>
        <p>{aviso.motivo}</p>
        {aviso.pedido_lai ? <p>{aviso.pedido_lai}</p> : null}
        {aviso.fonte?.url ? <SeloFonte fonte={{ ...aviso.fonte, orgao: aviso.fonte.orgao ?? u.casa.sigla }} /> : null}
      </div>
    </Secao>
  );
}

/** Página de deputados, projetos ou votações de uma UF sem coleta da Assembleia. */
export function PaginaAssembleiaIndisponivel({ u, aviso, titulo }: { u: UfInfo; aviso: AssembleiaIndisponivel; titulo: string }) {
  const base = baseUf(u.uf);
  return (
    <div className="space-y-8">
      <Migalhas
        itens={[
          { href: "/estados", rotulo: "Estados" },
          { href: base, rotulo: u.nome },
        ]}
      />
      <header className="max-w-3xl">
        <Figurinha nome="mapa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{titulo}</h1>
        <p className="text-lg font-semibold text-foreground">Em breve.</p>
      </header>
      <AvisoAssembleia u={u} aviso={aviso} />
      <p>
        <Link href={`${base}/leis-e-decretos`} className="botao">
          Ver as leis, decretos e vetos do governador
        </Link>
      </p>
    </div>
  );
}
