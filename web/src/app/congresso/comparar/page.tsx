import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { getIndice } from "@/features/congresso/dados";
import { Comparador, type ParlamentarComparar } from "@/features/congresso/componentes/Comparador";
import { ANO_RESUMO, resumoGastos, resumoPresenca } from "@/features/congresso/resumo-parlamentar";
import { CASAS, CASA_NOME, formatarData } from "@/features/congresso/rotulos";
import type { Casa } from "@/features/congresso/tipos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = metadadosCompartilhamento({
  titulo: "Comparar parlamentares lado a lado",
  descricao: "De 2 a 5 deputados ou senadores lado a lado: partido, estado, presença, cota parlamentar e votos nas mesmas votações nominais, com fonte oficial. Sem nota nem ranking.",
  caminho: "/congresso/comparar",
});

function parlamentares(casa: Casa): ParlamentarComparar[] {
  return getIndice(casa).parlamentares.map((p) => {
    const pres = resumoPresenca(casa, p.id);
    const g = resumoGastos(casa, p.id);
    return {
      id: p.id,
      nome: p.nome,
      partido: p.partido ?? null,
      uf: p.uf ?? null,
      lista: p.na_lista_atual,
      presenca: pres.valor,
      presencaUrl: pres.fonte?.url ?? null,
      gastos: g.valor,
      gastosUrl: g.fonte?.url ?? null,
    };
  });
}

export default function CompararPage() {
  const dados = Object.fromEntries(CASAS.map((c) => [c, parlamentares(c)])) as Record<Casa, ParlamentarComparar[]>;
  const coleta = Object.fromEntries(CASAS.map((c) => [c, formatarData(getIndice(c).atualizado_em)])) as Record<Casa, string>;
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/congresso" className="lk inline-flex min-h-11 items-center">
            Congresso
          </Link>
        </nav>
        <Figurinha nome="pessoas" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-1 text-2xl font-bold text-foreground md:text-3xl">Comparar parlamentares</h1>
        <p className="mt-3 leading-relaxed">
          Escolha de 2 a 5 parlamentares da mesma casa para ver lado a lado os dados oficiais: partido, estado, presença em
          Plenário (só a Câmara publica por sessão) e cota parlamentar em {ANO_RESUMO}, quantas votações nominais têm voto registrado e
          em quais delas votaram igual ou diferente. Não há nota, índice nem ranking. A escolha fica só no endereço da página
          (que pode ser copiado e compartilhado); nada é guardado.
        </p>
        <p className="meta mt-2">
          Dados coletados em {CASAS.map((c) => `${coleta[c]} (${CASA_NOME[c]})`).join(" e ")}.
        </p>
      </header>
      <Suspense fallback={<p className="text-[var(--cor-secundaria)]">Carregando o comparador…</p>}>
        <Comparador dados={dados} coleta={coleta} />
      </Suspense>
    </div>
  );
}
